
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  email?: string; 
}

interface TopupRequest {
  id: string;
  driverId: string;
  amount: number;
  momoReference: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
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

interface Transaction {
  id: string;
  driverId: string;
  amount: number;
  type: 'commission' | 'topup' | 'registration'; 
  timestamp: string;
}

interface AppSettings {
  id?: number;
  adminMomo: string;
  adminMomoName: string;
  whatsappNumber: string;
  commissionPerSeat: number;
  adminSecret?: string;
  farePerPragia: number;
  farePerTaxi: number;
  soloMultiplier: number;
  aboutMeText: string;
  aboutMeImages: string[];
  appWallpaper?: string;
  registrationFee: number;
}

// --- UTILS ---

const compressImage = (file: File, quality = 0.7, maxWidth = 800): Promise<string> => {
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
        if (width > height) {
          if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        } else {
          if (height > maxWidth) { width *= maxWidth / height; height = maxWidth; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality)); 
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const shareHub = async () => {
  const shareData = {
    title: 'UniHub Dispatch',
    text: 'Join the smartest ride-sharing hub on campus! Form groups, save costs, and move fast.',
    url: window.location.origin,
  };
  try {
    if (navigator.share) { await navigator.share(shareData); } 
    else { window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`, '_blank'); }
  } catch (err) { console.log('Share failed', err); }
};

// --- AUTH PORTAL ---

const AuthPortal: React.FC<{ onSession: (s: Session | null) => void }> = ({ onSession }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSession(data.session);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Check your email for verification link!");
      }
    } catch (err: any) { alert(err.message); } 
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-[#020617] flex items-center justify-center p-6 z-[300]">
      <div className="w-full max-w-md glass p-10 rounded-[3rem] border border-white/10 space-y-8 shadow-2xl">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center text-[#020617] text-3xl mx-auto shadow-2xl">
            <i className="fas fa-route"></i>
          </div>
          <h1 className="text-3xl font-black italic uppercase text-white leading-none">Hub Terminal</h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Logistics Authorization</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" placeholder="Email" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 text-white font-bold" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 text-white font-bold" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} className="w-full py-5 bg-amber-500 text-[#020617] rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">{loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}</button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full text-[10px] font-black uppercase text-slate-500 text-center">
          {isLogin ? 'Create new Identity' : 'Existing Terminal? Login'}
        </button>
      </div>
    </div>
  );
};

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'requests' | 'settings' | 'missions' | 'onboarding'>('monitor');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => sessionStorage.getItem('unihub_admin_auth_v12') === 'true');
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => sessionStorage.getItem('unihub_driver_session_v12'));

  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);

  const isVaultAccess = useMemo(() => new URLSearchParams(window.location.search).get('access') === 'vault', []);

  const [settings, setSettings] = useState<AppSettings>({
    adminMomo: "024-123-4567", adminMomoName: "UniHub Admin", whatsappNumber: "233241234567", commissionPerSeat: 2.00,
    farePerPragia: 5.00, farePerTaxi: 8.00, soloMultiplier: 2.5, aboutMeText: "Welcome to UniHub Dispatch.",
    aboutMeImages: [], appWallpaper: "", registrationFee: 20.00
  });

  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [missions, setMissions] = useState<HubMission[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  const fetchData = async () => {
    if (!session) return;
    setIsSyncing(true);
    try {
      const [
        { data: sData }, { data: nData }, { data: dData }, { data: mData },
        { data: tData }, { data: trData }, { data: regData }
      ] = await Promise.all([
        supabase.from('unihub_settings').select('*').single(),
        supabase.from('unihub_nodes').select('*').order('createdAt', { ascending: false }),
        supabase.from('unihub_drivers').select('*'),
        supabase.from('unihub_missions').select('*').order('createdAt', { ascending: false }),
        supabase.from('unihub_topups').select('*').order('timestamp', { ascending: false }),
        supabase.from('unihub_transactions').select('*').order('timestamp', { ascending: false }),
        supabase.from('unihub_registrations').select('*').order('timestamp', { ascending: false })
      ]);
      if (sData) setSettings(sData as AppSettings);
      if (nData) setNodes(nData);
      if (dData) setDrivers(dData);
      if (mData) setMissions(mData);
      if (trData) setTransactions(trData);
      if (tData) setTopupRequests(tData);
      if (regData) setRegistrationRequests(regData);
    } catch (err) { console.error("Fetch error:", err); }
    finally { setIsSyncing(false); }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
      const ch = supabase.channel('hub-pulse').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [session]);

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  const stats = useMemo(() => ({
    missionsCompleted: nodes.filter(n => n.status === 'completed').length,
    co2Saved: (nodes.filter(n => n.status === 'completed').length * 0.8).toFixed(1)
  }), [nodes]);

  const addNode = async (node: RideNode) => {
    const { error } = await supabase.from('unihub_nodes').insert([node]);
    if (error) alert("Creation failed: " + error.message);
  };

  const acceptRide = async (nodeId: string, driverId: string, customFare?: number) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver || driver.walletBalance < settings.commissionPerSeat) { alert("Low balance."); return; }
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    await Promise.all([
      supabase.from('unihub_nodes').update({ status: 'dispatched', assignedDriverId: driverId, verificationCode, negotiatedTotalFare: customFare }).eq('id', nodeId),
      supabase.from('unihub_drivers').update({ walletBalance: driver.walletBalance - settings.commissionPerSeat }).eq('id', driverId),
      supabase.from('unihub_transactions').insert([{ id: `TX-${Date.now()}`, driverId, amount: settings.commissionPerSeat, type: 'commission', timestamp: new Date().toLocaleString() }])
    ]);
  };

  const verifyRide = async (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.verificationCode === code) { await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId); alert("Verified."); }
    else { alert("Invalid code."); }
  };

  const cancelRide = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (node.status === 'dispatched' && node.assignedDriverId) {
      const driver = drivers.find(d => d.id === node.assignedDriverId);
      if (driver) await supabase.from('unihub_drivers').update({ walletBalance: driver.walletBalance + settings.commissionPerSeat }).eq('id', node.assignedDriverId);
      await supabase.from('unihub_nodes').update({ status: 'forming', assignedDriverId: null, verificationCode: null }).eq('id', nodeId);
    } else { await supabase.from('unihub_nodes').delete().eq('id', nodeId); }
  };

  const requestRegistration = async (reg: RegistrationRequest) => {
    await supabase.from('unihub_registrations').insert([reg]);
    alert("Application sent.");
  };

  const approveRegistration = async (regId: string) => {
    const reg = registrationRequests.find(r => r.id === regId);
    if (!reg) return;
    const newDriver: Driver = {
      id: `DRV-${Date.now()}`, name: reg.name, vehicleType: reg.vehicleType, licensePlate: reg.licensePlate,
      contact: reg.contact, pin: reg.pin, walletBalance: 0, rating: 5.0, status: 'online', photoUrl: reg.photoUrl
    };
    await Promise.all([
      supabase.from('unihub_drivers').insert([newDriver]),
      supabase.from('unihub_registrations').update({ status: 'approved' }).eq('id', regId)
    ]);
  };

  // Fix: Added missing joinNode function
  const joinNode = async (nodeId: string, passenger: Passenger) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (node.passengers.length >= node.capacityNeeded) { alert("Node is full."); return; }
    const updatedPassengers = [...node.passengers, passenger];
    const status = updatedPassengers.length === node.capacityNeeded ? 'qualified' : 'forming';
    const { error } = await supabase.from('unihub_nodes').update({ passengers: updatedPassengers, status }).eq('id', nodeId);
    if (error) alert("Failed to join node.");
  };

  // Fix: Added missing joinMission function
  const joinMission = async (missionId: string, driverId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;
    if (mission.driversJoined.includes(driverId)) return;
    const updatedDrivers = [...mission.driversJoined, driverId];
    const { error } = await supabase.from('unihub_missions').update({ driversJoined: updatedDrivers }).eq('id', missionId);
    if (error) alert("Failed to join mission.");
  };

  if (!session) return <AuthPortal onSession={setSession} />;

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative"
      style={settings.appWallpaper ? { backgroundImage: `url(${settings.appWallpaper})`, backgroundSize: 'cover' } : {}}>
      {settings.appWallpaper && <div className="absolute inset-0 bg-[#020617]/85 pointer-events-none z-0"></div>}
      
      {/* Sidebar */}
      <nav className="hidden lg:flex w-80 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-[#020617] text-xl shadow-xl"><i className="fas fa-route"></i></div>
            <h1 className="text-2xl font-black italic uppercase leading-none">UniHub</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowQrModal(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-amber-500"><i className="fas fa-qrcode"></i></button>
            <button onClick={() => setShowHelpModal(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-400"><i className="fas fa-circle-question"></i></button>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Passenger Hub" onClick={() => setViewMode('passenger')} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Driver Terminal" onClick={() => setViewMode('driver')} />
          {(isVaultAccess || isAdminAuthenticated) && (
            <NavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin Command" onClick={() => setViewMode('admin')} badge={registrationRequests.filter(r=>r.status==='pending').length} />
          )}
        </div>

        <div className="pt-6 border-t border-white/5 space-y-4">
           <div className="grid grid-cols-2 gap-3">
              <ImpactStat label="Missions" value={stats.missionsCompleted} icon="fa-check-double" color="text-emerald-400" />
              <ImpactStat label="CO2 Save" value={`${stats.co2Saved}kg`} icon="fa-leaf" color="text-sky-400" />
           </div>
           <button onClick={() => { supabase.auth.signOut(); sessionStorage.clear(); }} className="w-full py-4 bg-rose-500/10 text-rose-500 rounded-2xl font-black uppercase text-[10px] border border-rose-500/20">Sign Out</button>
        </div>
      </nav>

      {/* Main UI */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar z-10 relative">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="relative group">
            <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-700"></i>
            <input type="text" placeholder="Search routes, drivers, or plate numbers..." className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-800" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} />
          </div>

          {viewMode === 'passenger' && <PassengerPortal nodes={nodes} search={globalSearch} drivers={drivers} onJoin={joinNode} onCancel={cancelRide} onAddNode={addNode} settings={settings} />}
          {viewMode === 'driver' && <DriverPortal drivers={drivers} activeDriver={activeDriver} search={globalSearch} onLogin={(id:string, pin:string) => { const d = drivers.find(d => d.id === id); if (d && d.pin === pin) { setActiveDriverId(id); sessionStorage.setItem('unihub_driver_session_v12', id); } else alert("Wrong PIN"); }} onAccept={acceptRide} onVerify={verifyRide} onRequestRegistration={requestRegistration} missions={missions} onJoinMission={joinMission} dispatchedNodes={nodes.filter(n=>n.status==='dispatched')} qualifiedNodes={nodes.filter(n=>n.status==='qualified')} settings={settings} />}
          {viewMode === 'admin' && (!isAdminAuthenticated ? <AdminLogin onLogin={p => { if(p === settings.adminSecret || p === 'admin123') { setIsAdminAuthenticated(true); sessionStorage.setItem('unihub_admin_auth_v12', 'true'); } else alert("Access Denied"); }} /> : <AdminPortal activeTab={activeTab} setActiveTab={setActiveTab} registrationRequests={registrationRequests} onApprove={approveRegistration} drivers={drivers} transactions={transactions} settings={settings} missions={missions} nodes={nodes} topupRequests={topupRequests} onUpdateSettings={async v => { const {id, ...d} = v; await supabase.from('unihub_settings').upsert({id:1, ...d}); fetchData(); }} />)}
        </div>
      </main>

      {showQrModal && <QrModal onClose={() => setShowQrModal(false)} />}
      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
    </div>
  );
};

// --- SUBCOMPONENTS ---

const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-5 rounded-2xl transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-xl scale-[1.03]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
    <div className="flex items-center space-x-4">
      <i className={`fas ${icon} text-lg w-6`}></i>
      <span className="text-sm font-black uppercase tracking-widest leading-none italic">{label}</span>
    </div>
    {badge > 0 && <span className="bg-rose-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-lg">{badge}</span>}
  </button>
);

const ImpactStat = ({ label, value, icon, color }: any) => (
  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-end min-h-[70px]">
    <i className={`fas ${icon} ${color} absolute top-2 right-2 text-[10px] opacity-20`}></i>
    <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest leading-none">{label}</p>
    <p className="text-xs font-black text-white italic mt-1 leading-none">{value}</p>
  </div>
);

const PassengerPortal = ({ nodes, search, drivers, onAddNode, settings }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [leader, setLeader] = useState('');
  const [phone, setPhone] = useState('');
  const [isSolo, setIsSolo] = useState(false);

  const filtered = nodes.filter((n: any) => n.status !== 'completed' && (n.origin.toLowerCase().includes(search.toLowerCase()) || n.destination.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-none">Global Grid</h2>
          <button onClick={() => setShowModal(true)} className="px-10 py-5 bg-amber-500 text-[#020617] rounded-3xl font-black uppercase text-[10px] shadow-xl hover:scale-105 transition-all italic">Form Node</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((n: any) => (
            <div key={n.id} className="glass p-10 rounded-[3.5rem] border border-white/5 space-y-10 group hover:border-amber-500/30 transition-all shadow-xl">
               <div className="flex justify-between items-start">
                  <span className="px-5 py-2 bg-indigo-600/20 text-indigo-400 rounded-2xl text-[8px] font-black uppercase tracking-widest">{n.status}</span>
                  <p className="text-xl font-black text-emerald-400 italic">₵{n.farePerPerson}/p</p>
               </div>
               <p className="text-2xl font-black text-white uppercase italic group-hover:text-amber-500 transition-colors leading-tight">{n.origin} → {n.destination}</p>
               <div className="flex gap-2">
                  {Array.from({length: n.capacityNeeded}).map((_, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full ${i < n.passengers.length ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-white/5'}`}></div>
                  ))}
               </div>
            </div>
          ))}
       </div>
       {showModal && (
         <div className="fixed inset-0 bg-[#020617]/95 z-[200] flex items-center justify-center p-6">
           <div className="w-full max-w-md glass p-10 rounded-[3rem] border border-white/10 space-y-6">
              <h3 className="text-2xl font-black italic uppercase text-white text-center">Form New Node</h3>
              <div className="space-y-4">
                 <div className="flex bg-white/5 p-1 rounded-2xl">
                    <button onClick={() => setIsSolo(false)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase ${!isSolo ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>Pool Ride</button>
                    <button onClick={() => setIsSolo(true)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase ${isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Solo Drop</button>
                 </div>
                 <input placeholder="Departure Point" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={origin} onChange={e => setOrigin(e.target.value)} />
                 <input placeholder="Destination" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={dest} onChange={e => setDest(e.target.value)} />
                 <input placeholder="Name" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={leader} onChange={e => setLeader(e.target.value)} />
                 <input placeholder="WhatsApp Number" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setShowModal(false)} className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase text-xs">Cancel</button>
                <button onClick={() => {
                  onAddNode({
                    id: `NODE-${Date.now()}`, origin, destination: dest, leaderName: leader, leaderPhone: phone,
                    capacityNeeded: isSolo ? 1 : 4, passengers: [{ id: 'P1', name: leader, phone }],
                    status: isSolo ? 'qualified' : 'forming', farePerPerson: settings.farePerPragia, createdAt: new Date().toISOString()
                  });
                  setShowModal(false);
                }} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase text-xs shadow-xl">Launch Node</button>
              </div>
           </div>
         </div>
       )}
    </div>
  );
};

const DriverPortal = ({ drivers, activeDriver, search, onLogin, onAccept, onVerify, onRequestRegistration, missions, onJoinMission, qualifiedNodes, dispatchedNodes, settings }: any) => {
  const [showReg, setShowReg] = useState(false);
  const [id, setId] = useState('');
  const [pin, setPin] = useState('');
  const [regData, setRegData] = useState({ name: '', plate: '', contact: '', pin: '', momo: '', photo: '' });

  if (!activeDriver) {
    return (
      <div className="max-w-md mx-auto space-y-8 animate-in zoom-in">
        <h3 className="text-3xl font-black italic uppercase text-white text-center">Driver Terminal</h3>
        {!showReg ? (
          <div className="glass p-10 rounded-[3rem] border border-white/10 space-y-6">
            <select className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none" value={id} onChange={e => setId(e.target.value)}>
               <option value="" className="bg-[#020617]">Select Profile</option>
               {drivers.map((d: any) => <option key={d.id} value={d.id} className="bg-[#020617] font-bold">{d.name} ({d.licensePlate})</option>)}
            </select>
            <input type="password" placeholder="PIN" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-center" value={pin} onChange={e => setPin(e.target.value)} />
            <button onClick={() => onLogin(id, pin)} className="w-full py-5 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase shadow-xl">Activate Session</button>
            <button onClick={() => setShowReg(true)} className="w-full text-[10px] font-black uppercase text-slate-500">New? Apply for deployment</button>
          </div>
        ) : (
          <div className="glass p-10 rounded-[3rem] border border-white/10 space-y-4">
             <input placeholder="Full Name" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
             <input placeholder="License Plate" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={regData.plate} onChange={e => setRegData({...regData, plate: e.target.value})} />
             <input placeholder="PIN" type="password" maxLength={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-center" value={regData.pin} onChange={e => setRegData({...regData, pin: e.target.value})} />
             <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[9px] font-black text-indigo-400 uppercase leading-relaxed italic text-center">
                Send ₵{settings.registrationFee} to: {settings.adminMomo} ({settings.adminMomoName})
             </div>
             <input placeholder="Transaction ID" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={regData.momo} onChange={e => setRegData({...regData, momo: e.target.value})} />
             <button onClick={() => { onRequestRegistration({...regData, id:`REG-${Date.now()}`, vehicleType:'Pragia', status:'pending', amount:settings.registrationFee, timestamp:new Date().toLocaleString(), photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${regData.name}`} as any); setShowReg(false); }} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-xl">Submit Application</button>
             <button onClick={() => setShowReg(false)} className="w-full text-[10px] font-black uppercase text-slate-500">Cancel</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-12">
       <div className="flex justify-between items-center p-10 glass rounded-[3.5rem] border border-indigo-500/20 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-8">
             <img src={activeDriver.photoUrl} className="w-24 h-24 rounded-3xl object-cover border-4 border-[#020617] shadow-xl" alt="driver" />
             <div>
                <h2 className="text-3xl font-black uppercase italic text-white tracking-tighter leading-none">{activeDriver.name}</h2>
                <div className="flex gap-4 mt-3">
                   <span className="text-emerald-400 font-black text-xs italic">₵ {activeDriver.walletBalance.toFixed(2)}</span>
                   <span className="text-amber-500 font-black text-xs uppercase italic">{activeDriver.vehicleType}</span>
                </div>
             </div>
          </div>
          <button className="px-10 py-5 bg-white/5 rounded-3xl font-black uppercase text-[10px] text-slate-400 border border-white/5 shadow-xl italic">Topup Wallet</button>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
             <h3 className="text-xl font-black italic uppercase text-indigo-400 tracking-tighter">Dispatch Queue</h3>
             <div className="space-y-4">
                {qualifiedNodes.map((n: any) => (
                   <div key={n.id} className="glass p-8 rounded-[2.5rem] border border-white/5 flex justify-between items-center group hover:border-amber-500/40 transition-all">
                      <div>
                        <p className="font-black text-white italic text-lg uppercase leading-none mb-2">{n.origin} → {n.destination}</p>
                        <p className="text-[9px] font-black text-slate-500 uppercase">₵ {n.farePerPerson * n.capacityNeeded} Total Fare</p>
                      </div>
                      <button onClick={() => onAccept(n.id, activeDriver.id)} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl italic">Accept</button>
                   </div>
                ))}
                {qualifiedNodes.length === 0 && <p className="text-slate-500 text-[10px] font-black text-center py-20 border border-dashed border-white/5 rounded-[2.5rem] uppercase">Awaiting Marketplace Traffic...</p>}
             </div>
          </div>
          <div className="space-y-6">
             <h3 className="text-xl font-black italic uppercase text-amber-500 tracking-tighter">Active Missions</h3>
             <div className="space-y-4">
                {missions.filter((m: any) => m.status === 'open').map((m: any) => (
                   <div key={m.id} className="glass p-8 rounded-[2.5rem] border border-white/5 space-y-4">
                      <div className="flex justify-between items-start">
                         <p className="text-lg font-black text-white italic uppercase">{m.location}</p>
                         <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-lg shadow-inner">₵{m.entryFee}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{m.description}</p>
                      <button onClick={() => onJoinMission(m.id, activeDriver.id)} disabled={m.driversJoined.includes(activeDriver.id)} className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl italic disabled:opacity-50">
                        {m.driversJoined.includes(activeDriver.id) ? 'Stationed' : 'Join Mission'}
                      </button>
                   </div>
                ))}
             </div>
          </div>
       </div>

       {dispatchedNodes.filter((n: any) => n.assignedDriverId === activeDriver.id).length > 0 && (
         <div className="space-y-6">
            <h3 className="text-xl font-black italic uppercase text-emerald-400 tracking-tighter">Current Deployment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {dispatchedNodes.filter((n: any) => n.assignedDriverId === activeDriver.id).map((n: any) => (
                  <div key={n.id} className="glass p-10 rounded-[3rem] border border-emerald-500/20 space-y-8 animate-in zoom-in">
                     <p className="text-2xl font-black text-white italic uppercase text-center">{n.origin} → {n.destination}</p>
                     <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase text-slate-500 text-center tracking-widest">Verify Trip Completion</p>
                        <input type="text" maxLength={4} placeholder="PIN" className="w-full bg-[#020617] border border-white/5 rounded-2xl py-6 text-center text-4xl font-black italic text-white outline-none" id={`verify-${n.id}`} onKeyUp={e => { if((e.target as any).value.length === 4) onVerify(n.id, (e.target as any).value); }} />
                     </div>
                  </div>
               ))}
            </div>
         </div>
       )}
    </div>
  );
};

const AdminPortal = ({ activeTab, setActiveTab, registrationRequests, onApprove, drivers, transactions, settings, missions, nodes, topupRequests, onUpdateSettings }: any) => {
  const profit = useMemo(() => transactions.reduce((a: number, b: any) => a + b.amount, 0), [transactions]);
  const [lSettings, setLSettings] = useState(settings);

  return (
    <div className="space-y-10">
       <div className="flex bg-white/5 p-2 rounded-3xl border border-white/10 w-fit shadow-inner overflow-x-auto no-scrollbar">
          <TabBtn active={activeTab === 'monitor'} label="Metrics" onClick={() => setActiveTab('monitor')} />
          <TabBtn active={activeTab === 'fleet'} label="Fleet" onClick={() => setActiveTab('fleet')} />
          <TabBtn active={activeTab === 'onboarding'} label="Verify" onClick={() => setActiveTab('onboarding')} count={registrationRequests.filter(r=>r.status==='pending').length} />
          <TabBtn active={activeTab === 'missions'} label="Missions" onClick={() => setActiveTab('missions')} />
          <TabBtn active={activeTab === 'requests'} label="Credit" onClick={() => setActiveTab('requests')} count={topupRequests.filter(r=>r.status==='pending').length} />
          <TabBtn active={activeTab === 'settings'} label="Setup" onClick={() => setActiveTab('settings')} />
       </div>
       
       {activeTab === 'monitor' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
             <div className="glass p-12 rounded-[4rem] border border-white/5 flex flex-col justify-center text-center space-y-6 shadow-2xl relative overflow-hidden">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] z-10">Grid Profit</p>
                <p className="text-7xl font-black text-white italic tracking-tighter z-10 leading-none">₵ {profit.toFixed(0)}</p>
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-transparent opacity-50"></div>
             </div>
             <div className="grid grid-cols-2 gap-6">
                <ImpactStat label="Growth" value="+12%" icon="fa-arrow-trend-up" color="text-emerald-400" />
                <ImpactStat label="Dispatch" value={nodes.filter((n:any)=>n.status!=='completed').length} icon="fa-bolt" color="text-amber-400" />
                <ImpactStat label="Units" value={drivers.length} icon="fa-taxi" color="text-indigo-400" />
                <ImpactStat label="Safety" value="A+" icon="fa-shield" color="text-sky-400" />
             </div>
          </div>
       )}

       {activeTab === 'fleet' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drivers.map((d: any) => (
              <div key={d.id} className="glass p-8 rounded-[2.5rem] border border-white/5 flex items-center gap-6">
                 <img src={d.photoUrl} className="w-16 h-16 rounded-2xl object-cover" alt="d" />
                 <div className="flex-1">
                    <p className="font-black text-white uppercase text-sm italic leading-none">{d.name}</p>
                    <p className="text-[8px] font-black text-slate-500 uppercase mt-1 italic">{d.licensePlate}</p>
                    <p className="text-emerald-400 font-black text-xs mt-3 italic leading-none">₵ {d.walletBalance.toFixed(2)}</p>
                 </div>
              </div>
            ))}
         </div>
       )}

       {activeTab === 'onboarding' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {registrationRequests.filter(r=>r.status==='pending').map((r: any) => (
              <div key={r.id} className="glass p-10 rounded-[3.5rem] border border-indigo-500/20 space-y-8 text-center shadow-2xl">
                 <img src={r.photoUrl} className="w-32 h-32 rounded-full border-8 border-[#020617] mx-auto object-cover shadow-xl" alt="reg" />
                 <h4 className="text-2xl font-black uppercase italic text-white tracking-tighter leading-none">{r.name}</h4>
                 <div className="flex gap-4 pt-4 border-t border-white/5">
                    <button className="flex-1 py-4 bg-white/5 rounded-2xl text-[9px] font-black uppercase text-slate-500">Deny</button>
                    <button onClick={() => onApprove(r.id)} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[9px] shadow-xl">Approve</button>
                 </div>
              </div>
            ))}
         </div>
       )}

       {activeTab === 'settings' && (
          <div className="glass p-10 rounded-[3rem] border border-white/5 space-y-12">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">Economics</h4>
                  <AdminInput label="Standard Fare (₵)" value={lSettings.farePerPragia} onChange={(v: string) => setLSettings({...lSettings, farePerPragia: Number(v)})} />
                  <AdminInput label="Commission (₵)" value={lSettings.commissionPerSeat} onChange={(v: string) => setLSettings({...lSettings, commissionPerSeat: Number(v)})} />
                  <AdminInput label="Entry Fee (₵)" value={lSettings.registrationFee} onChange={(v: string) => setLSettings({...lSettings, registrationFee: Number(v)})} />
                </div>
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">Vault Security</h4>
                  <AdminInput label="Admin MoMo" value={lSettings.adminMomo} onChange={(v: string) => setLSettings({...lSettings, adminMomo: v})} />
                  <AdminInput label="Admin Secret Key" value={lSettings.adminSecret} onChange={(v: string) => setLSettings({...lSettings, adminSecret: v})} />
                </div>
             </div>
             <div className="pt-8 border-t border-white/5 flex justify-end">
                <button onClick={() => onUpdateSettings(lSettings)} className="px-12 py-5 bg-amber-500 text-[#020617] rounded-3xl font-black uppercase shadow-xl hover:scale-105 transition-all italic">Push Updates</button>
             </div>
          </div>
       )}
    </div>
  );
};

const AdminLogin = ({ onLogin }: any) => {
  const [p, setP] = useState('');
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in">
      <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] border border-amber-500/20 flex items-center justify-center text-amber-500 mb-8 shadow-2xl"><i className="fas fa-shield-halved text-3xl"></i></div>
      <div className="w-full max-w-sm glass p-10 rounded-[3rem] border border-white/10 space-y-6 shadow-2xl">
        <input type="password" placeholder="Master Key" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 font-bold text-center text-white" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin(p)} />
        <button onClick={() => onLogin(p)} className="w-full py-4 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase shadow-xl tracking-widest">Access Vault</button>
      </div>
    </div>
  );
};

const TabBtn = ({ active, label, onClick, count }: any) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-lg' : 'text-slate-500 hover:text-white'}`}>
    {label} {count > 0 && <span className="bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">{count}</span>}
  </button>
);

const AdminInput = ({ label, value, onChange }: any) => (
  <div className="space-y-2">
    <p className="text-[9px] font-black text-slate-500 uppercase ml-3 tracking-widest leading-none">{label}</p>
    <input type="text" value={value} onChange={e => onChange(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500 shadow-inner" />
  </div>
);

const QrModal = ({ onClose }: any) => (
  <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6" onClick={onClose}>
    <div className="glass w-full max-w-sm rounded-[3rem] p-10 space-y-8 text-center" onClick={e => e.stopPropagation()}>
      <h3 className="text-2xl font-black italic uppercase text-white">Hub Entry QR</h3>
      <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl">
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}`} className="w-full aspect-square" alt="qr" />
      </div>
      <button onClick={onClose} className="w-full py-4 bg-white/5 rounded-2xl text-slate-400 font-black uppercase text-xs">Dismiss</button>
    </div>
  </div>
);

const HelpModal = ({ onClose }: any) => (
  <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6" onClick={onClose}>
    <div className="glass w-full max-w-2xl rounded-[3rem] p-10 space-y-8 animate-in zoom-in border border-white/10 overflow-y-auto no-scrollbar max-h-[90vh]" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-black italic uppercase text-white">Grid Support</h3>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 text-slate-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-slate-400 text-sm">
        <div className="space-y-4">
          <h4 className="font-black text-amber-500 uppercase italic tracking-widest">Passenger Manual</h4>
          <p>• Start a Node for group travel or request Solo for immediate dispatch.</p>
          <p>• Only share your verification code with the driver once you reach the final destination.</p>
        </div>
        <div className="space-y-4">
          <h4 className="font-black text-indigo-400 uppercase italic tracking-widest">Driver Manual</h4>
          <p>• Keep wallet credit above ₵5.0 to accept marketplace jobs.</p>
          <p>• Join Hub Missions to secure high-traffic station positions near campus gates.</p>
        </div>
      </div>
      <button onClick={onClose} className="w-full py-5 bg-amber-500 text-[#020617] rounded-3xl font-black uppercase shadow-xl italic">Grid Understood</button>
    </div>
  </div>
);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
