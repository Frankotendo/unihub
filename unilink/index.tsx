
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient, Session } from '@supabase/supabase-js';

// --- SUPABASE CLIENT ---
const SUPABASE_URL = "https://kzjgihwxiaeqzopeuzhm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- TYPES & INTERFACES ---

type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed'; 
type PortalMode = 'passenger' | 'driver' | 'admin';

interface RideNode {
  id: string;
  destination: string;
  origin: string;
  capacityNeeded: number;
  passengers: any[];
  status: NodeStatus;
  farePerPerson: number;
  createdAt: string;
  assignedDriverId?: string;
  verificationCode: string; // Restored: For "Scan to Verify" logic
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
  photoUrl: string; 
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
  photoUrl: string; 
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
  appWallpaper: string; // Missing: Restored
  aboutMeText: string;   // Missing: Restored
}

// --- UTILS ---

const compressImage = (file: File, quality = 0.5, maxWidth = 800): Promise<string> => {
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

// --- AUTH & VAULT ---

const AuthPortal: React.FC<{ onSession: (s: Session | null) => void }> = ({ onSession }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSigningUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Account Created. Check email.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSession(data.session);
      }
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-[#020617] flex items-center justify-center p-6 z-[300]">
      <div className="w-full max-w-md glass p-10 rounded-[3rem] border border-white/10 space-y-8 animate-in zoom-in shadow-2xl">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center text-[#020617] text-3xl mx-auto"><i className="fas fa-shield-halved"></i></div>
          <h1 className="text-3xl font-black italic uppercase text-white">Hub Terminal</h1>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" placeholder="Email" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Key" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} className="w-full py-5 bg-amber-500 text-[#020617] rounded-2xl font-black text-xs uppercase tracking-widest">{loading ? '...' : (isSigningUp ? 'Join' : 'Authorize')}</button>
        </form>
        <button onClick={() => setIsSigningUp(!isSigningUp)} className="w-full text-[10px] font-black uppercase text-slate-500 text-center">{isSigningUp ? 'Login' : 'Sign Up'}</button>
      </div>
    </div>
  );
};

const VaultAuthModal: React.FC<{ isOpen: boolean, onAuth: (secret: string) => Promise<void>, onClose: () => void }> = ({ isOpen, onAuth, onClose }) => {
  const [secret, setSecret] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[500] flex items-center justify-center p-6 animate-in fade-in">
      <div className="w-full max-w-sm glass p-10 rounded-[3.5rem] border border-amber-500/20 space-y-8 animate-in zoom-in text-center shadow-2xl">
        <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] flex items-center justify-center text-amber-500 text-3xl mx-auto border border-amber-500/20"><i className="fas fa-vault"></i></div>
        <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">Command Vault</h2>
        <input type="password" placeholder="SEC-KEY" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center text-lg font-black text-white outline-none focus:border-amber-500" value={secret} onChange={e => setSecret(e.target.value)} autoFocus />
        <div className="flex gap-4">
           <button onClick={onClose} className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase text-slate-500">Abort</button>
           <button onClick={() => onAuth(secret)} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-2xl text-[10px] font-black uppercase shadow-xl">Unlock</button>
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
  const [showAbout, setShowAbout] = useState(false);

  const [settings, setSettings] = useState<AppSettings>({
    id: 1, adminMomo: "0240000000", adminMomoName: "Admin", whatsappNumber: "233000",
    commissionPerSeat: 2, farePerPragia: 5, farePerTaxi: 8, soloMultiplier: 2.5,
    registrationFee: 20, adminSecret: "", appWallpaper: "", aboutMeText: "Welcome to UniHub Dispatch."
  });
  
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('access') === 'vault' && !isAdminAuthenticated) setShowVaultModal(true);
  }, [isAdminAuthenticated]);

  const fetchData = async () => {
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
  };

  useEffect(() => {
    if (session) {
      fetchData();
      const channel = supabase.channel('hub-pulse').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [session]);

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  const handleAdminAuth = async (secret: string) => {
    const { data } = await supabase.rpc('verify_admin_secret', { candidate_secret: secret });
    if (data === true) {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('unihub_admin_auth_v12', 'true');
      setShowVaultModal(false);
      setViewMode('admin');
    } else { alert("ACCESS DENIED"); }
  };

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    await supabase.from('unihub_settings').update(newSettings).eq('id', settings.id);
    fetchData();
  };

  const handleTopup = async (driverId: string, amount: number) => {
    const drv = drivers.find(d => d.id === driverId);
    if (!drv) return;
    await supabase.from('unihub_drivers').update({ walletBalance: drv.walletBalance + amount }).eq('id', driverId);
    fetchData();
  };

  const handleFormNode = async (origin: string, dest: string, cap: number) => {
    const vCode = Math.floor(1000 + Math.random() * 9000).toString(); // Generate Verification Code
    const newNode = {
      id: `NODE-${Date.now()}`, origin, destination: dest, capacityNeeded: cap,
      passengers: [], status: 'forming', farePerPerson: settings.farePerPragia, 
      createdAt: new Date().toISOString(), verificationCode: vCode
    };
    await supabase.from('unihub_nodes').insert([newNode]);
    fetchData();
    alert(`Node Deployed. Verification Code: ${vCode}. SHARE THIS WITH YOUR DRIVER.`);
  };

  if (!session) return <AuthPortal onSession={setSession} />;

  return (
    <div 
      className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative bg-cover bg-center transition-all duration-700"
      style={{ backgroundImage: settings.appWallpaper ? `linear-gradient(rgba(2, 6, 23, 0.85), rgba(2, 6, 23, 0.95)), url(${settings.appWallpaper})` : 'none' }}
    >
      <VaultAuthModal isOpen={showVaultModal} onAuth={handleAdminAuth} onClose={() => setShowVaultModal(false)} />

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
           <div className="w-full max-w-2xl glass p-12 rounded-[4rem] border border-white/10 space-y-8 animate-in zoom-in shadow-2xl relative">
              <button onClick={() => setShowAbout(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"><i className="fas fa-times text-2xl"></i></button>
              <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">About UniHub</h2>
              <div className="max-h-[60vh] overflow-y-auto no-scrollbar pr-4 text-slate-300 space-y-6 leading-relaxed">
                 <p className="whitespace-pre-wrap font-medium">{settings.aboutMeText || "No information provided by Hub Global."}</p>
              </div>
           </div>
        </div>
      )}

      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl"><i className="fas fa-globe text-[#020617] text-xl"></i></div>
          <h1 className="text-2xl font-black italic text-white leading-none uppercase">Hub Global</h1>
        </div>
        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-people-group" label="Commuter Hub" onClick={() => setViewMode('passenger')} />
          <NavItem active={viewMode === 'driver'} icon="fa-truck-fast" label="Driver Terminal" onClick={() => setViewMode('driver')} />
          {isAdminAuthenticated && <NavItem active={viewMode === 'admin'} icon="fa-fingerprint" label="Admin Command" onClick={() => setViewMode('admin')} badge={registrationRequests.filter(r=>r.status==='pending').length} />}
          <button onClick={() => setShowAbout(true)} className="w-full flex items-center px-6 py-5 rounded-2xl text-slate-500 hover:text-white transition-colors mt-4">
             <i className="fas fa-circle-info text-lg w-6"></i>
             <span className="text-sm font-black uppercase tracking-widest leading-none">About Hub</span>
          </button>
          <button onClick={() => { supabase.auth.signOut(); sessionStorage.clear(); }} className="w-full flex items-center px-6 py-5 rounded-2xl text-slate-500 hover:text-rose-500 transition-colors mt-10"><i className="fas fa-power-off text-lg w-6"></i><span className="text-sm font-black uppercase tracking-widest">Logout</span></button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 no-scrollbar z-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="relative group">
            <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-700"></i>
            <input type="text" placeholder="Scan global routes, fleets, or missions..." className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-700" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} />
          </div>

          {viewMode === 'passenger' && <PassengerPortal nodes={nodes} search={globalSearch} onForm={handleFormNode} />}
          {viewMode === 'driver' && <DriverPortal drivers={drivers} activeDriver={activeDriver} onLogin={(id, pin) => { const d = drivers.find(drv => drv.id === id); if (d && d.pin === pin) { setActiveDriverId(id); sessionStorage.setItem('unihub_driver_session_v12', id); } else alert("Access Denied"); }} onLogout={() => { setActiveDriverId(null); sessionStorage.removeItem('unihub_driver_session_v12'); }} nodes={nodes} fetchData={fetchData} />}
          {viewMode === 'admin' && <AdminPortal activeTab={activeTab} setActiveTab={setActiveTab} registrationRequests={registrationRequests} drivers={drivers} nodes={nodes} settings={settings} onUpdateSettings={handleUpdateSettings} onTopup={handleTopup} />}
        </div>
      </main>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const DriverPortal = ({ drivers, activeDriver, onLogin, onLogout, nodes, fetchData }: any) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [verifyingNodeId, setVerifyingNodeId] = useState<string | null>(null);
  const [vInput, setVInput] = useState('');

  if (!activeDriver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-in fade-in">
        <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">Driver Terminal</h2>
        {selectedId ? (
          <div className="w-full max-w-sm glass p-10 rounded-[3rem] text-center space-y-8 animate-in zoom-in border border-indigo-500/20">
            <input type="password" maxLength={4} className="w-full bg-white/5 border-b-2 border-indigo-500 text-center text-5xl tracking-[1em] font-black text-white outline-none pb-4" value={pin} onChange={e => setPin(e.target.value)} autoFocus />
            <button onClick={() => onLogin(selectedId, pin)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl">Authorize</button>
            <button onClick={() => setSelectedId(null)} className="text-[10px] font-black uppercase text-slate-500">Back</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4">
             {drivers.map((d: any) => (
               <button key={d.id} onClick={() => setSelectedId(d.id)} className="glass p-8 rounded-[2.5rem] border border-white/5 text-left flex items-center gap-4 hover:bg-white/5 shadow-xl transition-all">
                  <img src={d.photoUrl} className="w-12 h-12 rounded-full border border-white/10 object-cover" />
                  <div><p className="font-black text-white uppercase italic">{d.name}</p><p className="text-[8px] font-black text-slate-500 uppercase">₵{d.walletBalance.toFixed(1)}</p></div>
               </button>
             ))}
          </div>
        )}
      </div>
    );
  }

  const handleVerifyComplete = async () => {
    const node = nodes.find((n:any) => n.id === verifyingNodeId);
    if (node && node.verificationCode === vInput) {
       await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', node.id);
       await fetchData();
       setVerifyingNodeId(null);
       setVInput('');
       alert("Mission Verified & Completed. Funds released.");
    } else { alert("INVALID VERIFICATION CODE"); }
  };

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-12">
      {verifyingNodeId && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm glass p-10 rounded-[3.5rem] border border-emerald-500/30 text-center space-y-8 animate-in zoom-in">
             <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center text-emerald-500 text-3xl mx-auto shadow-2xl"><i className="fas fa-qrcode"></i></div>
             <h2 className="text-2xl font-black italic uppercase text-white leading-none">Scan to Verify</h2>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enter Passenger Verification Code</p>
             <input type="text" maxLength={4} className="w-full bg-white/5 border-b-2 border-emerald-500 text-center text-5xl tracking-[0.5em] font-black text-white outline-none pb-4" value={vInput} onChange={e => setVInput(e.target.value)} autoFocus />
             <div className="flex gap-4">
               <button onClick={() => setVerifyingNodeId(null)} className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black text-slate-500 uppercase">Cancel</button>
               <button onClick={handleVerifyComplete} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl">Verify</button>
             </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center p-10 glass rounded-[3.5rem] border border-white/5 shadow-2xl">
        <div className="flex items-center gap-8">
          <img src={activeDriver.photoUrl} className="w-24 h-24 rounded-[2.5rem] border-2 border-indigo-500/30 object-cover" />
          <div>
            <h2 className="text-3xl font-black uppercase italic text-white leading-none">{activeDriver.name}</h2>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-3">OPERATIONAL</p>
          </div>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Wallet</p>
           <p className="text-4xl font-black text-white italic tracking-tighter mt-2">₵ {activeDriver.walletBalance.toFixed(2)}</p>
        </div>
      </div>
      
      <div className="space-y-6">
         <h3 className="text-xl font-black italic uppercase text-white">Active Missions</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {nodes.filter((n:any) => n.status === 'forming' || (n.status === 'dispatched' && n.assignedDriverId === activeDriver.id)).map((node:any) => (
              <div key={node.id} className="glass p-8 rounded-[2.5rem] border border-white/5 space-y-6 shadow-xl">
                 <div className="flex justify-between items-start">
                    <span className="px-4 py-2 rounded-2xl text-[8px] font-black uppercase bg-indigo-600/20 text-indigo-400">{node.status}</span>
                    <p className="text-lg font-black text-emerald-400 italic">₵{node.farePerPerson * node.capacityNeeded}</p>
                 </div>
                 <p className="text-xl font-black text-white uppercase italic">{node.origin} → {node.destination}</p>
                 {node.status === 'forming' ? (
                   <button onClick={async () => {
                     await supabase.from('unihub_nodes').update({ status: 'dispatched', assignedDriverId: activeDriver.id }).eq('id', node.id);
                     await fetchData();
                   }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Accept Mission</button>
                 ) : (
                   <button onClick={() => setVerifyingNodeId(node.id)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg animate-pulse">Verify & Complete</button>
                 )}
              </div>
            ))}
         </div>
      </div>
      <button onClick={onLogout} className="w-full py-5 bg-rose-500/10 text-rose-500 rounded-3xl font-black uppercase text-[10px] border border-rose-500/20">Sign Out</button>
    </div>
  );
};

const PassengerPortal = ({ nodes, search, onForm }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ origin: '', destination: '', capacity: 4 });
  const filteredNodes = nodes.filter((n: any) => n.status !== 'completed' && (n.origin.toLowerCase().includes(search.toLowerCase()) || n.destination.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-8 animate-in fade-in">
       <div className="flex justify-between items-center">
          <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Global Grid</h2>
          <button onClick={() => setShowForm(true)} className="px-10 py-5 bg-amber-500 text-[#020617] rounded-3xl font-black uppercase text-[10px] shadow-xl tracking-widest hover:scale-105 transition-all">Form Node</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-1">
          {filteredNodes.map((node: any) => (
              <div key={node.id} className="glass p-10 rounded-[3rem] border border-white/5 space-y-8 group hover:border-amber-500/30 transition-all shadow-xl relative overflow-hidden">
                 <div className="flex justify-between items-start">
                    <span className="px-5 py-2 bg-indigo-600/20 text-indigo-400 rounded-2xl text-[8px] font-black uppercase">{node.status}</span>
                    <p className="text-xl font-black text-emerald-400 italic">₵{node.farePerPerson}/p</p>
                 </div>
                 <p className="text-2xl font-black text-white uppercase italic group-hover:text-amber-500 transition-colors leading-tight">{node.origin} → {node.destination}</p>
                 <div className="flex gap-2">
                    {Array.from({length: node.capacityNeeded}).map((_, i) => (
                      <div key={i} className={`w-3 h-3 rounded-full ${i < node.passengers.length ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-white/5'}`}></div>
                    ))}
                 </div>
              </div>
          ))}
       </div>
       {showForm && (
         <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
           <div className="glass-bright w-full max-w-md rounded-[3.5rem] p-12 space-y-8 animate-in zoom-in shadow-2xl border border-white/10">
              <h3 className="text-3xl font-black italic uppercase text-white text-center">Node Formation</h3>
              <div className="space-y-4">
                <AdminInput label="Origin" value={formData.origin} onChange={v => setFormData({...formData, origin: v})} />
                <AdminInput label="Destination" value={formData.destination} onChange={v => setFormData({...formData, destination: v})} />
                <AdminInput label="Capacity" value={formData.capacity} onChange={v => setFormData({...formData, capacity: parseInt(v) || 4})} type="number" />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setShowForm(false)} className="flex-1 py-5 bg-white/5 rounded-2xl text-[10px] font-black uppercase text-slate-500">Cancel</button>
                <button onClick={() => { onForm(formData.origin, formData.destination, formData.capacity); setShowForm(false); }} className="flex-1 py-5 bg-amber-500 text-[#020617] rounded-2xl text-[10px] font-black uppercase shadow-xl">Deploy</button>
              </div>
           </div>
         </div>
       )}
    </div>
  );
};

const AdminPortal = ({ activeTab, setActiveTab, registrationRequests, onApprove, drivers, settings, onUpdateSettings, onTopup, nodes }: any) => {
  const handleWallpaperChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const b64 = await compressImage(file);
      onUpdateSettings({ appWallpaper: b64 });
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in">
       <div className="flex bg-white/5 p-2 rounded-3xl border border-white/10 w-fit shadow-inner no-scrollbar overflow-x-auto">
          <TabBtn active={activeTab === 'monitor'} label="Metrics" onClick={() => setActiveTab('monitor')} />
          <TabBtn active={activeTab === 'fleet'} label="Fleet" onClick={() => setActiveTab('fleet')} />
          <TabBtn active={activeTab === 'onboarding'} label="Verify" onClick={() => setActiveTab('onboarding')} count={registrationRequests.filter((r:any)=>r.status==='pending').length} />
          <TabBtn active={activeTab === 'settings'} label="Setup" onClick={() => setActiveTab('settings')} />
       </div>
       
       {activeTab === 'settings' && (
         <div className="space-y-8">
           <div className="glass p-12 rounded-[4rem] border border-white/5 space-y-12 shadow-2xl">
              <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter">Logic & Fares</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                 <div className="space-y-8">
                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Economics</h4>
                    <AdminInput label="Commission (₵)" value={settings.commissionPerSeat} onChange={v => onUpdateSettings({commissionPerSeat: parseFloat(v)})} />
                    <AdminInput label="Entry Fee (₵)" value={settings.registrationFee} onChange={v => onUpdateSettings({registrationFee: parseFloat(v)})} />
                    <AdminInput label="Standard Fare (₵)" value={settings.farePerPragia} onChange={v => onUpdateSettings({farePerPragia: parseFloat(v)})} />
                 </div>
                 <div className="space-y-8">
                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Security</h4>
                    <AdminInput label="Admin Momo" value={settings.adminMomo} onChange={v => onUpdateSettings({adminMomo: v})} />
                    <AdminInput label="Vault Key" value={settings.adminSecret} type="password" onChange={v => onUpdateSettings({adminSecret: v})} />
                    <AdminInput label="WhatsApp Line" value={settings.whatsappNumber} onChange={v => onUpdateSettings({whatsappNumber: v})} />
                 </div>
              </div>
           </div>

           <div className="glass p-12 rounded-[4rem] border border-white/5 space-y-12 shadow-2xl">
              <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter">Appearance & Identity</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                 <div className="space-y-8">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Wallpaper Settings</h4>
                    <div className="flex items-center gap-6">
                       <label className="w-32 h-32 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center cursor-pointer overflow-hidden group hover:border-indigo-500 transition-all">
                          {settings.appWallpaper ? <img src={settings.appWallpaper} className="w-full h-full object-cover" /> : <i className="fas fa-image text-2xl text-slate-700"></i>}
                          <input type="file" className="hidden" accept="image/*" onChange={handleWallpaperChange} />
                       </label>
                       <div>
                          <p className="text-[10px] font-black uppercase text-slate-500">Global Wallpaper</p>
                          <p className="text-[8px] font-black text-slate-700 uppercase mt-2">Recommended: 1920x1080px</p>
                       </div>
                    </div>
                 </div>
                 <div className="space-y-8">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">About Hub Text</h4>
                    <textarea 
                      className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none focus:border-amber-500 shadow-inner no-scrollbar"
                      value={settings.aboutMeText} onChange={e => onUpdateSettings({ aboutMeText: e.target.value })}
                      placeholder="Describe the mission and rules of the Hub..."
                    />
                 </div>
              </div>
           </div>
         </div>
       )}

       {activeTab === 'fleet' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in">
            {drivers.map((d: any) => (
              <div key={d.id} className="glass p-10 rounded-[3.5rem] border border-white/5 space-y-8 shadow-xl">
                 <div className="flex items-center gap-5">
                    <img src={d.photoUrl} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/5 shadow-lg" />
                    <div><h4 className="text-lg font-black uppercase italic text-white leading-none">{d.name}</h4><p className="text-[9px] text-slate-500 font-black mt-2">{d.licensePlate}</p></div>
                 </div>
                 <div className="bg-white/5 p-6 rounded-2xl text-center shadow-inner"><p className="text-[9px] font-black text-slate-500 uppercase">Balance</p><p className="text-3xl font-black italic text-white tracking-tighter">₵ {d.walletBalance.toFixed(2)}</p></div>
                 <div className="flex gap-2">
                    <button onClick={() => onTopup(d.id, 10)} className="flex-1 py-4 bg-emerald-600/20 text-emerald-400 rounded-2xl text-[9px] font-black uppercase border border-emerald-500/20 hover:bg-emerald-600/40 transition-all">+₵10</button>
                    <button onClick={() => onTopup(d.id, 50)} className="flex-1 py-4 bg-indigo-600/20 text-indigo-400 rounded-2xl text-[9px] font-black uppercase border border-indigo-500/20 hover:bg-indigo-600/40 transition-all">+₵50</button>
                 </div>
              </div>
            ))}
         </div>
       )}

       {activeTab === 'onboarding' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in">
            {registrationRequests.filter((r:any)=>r.status==='pending').map((reg: any) => (
              <div key={reg.id} className="glass p-10 rounded-[3.5rem] border border-indigo-500/30 space-y-8 shadow-xl">
                 <img src={reg.photoUrl} className="w-32 h-32 rounded-full border-4 border-white/10 mx-auto object-cover shadow-2xl" />
                 <div className="text-center space-y-2">
                    <h4 className="text-2xl font-black uppercase italic text-white leading-none">{reg.name}</h4>
                    <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">MOMO: {reg.momoReference}</p>
                 </div>
                 <div className="flex gap-4 pt-4 border-t border-white/5">
                    <button className="flex-1 py-5 bg-white/5 rounded-2xl text-[9px] font-black uppercase text-slate-500">Decline</button>
                    <button onClick={() => onApprove(reg)} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[9px] shadow-xl">Verify & Deploy</button>
                 </div>
              </div>
            ))}
         </div>
       )}

       {activeTab === 'monitor' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="glass p-12 rounded-[4rem] border border-white/5 flex flex-col justify-center text-center space-y-4 shadow-2xl relative overflow-hidden">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] z-10">Total Grid Revenue</p>
                <p className="text-7xl font-black text-white italic tracking-tighter z-10 leading-none">₵ {nodes.reduce((acc: number, n: any) => acc + (n.status === 'completed' ? n.farePerPerson * n.capacityNeeded : 0), 0).toFixed(2)}</p>
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-transparent opacity-50"></div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <ImpactStat label="Fleet Growth" value="+12%" icon="fa-arrow-trend-up" color="text-emerald-400" />
                <ImpactStat label="Live Nodes" value={nodes.filter((n:any) => n.status !== 'completed').length} icon="fa-network-wired" color="text-indigo-400" />
                <ImpactStat label="Hub Latency" value="12ms" icon="fa-bolt" color="text-amber-400" />
                <ImpactStat label="Safety Grade" value="A+" icon="fa-shield-heart" color="text-rose-400" />
             </div>
          </div>
       )}
    </div>
  );
};

const AdminInput = ({ label, value, onChange, type = "text" }: { label: string, value: any, onChange: (v: string) => void, type?: string }) => (
  <div className="space-y-2 w-full text-left">
     <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-4">{label}</label>
     <input type={type} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none focus:border-amber-500 transition-all shadow-inner" value={value} onChange={e => onChange(e.target.value)} />
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
  <button onClick={onClick} className={`px-10 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all min-w-fit ${active ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:bg-white/5'}`}>
    {label} {count !== undefined && count > 0 && <span className="ml-3 bg-rose-500 text-white text-[8px] px-2 py-1 rounded-full">{count}</span>}
  </button>
);

const ImpactStat = ({ label, value, icon, color }: any) => (
  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 relative overflow-hidden">
    <i className={`fas ${icon} ${color} absolute top-2 right-2 text-[8px] opacity-20`}></i>
    <p className="text-[7px] font-black uppercase text-slate-500">{label}</p>
    <p className="text-xs font-black text-white italic mt-1">{value}</p>
  </div>
);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
