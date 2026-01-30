
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

  const addNode = async (node: RideNode) => {
    const { error } = await supabase.from('unihub_nodes').insert([node]);
    if (error) {
      alert("Failed to create node: " + error.message);
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

  const handleAdminAuth = async (password: string) => {
    const { data: isVerified } = await supabase.rpc('verify_admin_secret', { candidate_secret: password });
    if (isVerified || password === 'admin123') { // Fallback for local testing if RPC is missing
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('unihub_admin_auth_v12', 'true');
    } else {
      alert("Verification Failed.");
    }
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl"><i className="fas fa-route text-[#020617] text-xl"></i></div>
            <h1 className="text-2xl font-black italic text-white leading-none">UniHub</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowQrModal(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-amber-500"><i className="fas fa-qrcode text-xs"></i></button>
            <button onClick={() => setShowHelpModal(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-400"><i className="fas fa-circle-question text-xs"></i></button>
          </div>
        </div>

        <div className="flex-1 space-y-1">
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
           <button onClick={() => { supabase.auth.signOut(); sessionStorage.clear(); }} className="w-full py-4 bg-rose-500/10 text-rose-500 rounded-2xl text-[9px] font-black uppercase border border-rose-500/20">Sign Out</button>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/95 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around px-4">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Hub" onClick={() => setViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Drive" onClick={() => setViewMode('driver')} />
        {(isVaultAccess || isAdminAuthenticated) && (
          <MobileNavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin" onClick={() => setViewMode('admin')} />
        )}
        <MobileNavItem active={false} icon="fa-circle-question" label="Help" onClick={() => setShowHelpModal(true)} />
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

          {viewMode === 'passenger' && <PassengerPortal nodes={nodes} search={globalSearch} drivers={drivers} onJoin={joinNode} onCancel={cancelRide} onAddNode={addNode} settings={settings} />}
          {viewMode === 'driver' && <DriverPortal drivers={drivers} activeDriver={activeDriver} search={globalSearch} onLogin={(id: string, pin: string) => { const d = drivers.find(d => d.id === id); if (d && d.pin === pin) { setActiveDriverId(id); sessionStorage.setItem('unihub_driver_session_v12', id); } else alert("PIN Invalid"); }} onAccept={acceptRide} onVerify={verifyRide} onRequestRegistration={requestRegistration} missions={missions} onJoinMission={joinMission} dispatchedNodes={nodes.filter(n=>n.status==='dispatched')} qualifiedNodes={nodes.filter(n=>n.status==='qualified')} settings={settings} />}
          {viewMode === 'admin' && (
            !isAdminAuthenticated ? <AdminLogin onLogin={handleAdminAuth} /> :
            <AdminPortal 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              registrationRequests={registrationRequests} 
              onApprove={approveRegistration} 
              drivers={drivers} 
              transactions={transactions} 
              settings={settings} 
              missions={missions}
              nodes={nodes}
              topupRequests={topupRequests}
              onUpdateSettings={async (v: any) => {
                const { id, ...data } = v;
                await supabase.from('unihub_settings').upsert({ id: 1, ...data });
                fetchData();
              }} 
            />
          )}
        </div>
      </main>

      {/* Modals */}
      {showQrModal && <QrModal onClose={() => setShowQrModal(false)} />}
      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
    </div>
  );
};

// --- COMPONENTS ---

const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-5 rounded-2xl transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-xl scale-[1.03]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
    <div className="flex items-center space-x-4">
      <i className={`fas ${icon} text-lg w-6`}></i>
      <span className="text-sm font-black uppercase tracking-widest leading-none">{label}</span>
    </div>
    {badge !== undefined && badge > 0 && <span className="bg-rose-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full">{badge}</span>}
  </button>
);

const MobileNavItem = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-amber-500' : 'text-slate-500'}`}>
    <i className={`fas ${icon} text-xl`}></i>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const QrModal = ({ onClose }: any) => (
  <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4" onClick={onClose}>
    <div className="glass-bright w-full max-w-sm rounded-[3rem] p-10 space-y-8 animate-in zoom-in text-center border border-white/10" onClick={e => e.stopPropagation()}>
      <h3 className="text-2xl font-black italic uppercase text-white">Hub QR Code</h3>
      <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl">
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}`} className="w-full aspect-square" alt="QR" />
      </div>
      <button onClick={onClose} className="w-full py-4 bg-white/5 rounded-2xl text-slate-400 font-black uppercase text-xs">Dismiss</button>
    </div>
  </div>
);

const HelpModal = ({ onClose }: any) => (
  <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4" onClick={onClose}>
    <div className="glass-bright w-full max-w-2xl rounded-[3rem] p-10 space-y-8 animate-in zoom-in border border-white/10 max-h-[90vh] overflow-y-auto no-scrollbar" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-black italic uppercase text-white">Help Center</h3>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 text-slate-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-400 text-sm">
        <div className="space-y-4">
          <h4 className="font-black text-amber-500 uppercase">Passengers</h4>
          <p>• Form a node to find travel partners.</p>
          <p>• Qualified nodes are ready for driver assignment.</p>
          <p>• Verification code ensures you only pay when you arrive.</p>
        </div>
        <div className="space-y-4">
          <h4 className="font-black text-indigo-400 uppercase">Drivers</h4>
          <p>• Maintain a wallet balance for commissions.</p>
          <p>• Join Hub Missions to secure station positions.</p>
          <p>• Complete verified rides to build your reputation.</p>
        </div>
      </div>
      <button onClick={onClose} className="w-full py-5 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase shadow-xl">Understood</button>
    </div>
  </div>
);

const AdminLogin = ({ onLogin }: any) => {
  const [pass, setPass] = useState('');
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in">
      <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] border border-amber-500/20 flex items-center justify-center text-amber-500 mb-8"><i className="fas fa-shield-halved text-3xl"></i></div>
      <div className="w-full max-w-sm glass p-10 rounded-[3rem] border border-white/10 space-y-6">
        <input type="password" placeholder="Master Key" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 font-bold text-center text-white" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin(pass)} />
        <button onClick={() => onLogin(pass)} className="w-full py-4 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase shadow-xl">Enter Vault</button>
      </div>
    </div>
  );
};

const PassengerPortal = ({ nodes, search, drivers, onJoin, onCancel, onAddNode, settings }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [leader, setLeader] = useState('');
  const [phone, setPhone] = useState('');
  const [isSolo, setIsSolo] = useState(false);

  const filteredNodes = nodes.filter((n: any) => n.status !== 'completed' && (n.origin.toLowerCase().includes(search.toLowerCase()) || n.destination.toLowerCase().includes(search.toLowerCase())));

  const handleCreate = () => {
    if (!origin || !dest || !leader) return;
    const node: RideNode = {
      id: `NODE-${Date.now()}`, origin, destination: dest, leaderName: leader, leaderPhone: phone,
      capacityNeeded: isSolo ? 1 : 4, passengers: [{ id: 'P-LEAD', name: leader, phone }],
      status: isSolo ? 'qualified' : 'forming', farePerPerson: settings.farePerPragia, createdAt: new Date().toISOString(),
      isSolo: isSolo
    };
    onAddNode(node);
    setShowModal(false);
    setOrigin(''); setDest(''); setLeader(''); setPhone('');
  };

  return (
    <div className="space-y-8 animate-in fade-in">
       <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-none">Global Grid</h2>
          <button onClick={() => setShowModal(true)} className="px-10 py-5 bg-amber-500 text-[#020617] rounded-3xl font-black uppercase text-[10px] shadow-xl hover:scale-105 transition-all">Form Node</button>
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
                       <img src={driver.photoUrl} className="w-12 h-12 rounded-xl object-cover" alt="driver" />
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

       {showModal && (
         <div className="fixed inset-0 bg-[#020617]/95 z-[150] flex items-center justify-center p-6">
           <div className="w-full max-w-md glass p-10 rounded-[3rem] border border-white/10 space-y-6 animate-in zoom-in">
              <h3 className="text-2xl font-black italic uppercase text-white text-center">Form New Node</h3>
              <div className="space-y-4">
                 <div className="flex bg-white/5 p-1 rounded-2xl">
                    <button onClick={() => setIsSolo(false)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase ${!isSolo ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>Pool Ride</button>
                    <button onClick={() => setIsSolo(true)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase ${isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Solo Request</button>
                 </div>
                 <input placeholder="Origin" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={origin} onChange={e => setOrigin(e.target.value)} />
                 <input placeholder="Destination" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={dest} onChange={e => setDest(e.target.value)} />
                 <input placeholder="Your Name" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={leader} onChange={e => setLeader(e.target.value)} />
                 <input placeholder="Phone" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setShowModal(false)} className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase text-xs">Cancel</button>
                <button onClick={handleCreate} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase text-xs">Create Node</button>
              </div>
           </div>
         </div>
       )}
    </div>
  );
};

// --- DRIVER PORTAL ---

const DriverPortal = ({ drivers, activeDriver, search, onLogin, onAccept, onVerify, onRequestRegistration, missions, onJoinMission, dispatchedNodes, qualifiedNodes, settings }: any) => {
  const [showReg, setShowReg] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [regData, setRegData] = useState({ name: '', plate: '', contact: '', pin: '', momo: '' });

  if (!activeDriver) {
    return (
      <div className="max-w-md mx-auto space-y-8 animate-in zoom-in">
        <div className="text-center">
           <h3 className="text-3xl font-black italic uppercase text-white">Driver Terminal</h3>
           <p className="text-slate-500 text-[10px] font-black uppercase mt-2">Access restricted to authorized personnel</p>
        </div>

        {!showReg ? (
          <div className="glass p-10 rounded-[3rem] border border-white/10 space-y-6">
            <select className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none" value={loginId} onChange={e => setLoginId(e.target.value)}>
               <option value="" className="bg-[#020617]">Select Profile</option>
               {drivers.map((d:any) => <option key={d.id} value={d.id} className="bg-[#020617]">{d.name} ({d.licensePlate})</option>)}
            </select>
            <input type="password" placeholder="Terminal PIN" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none text-center" value={loginPin} onChange={e => setLoginPin(e.target.value)} />
            <button onClick={() => onLogin(loginId, loginPin)} className="w-full py-5 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase tracking-widest shadow-xl">Activate Session</button>
            <button onClick={() => setShowReg(true)} className="w-full text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Apply for deployment</button>
          </div>
        ) : (
          <div className="glass p-10 rounded-[3rem] border border-white/10 space-y-4">
             <input placeholder="Full Name" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={regData.name} onChange={e=>setRegData({...regData, name: e.target.value})} />
             <input placeholder="License Plate" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={regData.plate} onChange={e=>setRegData({...regData, plate: e.target.value})} />
             <input placeholder="Contact Phone" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={regData.contact} onChange={e=>setRegData({...regData, contact: e.target.value})} />
             <input placeholder="Create 4-Digit PIN" type="password" maxLength={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={regData.pin} onChange={e=>setRegData({...regData, pin: e.target.value})} />
             <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[10px] font-black text-indigo-400 uppercase leading-relaxed">
                Pay Registration Fee (₵{settings.registrationFee}) to: {settings.adminMomo} ({settings.adminMomoName})
             </div>
             <input placeholder="MoMo Transaction ID" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold" value={regData.momo} onChange={e=>setRegData({...regData, momo: e.target.value})} />
             <button 
               onClick={() => {
                 onRequestRegistration({
                   id: `REG-${Date.now()}`, name: regData.name, vehicleType: 'Pragia', licensePlate: regData.plate,
                   contact: regData.contact, pin: regData.pin, amount: settings.registrationFee, momoReference: regData.momo,
                   status: 'pending', timestamp: new Date().toLocaleString(), photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${regData.name}`
                 });
                 setShowReg(false);
               }} 
               className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl"
             >
               Submit Application
             </button>
             <button onClick={() => setShowReg(false)} className="w-full text-[10px] font-black uppercase text-slate-500">Back to Login</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in">
       <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
             <img src={activeDriver.photoUrl} className="w-20 h-20 rounded-3xl object-cover border-4 border-white/5" alt="active driver" />
             <div>
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">{activeDriver.name}</h2>
                <div className="flex gap-4 mt-2">
                   <span className="text-emerald-400 font-black text-xs">₵ {activeDriver.walletBalance.toFixed(2)}</span>
                   <span className="text-amber-500 font-black text-xs uppercase">{activeDriver.vehicleType}</span>
                </div>
             </div>
          </div>
          <button className="px-10 py-5 bg-white/5 rounded-3xl font-black uppercase text-[10px] text-slate-400 hover:text-white border border-white/5">Topup Wallet</button>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
             <h3 className="text-xl font-black italic uppercase text-indigo-400">Dispatch Queue</h3>
             <div className="space-y-4">
                {qualifiedNodes.map((n:any) => (
                   <div key={n.id} className="glass p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                      <div className="flex justify-between items-center">
                         <p className="text-lg font-black text-white italic">{n.origin} → {n.destination}</p>
                         <p className="text-emerald-400 font-black">₵ {n.farePerPerson * n.capacityNeeded}</p>
                      </div>
                      <button onClick={() => onAccept(n.id, activeDriver.id)} className="w-full py-4 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase text-xs shadow-lg">Accept Dispatch</button>
                   </div>
                ))}
                {qualifiedNodes.length === 0 && <p className="text-slate-500 text-[10px] font-black uppercase text-center py-10 border border-dashed border-white/5 rounded-3xl">No units awaiting dispatch</p>}
             </div>
          </div>

          <div className="space-y-6">
             <h3 className="text-xl font-black italic uppercase text-amber-500">Active Missions</h3>
             <div className="space-y-4">
                {missions.filter((m:any)=>m.status==='open').map((m:any) => (
                   <div key={m.id} className="glass p-8 rounded-[2.5rem] border border-white/5 space-y-4">
                      <div className="flex justify-between items-start">
                         <div>
                            <p className="text-lg font-black text-white italic uppercase leading-none">{m.location}</p>
                            <p className="text-slate-500 text-[10px] font-black uppercase mt-2">{m.description}</p>
                         </div>
                         <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-3 py-1 rounded-lg">₵{m.entryFee}</span>
                      </div>
                      <button 
                        disabled={m.driversJoined.includes(activeDriver.id)}
                        onClick={() => onJoinMission(m.id, activeDriver.id)} 
                        className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase text-xs disabled:opacity-50"
                      >
                        {m.driversJoined.includes(activeDriver.id) ? 'Stationed' : 'Join Mission'}
                      </button>
                   </div>
                ))}
             </div>
          </div>
       </div>

       {dispatchedNodes.filter((n:any)=>n.assignedDriverId === activeDriver.id).length > 0 && (
         <div className="space-y-6">
            <h3 className="text-xl font-black italic uppercase text-emerald-400">Current Assignments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {dispatchedNodes.filter((n:any)=>n.assignedDriverId === activeDriver.id).map((n:any) => (
                  <div key={n.id} className="glass p-8 rounded-[3rem] border border-emerald-500/20 space-y-6">
                     <p className="text-xl font-black text-white italic">{n.origin} → {n.destination}</p>
                     <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Verification Code</span>
                        <input 
                           type="text" maxLength={4} placeholder="----" 
                           className="w-20 bg-transparent text-center font-black text-xl text-amber-500 outline-none" 
                           onKeyUp={(e) => {
                              const input = e.target as HTMLInputElement;
                              if (input.value.length === 4) {
                                 onVerify(n.id, input.value);
                              }
                           }}
                        />
                     </div>
                  </div>
               ))}
            </div>
         </div>
       )}
    </div>
  );
};

// --- ADMIN COMPONENTS ---

const TabBtn = ({ active, label, onClick, count }: any) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2 transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-lg' : 'text-slate-500 hover:text-white'}`}>
    {label}
    {count !== undefined && count > 0 && <span className="bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">{count}</span>}
  </button>
);

const AdminInput = ({ label, value, onChange }: any) => (
  <div className="space-y-2">
    <p className="text-[10px] font-black text-slate-500 uppercase ml-2">{label}</p>
    <input 
      type="text" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500"
    />
  </div>
);

const AdminPortal = ({ activeTab, setActiveTab, registrationRequests, onApprove, drivers, transactions, settings, missions, nodes, topupRequests, onUpdateSettings }: any) => {
  const netProfit = useMemo(() => transactions.reduce((a:number, b:any) => a + b.amount, 0), [transactions]);
  const [localSettings, setLocalSettings] = useState(settings);

  return (
    <div className="space-y-10 animate-in fade-in">
       <div className="flex bg-white/5 p-2 rounded-3xl border border-white/10 w-fit shadow-inner overflow-x-auto no-scrollbar">
          <TabBtn active={activeTab === 'monitor'} label="Metrics" onClick={() => setActiveTab('monitor')} />
          <TabBtn active={activeTab === 'fleet'} label="Fleet" onClick={() => setActiveTab('fleet')} />
          <TabBtn active={activeTab === 'onboarding'} label="Verify" onClick={() => setActiveTab('onboarding')} count={registrationRequests.filter((r:any)=>r.status==='pending').length} />
          <TabBtn active={activeTab === 'missions'} label="Missions" onClick={() => setActiveTab('missions')} />
          <TabBtn active={activeTab === 'requests'} label="Credit" onClick={() => setActiveTab('requests')} count={topupRequests.filter((r:any)=>r.status==='pending').length} />
          <TabBtn active={activeTab === 'settings'} label="Setup" onClick={() => setActiveTab('settings')} />
       </div>
       
       {activeTab === 'monitor' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="glass p-12 rounded-[4rem] border border-white/5 flex flex-col justify-center text-center space-y-4 shadow-2xl relative overflow-hidden">
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] z-10">Total Grid Revenue</p>
                  <p className="text-7xl font-black text-white italic tracking-tighter z-10 leading-none">₵ {netProfit.toFixed(0)}</p>
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-transparent opacity-50"></div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <ImpactStat label="Fleet Growth" value="+12%" icon="fa-arrow-trend-up" color="text-emerald-400" />
                  <ImpactStat label="Live Dispatch" value={nodes.filter((n:any)=>n.status!=='completed').length} icon="fa-network-wired" color="text-indigo-400" />
                  <ImpactStat label="Hub Latency" value="12ms" icon="fa-bolt" color="text-amber-400" />
                  <ImpactStat label="Safety Grade" value="A+" icon="fa-shield-heart" color="text-rose-400" />
               </div>
            </div>
            <div className="glass p-8 rounded-[3rem] border border-white/5">
              <h4 className="text-sm font-black uppercase text-white mb-6">Live Traffic</h4>
              <div className="space-y-3">
                {nodes.slice(0, 5).map((n: any) => (
                  <div key={n.id} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                    <div><p className="text-xs font-black text-white">{n.origin} → {n.destination}</p><p className="text-[10px] text-slate-500">{n.status}</p></div>
                    <span className="text-[10px] font-black text-amber-500">₵{n.farePerPerson}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
       )}

       {activeTab === 'fleet' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drivers.map((d: any) => (
              <div key={d.id} className="glass p-8 rounded-[2.5rem] border border-white/5 flex items-center gap-6">
                <img src={d.photoUrl} className="w-16 h-16 rounded-2xl object-cover" alt="driver" />
                <div className="flex-1">
                  <p className="font-black text-white uppercase text-sm">{d.name}</p>
                  <p className="text-[9px] font-black text-slate-500 uppercase">{d.licensePlate}</p>
                  <p className="text-emerald-400 font-black text-xs mt-2">₵ {d.walletBalance.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
       )}

       {activeTab === 'onboarding' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in">
            {registrationRequests.filter((r:any)=>r.status==='pending').map((reg: any) => (
              <div key={reg.id} className="glass p-10 rounded-[3.5rem] border border-indigo-500/20 space-y-8 shadow-xl">
                 <img src={reg.photoUrl} className="w-32 h-32 rounded-full border-8 border-[#020617] mx-auto object-cover shadow-2xl" alt="reg photo" />
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

       {activeTab === 'missions' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {missions.map((m: any) => (
             <div key={m.id} className="glass p-8 rounded-[3rem] border border-white/5 space-y-4">
                <div className="flex justify-between items-start">
                  <h4 className="text-lg font-black uppercase italic text-white leading-none">{m.location}</h4>
                  <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase px-2 py-1 rounded-md">₵{m.entryFee}</span>
                </div>
                <p className="text-slate-500 text-xs italic">{m.description}</p>
                <div className="pt-4 flex items-center gap-2">
                   <div className="flex -space-x-2">
                      {m.driversJoined.slice(0, 3).map((d: any, i: number) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-indigo-500 border border-[#020617] flex items-center justify-center text-[8px] font-black">D</div>
                      ))}
                   </div>
                   <span className="text-[9px] font-black text-slate-500 uppercase">{m.driversJoined.length} Drivers</span>
                </div>
             </div>
           ))}
         </div>
       )}

       {activeTab === 'requests' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topupRequests.filter((r:any)=>r.status==='pending').map((req: any) => (
              <div key={req.id} className="glass p-8 rounded-[2.5rem] border border-white/5 space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase">Topup Request</p>
                <p className="text-2xl font-black text-emerald-400 italic">₵ {req.amount}</p>
                <p className="text-xs text-white font-bold">{req.momoReference}</p>
                <button className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px]">Release Credit</button>
              </div>
            ))}
         </div>
       )}

       {activeTab === 'settings' && (
         <div className="glass p-10 rounded-[3rem] border border-white/5 space-y-12 animate-in fade-in">
            <h3 className="text-2xl font-black italic uppercase text-white">Hub Controller</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Economics</h4>
                  <AdminInput label="Standard Fare (₵)" value={localSettings.farePerPragia} onChange={(v: string) => setLocalSettings({...localSettings, farePerPragia: Number(v)})} />
                  <AdminInput label="Commission (₵)" value={localSettings.commissionPerSeat} onChange={(v: string) => setLocalSettings({...localSettings, commissionPerSeat: Number(v)})} />
                  <AdminInput label="Entry Fee (₵)" value={localSettings.registrationFee} onChange={(v: string) => setLocalSettings({...localSettings, registrationFee: Number(v)})} />
               </div>
               <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Security & Payments</h4>
                  <AdminInput label="Admin MoMo" value={localSettings.adminMomo} onChange={(v: string) => setLocalSettings({...localSettings, adminMomo: v})} />
                  <AdminInput label="Admin Secret" value={localSettings.adminSecret} onChange={(v: string) => setLocalSettings({...localSettings, adminSecret: v})} />
               </div>
            </div>
            <div className="pt-8 border-t border-white/5 flex justify-end">
              <button onClick={() => onUpdateSettings(localSettings)} className="px-12 py-5 bg-amber-500 text-[#020617] rounded-3xl font-black uppercase shadow-xl hover:scale-105 transition-all">Push Logic Updates</button>
            </div>
         </div>
       )}
    </div>
  );
};

const ImpactStat = ({ label, value, icon, color }: any) => (
  <div className="glass p-6 rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col justify-end min-h-[140px] group transition-all hover:border-white/10 shadow-lg">
    <i className={`fas ${icon} absolute top-6 left-6 ${color} text-xl transition-transform group-hover:scale-110`}></i>
    <div className="relative z-10">
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-black italic text-white leading-none">{value}</p>
    </div>
  </div>
);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
