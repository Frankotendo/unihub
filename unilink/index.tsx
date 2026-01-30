
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
  photoUrl?: string; // RESTORED & ADDED
  email?: string; // FOR UNIFIED AUTH
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
  photoUrl?: string; // ADDED FOR TRUST
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

const shareHub = async () => {
  const shareData = {
    title: 'UniHub Dispatch',
    text: 'Join the smartest ride-sharing hub on campus! Form groups, save costs, and move fast.',
    url: window.location.origin,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`, '_blank');
    }
  } catch (err) {
    console.log('Share failed', err);
  }
};

const shareNode = async (node: RideNode) => {
  const seatsLeft = node.capacityNeeded - node.passengers.length;
  const message = node.isLongDistance 
    ? `🚀 *UniHub Long Distance!* \n📍 *From:* ${node.origin}\n📍 *To:* ${node.destination}\n🚕 *Bids open for Drivers!*`
    : node.isSolo 
    ? `🚀 *UniHub Dropping!* \n📍 *Route:* ${node.origin} → ${node.destination}\n🚕 *Solo Request* needs a driver!`
    : `🚀 *Ride Hub Alert!*\n📍 *Route:* ${node.origin} → ${node.destination}\n👥 *Seats Left:* ${seatsLeft}\n💰 *Price:* ₵${node.farePerPerson}/p\n\nJoin my ride node on UniHub! 👇\n${window.location.origin}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'UniHub Ride Update',
        text: message,
        url: window.location.origin
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  } catch (err) {
    console.log('Node share failed', err);
  }
};

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
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
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

// --- AUTH PORTAL (THE WALL) ---

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
    } catch (err: any) {
      alert(err.message);
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
            <i className="fas fa-route"></i>
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white leading-none">Hub Terminal</h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Logistics Authorization</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <input 
            type="email" placeholder="Terminal ID (Email)" 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 text-white font-bold"
            value={email} onChange={e => setEmail(e.target.value)} required
          />
          <input 
            type="password" placeholder="Access Key (Password)" 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 text-white font-bold"
            value={password} onChange={e => setPassword(e.target.value)} required
          />
          <button 
            type="submit" disabled={loading}
            className="w-full py-5 bg-amber-500 text-[#020617] rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isLogin ? 'Authorize Session' : 'Create Identity')}
          </button>
        </form>

        <button 
          onClick={() => setIsLogin(!isLogin)} 
          className="w-full text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors text-center"
        >
          {isLogin ? 'Establish new Hub Identity' : 'Already authorized? Login here'}
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
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('unihub_admin_auth_v12') === 'true';
  });
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => {
    return sessionStorage.getItem('unihub_driver_session_v12');
  });

  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isNewUser, setIsNewUser] = useState(() => !localStorage.getItem('unihub_seen_welcome_v12'));
  const [isSyncing, setIsSyncing] = useState(true);

  const isVaultAccess = useMemo(() => {
    return new URLSearchParams(window.location.search).get('access') === 'vault';
  }, []);

  const [settings, setSettings] = useState<AppSettings>({
    adminMomo: "024-123-4567",
    adminMomoName: "UniHub Admin",
    whatsappNumber: "233241234567",
    commissionPerSeat: 2.00,
    farePerPragia: 5.00,
    farePerTaxi: 8.00,
    soloMultiplier: 2.5,
    aboutMeText: "Welcome to UniHub Dispatch.",
    aboutMeImages: [],
    appWallpaper: "",
    registrationFee: 20.00
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
        { data: sData },
        { data: nData },
        { data: dData },
        { data: mData },
        { data: tData },
        { data: trData },
        { data: regData }
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
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
      const channel = supabase.channel('hub-pulse')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [session]);

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  const stats = useMemo(() => ({
    missionsCompleted: nodes.filter(n => n.status === 'completed').length,
    co2Saved: (nodes.filter(n => n.status === 'completed').length * 0.8).toFixed(1),
    activeUnits: drivers.filter(d => d.status === 'online').length,
    communityEfficiency: "94%"
  }), [nodes, drivers]);

  const joinMission = async (missionId: string, driverId: string) => {
    const mission = missions.find(m => m.id === missionId);
    const driver = drivers.find(d => d.id === driverId);

    if (!mission || !driver) return;
    if (mission.driversJoined.includes(driverId)) {
      alert("Already stationed.");
      return;
    }
    if (driver.walletBalance < mission.entryFee) {
      alert("Insufficient Balance.");
      return;
    }

    const newJoined = [...mission.driversJoined, driverId];
    
    await Promise.all([
      supabase.from('unihub_missions').update({ driversJoined: newJoined }).eq('id', missionId),
      supabase.from('unihub_drivers').update({ walletBalance: driver.walletBalance - mission.entryFee }).eq('id', driverId),
      supabase.from('unihub_transactions').insert([{
        id: `TX-MISSION-${Date.now()}`,
        driverId,
        amount: mission.entryFee,
        type: 'commission', 
        timestamp: new Date().toLocaleString()
      }])
    ]);
  };

  const joinNode = async (nodeId: string, name: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.passengers.length < node.capacityNeeded) {
      const newPassengers = [...node.passengers, { id: `P-${Date.now()}`, name, phone }];
      const isQualified = newPassengers.length >= node.capacityNeeded;
      const updatedStatus = isQualified ? 'qualified' : 'forming';
      
      await supabase.from('unihub_nodes').update({ 
        passengers: newPassengers, 
        status: updatedStatus 
      }).eq('id', nodeId);
    }
  };

  const acceptRide = async (nodeId: string, driverId: string, customFare?: number) => {
    const driver = drivers.find(d => d.id === driverId);
    const node = nodes.find(n => n.id === nodeId);
    if (!driver || driver.walletBalance < settings.commissionPerSeat) {
      alert("Low Balance.");
      return;
    }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    await Promise.all([
      supabase.from('unihub_nodes').update({ 
        status: 'dispatched', 
        assignedDriverId: driverId, 
        verificationCode,
        negotiatedTotalFare: customFare || node?.negotiatedTotalFare
      }).eq('id', nodeId),
      supabase.from('unihub_drivers').update({ 
        walletBalance: driver.walletBalance - settings.commissionPerSeat 
      }).eq('id', driverId),
      supabase.from('unihub_transactions').insert([{
        id: `TX-${Date.now()}`,
        driverId,
        amount: settings.commissionPerSeat,
        type: 'commission',
        timestamp: new Date().toLocaleString()
      }])
    ]);
  };

  const verifyRide = async (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.verificationCode === code) {
      await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId);
      alert("Verified.");
    } else {
      alert("Invalid code.");
    }
  };

  const cancelRide = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    try {
      if (node.status === 'dispatched' && node.assignedDriverId) {
        const driver = drivers.find(d => d.id === node.assignedDriverId);
        if (driver) {
          await supabase.from('unihub_drivers').update({ walletBalance: driver.walletBalance + settings.commissionPerSeat }).eq('id', node.assignedDriverId);
        }
        const resetStatus = (node.isSolo || node.isLongDistance) ? 'qualified' : (node.passengers.length >= 4 ? 'qualified' : 'forming');
        await supabase.from('unihub_nodes').update({ status: resetStatus, assignedDriverId: null, verificationCode: null }).eq('id', nodeId);
      } else {
        await supabase.from('unihub_nodes').delete().eq('id', nodeId);
      }
    } catch (err) {}
  };

  const requestRegistration = async (reg: RegistrationRequest) => {
    await supabase.from('unihub_registrations').insert([reg]);
    alert("Application submitted.");
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

  if (!session) return <AuthPortal onSession={setSession} />;

  return (
    <div 
      className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative"
      style={settings.appWallpaper ? { backgroundImage: `url(${settings.appWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
    >
      {settings.appWallpaper && <div className="absolute inset-0 bg-[#020617]/80 pointer-events-none z-0"></div>}
      
      {isSyncing && (
        <div className="fixed top-4 right-4 z-[300] bg-amber-500/10 text-amber-500 px-4 py-2 rounded-full border border-amber-500/20 text-[10px] font-black uppercase flex items-center gap-2">
           <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div> Grid Syncing
        </div>
      )}

      {/* Sidebar */}
      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl"><i className="fas fa-route text-[#020617] text-xl"></i></div>
          <h1 className="text-2xl font-black italic text-white leading-none">UniHub</h1>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Passenger Hub" onClick={() => setViewMode('passenger')} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Driver Terminal" onClick={() => setViewMode('driver')} />
          {(isVaultAccess || isAdminAuthenticated) && (
            <NavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin Command" onClick={() => setViewMode('admin')} />
          )}
        </div>

        <div className="pt-6 border-t border-white/5 space-y-4">
           <div className="grid grid-cols-2 gap-3">
              <ImpactStat label="Missions" value={stats.missionsCompleted} icon="fa-check-double" color="text-emerald-400" />
              <ImpactStat label="CO2 Save" value={`${stats.co2Saved}kg`} icon="fa-leaf" color="text-sky-400" />
           </div>
           <button onClick={() => { supabase.auth.signOut(); sessionStorage.clear(); }} className="w-full py-4 bg-rose-500/10 text-rose-500 rounded-2xl text-[9px] font-black uppercase border border-rose-500/20">Sign Out</button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar z-10 relative">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="relative group">
            <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-700"></i>
            <input 
              type="text" placeholder="Search routes, drivers, or plate numbers..." 
              className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-800"
              value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </div>

          {viewMode === 'passenger' && <PassengerPortal nodes={nodes} search={globalSearch} drivers={drivers} onJoin={joinNode} onCancel={cancelRide} />}
          {viewMode === 'driver' && <DriverPortal drivers={drivers} activeDriver={activeDriver} search={globalSearch} onLogin={(id, pin) => { const d = drivers.find(d => d.id === id); if (d && d.pin === pin) { setActiveDriverId(id); sessionStorage.setItem('unihub_driver_session_v12', id); } else alert("PIN Invalid"); }} onAccept={acceptRide} onVerify={verifyRide} onRequestRegistration={requestRegistration} missions={missions} onJoinMission={joinMission} dispatchedNodes={nodes.filter(n=>n.status==='dispatched')} qualifiedNodes={nodes.filter(n=>n.status==='qualified')} />}
          {viewMode === 'admin' && <AdminPortal activeTab={activeTab} setActiveTab={setActiveTab} registrationRequests={registrationRequests} onApprove={approveRegistration} drivers={drivers} transactions={transactions} settings={settings} onUpdateSettings={v => supabase.from('unihub_settings').update(v).eq('id', 1)} />}
        </div>
      </main>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const ImpactStat = ({ label, value, icon, color }: any) => (
  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 relative overflow-hidden">
    <i className={`fas ${icon} ${color} absolute top-2 right-2 text-[8px] opacity-20`}></i>
    <p className="text-[7px] font-black uppercase text-slate-500">{label}</p>
    <p className="text-xs font-black text-white italic mt-1">{value}</p>
  </div>
);

const DriverPortal = ({ drivers, activeDriver, search, onLogin, onAccept, onVerify, onRequestRegistration, missions, onJoinMission, qualifiedNodes, dispatchedNodes }: any) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [showReg, setShowReg] = useState(false);
  const [regData, setRegData] = useState<any>({ name: '', vehicleType: 'Pragia', licensePlate: '', pin: '', photoUrl: '' });

  const filteredDrivers = drivers.filter((d: any) => d.name.toLowerCase().includes(search.toLowerCase()) || d.licensePlate.toLowerCase().includes(search.toLowerCase()));

  if (!activeDriver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-in fade-in">
        <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">Driver Terminal</h2>
        {selectedId ? (
          <div className="w-full max-w-sm glass p-10 rounded-[3rem] text-center space-y-8 animate-in zoom-in border border-indigo-500/20">
            <input type="password" maxLength={4} className="w-full bg-white/5 border-b-2 border-indigo-500 text-center text-5xl tracking-[1em] font-black text-white outline-none pb-4" value={pin} onChange={e => setPin(e.target.value)} autoFocus />
            <button onClick={() => onLogin(selectedId, pin)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase">Authenticate</button>
            <button onClick={() => setSelectedId(null)} className="text-[10px] font-black uppercase text-slate-500">Back</button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              {filteredDrivers.map((d: any) => (
                <button key={d.id} onClick={() => setSelectedId(d.id)} className="glass p-8 rounded-[2rem] border border-white/5 flex items-center gap-5 hover:border-amber-500/40 transition-all text-left">
                  {d.photoUrl ? <img src={d.photoUrl} className="w-14 h-14 rounded-xl object-cover" /> : <div className="w-14 h-14 bg-indigo-500/10 rounded-xl flex items-center justify-center"><i className="fas fa-id-card"></i></div>}
                  <div><p className="font-black text-white uppercase italic">{d.name}</p><p className="text-[8px] font-black text-slate-500 uppercase">{d.licensePlate}</p></div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowReg(true)} className="px-12 py-5 bg-amber-500 text-[#020617] rounded-3xl font-black text-xs uppercase shadow-2xl">Join UniHub Fleet</button>
          </div>
        )}

        {showReg && (
          <div className="fixed inset-0 bg-[#020617] z-[400] flex items-center justify-center p-6">
            <div className="w-full max-w-md glass p-10 rounded-[3rem] border border-indigo-500/20 space-y-8 animate-in zoom-in">
              <h3 className="text-2xl font-black italic uppercase text-white text-center">Enroll Driver</h3>
              <div className="flex flex-col items-center gap-4">
                 <label className="w-32 h-32 rounded-3xl bg-white/5 border-2 border-dashed border-indigo-500/20 flex items-center justify-center cursor-pointer overflow-hidden relative group">
                    {regData.photoUrl ? <img src={regData.photoUrl} className="w-full h-full object-cover" /> : <i className="fas fa-camera text-indigo-500/30 text-3xl"></i>}
                    <input type="file" accept="image/*" capture="user" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) setRegData({...regData, photoUrl: await compressImage(file)});
                    }} />
                 </label>
                 <p className="text-[8px] font-black uppercase text-slate-600">Capture Live Selfie</p>
              </div>
              <div className="space-y-4">
                 <AdminInput label="Name" value={regData.name} onChange={v => setRegData({...regData, name: v})} />
                 <AdminInput label="License Plate" value={regData.licensePlate} onChange={v => setRegData({...regData, licensePlate: v})} />
                 <AdminInput label="PIN" value={regData.pin} onChange={v => setRegData({...regData, pin: v})} />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setShowReg(false)} className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase text-slate-500">Abort</button>
                <button onClick={() => { onRequestRegistration({...regData, id: `REG-${Date.now()}`, status: 'pending', timestamp: new Date().toLocaleString()}); setShowReg(false); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase">Submit</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-12">
      <div className="flex justify-between items-center p-10 glass rounded-[3.5rem] border border-indigo-500/20 shadow-2xl overflow-hidden relative">
        <div className="flex items-center gap-8 z-10">
          <img src={activeDriver.photoUrl} className="w-24 h-24 rounded-[2rem] border-4 border-[#020617] object-cover shadow-2xl" />
          <div>
            <h2 className="text-3xl font-black uppercase italic text-white leading-none tracking-tighter">{activeDriver.name}</h2>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-3 animate-pulse">Operational</p>
          </div>
        </div>
        <div className="text-right z-10">
           <p className="text-[10px] font-black uppercase text-slate-500">Wallet</p>
           <p className="text-4xl font-black text-white italic leading-none mt-2">₵ {activeDriver.walletBalance.toFixed(2)}</p>
        </div>
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
         <section className="space-y-6">
            <h3 className="text-xl font-black italic uppercase text-white">Grid Missions</h3>
            <div className="space-y-4">
               {qualifiedNodes.map((n: any) => (
                 <div key={n.id} className="glass p-8 rounded-[2.5rem] border border-white/5 flex justify-between items-center group hover:border-indigo-500/40 transition-all">
                    <div>
                      <p className="font-black text-white italic text-lg uppercase leading-none mb-2">{n.origin} → {n.destination}</p>
                      <p className="text-[9px] font-black text-slate-500 uppercase">Requested by {n.leaderName}</p>
                    </div>
                    <button onClick={() => onAccept(n.id, activeDriver.id)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-xl group-hover:scale-105 transition-all">Accept Dispatch</button>
                 </div>
               ))}
            </div>
         </section>

         <section className="space-y-6">
            <h3 className="text-xl font-black italic uppercase text-white">Active Missions</h3>
            {dispatchedNodes.filter((n:any)=>n.assignedDriverId === activeDriver.id).map((n:any) => (
              <div key={n.id} className="glass p-10 rounded-[3rem] border border-emerald-500/20 space-y-8 animate-in zoom-in">
                 <h4 className="text-2xl font-black italic uppercase text-white leading-none text-center">{n.origin} to {n.destination}</h4>
                 <div className="space-y-6">
                    <p className="text-[9px] font-black uppercase text-slate-500 text-center tracking-widest">Verify passenger code to finish</p>
                    <input className="w-full bg-[#020617] border border-white/5 rounded-2xl py-6 text-center text-4xl font-black italic text-white outline-none focus:border-emerald-500" placeholder="0000" id={`verify-${n.id}`} maxLength={4} />
                    <button onClick={() => onVerify(n.id, (document.getElementById(`verify-${n.id}`) as HTMLInputElement).value)} className="w-full py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl">Complete Mission</button>
                 </div>
              </div>
            ))}
         </section>
      </div>
    </div>
  );
};

const PassengerPortal = ({ nodes, search, drivers, onJoin, onCancel }: any) => {
  const filteredNodes = nodes.filter((n: any) => n.status !== 'completed' && (n.origin.toLowerCase().includes(search.toLowerCase()) || n.destination.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-8 animate-in fade-in">
       <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-none">Global Grid</h2>
          <button className="px-10 py-5 bg-amber-500 text-[#020617] rounded-3xl font-black uppercase text-[10px] shadow-xl hover:scale-105 transition-all">Form Node</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-1">
          {filteredNodes.map((node: any) => {
             const driver = drivers.find((d: any) => d.id === node.assignedDriverId);
             return (
              <div key={node.id} className="glass p-10 rounded-[3.5rem] border border-white/5 space-y-10 group hover:border-amber-500/30 transition-all shadow-xl relative overflow-hidden">
                 <div className="flex justify-between items-start">
                    <span className="px-5 py-2 bg-indigo-600/20 text-indigo-400 rounded-2xl text-[8px] font-black uppercase shadow-inner tracking-widest">{node.status}</span>
                    <p className="text-xl font-black text-emerald-400 italic">₵{node.farePerPerson}/p</p>
                 </div>
                 <p className="text-2xl font-black text-white uppercase italic group-hover:text-amber-500 transition-colors leading-tight">{node.origin} → {node.destination}</p>
                 
                 {node.status === 'dispatched' && driver && (
                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 animate-in slide-in-from-bottom-4">
                       <img src={driver.photoUrl} className="w-12 h-12 rounded-xl object-cover" />
                       <div><p className="text-[10px] font-black text-white uppercase leading-none">{driver.name}</p><p className="text-[8px] text-slate-500 font-black mt-2">{driver.licensePlate}</p></div>
                    </div>
                 )}

                 <div className="flex gap-2">
                    {Array.from({length: node.capacityNeeded}).map((_, i) => (
                      <div key={i} className={`w-3 h-3 rounded-full transition-all duration-500 ${i < node.passengers.length ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-white/5'}`}></div>
                    ))}
                 </div>
              </div>
          )})}
       </div>
    </div>
  );
};

const AdminPortal = ({ activeTab, setActiveTab, registrationRequests, onApprove, drivers, transactions }: any) => {
  const netProfit = useMemo(() => transactions.reduce((a:number, b:any) => a + b.amount, 0), [transactions]);

  return (
    <div className="space-y-10 animate-in fade-in">
       <div className="flex bg-white/5 p-2 rounded-3xl border border-white/10 w-fit shadow-inner">
          <TabBtn active={activeTab === 'monitor'} label="Metrics" onClick={() => setActiveTab('monitor')} />
          <TabBtn active={activeTab === 'onboarding'} label="Verify" onClick={() => setActiveTab('onboarding')} count={registrationRequests.filter((r:any)=>r.status==='pending').length} />
          <TabBtn active={activeTab === 'settings'} label="Setup" onClick={() => setActiveTab('settings')} />
       </div>
       
       {activeTab === 'monitor' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="glass p-12 rounded-[4rem] border border-white/5 flex flex-col justify-center text-center space-y-4 shadow-2xl relative overflow-hidden">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] z-10">Total Grid Revenue</p>
                <p className="text-7xl font-black text-white italic tracking-tighter z-10 leading-none">₵ {netProfit.toFixed(0)}</p>
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-transparent opacity-50"></div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <ImpactStat label="Fleet Growth" value="+12%" icon="fa-arrow-trend-up" color="text-emerald-400" />
                <ImpactStat label="Live Dispatch" value="23" icon="fa-network-wired" color="text-indigo-400" />
                <ImpactStat label="Hub Latency" value="12ms" icon="fa-bolt" color="text-amber-400" />
                <ImpactStat label="Safety Grade" value="A+" icon="fa-shield-heart" color="text-rose-400" />
             </div>
          </div>
       )}

       {activeTab === 'onboarding' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in">
            {registrationRequests.filter((r:any)=>r.status==='pending').map((reg: any) => (
              <div key={reg.id} className="glass p-10 rounded-[3.5rem] border border-indigo-500/20 space-y-8 shadow-xl">
                 <img src={reg.photoUrl} className="w-32 h-32 rounded-full border-8 border-[#020617] mx-auto object-cover shadow-2xl" />
                 <div className="text-center space-y-2">
                    <h4 className="text-2xl font-black uppercase italic text-white leading-none tracking-tighter">{reg.name}</h4>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{reg.licensePlate}</p>
                 </div>
                 <div className="flex gap-4 pt-4 border-t border-white/5">
                    <button className="flex-1 py-5 bg-white/5 rounded-2xl text-[9px] font-black uppercase text-slate-500">Decline</button>
                    <button onClick={() => onApprove(reg.id)} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[9px] shadow-xl">Verify & Deploy</button>
                 </div>
              </div>
            ))}
         </div>
       )}
    </div>
  );
};

const AdminInput = ({ label, value, onChange }: { label: string, value: any, onChange: (v: string) => void }) => (
  <div className="space-y-2 w-full text-left">
     <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-4">{label}</label>
     <input className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none focus:border-amber-500 transition-all shadow-inner" value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

const NavItem = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center px-6 py-5 rounded-2xl transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-xl scale-[1.03]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
    <i className={`fas ${icon} text-lg mr-4 w-6`}></i>
    <span className="text-sm font-black uppercase tracking-widest leading-none">{label}</span>
  </button>
);

const TabBtn = ({ active, label, onClick, count }: any) => (
  <button onClick={onClick} className={`px-10 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${active ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:bg-white/5'}`}>
    {label} {count !== undefined && count > 0 && <span className="ml-3 bg-rose-500 text-white text-[8px] px-2 py-1 rounded-full">{count}</span>}
  </button>
);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
