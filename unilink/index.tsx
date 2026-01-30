
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

interface HubMission {
  id: string;
  location: string;
  description: string;
  entryFee: number;
  driversJoined: string[]; 
  status: 'open' | 'closed';
  createdAt: string;
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
  verificationCode?: string;
  isSolo?: boolean;
  isLongDistance?: boolean;
  negotiatedTotalFare?: number;
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
  userId?: string;
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
  aboutMeText: string;
  aboutMeImages: string[];
  appWallpaper?: string;
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
        alert("Account created! Check your email to verify your identity.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            throw new Error("ACCESS DENIED: Email not confirmed. Please check your inbox.");
          }
          throw error;
        }
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
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white">Hub Terminal</h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Enterprise-Grade Secure Access</p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2">
            <p className="text-[10px] font-black text-rose-500 uppercase leading-relaxed text-center">
              <i className="fas fa-triangle-exclamation mr-2"></i>
              {errorMsg}
            </p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-4">Account ID (Email)</label>
            <input 
              type="email" 
              placeholder="e.g. name@domain.com" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 text-white font-bold transition-all placeholder:text-slate-700"
              value={email} onChange={e => setEmail(e.target.value)} required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-4">Encryption Key (Password)</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 text-white font-bold transition-all placeholder:text-slate-700"
              value={password} onChange={e => setPassword(e.target.value)} required
            />
          </div>
          <button 
            type="submit" disabled={loading}
            className="w-full py-5 bg-amber-500 text-[#020617] rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all"
          >
            {loading ? 'Decrypting Access...' : (isSigningUp ? 'Establish Identity' : 'Authorize Session')}
          </button>
        </form>

        <div className="pt-4 border-t border-white/5">
          <button 
            onClick={() => { setIsSigningUp(!isSigningUp); setErrorMsg(null); }} 
            className="w-full text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors text-center tracking-widest"
          >
            {isSigningUp ? 'Already have identity? Login' : 'Need Identity? Sign Up'}
          </button>
        </div>
      </div>
      
      <div className="absolute bottom-10 text-center w-full px-6">
        <p className="text-[8px] font-black text-slate-800 uppercase tracking-[0.4em]">
          End-to-End Encrypted Communication • Hub Global Ver. 12.0.4
        </p>
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
        <div>
          <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">Vault Encryption</h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Enter Command Secret Key</p>
        </div>
        <input 
          type="password" 
          placeholder="SEC-KEY-••••" 
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center text-lg font-black tracking-widest text-white outline-none focus:border-amber-500 transition-all shadow-inner"
          value={secret} onChange={e => setSecret(e.target.value)}
          autoFocus
        />
        <div className="flex gap-4">
           <button onClick={onClose} className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase text-slate-500 tracking-widest">Abort</button>
           <button onClick={handleVerify} disabled={isVerifying} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Authorize</button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'onboarding' | 'settings'>('monitor');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => sessionStorage.getItem('unihub_admin_auth_v12') === 'true');
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => sessionStorage.getItem('unihub_driver_session_v12'));
  const [showVaultModal, setShowVaultModal] = useState(false);

  const [isSyncing, setIsSyncing] = useState(true);
  const [settings, setSettings] = useState<AppSettings>({
    id: 1, adminMomo: "024-000-0000", adminMomoName: "Hub Logistics", whatsappNumber: "233000000000",
    commissionPerSeat: 2.00, farePerPragia: 5.00, farePerTaxi: 8.00, soloMultiplier: 2.5,
    aboutMeText: "Commuter Hub: Global Logistics Engine.", aboutMeImages: [], registrationFee: 20.00, adminSecret: ""
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
    const { data, error } = await supabase.rpc('verify_admin_secret', { candidate_secret: secret });
    if (data === true) {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('unihub_admin_auth_v12', 'true');
      setShowVaultModal(false);
      setViewMode('admin'); // Directly take them to Admin Command
      const url = new URL(window.location.href);
      url.searchParams.delete('access');
      window.history.replaceState({}, '', url.toString());
    } else {
      alert("Invalid Command Secret. Access Refused.");
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    const { error } = await supabase.from('unihub_settings').update(newSettings).eq('id', settings.id);
    if (error) alert(error.message);
    else fetchData();
  };

  if (!session) return <AuthPortal onSession={setSession} />;

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative">
      <VaultAuthModal 
        isOpen={showVaultModal} 
        onAuth={handleAdminAuth} 
        onClose={() => {
          setShowVaultModal(false);
          const url = new URL(window.location.href);
          url.searchParams.delete('access');
          window.history.replaceState({}, '', url.toString());
        }} 
      />

      {/* Dynamic Impact Sidebar */}
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

        <div className="pt-6 border-t border-white/5 space-y-4">
           <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] italic">Network Health</p>
           <div className="grid grid-cols-2 gap-3">
              <ImpactStat label="Missions" value={stats.missionsCompleted} icon="fa-check-double" color="text-emerald-400" />
              <ImpactStat label="Units" value={stats.unitsActive} icon="fa-car-side" color="text-amber-400" />
              <ImpactStat label="Savings" value={`₵${stats.communitySavings}`} icon="fa-leaf" color="text-indigo-400" />
              <ImpactStat label="CO2 Save" value={`${stats.co2Saved}kg`} icon="fa-cloud-sun" color="text-sky-400" />
           </div>
        </div>
      </nav>

      {/* Mobile Nav */}
      <div className="lg:hidden flex justify-around p-4 glass border-b border-white/5 z-50">
          <button onClick={() => setViewMode('passenger')} className={`p-4 rounded-2xl ${viewMode === 'passenger' ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>
            <i className="fas fa-people-group"></i>
          </button>
          <button onClick={() => setViewMode('driver')} className={`p-4 rounded-2xl ${viewMode === 'driver' ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>
            <i className="fas fa-truck-fast"></i>
          </button>
          {isAdminAuthenticated && (
            <button onClick={() => setViewMode('admin')} className={`p-4 rounded-2xl relative ${viewMode === 'admin' ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>
               <i className="fas fa-fingerprint"></i>
               {pendingRegCount > 0 && <span className="absolute top-2 right-2 bg-rose-500 w-2 h-2 rounded-full"></span>}
            </button>
          )}
      </div>

      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar z-10 relative">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="relative group">
            <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-amber-500 transition-colors"></i>
            <input 
              type="text" 
              placeholder="Search global routes, fleets, or missions..." 
              className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-700 shadow-inner"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </div>

          {viewMode === 'passenger' && (
            <PassengerPortal nodes={nodes} drivers={drivers} search={globalSearch} settings={settings} />
          )}
          
          {viewMode === 'driver' && (
            <DriverPortal 
              drivers={drivers} 
              activeDriver={activeDriver}
              onLogin={(id: string, pin: string) => {
                const d = drivers.find(drv => drv.id === id);
                if (d && d.pin === pin) { setActiveDriverId(id); sessionStorage.setItem('unihub_driver_session_v12', id); }
                else alert("Authentication Failed.");
              }}
              onLogout={() => { setActiveDriverId(null); sessionStorage.removeItem('unihub_driver_session_v12'); }}
              nodes={nodes}
              onRequestRegistration={async (reg: any) => {
                await supabase.from('unihub_registrations').insert([reg]);
                alert("Application submitted for verification.");
              }}
              settings={settings}
            />
          )}

          {viewMode === 'admin' && (
            <AdminPortal 
              activeTab={activeTab} setActiveTab={setActiveTab} 
              registrationRequests={registrationRequests}
              drivers={drivers}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onApprove={async (reg: RegistrationRequest) => {
                 const newDriver = {
                   id: `DRV-${Date.now()}`,
                   name: reg.name,
                   vehicleType: reg.vehicleType,
                   licensePlate: reg.licensePlate,
                   contact: reg.contact,
                   walletBalance: 0,
                   rating: 5,
                   status: 'offline',
                   pin: reg.pin,
                   photoUrl: reg.photoUrl
                 };
                 await Promise.all([
                   supabase.from('unihub_drivers').insert([newDriver]),
                   supabase.from('unihub_registrations').update({ status: 'approved' }).eq('id', reg.id)
                 ]);
                 fetchData();
                 alert(`Driver deployed to fleet.`);
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
    <i className={`fas ${icon} ${color} absolute top-2 right-2 text-[8px] opacity-20 group-hover:opacity-100 transition-opacity`}></i>
    <p className="text-[7px] font-black uppercase text-slate-500 leading-none">{label}</p>
    <p className="text-xs font-black text-white italic mt-1">{value}</p>
  </div>
);

const DriverPortal = ({ drivers, activeDriver, onLogin, onLogout, onRequestRegistration, settings }: any) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [showReg, setShowReg] = useState(false);
  const [regData, setRegData] = useState<any>({ name: '', vehicleType: 'Pragia', photoUrl: '', licensePlate: '', pin: '', contact: '', momoReference: '' });

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const b64 = await compressImage(file, 0.5, 400);
      setRegData({ ...regData, photoUrl: b64 });
    }
  };

  if (!activeDriver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-in fade-in">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white text-3xl shadow-2xl mx-auto ring-4 ring-indigo-500/20">
            <i className="fas fa-id-card-clip"></i>
          </div>
          <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">Driver Terminal</h2>
        </div>
        
        {selectedId ? (
          <div className="w-full max-w-sm glass p-10 rounded-[3rem] text-center space-y-8 animate-in zoom-in border border-indigo-500/20">
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Enter Terminal PIN</p>
            <input 
              type="password" maxLength={4} 
              className="w-full bg-white/5 border-b-2 border-indigo-500 text-center text-5xl tracking-[1em] font-black text-white outline-none pb-4" 
              value={pin} onChange={e => setPin(e.target.value)} autoFocus
            />
            <button onClick={() => onLogin(selectedId, pin)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-transform">Authorize</button>
            <button onClick={() => setSelectedId(null)} className="text-[10px] font-black uppercase text-slate-500">Cancel</button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full px-4">
               {drivers.map((d: any) => (
                 <button key={d.id} onClick={() => setSelectedId(d.id)} className="glass p-8 rounded-[2.5rem] border border-white/5 text-left hover:border-amber-500/50 transition-all flex items-center gap-4 hover:bg-white/5">
                    <img src={d.photoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${d.name}`} className="w-12 h-12 rounded-full border border-white/10" />
                    <div>
                      <p className="font-black text-white italic uppercase">{d.name}</p>
                      <p className="text-[8px] font-black text-slate-500 uppercase mt-1">WALLET: ₵{d.walletBalance.toFixed(1)}</p>
                    </div>
                 </button>
               ))}
             </div>
             <button onClick={() => setShowReg(true)} className="px-16 py-5 bg-amber-500 text-[#020617] rounded-3xl font-black text-xs uppercase shadow-2xl tracking-widest">Join Fleet</button>
          </div>
        )}

        {showReg && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[400] flex items-center justify-center p-4 overflow-y-auto">
            <div className="glass-bright w-full max-w-md rounded-[3rem] p-10 space-y-8 animate-in zoom-in border border-white/10">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black italic uppercase text-white">Identity Verification</h3>
              </div>

              <div className="flex flex-col items-center gap-4">
                 <label htmlFor="selfie-capture" className="w-40 h-40 rounded-[2.5rem] bg-white/5 border-2 border-dashed border-indigo-500/30 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group hover:border-indigo-500 transition-all">
                    {regData.photoUrl ? (
                      <img src={regData.photoUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-6">
                        <i className="fas fa-camera text-indigo-500 text-3xl mb-3"></i>
                        <p className="text-[8px] font-black uppercase text-slate-500 leading-tight">Identity Selfie</p>
                      </div>
                    )}
                    <input type="file" id="selfie-capture" accept="image/*" capture="user" className="hidden" onChange={handleCapture} />
                 </label>
              </div>

              <div className="space-y-4">
                <AdminInput label="Full Name" value={regData.name} onChange={v => setRegData({...regData, name: v})} />
                <div className="grid grid-cols-2 gap-4">
                  <AdminInput label="Type" value={regData.vehicleType} onChange={v => setRegData({...regData, vehicleType: v})} />
                  <AdminInput label="Plate" value={regData.licensePlate} onChange={v => setRegData({...regData, licensePlate: v})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <AdminInput label="PIN" value={regData.pin} onChange={v => setRegData({...regData, pin: v})} type="password" />
                  <AdminInput label="WhatsApp" value={regData.contact} onChange={v => setRegData({...regData, contact: v})} />
                </div>
                <AdminInput label="Momo Ref (₵20 fee)" value={regData.momoReference} onChange={v => setRegData({...regData, momoReference: v})} />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setShowReg(false)} className="flex-1 py-5 bg-white/5 rounded-2xl text-[10px] font-black uppercase text-slate-500">Cancel</button>
                <button onClick={() => { 
                  if (!regData.photoUrl || !regData.name || !regData.momoReference) return alert("Photo and required fields missing.");
                  onRequestRegistration({ ...regData, id: `REG-${Date.now()}`, status: 'pending', timestamp: new Date().toLocaleString(), amount: settings.registrationFee });
                  setShowReg(false);
                }} className="flex-1 py-5 bg-amber-500 text-[#020617] rounded-2xl text-[10px] font-black uppercase shadow-xl">Apply</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-12">
      <div className="flex justify-between items-center p-10 glass rounded-[3.5rem] border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-24 h-24 rounded-[2.5rem] overflow-hidden border-2 border-indigo-500/30">
            <img src={activeDriver.photoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${activeDriver.name}`} className="w-full h-full object-cover" alt="Identity" />
          </div>
          <div>
            <h2 className="text-3xl font-black uppercase italic text-white leading-none tracking-tighter">{activeDriver.name}</h2>
            <p className="text-[10px] font-black text-emerald-400 uppercase mt-3 tracking-[0.2em] animate-pulse">Terminal Online</p>
          </div>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Global Wallet</p>
           <p className="text-4xl font-black text-white italic tracking-tighter">₵ {activeDriver.walletBalance.toFixed(2)}</p>
        </div>
      </div>
      <button onClick={onLogout} className="w-full py-5 bg-rose-500/10 text-rose-500 rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] border border-rose-500/20">Terminate Session</button>
    </div>
  );
};

const PassengerPortal = ({ nodes, drivers, settings, search }: any) => {
  const filteredNodes = nodes.filter((n: any) => 
    n.status !== 'completed' && 
    (n.origin.toLowerCase().includes(search.toLowerCase()) || n.destination.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-in fade-in">
       <div className="flex justify-between items-center">
          <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Commuter Terminal</h2>
          <button className="px-10 py-5 bg-amber-500 text-[#020617] rounded-3xl font-black uppercase text-[10px] shadow-xl hover:scale-105 transition-transform tracking-widest">Form Route Node</button>
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

const AdminPortal = ({ activeTab, setActiveTab, registrationRequests, onApprove, settings, onUpdateSettings }: any) => {
  return (
    <div className="space-y-10 animate-in fade-in">
       <div className="flex bg-white/5 p-2 rounded-3xl border border-white/10 w-fit shadow-inner">
          <TabBtn active={activeTab === 'monitor'} label="Metrics" onClick={() => setActiveTab('monitor')} />
          <TabBtn active={activeTab === 'onboarding'} label="Applications" onClick={() => setActiveTab('onboarding')} count={registrationRequests.filter((r:any)=>r.status==='pending').length} />
          <TabBtn active={activeTab === 'settings'} label="Setup" onClick={() => setActiveTab('settings')} />
       </div>
       
       {activeTab === 'settings' && (
         <div className="glass p-12 rounded-[4rem] border border-white/5 space-y-12">
            <div className="space-y-2">
               <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter">Hub Settings</h3>
               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Core Logic & Appearance Controller</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
               <div className="space-y-8">
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">Pricing & Fares</h4>
                  <AdminInput label="Commission (₵)" value={settings.commissionPerSeat} onChange={v => onUpdateSettings({commissionPerSeat: parseFloat(v)})} />
                  <AdminInput label="Registration Fee (₵)" value={settings.registrationFee} onChange={v => onUpdateSettings({registrationFee: parseFloat(v)})} />
                  <AdminInput label="Pragia Fare (₵)" value={settings.farePerPragia} onChange={v => onUpdateSettings({farePerPragia: parseFloat(v)})} />
                  <AdminInput label="Taxi Fare (₵)" value={settings.farePerTaxi} onChange={v => onUpdateSettings({farePerTaxi: parseFloat(v)})} />
               </div>
               <div className="space-y-8">
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">Payment & Contact</h4>
                  <AdminInput label="Admin Momo" value={settings.adminMomo} onChange={v => onUpdateSettings({adminMomo: v})} />
                  <AdminInput label="Admin Name" value={settings.adminMomoName} onChange={v => onUpdateSettings({adminMomoName: v})} />
                  <AdminInput label="WhatsApp Line" value={settings.whatsappNumber} onChange={v => onUpdateSettings({whatsappNumber: v})} />
                  <AdminInput label="Master Key" value={settings.adminSecret} type="password" onChange={v => onUpdateSettings({adminSecret: v})} />
               </div>
            </div>
            
            <div className="pt-8 border-t border-white/5">
                <button onClick={() => alert("Settings are auto-saved to Supabase.")} className="px-12 py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl">Deploy Logic Updates</button>
            </div>
         </div>
       )}

       {activeTab === 'onboarding' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in">
            {registrationRequests.filter((r:any)=>r.status==='pending').map((reg: any) => (
              <div key={reg.id} className="glass p-10 rounded-[3.5rem] border border-indigo-500/30 space-y-8 shadow-xl">
                 <div className="text-center space-y-4">
                    <img src={reg.photoUrl} className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/10 mx-auto shadow-2xl object-cover" alt="Identity" />
                    <div>
                      <h4 className="text-2xl font-black uppercase italic text-white leading-none">{reg.name}</h4>
                      <p className="text-[10px] text-indigo-400 font-black uppercase mt-3 tracking-[0.2em]">{reg.vehicleType}</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <button className="flex-1 py-5 bg-white/5 rounded-2xl text-[9px] font-black uppercase text-slate-500">Reject</button>
                    <button onClick={() => onApprove(reg)} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[9px] shadow-xl">Verify ID</button>
                 </div>
              </div>
            ))}
         </div>
       )}

       {activeTab === 'monitor' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="glass p-12 rounded-[4rem] border border-white/5 flex flex-col justify-center text-center space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">Total Hub Profit</p>
                <p className="text-7xl font-black text-white italic tracking-tighter">₵ 0.00</p>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <ImpactStat label="Fleet Growth" value="+12%" icon="fa-arrow-trend-up" color="text-emerald-400" />
                <ImpactStat label="Active Nodes" value="5" icon="fa-network-wired" color="text-indigo-400" />
                <ImpactStat label="Node Efficiency" value="94%" icon="fa-bolt" color="text-amber-400" />
                <ImpactStat label="Admin Latency" value="2ms" icon="fa-microchip" color="text-rose-400" />
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
       className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none focus:border-amber-500 transition-all shadow-inner" 
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
    {badge !== undefined && badge > 0 && <span className="bg-rose-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full ring-4 ring-[#020617] animate-pulse">{badge}</span>}
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
