
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CLIENT ---
const SUPABASE_URL = "https://kzjgihwxiaeqzopeuzhm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- GEMINI INITIALIZATION ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- TYPES & INTERFACES ---

type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed'; 
type PortalMode = 'passenger' | 'driver' | 'admin';

interface SearchConfig {
  query: string;
  vehicleType: VehicleType | 'All';
  status: NodeStatus | 'All';
  sortBy: 'newest' | 'price' | 'capacity';
  isSolo: boolean | null;
}

interface UniUser {
  id: string;
  username: string;
  phone: string;
}

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
  vehicleType?: VehicleType; 
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
  avatarUrl?: string; 
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
  avatarUrl?: string; 
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
  hub_announcement?: string; 
}

// --- UTILS ---

const shareHub = async () => {
  const shareData = {
    title: 'NexRyde Dispatch',
    text: 'Join the smartest ride-sharing platform on campus! Save costs and move fast.',
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
    ? `🚀 *Premium NexRyde Trip!* \n📍 *From:* ${node.origin}\n📍 *To:* ${node.destination}\nPartner bidding open!`
    : node.isSolo 
    ? `🚀 *Solo NexRyde Trip!* \n📍 *Route:* ${node.origin} → ${node.destination}\nPartner needed now!`
    : `🚀 *NexRyde Pool!* \n📍 *Route:* ${node.origin} → ${node.destination}\n👥 *Seats Left:* ${seatsLeft}\n💰 *₵${node.farePerPerson}/p*`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'NexRyde Update',
        text: message,
        url: window.location.origin
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  } catch (err) {
    console.log('Trip share failed', err);
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
        const MAX_WIDTH = maxWidth; 
        const MAX_HEIGHT = maxWidth;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
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

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'requests' | 'settings' | 'missions' | 'onboarding'>('monitor');
  
  const [session, setSession] = useState<any>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UniUser | null>(() => {
    const saved = localStorage.getItem('nexryde_user_v1');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => {
    return sessionStorage.getItem('nexryde_driver_session_v1');
  });

  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    query: '', vehicleType: 'All', status: 'All', sortBy: 'newest', isSolo: null
  });

  const [myRideIds, setMyRideIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nexryde_my_rides_v1');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [isNewUser, setIsNewUser] = useState(() => !localStorage.getItem('nexryde_seen_welcome_v1'));
  const [isSyncing, setIsSyncing] = useState(true);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState(() => sessionStorage.getItem('nexryde_dismissed_announcement'));

  const [settings, setSettings] = useState<AppSettings>({
    adminMomo: "024-123-4567", adminMomoName: "NexRyde Admin", whatsappNumber: "233241234567", commissionPerSeat: 2.00, farePerPragia: 5.00, farePerTaxi: 8.00, soloMultiplier: 2.5, aboutMeText: "Welcome to NexRyde Logistics.", aboutMeImages: [], appWallpaper: "", registrationFee: 20.00, hub_announcement: ""
  });
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [missions, setMissions] = useState<HubMission[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);

  const fetchData = async () => {
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

      if (sData) {
        setSettings(sData as AppSettings);
        const currentMsg = sData.hub_announcement || '';
        if (currentMsg !== sessionStorage.getItem('nexryde_last_announcement')) {
          setDismissedAnnouncement(null);
          sessionStorage.removeItem('nexryde_dismissed_announcement');
          sessionStorage.setItem('nexryde_last_announcement', currentMsg);
        }
      }
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
      setIsAdminAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAdminAuthenticated(!!session);
    });

    fetchData();

    const channels = [
      supabase.channel('public:unihub_settings').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_settings' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_nodes').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_nodes' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_drivers').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_drivers' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_missions').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_missions' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_transactions').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_transactions' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_topups').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_topups' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_registrations').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_registrations' }, () => fetchData()).subscribe()
    ];

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      subscription.unsubscribe();
    };
  }, []);

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  const handleGlobalUserAuth = async (username: string, phone: string, mode: 'login' | 'signup') => {
    if (!phone) { alert("Verification details required."); return; }
    setIsSyncing(true);
    try {
      const { data } = await supabase.from('unihub_users').select('*').eq('phone', phone).maybeSingle();
      if (mode === 'login') {
        if (!data) { alert("Profile not found! Please create an account first."); setIsSyncing(false); return; }
        const user = data as UniUser;
        setCurrentUser(user);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(user));
      } else {
        if (data) { alert("An account with this phone already exists! Please Sign In."); setIsSyncing(false); return; }
        if (!username) { alert("Please enter a username for your profile."); setIsSyncing(false); return; }
        const newUser = { id: `USER-${Date.now()}`, username, phone };
        const { error: insertErr } = await supabase.from('unihub_users').insert([newUser]);
        if (insertErr) throw insertErr;
        setCurrentUser(newUser);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(newUser));
      }
    } catch (err: any) { alert("Identity Error: " + err.message); } finally { setIsSyncing(false); }
  };

  const handleLogout = () => {
    if (confirm("Sign out of NexRyde?")) {
      localStorage.removeItem('nexryde_user_v1');
      setCurrentUser(null);
    }
  };

  const approveRegistration = async (reqId: string) => {
    const reg = registrationRequests.find(r => r.id === reqId);
    if (!reg || reg.status !== 'pending') return;

    const newDriver: Driver = {
      id: `DRV-${Date.now()}`,
      name: reg.name,
      vehicleType: reg.vehicleType,
      licensePlate: reg.licensePlate,
      contact: reg.contact,
      pin: reg.pin,
      walletBalance: 0,
      rating: 5.0,
      status: 'online',
      avatarUrl: reg.avatarUrl
    };

    try {
      await Promise.all([
        supabase.from('unihub_drivers').insert([newDriver]),
        supabase.from('unihub_registrations').update({ status: 'approved' }).eq('id', reqId),
        supabase.from('unihub_transactions').insert([{
          id: `TX-REG-${Date.now()}`,
          driverId: newDriver.id,
          amount: reg.amount,
          type: 'registration',
          timestamp: new Date().toLocaleString()
        }])
      ]);
      alert("Partner approved and activated!");
    } catch (err: any) {
      console.error("Approval error:", err);
      alert("Activation failed: " + err.message);
    }
  };

  const registerDriver = async (d: Omit<Driver, 'id' | 'walletBalance' | 'rating' | 'status'>) => {
    const newDriver: Driver = {
      ...d,
      id: `DRV-${Date.now()}`,
      walletBalance: 0,
      rating: 5.0,
      status: 'online'
    };
    try {
      const { error } = await supabase.from('unihub_drivers').insert([newDriver]);
      if (error) throw error;
      alert(`Partner ${d.name} registered successfully!`);
    } catch (err: any) {
      alert(`Failed to register: ${err.message}.`);
    }
  };

  const handleDriverAuth = (driverId: string, pin: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver && driver.pin === pin) {
      setActiveDriverId(driverId);
      sessionStorage.setItem('nexryde_driver_session_v1', driverId);
      setViewMode('driver');
    } else { alert("Access Denied: Invalid Partner Password"); }
  };

  const handleDriverLogout = () => {
    setActiveDriverId(null);
    sessionStorage.removeItem('nexryde_driver_session_v1');
    setViewMode('passenger');
  };

  /**
   * FIX: Added missing identifiers and logic derived from requirements.
   */
  const isVaultAccess = false; 
  const pendingRequestsCount = useMemo(() => {
    return topupRequests.filter(r => r.status === 'pending').length + registrationRequests.filter(r => r.status === 'pending').length;
  }, [topupRequests, registrationRequests]);
  const onlineDriverCount = useMemo(() => drivers.filter(d => d.status === 'online').length, [drivers]);
  const activeNodeCount = useMemo(() => nodes.filter(n => n.status !== 'completed').length, [nodes]);
  const hubRevenue = useMemo(() => transactions.reduce((acc, curr) => acc + curr.amount, 0), [transactions]);

  const joinNode = async (nodeId: string, name: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (node.passengers.length >= node.capacityNeeded) {
      alert("This ride is full!");
      return;
    }
    const updatedPassengers = [...node.passengers, { id: `P-${Date.now()}`, name, phone }];
    const status = updatedPassengers.length === node.capacityNeeded ? 'qualified' : node.status;
    try {
      await supabase.from('unihub_nodes').update({ passengers: updatedPassengers, status }).eq('id', nodeId);
      const newMyRideIds = [...myRideIds, nodeId];
      setMyRideIds(newMyRideIds);
      localStorage.setItem('nexryde_my_rides_v1', JSON.stringify(newMyRideIds));
    } catch (err) { console.error(err); }
  };

  const joinMission = async (missionId: string, driverId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;
    if (mission.driversJoined.includes(driverId)) return;
    try {
      await supabase.from('unihub_missions').update({ driversJoined: [...mission.driversJoined, driverId] }).eq('id', missionId);
    } catch (err) { console.error(err); }
  };

  const requestRegistration = async (reg: any) => {
    try {
      await supabase.from('unihub_registrations').insert([{
        ...reg,
        id: `REG-${Date.now()}`,
        status: 'pending',
        timestamp: new Date().toLocaleString()
      }]);
      alert("Application sent for verification.");
    } catch (err: any) { alert("Submission error: " + err.message); }
  };

  const settleNode = async (nodeId: string) => {
    try {
      await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId);
    } catch (err) { console.error(err); }
  };

  const approveTopup = async (reqId: string) => {
    const req = topupRequests.find(r => r.id === reqId);
    if (!req || req.status !== 'pending') return;
    const driver = drivers.find(d => d.id === req.driverId);
    if (!driver) return;
    try {
      await Promise.all([
        supabase.from('unihub_drivers').update({ walletBalance: driver.walletBalance + req.amount }).eq('id', driver.id),
        supabase.from('unihub_topups').update({ status: 'approved' }).eq('id', reqId),
        supabase.from('unihub_transactions').insert([{
          id: `TX-TOP-${Date.now()}`,
          driverId: driver.id,
          amount: req.amount,
          type: 'topup',
          timestamp: new Date().toLocaleString()
        }])
      ]);
      alert("Wallet updated successfully.");
    } catch (err: any) { alert("Topup approval failed: " + err.message); }
  };

  if (!currentUser) {
    return <HubGateway onIdentify={handleGlobalUserAuth} />;
  }

  return (
    <div 
      className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative"
      style={settings.appWallpaper ? {
        backgroundImage: `url(${settings.appWallpaper})`,
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed'
      } : {}}
    >
      {settings.appWallpaper && <div className="absolute inset-0 bg-[#020617]/70 pointer-events-none z-0"></div>}

      {settings.hub_announcement && !dismissedAnnouncement && (
        <div className="fixed top-0 left-0 right-0 z-[400] bg-gradient-to-r from-amber-600 to-rose-600 px-4 py-3 flex items-center justify-between shadow-2xl animate-in slide-in-from-top duration-500 border-b border-white/10">
           <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <i className="fas fa-bullhorn text-white text-xs"></i>
              </div>
              <p className="text-[10px] sm:text-xs font-black uppercase italic text-white truncate tracking-tight">{settings.hub_announcement}</p>
           </div>
           <button onClick={() => setDismissedAnnouncement('true')} className="ml-4 w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-white text-[10px] hover:bg-white/30 transition-all shrink-0">
             <i className="fas fa-times"></i>
           </button>
        </div>
      )}

      {isSyncing && (
        <div className={`fixed ${settings.hub_announcement && !dismissedAnnouncement ? 'top-20' : 'top-4'} right-4 z-[300] bg-amber-500/20 text-amber-500 px-4 py-2 rounded-full border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-2 transition-all`}>
           <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
           Syncing...
        </div>
      )}

      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl">
              <i className="fas fa-route text-[#020617] text-xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white">NexRyde</h1>
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Transit Platform</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => setShowQrModal(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-amber-500"><i className="fas fa-qrcode text-xs"></i></button>
            <button onClick={() => setShowAiHelp(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-400"><i className="fas fa-sparkles text-xs"></i></button>
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride Center" onClick={() => setViewMode('passenger')} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Partner Hub" onClick={() => setViewMode('driver')} />
          {(isVaultAccess || isAdminAuthenticated) && (
            <NavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Command Vault" onClick={() => setViewMode('admin')} badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined} />
          )}
          <NavItem active={false} icon="fa-share-nodes" label="Invite Peers" onClick={shareHub} />
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-500 hover:bg-white/5 transition-all mt-4">
             <i className="fas fa-power-off text-lg w-6"></i>
             <span className="text-sm font-bold">Sign Out</span>
          </button>
        </div>

        <div className="pt-6 border-t border-white/5">
           {activeDriver ? (
             <div className="bg-indigo-500/10 p-6 rounded-[2.5rem] border border-indigo-500/20 mb-4">
                <div className="flex items-center gap-3">
                  {activeDriver.avatarUrl ? <img src={activeDriver.avatarUrl} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400"><i className="fas fa-user text-xs"></i></div>}
                  <div className="truncate">
                    <p className="text-[9px] font-black uppercase text-indigo-400">Partner</p>
                    <p className="text-sm font-black text-white truncate">{activeDriver.name}</p>
                  </div>
                </div>
                <button onClick={handleDriverLogout} className="mt-4 w-full py-2 bg-indigo-600 rounded-xl text-[8px] font-black uppercase">Logout</button>
             </div>
           ) : (
             <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 mb-4">
                <p className="text-[9px] font-black uppercase text-slate-500">Identity</p>
                <p className="text-sm font-black text-white truncate">{currentUser.username}</p>
             </div>
           )}
          <div className="bg-emerald-500/10 p-6 rounded-[2.5rem] border border-emerald-500/20">
            <p className="text-[9px] font-black uppercase text-emerald-400 mb-2">Live Pulse</p>
            <div className="flex justify-between items-center"><p className="text-[10px] text-white/60">Fleet Units</p><p className="text-lg font-black text-white italic">{onlineDriverCount}</p></div>
            <div className="flex justify-between items-center"><p className="text-[10px] text-white/60">Active Trips</p><p className="text-lg font-black text-white italic">{activeNodeCount}</p></div>
          </div>
        </div>
      </nav>

      <main className={`flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar z-10 relative transition-all duration-500 ${settings.hub_announcement && !dismissedAnnouncement ? 'pt-24 lg:pt-28' : 'pt-4 lg:pt-12'}`}>
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
          
          {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
            <SearchHub searchConfig={searchConfig} setSearchConfig={setSearchConfig} portalMode={viewMode} />
          )}

          {viewMode === 'passenger' && (
            <PassengerPortal 
              currentUser={currentUser}
              nodes={nodes} 
              myRideIds={myRideIds}
              onAddNode={async (node: RideNode) => {
                await supabase.from('unihub_nodes').insert([node]);
                setMyRideIds(prev => [...prev, node.id]);
              }} 
              onJoin={joinNode} 
              onCancel={async (id: string) => await supabase.from('unihub_nodes').delete().eq('id', id)} 
              drivers={drivers} 
              searchConfig={searchConfig} 
              settings={settings} 
              onShowQr={() => setShowQrModal(true)} 
              onShowAbout={() => setShowAboutModal(true)}
            />
          )}

          {viewMode === 'driver' && (
            <DriverPortal 
              drivers={drivers} 
              activeDriver={activeDriver}
              onLogin={handleDriverAuth}
              onLogout={handleDriverLogout}
              qualifiedNodes={nodes.filter(n => n.status === 'qualified')} 
              dispatchedNodes={nodes.filter(n => n.status === 'dispatched')}
              missions={missions}
              allNodes={nodes}
              onJoinMission={joinMission}
              onAccept={async (nid: string, did: string) => {
                const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
                await supabase.from('unihub_nodes').update({ status: 'dispatched', assignedDriverId: did, verificationCode }).eq('id', nid);
              }}
              onVerify={async (nid: string, code: string) => {
                 const node = nodes.find(n => n.id === nid);
                 if (node?.verificationCode === code) {
                   const totalComm = settings.commissionPerSeat * node.passengers.length;
                   await Promise.all([
                     supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nid),
                     supabase.from('unihub_drivers').update({ walletBalance: activeDriver!.walletBalance - totalComm }).eq('id', activeDriver!.id),
                     supabase.from('unihub_transactions').insert([{ id: `TX-${Date.now()}`, driverId: activeDriver!.id, amount: totalComm, type: 'commission', timestamp: new Date().toLocaleString() }])
                   ]);
                   alert("Trip verified!");
                 } else { alert("Incorrect Ride PIN!"); }
              }}
              onCancel={async (nid: string) => await supabase.from('unihub_nodes').update({ status: 'qualified', assignedDriverId: null, verificationCode: null }).eq('id', nid)}
              onRequestTopup={async (did: string, amt: number, ref: string) => {
                 await supabase.from('unihub_topups').insert([{ id: `REQ-${Date.now()}`, driverId: did, amount: amt, momoReference: ref, status: 'pending', timestamp: new Date().toLocaleString() }]);
                 alert("Request logged.");
              }}
              onRequestRegistration={requestRegistration}
              searchConfig={searchConfig}
              settings={settings}
            />
          )}

          {viewMode === 'admin' && (
            !isAdminAuthenticated ? (
              <AdminLogin onLogin={async (e: string, p: string) => {
                const { data } = await supabase.auth.signInWithPassword({ email: e, password: p });
                if (data.session) setIsAdminAuthenticated(true);
              }} />
            ) : (
              <AdminPortal 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                nodes={nodes} 
                drivers={drivers} 
                onAddDriver={registerDriver}
                onDeleteDriver={async (id: string) => await supabase.from('unihub_drivers').delete().eq('id', id)}
                onCancelRide={async (id: string) => await supabase.from('unihub_nodes').delete().eq('id', id)}
                onSettleRide={settleNode}
                missions={missions}
                onCreateMission={async (m: HubMission) => await supabase.from('unihub_missions').insert([m])}
                onDeleteMission={async (id: string) => await supabase.from('unihub_missions').delete().eq('id', id)}
                transactions={transactions} 
                topupRequests={topupRequests}
                registrationRequests={registrationRequests}
                onApproveTopup={approveTopup}
                onApproveRegistration={approveRegistration}
                onLock={() => setIsAdminAuthenticated(false)}
                searchConfig={searchConfig}
                settings={settings}
                onUpdateSettings={async (s: AppSettings) => await supabase.from('unihub_settings').upsert({ id: 1, ...s })}
                hubRevenue={hubRevenue}
              />
            )
          )}
        </div>
      </main>

      {showAiHelp && <AiHelpDesk onClose={() => setShowAiHelp(false)} settings={settings} />}
      
      {/* Visual Modals */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-sm:px-4 max-w-sm rounded-[3rem] p-10 text-center border border-white/10 space-y-8 animate-in zoom-in">
              <h3 className="text-2xl font-black italic uppercase text-white">NexRyde Code</h3>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl">
                 <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}&bgcolor=ffffff&color=020617&format=svg`} className="w-full aspect-square" alt="QR" />
              </div>
              <button onClick={() => setShowQrModal(false)} className="w-full py-4 bg-white/5 rounded-2xl font-black text-xs uppercase text-slate-400">Close</button>
           </div>
        </div>
      )}
    </div>
  );
};

// --- SUB-COMPONENTS (STYLED ACCORDING TO IMAGE) ---

const HubGateway = ({ onIdentify }: { onIdentify: (u: string, p: string, m: 'login' | 'signup') => void }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <div className="fixed inset-0 bg-[#020617] flex items-center justify-center p-6 z-[500]">
      <div className="w-full max-md glass p-10 rounded-[3.5rem] border border-white/10 space-y-12 animate-in zoom-in">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center mx-auto mb-4"><i className="fas fa-fingerprint text-[#020617] text-3xl"></i></div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">NexRyde Identity</h1>
        </div>
        <div className="space-y-4">
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mb-4">
             <button onClick={() => setMode('login')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'login' ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>Sign In</button>
             <button onClick={() => setMode('signup')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'signup' ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>Sign Up</button>
          </div>
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-500 uppercase ml-1">Username</label>
              <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold outline-none focus:border-amber-500" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-slate-500 uppercase ml-1">Phone Number</label>
            <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold outline-none focus:border-amber-500" placeholder="024 XXX XXXX" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
        </div>
        <button onClick={() => onIdentify(username, phone, mode)} className="w-full py-5 bg-amber-500 text-[#020617] rounded-3xl font-black uppercase text-xs shadow-2xl">Confirm Access</button>
      </div>
    </div>
  );
};

const PassengerPortal = ({ currentUser, nodes, myRideIds, onAddNode, onJoin, onCancel, settings }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [type, setType] = useState<VehicleType>('Pragia');
  const [isSolo, setIsSolo] = useState(false);
  const [isLongDist, setIsLongDist] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAiFill = async () => {
    if (!aiInput.trim()) return;
    setLoading(true);
    try {
      const prompt = `Parse: "${aiInput}" to JSON { "origin": string, "destination": string, "isSolo": boolean, "vehicleType": "Pragia"|"Taxi" }`;
      const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: "application/json" } });
      const d = JSON.parse(res.text || '{}');
      if (d.origin) setOrigin(d.origin); if (d.destination) setDest(d.destination);
      if (d.isSolo !== undefined) setIsSolo(d.isSolo); if (d.vehicleType) setType(d.vehicleType);
      setAiInput('');
    } catch (e) {} finally { setLoading(false); }
  };

  const submit = async () => {
    if (!origin || !dest) return;
    const base = type === 'Pragia' ? settings.farePerPragia : settings.farePerTaxi;
    const fare = isSolo ? Math.ceil(base * settings.soloMultiplier) : base;
    const node: RideNode = {
      id: `NODE-${Date.now()}`, origin, destination: dest, capacityNeeded: isSolo ? 1 : 4, passengers: [{ id: 'P-LEAD', name: currentUser.username, phone: currentUser.phone }], status: (isSolo || isLongDist) ? 'qualified' : 'forming', leaderName: currentUser.username, leaderPhone: currentUser.phone, farePerPerson: isLongDist ? 0 : fare, createdAt: new Date().toISOString(), isSolo, isLongDistance: isLongDist, vehicleType: type
    };
    await onAddNode(node); setShowModal(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-end"><h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Ride Center</h2><button onClick={() => setShowModal(true)} className="px-8 py-4 bg-amber-500 text-[#020617] rounded-2xl font-black text-[10px] uppercase shadow-xl">Form Ride</button></div>
      
      {showModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-lg rounded-[2.5rem] p-8 space-y-6 animate-in zoom-in">
            <div className="text-center"><h3 className="text-xl font-black italic uppercase text-white leading-none">Create Ride Request</h3><p className="text-slate-500 text-[8px] font-black uppercase mt-1">NexRyde Logistics Engine</p></div>
            
            <div className="p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl space-y-2">
               <p className="text-indigo-400 font-black text-[7px] uppercase tracking-widest"><i className="fas fa-sparkles"></i> AI Quick Dispatch</p>
               <textarea className="w-full bg-[#020617] text-white text-[11px] border border-white/10 rounded-xl p-3 outline-none h-12 resize-none" placeholder="e.g. Solo taxi from CS to Gate" value={aiInput} onChange={e => setAiInput(e.target.value)} />
               <button onClick={handleAiFill} className="w-full py-1.5 bg-indigo-600 text-white rounded-lg font-black text-[8px] uppercase">{loading ? 'Processing...' : '✨ Auto-Fill'}</button>
            </div>

            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
               <button onClick={() => { setIsSolo(false); setIsLongDist(false); }} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase ${!isSolo && !isLongDist ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>Group</button>
               <button onClick={() => { setIsSolo(true); setIsLongDist(false); }} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase ${isSolo ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>Solo</button>
               <button onClick={() => { setIsSolo(false); setIsLongDist(true); }} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase ${isLongDist ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>Long Dist</button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Departure</label><input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold text-xs" value={origin} onChange={e => setOrigin(e.target.value)} /></div>
                <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Destination</label><input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold text-xs" value={dest} onChange={e => setDest(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Vehicle</label><select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold text-xs" value={type} onChange={e => setType(e.target.value as any)}><option value="Pragia">Pragia</option><option value="Taxi">Taxi</option></select></div>
                <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Requester</label><input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-500 font-bold text-xs" value={currentUser.username} readOnly /></div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 py-4 bg-white/10 rounded-2xl font-black text-[10px] uppercase text-white">Back</button>
              <button onClick={submit} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-2xl font-black text-[10px] uppercase shadow-xl">Launch Node</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodes.filter(n => n.status !== 'completed').map(node => (
          <div key={node.id} className="glass p-8 rounded-[2.5rem] border border-white/5 space-y-6 relative overflow-hidden">
            <div className="flex justify-between items-start">
               <div><span className="text-[8px] font-black uppercase px-3 py-1 bg-amber-500 text-[#020617] rounded-full">{node.status}</span><h4 className="text-xl font-black text-white italic uppercase mt-3">{node.destination}</h4><p className="text-[10px] text-slate-500 font-bold uppercase">From: {node.origin}</p></div>
               <p className="text-lg font-black text-white italic">₵{node.farePerPerson}</p>
            </div>
            <div className="flex -space-x-2">{node.passengers.map((p:any, i:number) => <div key={i} className="w-10 h-10 rounded-full bg-indigo-600 border-4 border-[#020617] flex items-center justify-center text-[10px] font-black">{p.name[0]}</div>)}</div>
            {myRideIds.includes(node.id) ? (
              <div className="pt-4 border-t border-white/5 text-center"><p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">RIDE PIN</p><p className="text-3xl font-black italic text-white tracking-[0.2em]">{node.verificationCode || 'WAIT'}</p></div>
            ) : (
              <button onClick={() => onJoin(node.id, currentUser.username, currentUser.phone)} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-[10px] uppercase">Join Trip</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const DriverPortal = ({ activeDriver, drivers, onLogin, qualifiedNodes, dispatchedNodes, onAccept, onVerify, onRequestRegistration, settings }: any) => {
  const [selectedDid, setSelectedDid] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [regShow, setRegShow] = useState(false);
  const [regData, setRegData] = useState<any>({ vehicleType: 'Pragia' });
  const [verifyCode, setVerifyCode] = useState('');

  if (!activeDriver) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-10 animate-in zoom-in">
        <div className="text-center space-y-2"><div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-2xl"><i className="fas fa-id-card-clip text-white text-3xl"></i></div><h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Partner Terminal</h2></div>
        {selectedDid ? (
          <div className="w-full max-md glass p-10 rounded-[3rem] border border-white/10 space-y-6 text-center">
             <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Partner Password</label><input type="password" className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-center text-slate-900 font-black text-3xl tracking-[0.5em] outline-none" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} /></div>
             <div className="flex gap-4"><button onClick={() => setSelectedDid(null)} className="flex-1 py-4 bg-white/5 rounded-2xl font-black text-[10px] uppercase text-slate-500">Back</button><button onClick={() => onLogin(selectedDid, pin)} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-2xl font-black text-[10px] uppercase shadow-xl">Unlock Hub</button></div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 w-full max-w-xl">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
               {drivers.map((d: any) => (
                 <button key={d.id} onClick={() => setSelectedDid(d.id)} className="glass p-6 rounded-[2rem] border border-white/5 text-left flex items-center gap-4 hover:border-amber-500/50 transition-all">
                    {d.avatarUrl ? <img src={d.avatarUrl} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-slate-800" />}
                    <div><p className="font-black text-white uppercase italic">{d.name}</p><p className="text-[9px] font-bold text-slate-500 uppercase">₵{d.walletBalance.toFixed(1)}</p></div>
                 </button>
               ))}
             </div>
             <button onClick={() => setRegShow(true)} className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-[10px] uppercase shadow-2xl">Join NexRyde Fleet</button>
          </div>
        )}
        {regShow && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
             <div className="glass-bright w-full max-w-md rounded-[2.5rem] p-8 space-y-6 animate-in zoom-in">
                <div className="text-center"><h3 className="text-xl font-black italic uppercase text-white leading-none">Partner Onboarding</h3><p className="text-indigo-400 text-[8px] font-black uppercase mt-1">Activation Fee: ₵{settings.registrationFee}</p></div>
                <div className="space-y-3">
                   <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Full Legal Name</label><input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold text-xs" value={regData.name || ''} onChange={e => setRegData({...regData, name: e.target.value})} /></div>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Asset Plate</label><input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold text-xs" value={regData.licensePlate || ''} onChange={e => setRegData({...regData, licensePlate: e.target.value})} /></div>
                      <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Vehicle</label><select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold text-xs" value={regData.vehicleType || 'Pragia'} onChange={e => setRegData({...regData, vehicleType: e.target.value as any})}><option value="Pragia">Pragia</option><option value="Taxi">Taxi</option></select></div>
                   </div>
                   <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">WhatsApp Contact</label><input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold text-xs" value={regData.contact || ''} onChange={e => setRegData({...regData, contact: e.target.value})} /></div>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Hub Password</label><input type="password" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-black text-center text-xs" maxLength={4} value={regData.pin || ''} onChange={e => setRegData({...regData, pin: e.target.value})} /></div>
                      <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Payment Ref</label><input className="w-full bg-white border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-600 font-black text-center text-xs" value={regData.momoReference || ''} onChange={e => setRegData({...regData, momoReference: e.target.value})} /></div>
                   </div>
                </div>
                <div className="flex gap-4 pt-2">
                   <button onClick={() => setRegShow(false)} className="flex-1 py-4 bg-white/10 rounded-2xl font-black text-[10px] uppercase text-white">Cancel</button>
                   <button onClick={() => { onRequestRegistration({...regData, amount: settings.registrationFee}); setRegShow(false); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl">Apply Now</button>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in slide-in-from-bottom-8">
      <div className="flex justify-between items-center bg-indigo-600/10 p-6 rounded-[2.5rem] border border-indigo-600/20">
         <div className="flex items-center gap-4">
            {activeDriver.avatarUrl ? <img src={activeDriver.avatarUrl} className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-500" /> : <div className="w-14 h-14 bg-amber-500 rounded-2xl" />}
            <div><h2 className="text-2xl font-black italic text-white leading-none">{activeDriver.name}</h2><p className="text-[10px] font-black text-amber-500 uppercase mt-2">₵ {activeDriver.walletBalance.toFixed(2)} CREDITS</p></div>
         </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <section className="lg:col-span-8 space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Open Trips</h3>
            <div className="space-y-4">
              {qualifiedNodes.map((n:any) => (
                <div key={n.id} className="glass p-6 rounded-[2rem] border border-white/5 flex items-center justify-between">
                   <div><p className="font-black text-white uppercase italic">{n.origin} → {n.destination}</p><p className="text-[9px] font-bold text-slate-500 uppercase mt-1">₵{n.farePerPerson} / 4 seats</p></div>
                   <button onClick={() => onAccept(n.id, activeDriver.id)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase shadow-xl">Accept</button>
                </div>
              ))}
            </div>
         </section>
         <section className="lg:col-span-4 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Active Job</h3>
            {dispatchedNodes.filter((n:any) => n.assignedDriverId === activeDriver.id).map((n:any) => (
              <div key={n.id} className="glass p-8 rounded-[2rem] border border-amber-500/20 space-y-6">
                 <div className="text-center space-y-1"><h4 className="text-xl font-black text-white italic uppercase truncate">{n.destination}</h4><p className="text-[8px] font-black text-slate-500 uppercase">Input Ride PIN</p></div>
                 <input className="w-full bg-[#020617] border border-white/10 rounded-2xl py-5 text-center text-4xl font-black text-amber-500 outline-none" maxLength={4} value={verifyCode} onChange={e => setVerifyCode(e.target.value)} />
                 <button onClick={() => onVerify(n.id, verifyCode)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl">Verify & Finish</button>
              </div>
            ))}
         </section>
      </div>
    </div>
  );
};

const AdminPortal = ({ activeTab, setActiveTab, drivers, onAddDriver, onDeleteDriver, transactions, topupRequests, registrationRequests, onApproveTopup, onApproveRegistration, onLock, settings, onUpdateSettings, hubRevenue }: any) => {
  const [showManual, setShowManual] = useState(false);
  const [manDriver, setManDriver] = useState<any>({ vehicleType: 'Pragia' });

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-8">
      <div className="flex bg-white/5 p-1 rounded-[1.5rem] border border-white/10 w-fit">
        <TabBtn active={activeTab === 'monitor'} label="Market" onClick={() => setActiveTab('monitor')} />
        <TabBtn active={activeTab === 'fleet'} label="Fleet" onClick={() => setActiveTab('fleet')} />
        <TabBtn active={activeTab === 'onboarding'} label="Queue" onClick={() => setActiveTab('onboarding')} count={registrationRequests.filter((r:any)=>r.status==='pending').length} />
        <TabBtn active={activeTab === 'requests'} label="Billing" onClick={() => setActiveTab('requests')} count={topupRequests.filter((r:any)=>r.status==='pending').length} />
        <TabBtn active={activeTab === 'settings'} label="Setup" onClick={() => setActiveTab('settings')} />
      </div>

      {activeTab === 'fleet' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center"><h3 className="text-xl font-black italic uppercase text-white">Partner Registry</h3><button onClick={() => setShowManual(true)} className="px-6 py-3 bg-amber-500 text-[#020617] rounded-xl text-[9px] font-black uppercase">Direct Registry</button></div>
           <div className="glass rounded-[2rem] overflow-hidden border border-white/5">
              <table className="w-full text-left text-[11px]"><thead className="bg-white/5 text-slate-500 uppercase font-black border-b border-white/5"><tr><th className="px-8 py-5">Partner</th><th className="px-8 py-5">Asset</th><th className="px-8 py-5">Wallet</th><th className="px-8 py-5 text-right">Action</th></tr></thead><tbody className="divide-y divide-white/5">{drivers.map((d: any) => (<tr key={d.id} className="text-slate-300 font-bold"><td className="px-8 py-5">{d.name}</td><td className="px-8 py-5">{d.licensePlate}</td><td className="px-8 py-5 italic text-emerald-400 font-black">₵{d.walletBalance.toFixed(1)}</td><td className="px-8 py-5 text-right"><button onClick={() => onDeleteDriver(d.id)} className="text-rose-500 uppercase font-black">Revoke</button></td></tr>))}</tbody></table>
           </div>
        </div>
      )}

      {activeTab === 'onboarding' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {registrationRequests.filter((r:any)=>r.status==='pending').map((reg: any) => (
             <div key={reg.id} className="glass p-8 rounded-[2.5rem] border border-indigo-500/20 space-y-6">
                <div className="flex items-center gap-4">{reg.avatarUrl ? <img src={reg.avatarUrl} className="w-16 h-16 rounded-2xl object-cover" /> : <div className="w-16 h-16 bg-white/5 rounded-2xl" />}<div><h4 className="text-white font-black uppercase text-sm">{reg.name}</h4><span className="text-[8px] font-black text-indigo-400">{reg.vehicleType}</span></div></div>
                <div className="bg-white/5 p-4 rounded-xl space-y-2"><p className="text-[8px] font-black text-slate-500">Plate</p><p className="text-xs font-black text-white">{reg.licensePlate}</p><p className="text-[8px] font-black text-slate-500">MoMo Ref</p><p className="text-xs font-black text-emerald-400 italic">{reg.momoReference}</p></div>
                <button onClick={() => onApproveRegistration(reg.id)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Approve & Activate</button>
             </div>
           ))}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="glass p-10 rounded-[3rem] border border-white/5 space-y-10">
           <h3 className="text-xl font-black uppercase text-white">Hub Global Settings</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <section className="space-y-6">
                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pricing & Fares</h4>
                <div className="space-y-4">
                  <AdminInput label="Commission (₵)" value={settings.commissionPerSeat} onChange={(v:any)=>onUpdateSettings({...settings, commissionPerSeat: Number(v)})} />
                  <AdminInput label="Reg Fee (₵)" value={settings.registrationFee} onChange={(v:any)=>onUpdateSettings({...settings, registrationFee: Number(v)})} />
                </div>
              </section>
              <section className="space-y-6">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Communication</h4>
                <div className="space-y-4">
                  <AdminInput label="Announcement" value={settings.hub_announcement} onChange={(v:any)=>onUpdateSettings({...settings, hub_announcement: v})} />
                  <AdminInput label="WhatsApp Support" value={settings.whatsappNumber} onChange={(v:any)=>onUpdateSettings({...settings, whatsappNumber: v})} />
                </div>
              </section>
           </div>
        </div>
      )}

      {showManual && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-md rounded-[2.5rem] p-8 space-y-6 animate-in zoom-in">
             <div className="text-center"><h3 className="text-xl font-black italic uppercase text-white leading-none">Manual Registry</h3></div>
             <div className="space-y-3">
                <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Partner Name</label><input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold text-xs" onChange={(e: any) => setManDriver({...manDriver, name: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Asset Plate</label><input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold text-xs" onChange={(e: any) => setManDriver({...manDriver, licensePlate: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Hub PIN</label><input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-black text-center" maxLength={4} onChange={(e: any) => setManDriver({...manDriver, pin: e.target.value})} /></div>
             </div>
             <div className="flex gap-4 pt-2"><button onClick={() => setShowManual(false)} className="flex-1 py-4 bg-white/10 rounded-2xl font-black text-[10px] uppercase text-white">Abort</button><button onClick={() => { onAddDriver(manDriver); setShowManual(false); }} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-2xl font-black text-[10px] uppercase shadow-xl">Direct Add</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- BASE ATOMS ---

const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all relative ${active ? 'bg-amber-500 text-[#020617] shadow-xl' : 'text-slate-400 hover:bg-white/5'}`}>
    <i className={`fas ${icon} text-lg w-6`}></i>
    <span className="text-sm font-bold">{label}</span>
    {badge !== undefined && badge > 0 && <span className="absolute top-2 right-4 bg-rose-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-[#020617]">{badge}</span>}
  </button>
);

const TabBtn = ({ active, label, onClick, count }: any) => (
  <button onClick={onClick} className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${active ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}>{label} {count !== undefined && count > 0 && <span className="ml-1 bg-rose-500 text-white text-[7px] px-1.5 py-0.5 rounded-full">{count}</span>}</button>
);

const AdminInput = ({ label, value, onChange }: any) => (
  <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">{label}</label><input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold outline-none focus:border-amber-500 transition-all shadow-inner" value={value} onChange={e => onChange(e.target.value)} /></div>
);

const SearchHub = ({ searchConfig, setSearchConfig }: any) => (
  <div className="relative group"><i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i><input type="text" placeholder="Search routes or partners..." className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-4 lg:py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all" value={searchConfig.query} onChange={e => setSearchConfig({...searchConfig, query: e.target.value})} /></div>
);

const AiHelpDesk = ({ onClose }: any) => (
  <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex items-end sm:items-center justify-center p-4">
    <div className="w-full max-lg bg-[#020617] rounded-[2.5rem] border border-white/10 flex flex-col h-[70vh] animate-in slide-in-from-bottom-12 overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-indigo-600"><h3 className="font-black uppercase italic text-white text-sm">NexRyde Assistant</h3><button onClick={onClose} className="text-white/50 hover:text-white"><i className="fas fa-times"></i></button></div>
      <div className="flex-1 p-8 text-center space-y-4"><div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto text-indigo-400 text-3xl"><i className="fas fa-robot animate-bounce"></i></div><p className="text-slate-300 font-medium italic">"Welcome! I am analyzing Hub traffic patterns to help you move faster. How can I help?"</p></div>
      <div className="p-6 bg-white/5 border-t border-white/5 flex gap-2"><input className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-xs outline-none text-white" placeholder="Ask about routes, fares..." /><button className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white"><i className="fas fa-paper-plane"></i></button></div>
    </div>
  </div>
);

const AdminLogin = ({ onLogin }: any) => {
  const [e, setE] = useState(''); const [p, setP] = useState('');
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in">
      <div className="w-full max-md glass p-10 rounded-[3rem] border border-white/10 space-y-6 text-center">
        <h2 className="text-2xl font-black italic uppercase text-white">Vault Access</h2>
        <div className="space-y-4">
          <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Admin Email</label><input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold outline-none" onChange={(ev: any) => setE(ev.target.value)} /></div>
          <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-500 uppercase ml-1">Access Key</label><input type="password" className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold outline-none" onChange={(ev: any) => setP(ev.target.value)} /></div>
        </div>
        <button onClick={() => onLogin(e, p)} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl">Unlock Panel</button>
      </div>
    </div>
  );
};

// --- RENDER ---
const rootElement = document.getElementById('root');
if (rootElement) { ReactDOM.createRoot(rootElement).render(<App />); }
