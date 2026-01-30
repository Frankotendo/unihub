
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { createClient, Session, User } from '@supabase/supabase-js';

// --- SUPABASE CLIENT ---
const SUPABASE_URL = "https://kzjgihwxiaeqzopeuzhm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- TYPES & INTERFACES ---

type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed'; 
type PortalMode = 'passenger' | 'driver' | 'admin';

interface Passenger {
  id: string;
  name: string;
  phone: string;
}

interface RideNode {
  id: string;
  destination: string;
  origin: string;
  capacityNeeded: number;
  passengers: Passenger[];
  status: NodeStatus;
  leaderName: string;
  leaderPhone: string;
  farePerPerson: number;
  createdAt: string;
  assignedDriverId?: string;
}

interface Driver {
  id: string;
  name: string;
  vehicleType: VehicleType;
  licensePlate: string;
  contact: string;
  walletBalance: number; 
  rating: number;
  status: 'online' | 'busy' | 'offline';
  pin: string; 
  photoUrl?: string; 
}

interface RegistrationRequest {
  id: string;
  name: string;
  vehicleType: VehicleType;
  licensePlate: string;
  contact: string;
  pin: string;
  amount: number;
  momoReference: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
  photoUrl?: string; 
}

interface AppSettings {
  id: number;
  adminMomo: string;
  adminMomoName: string;
  whatsappNumber: string;
  commissionPerSeat: number;
  adminSecret: string;
  farePerPragia: number;
  farePerTaxi: number;
  soloMultiplier: number;
  registrationFee: number;
}

// --- UTILS ---

const compressImage = (file: File, quality = 0.6, maxWidth = 600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality)); 
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

// --- AUTH GATEKEEPER ---

const AuthPortal: React.FC<{ onSession: (s: Session | null) => void }> = ({ onSession }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      if (isSigningUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Account created! Check email to verify.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSession(data.session);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#020617] flex items-center justify-center p-6 z-[300] overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md glass p-10 rounded-[3rem] border border-white/10 space-y-8 animate-in zoom-in shadow-2xl relative z-10">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center text-[#020617] text-3xl shadow-2xl mx-auto ring-4 ring-amber-500/20">
            <i className={`fas ${loading ? 'fa-circle-notch fa-spin' : 'fa-shield-halved'}`}></i>
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white">Hub Terminal</h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Secure Logistics Access</p>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2 text-center">
            <p className="text-[10px] font-black text-rose-500 uppercase">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <input 
            type="email" placeholder="Account ID (Email)" 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 text-white font-bold"
            value={email} onChange={e => setEmail(e.target.value)} required
          />
          <input 
            type="password" placeholder="Encryption Key (Password)" 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 text-white font-bold"
            value={password} onChange={e => setPassword(e.target.value)} required
          />
          <button 
            type="submit" disabled={loading}
            className="w-full py-5 bg-amber-500 text-[#020617] rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl disabled:opacity-50"
          >
            {loading ? 'Decrypting...' : (isSigningUp ? 'Join Hub' : 'Authorize')}
          </button>
        </form>

        <button 
          onClick={() => setIsSigningUp(!isSigningUp)} 
          className="w-full text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors text-center"
        >
          {isSigningUp ? 'Return to Login' : 'Create Secure Identity'}
        </button>
      </div>
    </div>
  );
};

// --- VAULT ACCESS MODAL ---

const VaultAuthModal: React.FC<{ isOpen: boolean, onAuth: (secret: string) => Promise<void>, onClose: () => void }> = ({ isOpen, onAuth, onClose }) => {
  const [secret, setSecret] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleVerify = async () => {
    setIsVerifying(true);
    await onAuth(secret);
    setIsVerifying(false);
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[500] flex items-center justify-center p-6 animate-in fade-in">
      <div className="w-full max-w-sm glass p-10 rounded-[3.5rem] border border-amber-500/20 space-y-8 animate-in zoom-in text-center">
        <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] flex items-center justify-center text-amber-500 text-3xl shadow-2xl mx-auto border border-amber-500/20">
          <i className={`fas ${isVerifying ? 'fa-circle-notch fa-spin' : 'fa-vault'}`}></i>
        </div>
        <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter leading-none">Command Vault</h2>
        <input 
          type="password" placeholder="SEC-KEY-••••" 
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center text-lg font-black tracking-widest text-white outline-none focus:border-amber-500 transition-all"
          value={secret} onChange={e => setSecret(e.target.value)} autoFocus
        />
        <div className="flex gap-4">
           <button onClick={onClose} className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase text-slate-500">Abort</button>
           <button onClick={handleVerify} disabled={isVerifying} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-2xl text-[10px] font-black uppercase shadow-xl">Unlock</button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'onboarding' | 'fleet' | 'settings'>('monitor');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => sessionStorage.getItem('unihub_admin_auth_v12') === 'true');
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => sessionStorage.getItem('unihub_driver_session_v12'));
  const [showVaultModal, setShowVaultModal] = useState(false);

  const [isSyncing, setIsSyncing] = useState(true);
  const [settings, setSettings] = useState<AppSettings>({
    id: 1, adminMomo: "024-000-0000", adminMomoName: "Hub Logistics", whatsappNumber: "233000000000",
    commissionPerSeat: 2.00, farePerPragia: 5.00, farePerTaxi: 8.00, soloMultiplier: 2.5,
    registrationFee: 20.00, adminSecret: ""
  });
  
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('access') === 'vault' && !isAdminAuthenticated) {
      setShowVaultModal(true);
    }
  }, [isAdminAuthenticated]);

  const fetchData = async () => {
    setIsSyncing(true);
    try {
      const [s, n, d, reg] = await Promise.all([
        supabase.from('unihub_settings').select('*').single(),
        supabase.from('unihub_nodes').select('*').order('createdAt', { ascending: false }),
        supabase.from('unihub_drivers').select('*'),
        supabase.from('unihub_registrations').select('*').order('timestamp', { ascending: false })
      ]);
      if (s.data) setSettings(s.data);
      if (n.data) setNodes(n.data);
      if (d.data) setDrivers(d.data);
      if (reg.data) setRegistrationRequests(reg.data);
    } catch (err) {} finally { setIsSyncing(false); }
  };

  useEffect(() => { if (session) fetchData(); }, [session]);

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  const stats = useMemo(() => ({
    missionsCompleted: nodes.filter(n => n.status === 'completed').length,
    unitsActive: drivers.filter(d => d.status === 'online').length,
    communitySavings: nodes.filter(n => n.status === 'completed').length * 5, 
    co2Saved: (nodes.filter(n => n.status === 'completed').length * 0.8).toFixed(1) 
  }), [nodes, drivers]);

  const pendingRegCount = useMemo(() => registrationRequests.filter(r => r.status === 'pending').length, [registrationRequests]);

  const handleAdminAuth = async (secret: string) => {
    const { data } = await supabase.rpc('verify_admin_secret', { candidate_secret: secret });
    if (data === true) {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('unihub_admin_auth_v12', 'true');
      setShowVaultModal(false);
      setViewMode('admin');
      const url = new URL(window.location.href);
      url.searchParams.delete('access');
      window.history.replaceState({}, '', url.toString());
    } else {
      alert("Unauthorized Access.");
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    const { error } = await supabase.from('unihub_settings').update(newSettings).eq('id', settings.id);
    if (error) alert(error.message); else fetchData();
  };

  const handleTopup = async (driverId: string, amount: number) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;
    const { error } = await supabase.from('unihub_drivers').update({ walletBalance: driver.walletBalance + amount }).eq('id', driverId);
    if (error) alert(error.message); else { fetchData(); alert("Credit Released."); }
  };

  if (!session) return <AuthPortal onSession={setSession} />;

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative">
      <VaultAuthModal isOpen={showVaultModal} onAuth={handleAdminAuth} onClose={() => setShowVaultModal(false)} />

      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-amber-500/10">
            <i className="fas fa-globe text-[#020617] text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white">Hub Global</h1>
            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Operational Pulse</p>
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-people-group" label="Commuter Hub" onClick={() => setViewMode('passenger')} />
          <NavItem active={viewMode === 'driver'} icon="fa-truck-fast" label="Driver Terminal" onClick={() => setViewMode('driver')} />
          {isAdminAuthenticated && (
            <NavItem active={viewMode === 'admin'} icon="fa-fingerprint" label="Admin Command" onClick={() => setViewMode('admin')} badge={pendingRegCount} />
          )}
          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center px-6 py-5 rounded-2xl text-slate-500 hover:text-rose-500 transition-colors mt-10 hover:bg-rose-500/5">
            <i className="fas fa-power-off text-lg mr-4"></i>
            <span className="text-sm font-black uppercase tracking-widest">Logout</span>
          </button>
        </div>

        <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-3">
            <ImpactStat label="Missions" value={stats.missionsCompleted} icon="fa-check-double" color="text-emerald-400" />
            <ImpactStat label="Units" value={stats.unitsActive} icon="fa-car-side" color="text-amber-400" />
            <ImpactStat label="Savings" value={`₵${stats.communitySavings}`} icon="fa-leaf" color="text-indigo-400" />
            <ImpactStat label="CO2 Save" value={`${stats.co2Saved}kg`} icon="fa-cloud-sun" color="text-sky-400" />
        </div>
      </nav>

      {/* Mobile Nav */}
      <div className="lg:hidden flex justify-around p-4 glass border-b border-white/5 z-50">
          <button onClick={() => setViewMode('passenger')} className={`p-4 rounded-2xl ${viewMode === 'passenger' ? 'text-amber-500' : 'text-slate-500'}`}><i className="fas fa-people-group"></i></button>
          <button onClick={() => setViewMode('driver')} className={`p-4 rounded-2xl ${viewMode === 'driver' ? 'text-amber-500' : 'text-slate-500'}`}><i className="fas fa-truck-fast"></i></button>
          {isAdminAuthenticated && <button onClick={() => setViewMode('admin')} className={`p-4 rounded-2xl ${viewMode === 'admin' ? 'text-amber-500' : 'text-slate-500'}`}><i className="fas fa-fingerprint"></i></button>}
      </div>

      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar z-10 relative">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="relative group">
            <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-700"></i>
            <input 
              type="text" placeholder="Search routes, fleets, or missions..." 
              className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all shadow-inner placeholder:text-slate-700"
              value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </div>

          {viewMode === 'passenger' && <PassengerPortal nodes={nodes} drivers={drivers} search={globalSearch} />}
          
          {viewMode === 'driver' && (
            <DriverPortal 
              drivers={drivers} activeDriver={activeDriver}
              onLogin={(id, pin) => {
                const d = drivers.find(drv => drv.id === id);
                if (d && d.pin === pin) { setActiveDriverId(id); sessionStorage.setItem('unihub_driver_session_v12', id); }
                else alert("Access Denied.");
              }}
              onLogout={() => { setActiveDriverId(null); sessionStorage.removeItem('unihub_driver_session_v12'); }}
              nodes={nodes}
              onRequestRegistration={async (reg) => {
                await supabase.from('unihub_registrations').insert([reg]);
                alert("Application pending verification.");
              }}
            />
          )}

          {viewMode === 'admin' && (
            <AdminPortal 
              activeTab={activeTab} setActiveTab={setActiveTab} 
              registrationRequests={registrationRequests}
              drivers={drivers} nodes={nodes} settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onTopup={handleTopup}
              onApprove={async (reg) => {
                 const newDriver = {
                   id: `DRV-${Date.now()}`, name: reg.name, vehicleType: reg.vehicleType,
                   licensePlate: reg.licensePlate, contact: reg.contact, walletBalance: 0,
                   rating: 5, status: 'offline', pin: reg.pin, photoUrl: reg.photoUrl
                 };
                 await Promise.all([
                   supabase.from('unihub_drivers').insert([newDriver]),
                   supabase.from('unihub_registrations').update({ status: 'approved' }).eq('id', reg.id)
                 ]);
                 fetchData();
                 alert("ID Verified and Driver Deployed.");
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const ImpactStat = ({ label, value, icon, color }: any) => (
  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 relative overflow-hidden group">
    <i className={`fas ${icon} ${color} absolute top-2 right-2 text-[8px] opacity-20`}></i>
    <p className="text-[7px] font-black uppercase text-slate-500 leading-none">{label}</p>
    <p className="text-xs font-black text-white italic mt-1">{value}</p>
  </div>
);

const DriverPortal = ({ drivers, activeDriver, onLogin, onLogout, onRequestRegistration }: any) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [showReg, setShowReg] = useState(false);
  const [regData, setRegData] = useState<any>({ name: '', vehicleType: 'Pragia', photoUrl: '', licensePlate: '', pin: '', contact: '', momoReference: '' });

  if (!activeDriver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-in fade-in">
        <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">Driver Identity Terminal</h2>
        {selectedId ? (
          <div className="w-full max-w-sm glass p-10 rounded-[3rem] text-center space-y-8 animate-in zoom-in border border-indigo-500/20">
            <p className="text-xs font-black uppercase text-slate-400">Identity PIN Required</p>
            <input 
              type="password" maxLength={4} 
              className="w-full bg-white/5 border-b-2 border-indigo-500 text-center text-5xl tracking-[1em] font-black text-white outline-none pb-4" 
              value={pin} onChange={e => setPin(e.target.value)} autoFocus
            />
            <button onClick={() => onLogin(selectedId, pin)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">Authenticate</button>
            <button onClick={() => setSelectedId(null)} className="text-[10px] font-black uppercase text-slate-500">Back</button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full px-4">
               {drivers.map((d: any) => (
                 <button key={d.id} onClick={() => setSelectedId(d.id)} className="glass p-8 rounded-[2.5rem] border border-white/5 text-left hover:border-amber-500/50 transition-all flex items-center gap-4 hover:bg-white/5">
                    <img src={d.photoUrl} className="w-12 h-12 rounded-full border border-white/10 object-cover" />
                    <div><p className="font-black text-white italic uppercase">{d.name}</p><p className="text-[8px] font-black text-slate-500 uppercase mt-1">WALLET: ₵{d.walletBalance.toFixed(1)}</p></div>
                 </button>
               ))}
             </div>
             <button onClick={() => setShowReg(true)} className="px-16 py-5 bg-amber-500 text-[#020617] rounded-3xl font-black text-xs uppercase shadow-2xl tracking-widest">Enroll in Fleet</button>
          </div>
        )}
        {showReg && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
            <div className="glass-bright w-full max-w-md rounded-[3rem] p-10 space-y-8 animate-in zoom-in">
              <h3 className="text-2xl font-black italic uppercase text-white text-center">Biometric & Identity Enrollment</h3>
              <div className="flex flex-col items-center gap-4">
                 <label className="w-40 h-40 rounded-[2.5rem] bg-white/5 border-2 border-dashed border-indigo-500/30 flex items-center justify-center cursor-pointer overflow-hidden relative">
                    {regData.photoUrl ? <img src={regData.photoUrl} className="w-full h-full object-cover" /> : <i className="fas fa-camera text-indigo-500 text-3xl"></i>}
                    <input type="file" accept="image/*" capture="user" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) setRegData({...regData, photoUrl: await compressImage(file)});
                    }} />
                 </label>
                 <p className="text-[8px] font-black uppercase text-slate-500">Capture Live Identity Selfie</p>
              </div>
              <div className="space-y-4">
                <AdminInput label="Name" value={regData.name} onChange={v => setRegData({...regData, name: v})} />
                <div className="grid grid-cols-2 gap-4">
                  <AdminInput label="Plate" value={regData.licensePlate} onChange={v => setRegData({...regData, licensePlate: v})} />
                  <AdminInput label="PIN" value={regData.pin} onChange={v => setRegData({...regData, pin: v})} type="password" />
                </div>
                <AdminInput label="Momo Ref" value={regData.momoReference} onChange={v => setRegData({...regData, momoReference: v})} />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setShowReg(false)} className="flex-1 py-5 bg-white/5 rounded-2xl text-[10px] font-black uppercase text-slate-500">Cancel</button>
                <button onClick={() => { onRequestRegistration({...regData, id: `REG-${Date.now()}`, status: 'pending', timestamp: new Date().toLocaleString()}); setShowReg(false); }} className="flex-1 py-5 bg-amber-500 text-[#020617] rounded-2xl text-[10px] font-black uppercase">Apply</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-12">
      <div className="flex justify-between items-center p-10 glass rounded-[3.5rem] border border-white/5 shadow-2xl">
        <div className="flex items-center gap-8">
          <div className="w-24 h-24 rounded-[2.5rem] overflow-hidden border-2 border-indigo-500/30">
            <img src={activeDriver.photoUrl} className="w-full h-full object-cover" alt="Identity" />
          </div>
          <div>
            <h2 className="text-3xl font-black uppercase italic text-white leading-none tracking-tighter">{activeDriver.name}</h2>
            <p className="text-[10px] font-black text-emerald-400 uppercase mt-3 tracking-[0.2em] animate-pulse">Session Active</p>
          </div>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Global Wallet</p>
           <p className="text-4xl font-black text-white italic tracking-tighter">₵ {activeDriver.walletBalance.toFixed(2)}</p>
        </div>
      </div>
      <button onClick={onLogout} className="w-full py-5 bg-rose-500/10 text-rose-500 rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] border border-rose-500/20">Sign Out of Terminal</button>
    </div>
  );
};

const PassengerPortal = ({ nodes, search }: any) => {
  const filteredNodes = nodes.filter((n: any) => 
    n.status !== 'completed' && 
    (n.origin.toLowerCase().includes(search.toLowerCase()) || n.destination.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-in fade-in">
       <div className="flex justify-between items-center">
          <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter leading-none">Commuter Terminal</h2>
          <button className="px-10 py-5 bg-amber-500 text-[#020617] rounded-3xl font-black uppercase text-[10px] shadow-xl tracking-widest">Form Node</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-1">
          {filteredNodes.map((node: any) => (
              <div key={node.id} className="glass p-10 rounded-[3rem] border border-white/5 space-y-8 group hover:border-amber-500/30 transition-all">
                 <div className="flex justify-between items-start">
                    <span className="px-5 py-2 bg-indigo-600/20 text-indigo-400 rounded-2xl text-[8px] font-black uppercase tracking-widest">{node.status}</span>
                    <p className="text-xl font-black text-emerald-400 italic">₵{node.farePerPerson}/p</p>
                 </div>
                 <p className="text-2xl font-black text-white uppercase italic leading-tight group-hover:text-amber-500 transition-colors">{node.origin} → {node.destination}</p>
                 <div className="flex gap-2">
                    {Array.from({length: node.capacityNeeded}).map((_, i) => (
                      <div key={i} className={`w-3 h-3 rounded-full ${i < node.passengers.length ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-white/5'}`}></div>
                    ))}
                 </div>
              </div>
          ))}
       </div>
    </div>
  );
};

const AdminPortal = ({ activeTab, setActiveTab, registrationRequests, onApprove, drivers, settings, onUpdateSettings, onTopup, nodes }: any) => {
  return (
    <div className="space-y-10 animate-in fade-in">
       <div className="flex bg-white/5 p-2 rounded-3xl border border-white/10 w-fit shadow-inner">
          <TabBtn active={activeTab === 'monitor'} label="Metrics" onClick={() => setActiveTab('monitor')} />
          <TabBtn active={activeTab === 'fleet'} label="Fleet" onClick={() => setActiveTab('fleet')} />
          <TabBtn active={activeTab === 'onboarding'} label="Applications" onClick={() => setActiveTab('onboarding')} count={registrationRequests.filter((r:any)=>r.status==='pending').length} />
          <TabBtn active={activeTab === 'settings'} label="Setup" onClick={() => setActiveTab('settings')} />
       </div>
       
       {activeTab === 'settings' && (
         <div className="glass p-12 rounded-[4rem] border border-white/5 space-y-12">
            <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter">Hub Global Controller</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
               <div className="space-y-8">
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">Economics</h4>
                  <AdminInput label="Commission (₵)" value={settings.commissionPerSeat} onChange={v => onUpdateSettings({commissionPerSeat: parseFloat(v)})} />
                  <AdminInput label="Hub Entry Fee (₵)" value={settings.registrationFee} onChange={v => onUpdateSettings({registrationFee: parseFloat(v)})} />
                  <AdminInput label="Pragia Rate (₵)" value={settings.farePerPragia} onChange={v => onUpdateSettings({farePerPragia: parseFloat(v)})} />
               </div>
               <div className="space-y-8">
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">Security & Contact</h4>
                  <AdminInput label="Admin Momo" value={settings.adminMomo} onChange={v => onUpdateSettings({adminMomo: v})} />
                  <AdminInput label="Admin Identity" value={settings.adminMomoName} onChange={v => onUpdateSettings({adminMomoName: v})} />
                  <AdminInput label="Vault Secret Key" value={settings.adminSecret} type="password" onChange={v => onUpdateSettings({adminSecret: v})} />
               </div>
            </div>
         </div>
       )}

       {activeTab === 'fleet' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in">
            {drivers.map((d: any) => (
              <div key={d.id} className="glass p-10 rounded-[3.5rem] border border-white/5 space-y-8">
                 <div className="flex items-center gap-5">
                    <img src={d.photoUrl} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/5" />
                    <div><h4 className="text-lg font-black uppercase italic text-white leading-none">{d.name}</h4><p className="text-[9px] text-slate-500 font-black mt-2">{d.licensePlate}</p></div>
                 </div>
                 <div className="bg-white/5 p-6 rounded-2xl text-center"><p className="text-[9px] font-black text-slate-500 uppercase">Wallet Credit</p><p className="text-3xl font-black italic text-white tracking-tighter">₵ {d.walletBalance.toFixed(2)}</p></div>
                 <div className="flex gap-2">
                    <button onClick={() => onTopup(d.id, 10)} className="flex-1 py-4 bg-emerald-600/20 text-emerald-400 rounded-2xl text-[9px] font-black uppercase border border-emerald-500/20">+₵10</button>
                    <button onClick={() => onTopup(d.id, 50)} className="flex-1 py-4 bg-indigo-600/20 text-indigo-400 rounded-2xl text-[9px] font-black uppercase border border-indigo-500/20">+₵50</button>
                 </div>
              </div>
            ))}
         </div>
       )}

       {activeTab === 'onboarding' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in">
            {registrationRequests.filter((r:any)=>r.status==='pending').map((reg: any) => (
              <div key={reg.id} className="glass p-10 rounded-[3.5rem] border border-indigo-500/30 space-y-8">
                 <div className="text-center space-y-4">
                    <img src={reg.photoUrl} className="w-32 h-32 rounded-full border-4 border-white/10 mx-auto object-cover shadow-2xl" />
                    <h4 className="text-2xl font-black uppercase italic text-white leading-none tracking-tighter">{reg.name}</h4>
                    <p className="text-[9px] text-emerald-400 font-black uppercase">REF: {reg.momoReference}</p>
                 </div>
                 <div className="flex gap-4 pt-4 border-t border-white/5">
                    <button className="flex-1 py-5 bg-white/5 rounded-2xl text-[9px] font-black uppercase text-slate-500">Decline</button>
                    <button onClick={() => onApprove(reg)} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[9px] shadow-xl">Approve ID</button>
                 </div>
              </div>
            ))}
         </div>
       )}

       {activeTab === 'monitor' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="glass p-12 rounded-[4rem] border border-white/5 flex flex-col justify-center text-center space-y-4 shadow-2xl">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">Grid Volume Efficiency</p>
                <p className="text-7xl font-black text-white italic tracking-tighter">₵ {nodes.reduce((acc, n) => acc + (n.status === 'completed' ? n.farePerPerson * n.passengers.length : 0), 0).toFixed(2)}</p>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <ImpactStat label="Fleet Utilization" value="92%" icon="fa-arrow-trend-up" color="text-emerald-400" />
                <ImpactStat label="Live Nodes" value={nodes.filter(n => n.status !== 'completed').length} icon="fa-network-wired" color="text-indigo-400" />
                <ImpactStat label="Hub Latency" value="14ms" icon="fa-bolt" color="text-amber-400" />
                <ImpactStat label="Node Safety" value="99.9%" icon="fa-shield-heart" color="text-rose-400" />
             </div>
          </div>
       )}
    </div>
  );
};

const AdminInput = ({ label, value, onChange, type = "text" }: { label: string, value: any, onChange: (v: string) => void, type?: string }) => (
  <div className="space-y-2 w-full text-left">
     <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-4">{label}</label>
     <input 
       type={type} 
       className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none focus:border-amber-500 shadow-inner" 
       value={value} onChange={e => onChange(e.target.value)} 
     />
  </div>
);

const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-5 rounded-2xl transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-xl scale-[1.03]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
    <div className="flex items-center space-x-4">
      <i className={`fas ${icon} text-lg w-6`}></i>
      <span className="text-sm font-black uppercase tracking-widest leading-none">{label}</span>
    </div>
    {badge !== undefined && badge > 0 && <span className="bg-rose-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full ring-4 ring-[#020617]">{badge}</span>}
  </button>
);

const TabBtn = ({ active, label, onClick, count }: any) => (
  <button onClick={onClick} className={`px-10 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${active ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500'}`}>
    {label} {count !== undefined && count > 0 && <span className="ml-3 bg-rose-500 text-white text-[8px] px-2 py-1 rounded-full">{count}</span>}
  </button>
);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
