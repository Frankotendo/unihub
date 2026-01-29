
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CLIENT ---
const SUPABASE_URL = "https://kzjgihwxiaeqzopeuzhm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- TYPES & INTERFACES ---

type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed' | 'cancelled';
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
}

interface TopupRequest {
  id: string;
  driverId: string;
  amount: number;
  momoReference: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

interface Transaction {
  id: string;
  driverId: string;
  amount: number;
  type: 'commission' | 'topup' | 'refund';
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
        const MAX_WIDTH = maxWidth; 
        const MAX_HEIGHT = maxWidth;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
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

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'requests' | 'settings'>('monitor');
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

  // Core Data State
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
    appWallpaper: ""
  });
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);

  const [globalSearch, setGlobalSearch] = useState('');

  // --- SUPABASE SYNC LOGIC ---

  const fetchData = async () => {
    setIsSyncing(true);
    try {
      const [
        { data: sData },
        { data: nData },
        { data: dData },
        { data: tData },
        { data: trData }
      ] = await Promise.all([
        supabase.from('unihub_settings')
          .select('adminMomo, adminMomoName, whatsappNumber, commissionPerSeat, farePerPragia, farePerTaxi, soloMultiplier, aboutMeText, aboutMeImages, appWallpaper')
          .single(),
        supabase.from('unihub_nodes').select('*').order('createdAt', { ascending: false }),
        supabase.from('unihub_drivers').select('*'),
        supabase.from('unihub_transactions').select('*').order('timestamp', { ascending: false }),
        supabase.from('unihub_topups').select('*').order('timestamp', { ascending: false })
      ]);

      if (sData) setSettings(sData as AppSettings);
      if (nData) setNodes(nData);
      if (dData) setDrivers(dData);
      if (trData) setTransactions(trData);
      if (tData) setTopupRequests(tData);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up Realtime Subscriptions
    const channels = [
      supabase.channel('public:unihub_settings').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_settings' }, (payload) => {
        const { adminSecret, ...safeSettings } = payload.new as any;
        setSettings(safeSettings);
      }).subscribe(),
      supabase.channel('public:unihub_nodes').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_nodes' }, () => {
        supabase.from('unihub_nodes').select('*').order('createdAt', { ascending: false }).then(({ data }) => data && setNodes(data));
      }).subscribe(),
      supabase.channel('public:unihub_drivers').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_drivers' }, () => {
        supabase.from('unihub_drivers').select('*').then(({ data }) => data && setDrivers(data));
      }).subscribe(),
      supabase.channel('public:unihub_transactions').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_transactions' }, () => {
        supabase.from('unihub_transactions').select('*').order('timestamp', { ascending: false }).then(({ data }) => data && setTransactions(data));
      }).subscribe(),
      supabase.channel('public:unihub_topups').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_topups' }, () => {
        supabase.from('unihub_topups').select('*').order('timestamp', { ascending: false }).then(({ data }) => data && setTopupRequests(data));
      }).subscribe()
    ];

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, []);

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  // --- ACTIONS ---

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

  const forceQualify = async (nodeId: string) => {
    await supabase.from('unihub_nodes').update({ status: 'qualified' }).eq('id', nodeId);
  };

  const acceptRide = async (nodeId: string, driverId: string, customFare?: number) => {
    const driver = drivers.find(d => d.id === driverId);
    const node = nodes.find(n => n.id === nodeId);
    if (!driver || driver.walletBalance < settings.commissionPerSeat) {
      alert("Insufficient Balance! Top up first.");
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

    alert(customFare ? `Negotiated trip accepted at ₵${customFare}!` : "Job accepted! Route and code shared with you.");
  };

  const verifyRide = async (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.verificationCode === code) {
      const { error } = await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId);
      if (error) {
        alert("Verification failed in database: " + error.message);
      } else {
        alert("Verification successful!");
      }
    } else {
      alert("Wrong code! Ask the passenger for their code.");
    }
  };

  const cancelRide = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    try {
      if (node.status === 'dispatched' && node.assignedDriverId) {
        const driver = drivers.find(d => d.id === node.assignedDriverId);
        if (driver) {
          const { error: refundErr } = await supabase.from('unihub_drivers').update({ 
            walletBalance: driver.walletBalance + settings.commissionPerSeat 
          }).eq('id', node.assignedDriverId);
          
          if (refundErr) throw refundErr;

          const { error: transErr } = await supabase.from('unihub_transactions').insert([{
            id: `TX-REFUND-${Date.now()}`,
            driverId: node.assignedDriverId,
            amount: settings.commissionPerSeat,
            type: 'refund',
            timestamp: new Date().toLocaleString()
          }]);
          
          if (transErr) throw transErr;
        }
        
        const resetStatus = (node.isSolo || node.isLongDistance) ? 'qualified' : (node.passengers.length >= 4 ? 'qualified' : 'forming');
        const { error: resetErr } = await supabase.from('unihub_nodes').update({ 
          status: resetStatus, 
          assignedDriverId: null, 
          verificationCode: null 
        }).eq('id', nodeId);
        
        if (resetErr) throw resetErr;
        alert("Assignment cancelled and driver commission refunded.");
      } else {
        const { error: cancelErr } = await supabase.from('unihub_nodes').update({ status: 'cancelled' }).eq('id', nodeId);
        if (cancelErr) throw cancelErr;
        alert("Ride request removed from the Hub.");
      }
    } catch (err: any) {
      console.error("Cancellation error:", err);
      alert("Failed to process request: " + (err.message || "Unknown error"));
    }
  };

  const settleNode = async (nodeId: string) => {
    if (confirm("Force settle this ride as completed? No refunds will be issued.")) {
      const { error } = await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId);
      if (error) {
        alert("Force settle failed: " + error.message);
      } else {
        alert("Node settled manually.");
      }
    }
  };

  const requestTopup = async (driverId: string, amount: number, ref: string) => {
    if (!amount || !ref) {
      alert("Details missing.");
      return;
    }
    const req: TopupRequest = {
      id: `REQ-${Date.now()}`,
      driverId,
      amount: Number(amount),
      momoReference: ref,
      status: 'pending',
      timestamp: new Date().toLocaleString()
    };
    await supabase.from('unihub_topups').insert([req]);
    alert("Request logged.");
  };

  const approveTopup = async (reqId: string) => {
    const req = topupRequests.find(r => r.id === reqId);
    if (!req || req.status !== 'pending') return;

    const driver = drivers.find(d => d.id === req.driverId);
    if (!driver) return;

    await Promise.all([
      supabase.from('unihub_drivers').update({ walletBalance: driver.walletBalance + req.amount }).eq('id', req.driverId),
      supabase.from('unihub_topups').update({ status: 'approved' }).eq('id', reqId),
      supabase.from('unihub_transactions').insert([{
        id: `TX-${Date.now()}`,
        driverId: req.driverId,
        amount: req.amount,
        type: 'topup',
        timestamp: new Date().toLocaleString()
      }])
    ]);
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
      alert(`Driver ${d.name} registered successfully!`);
    } catch (err: any) {
      console.error("Registration error:", err);
      alert(`Failed to register: ${err.message}.`);
    }
  };

  const deleteDriver = useCallback(async (id: string) => {
    const hasActiveMission = nodes.some(n => n.assignedDriverId === id && (n.status === 'qualified' || n.status === 'dispatched'));
    if (hasActiveMission) {
      alert("Cannot unregister driver with an active mission.");
      return;
    }

    await supabase.from('unihub_drivers').delete().eq('id', id);
    if (activeDriverId === id) {
      handleDriverLogout();
    }
  }, [nodes, activeDriverId]);

  const updateGlobalSettings = async (newSettings: AppSettings) => {
    const { id, ...data } = newSettings;
    await supabase.from('unihub_settings').upsert({ id: 1, ...data });
  };

  const hubRevenue = useMemo(() => transactions.filter(t => t.type === 'commission').reduce((a, b) => a + b.amount, 0), [transactions]);
  const pendingRequestsCount = useMemo(() => topupRequests.filter(r => r.status === 'pending').length, [topupRequests]);

  const handleAdminAuth = async (password: string) => {
    if (!password) return;
    try {
      const { data: isVerified, error } = await supabase.rpc('verify_admin_secret', { candidate_secret: password });
      
      if (error) throw error;

      if (isVerified) {
        setIsAdminAuthenticated(true);
        sessionStorage.setItem('unihub_admin_auth_v12', 'true');
      } else {
        alert("Verification Failed: Master Key Invalid.");
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      alert("Authentication Service Unavailable. Check SQL setup.");
    }
  };

  const handleDriverAuth = (driverId: string, pin: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver && driver.pin === pin) {
      setActiveDriverId(driverId);
      sessionStorage.setItem('unihub_driver_session_v12', driverId);
      setViewMode('driver');
    } else {
      alert("Access Denied: Invalid Driver PIN");
    }
  };

  const handleDriverLogout = () => {
    setActiveDriverId(null);
    sessionStorage.removeItem('unihub_driver_session_v12');
    setViewMode('passenger');
  };

  const dismissWelcome = () => {
    setIsNewUser(false);
    localStorage.setItem('unihub_seen_welcome_v12', 'true');
  };

  const safeSetViewMode = (mode: PortalMode) => {
    if (activeDriverId && mode !== 'driver') {
      if (confirm("Logout from Driver Terminal?")) {
        handleDriverLogout();
      } else {
        return;
      }
    }
    setViewMode(mode);
  };

  return (
    <div 
      className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative"
      style={settings.appWallpaper ? {
        backgroundImage: `url(${settings.appWallpaper})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } : {}}
    >
      {settings.appWallpaper && (
        <div className="absolute inset-0 bg-[#020617]/70 pointer-events-none z-0"></div>
      )}
      
      {isSyncing && (
        <div className="fixed top-4 right-4 z-[300] bg-amber-500/20 text-amber-500 px-4 py-2 rounded-full border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-2">
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
              <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white">UniHub</h1>
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Logistics Engine</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => setShowQrModal(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-amber-500 hover:bg-white/10 transition-all">
              <i className="fas fa-qrcode text-xs"></i>
            </button>
            <button onClick={() => setShowHelpModal(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-white/10 transition-all">
              <i className="fas fa-circle-question text-xs"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Passenger Hub" onClick={() => {safeSetViewMode('passenger'); setGlobalSearch('');}} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Driver Terminal" onClick={() => {safeSetViewMode('driver'); setGlobalSearch('');}} />
          <NavItem 
            active={viewMode === 'admin'} 
            icon="fa-shield-halved" 
            label="Admin Command" 
            onClick={() => {safeSetViewMode('admin'); setGlobalSearch('');}} 
            badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
          />
          <NavItem active={false} icon="fa-share-nodes" label="Invite Friends" onClick={shareHub} />
        </div>

        <div className="pt-6 border-t border-white/5">
           {activeDriver ? (
             <div className="bg-indigo-500/10 p-6 rounded-[2.5rem] border border-indigo-500/20 relative overflow-hidden mb-4">
                <p className="text-[9px] font-black uppercase text-indigo-400 mb-1">Active Driver</p>
                <p className="text-lg font-black text-white truncate">{activeDriver.name}</p>
                <button onClick={handleDriverLogout} className="mt-4 w-full py-2 bg-indigo-600 rounded-xl text-[8px] font-black uppercase tracking-widest">Logout</button>
             </div>
           ) : null}
          <div className="bg-emerald-500/10 p-6 rounded-[2.5rem] border border-emerald-500/20 relative overflow-hidden">
            <p className="text-[9px] font-black uppercase text-emerald-400 mb-1">Total Hub Profit</p>
            <p className="text-3xl font-black text-white">₵ {hubRevenue.toFixed(2)}</p>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around px-4">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Hub" onClick={() => safeSetViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Drive" onClick={() => safeSetViewMode('driver')} />
        <MobileNavItem 
          active={viewMode === 'admin'} 
          icon="fa-shield-halved" 
          label="Admin" 
          onClick={() => safeSetViewMode('admin')} 
          badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
        />
        <MobileNavItem active={false} icon="fa-circle-question" label="Help" onClick={() => setShowHelpModal(true)} />
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar z-10 relative">
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
          
          {isNewUser && (
            <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
              <div className="relative z-10 flex items-center gap-6 text-center sm:text-left">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white text-2xl backdrop-blur-md shrink-0">
                   <i className="fas fa-sparkles"></i>
                </div>
                <div>
                   <h2 className="text-xl font-black uppercase italic leading-none">Welcome to the Hub</h2>
                   <p className="text-xs font-bold opacity-80 mt-1 uppercase tracking-tight">First time here? Check out our quick start guide.</p>
                </div>
              </div>
              <div className="relative z-10 flex gap-3 w-full sm:w-auto">
                 <button onClick={() => setShowHelpModal(true)} className="flex-1 sm:flex-none px-6 py-3 bg-white text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl">Open Guide</button>
                 <button onClick={dismissWelcome} className="flex-1 sm:flex-none px-6 py-3 bg-indigo-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest">Got it</button>
              </div>
              <i className="fas fa-route absolute right-[-20px] top-[-20px] text-[150px] opacity-10 pointer-events-none rotate-12"></i>
            </div>
          )}

          {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
            <div className="relative group">
               <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
               <input 
                  type="text" 
                  placeholder="Search routes or users..." 
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-4 lg:py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-700"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
               />
            </div>
          )}

          {viewMode === 'passenger' && (
            <PassengerPortal nodes={nodes} onAddNode={async (node: RideNode) => {
              try {
                const { error } = await supabase.from('unihub_nodes').insert([node]);
                if (error) throw error;
              } catch (err: any) {
                alert(`Failed to request ride: ${err.message}`);
                throw err;
              }
            }} onJoin={joinNode} onForceQualify={forceQualify} onCancel={cancelRide} drivers={drivers} search={globalSearch} settings={settings} onShowQr={() => setShowQrModal(true)} />
          )}
          {viewMode === 'driver' && (
            <DriverPortal 
              drivers={drivers} 
              activeDriver={activeDriver}
              onLogin={handleDriverAuth}
              onLogout={handleDriverLogout}
              qualifiedNodes={nodes.filter(n => n.status === 'qualified')} 
              dispatchedNodes={nodes.filter(n => n.status === 'dispatched')}
              onAccept={acceptRide}
              onVerify={verifyRide}
              onCancel={cancelRide}
              onRequestTopup={requestTopup}
              search={globalSearch}
              settings={settings}
            />
          )}
          {viewMode === 'admin' && (
            !isAdminAuthenticated ? (
              <AdminLogin onLogin={handleAdminAuth} />
            ) : (
              <AdminPortal 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                nodes={nodes} 
                setNodes={setNodes}
                drivers={drivers} 
                onAddDriver={registerDriver}
                onDeleteDriver={deleteDriver}
                onCancelRide={cancelRide}
                onSettleRide={settleNode}
                transactions={transactions} 
                topupRequests={topupRequests}
                onApproveTopup={approveTopup}
                onLock={() => {setIsAdminAuthenticated(false); sessionStorage.removeItem('unihub_admin_auth_v12');}}
                search={globalSearch}
                settings={settings}
                onUpdateSettings={updateGlobalSettings}
                hubRevenue={hubRevenue}
              />
            )
          )}
        </div>
      </main>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-sm:px-4 max-w-sm rounded-[3rem] p-10 space-y-8 animate-in zoom-in text-center border border-white/10">
              <div className="space-y-2">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">Hub QR Code</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Direct Link to UniHub Dispatch</p>
              </div>
              
              <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl relative group">
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}&bgcolor=ffffff&color=020617&format=svg`} 
                   className="w-full aspect-square"
                   alt="Hub QR"
                 />
              </div>

              <div className="flex gap-4">
                 <button onClick={() => setShowQrModal(false)} className="flex-1 py-4 bg-white/5 rounded-[1.5rem] font-black text-[10px] uppercase text-slate-400">Close</button>
                 <button onClick={shareHub} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl">Share Link</button>
              </div>
           </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-3xl rounded-[3rem] p-8 lg:p-12 space-y-10 animate-in zoom-in border border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                      <i className="fas fa-graduation-cap"></i>
                   </div>
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">Hub Help Center</h3>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Operational Guides v1.0</p>
                   </div>
                </div>
                <button onClick={() => setShowHelpModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                   <i className="fas fa-times"></i>
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <HelpSection 
                   icon="fa-user-graduate" 
                   title="Passenger Guide" 
                   color="text-amber-500"
                   points={[
                      "Form Node: Start a group ride to split costs (4 seats).",
                      "Quick Drop: Request a solo ride if you're in a hurry (fixed price).",
                      "Verification: Give your 4-digit code to the driver only when you reach your destination.",
                      "Refunds: If a driver doesn't show up, cancel the ride to restore his commission and free the hub."
                   ]}
                />
                <HelpSection 
                   icon="fa-id-card-clip" 
                   title="Driver Guide" 
                   color="text-indigo-400"
                   points={[
                      "Earnings: Check 'Ready for Dispatch' to find waiting jobs.",
                      "Verification: You must input the passenger's code to complete the trip.",
                      "Commission: ₵2.00 is deducted at acceptance, but refunded if the ride is cancelled.",
                      "Settlement: If verification fails, contact Admin for manual settlement."
                   ]}
                />
                <HelpSection 
                   icon="fa-circle-info" 
                   title="General Rules" 
                   color="text-emerald-400"
                   points={[
                      "Pricing: Fares are determined by vehicle type and solo multipliers.",
                      "Cancellation: Use the WhatsApp chat to resolve trip issues.",
                      "Security: PINs are mandatory for all driver logins.",
                      "Credits: Commissions are required upfront. No balance = No rides."
                   ]}
                />
             </div>

             <div className="pt-6 border-t border-white/5 flex justify-center">
                <button onClick={() => setShowHelpModal(false)} className="px-12 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest text-white hover:bg-white/10 transition-all">Understood</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- HELPER COMPONENTS ---

const HelpSection = ({ icon, title, points, color }: any) => (
  <div className="space-y-4">
     <div className="flex items-center gap-3">
        <i className={`fas ${icon} ${color} text-sm`}></i>
        <h4 className="font-black uppercase text-xs tracking-widest text-slate-300">{title}</h4>
     </div>
     <ul className="space-y-3">
        {points.map((p: string, i: number) => (
           <li key={i} className="flex items-start gap-3 group">
              <span className="w-1 h-1 rounded-full bg-slate-700 mt-2 shrink-0 group-hover:bg-indigo-500 transition-colors"></span>
              <p className="text-[11px] font-medium text-slate-400 leading-relaxed italic">{p}</p>
           </li>
        ))}
     </ul>
  </div>
);

const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-xl' : 'text-slate-400 hover:bg-white/5'}`}>
    <div className="flex items-center space-x-4">
      <i className={`fas ${icon} text-lg w-6`}></i>
      <span className="text-sm font-bold">{label}</span>
    </div>
    {badge !== undefined && <span className="bg-rose-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full ring-4 ring-[#020617]">{badge}</span>}
  </button>
);

const MobileNavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 relative ${active ? 'text-amber-500' : 'text-slate-500'}`}>
    <i className={`fas ${icon} text-xl`}></i>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    {badge !== undefined && <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-[#020617]">{badge}</span>}
  </button>
);

const AdminLogin = ({ onLogin }: any) => {
  const [pass, setPass] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleAuth = async () => {
    setIsVerifying(true);
    await onLogin(pass);
    setIsVerifying(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in">
      <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] border border-amber-500/20 flex items-center justify-center text-amber-500 mb-8 shadow-2xl">
        <i className="fas fa-shield-halved text-3xl"></i>
      </div>
      <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8 text-white">Admin Vault</h2>
      <div className="w-full max-sm:px-4 max-w-sm glass p-8 lg:p-10 rounded-[2.5rem] border border-white/10 space-y-6">
          <input 
            type="password" 
            placeholder="Master Key" 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 font-bold text-center text-white"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            disabled={isVerifying}
          />
        <button 
          onClick={handleAuth} 
          className="w-full py-4 bg-amber-500 text-[#020617] rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50"
          disabled={isVerifying}
        >
          {isVerifying ? 'Verifying...' : 'Enter Vault'}
        </button>
      </div>
    </div>
  );
};

const PassengerPortal = ({ nodes, onAddNode, onJoin, onForceQualify, onCancel, drivers, search, settings, onShowQr }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [joinModalNodeId, setJoinModalNodeId] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [leader, setLeader] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<VehicleType>('Pragia');
  const [isSolo, setIsSolo] = useState(false);
  const [isLongDistance, setIsLongDistance] = useState(false);
  
  const [joinName, setJoinName] = useState('');
  const [joinPhone, setJoinPhone] = useState('');

  const filteredNodes = nodes.filter((n: any) => 
    n.status !== 'completed' && n.status !== 'cancelled' &&
    (n.destination.toLowerCase().includes(search.toLowerCase()) || 
     n.origin.toLowerCase().includes(search.toLowerCase()) ||
     n.leaderName.toLowerCase().includes(search.toLowerCase()))
  );

  const createNode = async () => {
    if (!dest || !origin || !leader) return;
    
    const standardFare = type === 'Pragia' ? settings.farePerPragia : settings.farePerTaxi;
    const finalFare = isSolo ? Math.ceil(standardFare * settings.soloMultiplier) : standardFare;

    const node: RideNode = {
      id: `NODE-${Date.now()}`,
      origin: origin,
      destination: dest,
      capacityNeeded: isSolo ? 1 : 4, 
      passengers: [{ id: 'P-LEAD', name: leader, phone }],
      status: (isSolo || isLongDistance) ? 'qualified' : 'forming',
      leaderName: leader,
      leaderPhone: phone,
      farePerPerson: isLongDistance ? 0 : finalFare,
      createdAt: new Date().toISOString(),
      isSolo: isSolo,
      isLongDistance: isLongDistance
    };

    try {
      await onAddNode(node);
      setShowModal(false);
      setOrigin(''); setDest(''); setLeader(''); setPhone(''); setIsSolo(false); setIsLongDistance(false);
    } catch (err) {}
  };

  return (
    <div className="animate-in fade-in space-y-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Passenger Hub</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase mt-1">Request drops or form nodes</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={onShowQr} className="w-12 h-12 lg:hidden bg-white/5 rounded-2xl flex items-center justify-center text-amber-500 border border-white/10 shadow-xl">
             <i className="fas fa-qrcode"></i>
          </button>
          <button onClick={() => setShowModal(true)} className="flex-1 sm:flex-none px-8 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-transform">Form Ride</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNodes.map((node: any) => {
          const driver = drivers.find((d: any) => d.id === node.assignedDriverId);
          return (
            <div key={node.id} className={`glass rounded-[2.5rem] p-8 border transition-all ${node.isLongDistance ? 'border-indigo-500/40' : (node.status === 'dispatched' ? 'border-amber-500/30' : 'border-white/5 hover:border-white/10')}`}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-2">
                  <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest ${node.status === 'dispatched' ? 'bg-amber-500 text-[#020617]' : (node.isLongDistance ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400')}`}>{node.status}</span>
                  {node.isSolo && !node.isLongDistance && <span className="px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Solo Drop</span>}
                  {node.isLongDistance && <span className="px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Long Distance</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => shareNode(node)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-amber-500 hover:bg-amber-500 hover:text-[#020617] transition-all">
                    <i className="fas fa-share-nodes text-[10px]"></i>
                  </button>
                  <p className="text-lg font-black text-emerald-400 leading-none">₵ {node.negotiatedTotalFare || (node.farePerPerson + '/p')}</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="relative pl-6 border-l-2 border-white/5">
                  <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-slate-500"></div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">From</p>
                  <p className="text-white font-bold text-sm truncate uppercase">{node.origin}</p>
                </div>
                <div className="relative pl-6 border-l-2 border-white/5">
                  <div className="absolute left-[-5px] bottom-0 w-2 h-2 rounded-full bg-amber-500"></div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">To</p>
                  <p className="text-white font-black text-lg truncate uppercase">{node.destination}</p>
                </div>
              </div>

              <div className="space-y-6">
                {!node.isSolo && !node.isLongDistance && (
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {Array.from({ length: node.capacityNeeded }).map((_, i) => (
                        <div key={i} className={`w-10 h-10 rounded-xl border flex items-center justify-center ${node.passengers[i] ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-800'}`}>
                          <i className={`fas ${node.passengers[i] ? 'fa-user' : 'fa-chair'} text-[10px]`}></i>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{node.passengers.length} / {node.capacityNeeded}</p>
                  </div>
                )}

                {node.status === 'forming' && !node.isSolo && !node.isLongDistance && (
                  <div className="flex gap-2">
                    <button onClick={() => setJoinModalNodeId(node.id)} className="flex-1 py-4 bg-white/5 border border-white/10 rounded-[1.5rem] font-black text-[10px] uppercase text-white hover:bg-white/10 transition-all">Claim Seat</button>
                    <button onClick={() => { if(confirm("Remove this ride request?")) onCancel(node.id); }} className="w-12 h-12 bg-rose-600/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500"><i className="fas fa-trash"></i></button>
                  </div>
                )}

                {(node.status === 'forming' || node.status === 'qualified') && (node.isSolo || node.isLongDistance) && (
                   <button onClick={() => { if(confirm("Remove this request?")) onCancel(node.id); }} className="w-full py-4 bg-rose-600/10 border border-rose-500/20 rounded-[1.5rem] font-black text-[10px] uppercase text-rose-500">Cancel Request</button>
                )}

                {node.status === 'dispatched' && driver && (
                  <div className="space-y-4 animate-in zoom-in">
                    <div className="p-6 bg-amber-500 text-[#020617] rounded-[1.5rem] text-center shadow-xl flex flex-col items-center gap-4">
                       <div>
                          <p className="text-[8px] font-black uppercase mb-1">Move Code</p>
                          <p className="text-4xl font-black italic tracking-wider">{node.verificationCode}</p>
                       </div>
                       <div className="bg-white p-3 rounded-2xl shadow-inner border-2 border-[#020617]/10">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${node.verificationCode}&bgcolor=ffffff&color=020617`} 
                            className="w-24 h-24"
                            alt="Verification QR"
                          />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <a href={`tel:${driver.contact}`} className="py-3 bg-indigo-600 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase text-white"><i className="fas fa-phone"></i> Call</a>
                      <button onClick={() => { if(confirm("Cancel this ride assignment?")) onCancel(node.id); }} className="py-3 bg-rose-600 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase text-white"><i className="fas fa-xmark"></i> Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* About Section */}
      <section className="pt-12 border-t border-white/5">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-4">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">About UniHub</h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mx-auto italic">{settings.aboutMeText}</p>
          </div>
          
          {settings.aboutMeImages && settings.aboutMeImages.length > 0 && (
            <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar snap-x">
               {settings.aboutMeImages.map((img, idx) => (
                 <div key={idx} className="flex-shrink-0 w-72 h-48 rounded-[2rem] overflow-hidden border border-white/10 snap-center shadow-2xl">
                    <img src={img} className="w-full h-full object-cover" alt={`Hub preview ${idx}`} />
                 </div>
               ))}
            </div>
          )}
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-sm:px-4 max-w-lg rounded-[2.5rem] p-8 lg:p-10 space-y-8 animate-in zoom-in text-slate-900">
            <div className="text-center">
              <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white">Create Ride Request</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase mt-1">Carpooling or Quick Drop</p>
            </div>

            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
              <button onClick={() => {setIsSolo(false); setIsLongDistance(false);}} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${!isSolo && !isLongDistance ? 'bg-amber-500 text-[#020617]' : 'text-slate-400'}`}>Form Group</button>
              <button onClick={() => {setIsSolo(true); setIsLongDistance(false);}} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isSolo ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}>Solo Drop</button>
              <button onClick={() => {setIsSolo(false); setIsLongDistance(true);}} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isLongDistance ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Long Dist.</button>
            </div>

            <div className="space-y-4">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Departure Point" value={origin} onChange={e => setOrigin(e.target.value)} />
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Destination" value={dest} onChange={e => setDest(e.target.value)} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <select className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold" value={type} onChange={e => setType(e.target.value as VehicleType)}>
                    <option value="Pragia">Pragia</option>
                    <option value="Taxi">Taxi</option>
                  </select>
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold" placeholder="Your Name" value={leader} onChange={e => setLeader(e.target.value)} />
               </div>
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="WhatsApp Number" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            
            <div className="flex gap-4">
               <button onClick={() => setShowModal(false)} className="flex-1 py-4 bg-white/10 rounded-[1.5rem] font-black text-[10px] uppercase text-white">Cancel</button>
               <button onClick={createNode} className={`flex-1 py-4 ${isLongDistance ? 'bg-indigo-600' : (isSolo ? 'bg-emerald-500' : 'bg-amber-500')} text-white rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-transform`}>
                 {isLongDistance ? 'Request Bid' : (isSolo ? 'Request Drop' : 'Form Node')}
               </button>
            </div>
          </div>
        </div>
      )}

      {joinModalNodeId && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[160] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-sm:px-4 max-w-sm rounded-[2rem] p-8 space-y-6 animate-in zoom-in text-slate-900">
              <h3 className="text-xl font-black italic uppercase text-center text-white">Join Ride</h3>
              <div className="space-y-4">
                 <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Name" onChange={e => setJoinName(e.target.value)} />
                 <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Phone" onChange={e => setJoinPhone(e.target.value)} />
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setJoinModalNodeId(null)} className="flex-1 py-4 bg-white/10 rounded-xl font-black text-[10px] uppercase text-white">Cancel</button>
                 <button onClick={() => { onJoin(joinModalNodeId, joinName, joinPhone); setJoinModalNodeId(null); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Join</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const DriverPortal = ({ drivers, activeDriver, onLogin, onLogout, qualifiedNodes, dispatchedNodes, onAccept, onVerify, onCancel, onRequestTopup, search, settings }: any) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [momoRef, setMomoRef] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [activeMissionNodeId, setActiveMissionNodeId] = useState<string | null>(null);

  // QR Scanning Logic
  useEffect(() => {
    let html5QrCode: any = null;
    
    if (isScanning && activeMissionNodeId) {
      // Small delay to ensure the DOM element is rendered
      const timeout = setTimeout(async () => {
        try {
          html5QrCode = new (window as any).Html5Qrcode("qr-reader");
          const config = { fps: 15, qrbox: { width: 250, height: 250 } };
          
          await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText: string) => {
              setVerifyCode(decodedText);
              onVerify(activeMissionNodeId, decodedText);
              setIsScanning(false);
              html5QrCode.stop().catch(console.error);
            },
            (errorMessage: string) => {
              // Ignore constant stream of mismatch messages
            }
          );
        } catch (err: any) {
          console.error("Scanner startup failed:", err);
          alert("Camera initialization failed. Check permissions.");
          setIsScanning(false);
        }
      }, 300);

      return () => {
        clearTimeout(timeout);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch(console.error);
        }
      };
    }
  }, [isScanning, activeMissionNodeId, onVerify]);

  if (!activeDriver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-10 px-4 animate-in fade-in">
        <div className="text-center">
            <div className="w-24 h-24 bg-indigo-600/10 rounded-[2.5rem] flex items-center justify-center text-indigo-500 mx-auto mb-6 border border-indigo-500/20 shadow-2xl">
              <i className="fas fa-id-card-clip text-4xl"></i>
            </div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Driver Terminal</h2>
        </div>
        
        {selectedDriverId ? (
            <div className="w-full max-md glass p-10 rounded-[3rem] border border-white/10 space-y-8 animate-in zoom-in text-center">
                <input 
                  type="password" 
                  maxLength={4}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-4xl tracking-[1em] font-black outline-none focus:border-amber-500 text-center text-white" 
                  placeholder="0000"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onLogin(selectedDriverId, pin)}
                />
                <div className="flex gap-4">
                    <button onClick={() => {setSelectedDriverId(null); setPin('');}} className="flex-1 py-4 bg-white/5 rounded-xl font-black text-[10px] uppercase text-slate-400">Back</button>
                    <button onClick={() => onLogin(selectedDriverId, pin)} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-xl">Login</button>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
              {drivers.map((d: any) => (
                <button key={d.id} onClick={() => setSelectedDriverId(d.id)} className="glass p-8 rounded-[2rem] border border-white/5 text-left transition-all hover:border-amber-500/50 group">
                  <p className="font-black uppercase italic text-xl text-white mb-4 group-hover:text-amber-500 transition-colors">{d.name}</p>
                  <p className="text-[9px] font-black text-slate-500 uppercase">WALLET: ₵{d.walletBalance.toFixed(1)}</p>
                </button>
              ))}
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 bg-indigo-500/5 p-6 rounded-[2rem] border border-indigo-500/10 relative overflow-hidden">
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-[#020617] shadow-xl">
            <i className={`fas ${activeDriver.vehicleType === 'Pragia' ? 'fa-motorcycle' : 'fa-taxi'} text-2xl`}></i>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tighter uppercase italic text-white leading-none">{activeDriver.name}</h2>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-2">₵ {activeDriver.walletBalance.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto relative z-10">
          <button onClick={() => setShowTopupModal(true)} className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">Top-Up</button>
          <button onClick={onLogout} className="flex-1 sm:flex-none px-6 py-3 bg-rose-600/10 text-rose-500 rounded-xl text-[10px] font-black uppercase border border-rose-500/20">End Shift</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
           <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Ready for Dispatch</h3>
           <div className="space-y-4">
            {qualifiedNodes.map((node: any) => (
              <div key={node.id} className="glass rounded-[2rem] p-6 border transition-all flex flex-col md:flex-row items-center gap-6 border-white/5 hover:border-indigo-500/30">
                  <div className="flex-1">
                    <p className="font-black text-sm uppercase italic text-white">{node.origin} → {node.destination}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Requested by {node.leaderName}</p>
                  </div>
                  <button onClick={() => onAccept(node.id, activeDriver.id)} className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Accept Job (₵{settings.commissionPerSeat})</button>
              </div>
            ))}
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Active Mission</h3>
           {dispatchedNodes.filter((n: any) => n.assignedDriverId === activeDriver.id).map((node: any) => (
              <div key={node.id} className="glass rounded-[2rem] p-8 border space-y-6 border-amber-500/20">
                 <h4 className="text-xl font-black uppercase italic text-white leading-none truncate text-center">{node.origin} to {node.destination}</h4>
                 <div className="space-y-4 pt-4 border-t border-white/5 text-center">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Verify Trip to finish</p>
                    <div className="relative group">
                       <input 
                         className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-5 text-center text-4xl font-black outline-none focus:border-emerald-500 text-white" 
                         placeholder="0000" 
                         maxLength={4} 
                         value={verifyCode} 
                         onChange={e => setVerifyCode(e.target.value)} 
                       />
                       <button 
                         onClick={() => { setActiveMissionNodeId(node.id); setIsScanning(true); }}
                         className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500 hover:text-[#020617] transition-all border border-emerald-500/20 shadow-xl"
                       >
                          <i className="fas fa-qrcode text-lg"></i>
                       </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => onVerify(node.id, verifyCode)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Complete Ride</button>
                      <button onClick={() => { if(confirm("Abandon ride?")) onCancel(node.id); }} className="w-full py-2 bg-white/5 text-slate-500 rounded-xl font-black text-[9px] uppercase">Unable to Finish</button>
                    </div>
                 </div>
              </div>
           ))}
        </div>
      </div>

      {isScanning && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[200] flex items-center justify-center p-4">
           <div className="w-full max-w-lg space-y-8 animate-in zoom-in duration-300">
              <div className="flex justify-between items-center text-white px-2">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-[#020617] shadow-xl shadow-emerald-500/20">
                       <i className="fas fa-camera text-xl"></i>
                    </div>
                    <div>
                       <h3 className="text-xl font-black italic uppercase tracking-tighter leading-none">Scanning Trip QR</h3>
                       <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">Auto Verification Active</p>
                    </div>
                 </div>
                 <button onClick={() => setIsScanning(false)} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-all border border-white/10">
                    <i className="fas fa-times text-lg"></i>
                 </button>
              </div>
              
              <div className="relative group p-4 glass rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden">
                 <div id="qr-reader" className="w-full aspect-square bg-black/40 rounded-[2rem] overflow-hidden relative">
                    <div className="scanner-line"></div>
                 </div>
              </div>

              <div className="text-center space-y-3">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Point camera at the passenger's screen.<br/>Verification is automatic once detected.</p>
                 <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">UniHub Secure Bridge</span>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showTopupModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-sm:px-4 max-w-md rounded-[2.5rem] p-8 space-y-8 animate-in zoom-in text-slate-900">
            <div className="text-center">
              <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white">Credit Request</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase mt-1">Manual MoMo Verification</p>
            </div>
            
            <div className="space-y-4">
               <div className="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-center">
                  <p className="text-[9px] font-black text-amber-500 uppercase mb-1">Hub MoMo Account</p>
                  <p className="text-3xl font-black text-white italic leading-none">{settings.adminMomo}</p>
                  <p className="text-[11px] font-black text-slate-400 uppercase mt-2">{settings.adminMomoName}</p>
               </div>

               <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-black text-emerald-600 text-center text-xl" placeholder="Amount (₵)" onChange={e => setTopupAmount(e.target.value)} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-center" placeholder="Transaction Reference" onChange={e => setMomoRef(e.target.value)} />
            </div>
            <div className="flex gap-4">
               <button onClick={() => setShowTopupModal(false)} className="flex-1 py-4 bg-white/10 rounded-xl font-black text-[10px] uppercase text-white">Cancel</button>
               <button onClick={() => { onRequestTopup(activeDriver.id, Number(topupAmount), momoRef); setShowTopupModal(false); }} className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Send Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ... Rest of AdminPortal, StatCard, NavItem remain same ...
const AdminPortal = ({ activeTab, setActiveTab, nodes, drivers, onAddDriver, onDeleteDriver, onCancelRide, onSettleRide, transactions, topupRequests, onApproveTopup, onLock, search, settings, onUpdateSettings, hubRevenue }: any) => {
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [newDriver, setNewDriver] = useState<Partial<Driver>>({ vehicleType: 'Pragia', pin: '0000' });
  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);
  const [removalKey, setRemovalKey] = useState('');
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isProcessingWallpaper, setIsProcessingWallpaper] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const pendingRequests = topupRequests.filter((r: any) => 
    r.status === 'pending' && 
    (r.momoReference.toLowerCase().includes(search.toLowerCase()) || drivers.find((d:any)=>d.id===r.driverId)?.name.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredDrivers = drivers.filter((d: any) => 
    d.name.toLowerCase().includes(search.toLowerCase()) || d.licensePlate.toLowerCase().includes(search.toLowerCase())
  );

  const activeMissions = nodes.filter((n: any) => n.status === 'dispatched');

  const handleRegisterDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if(!newDriver.name || !newDriver.contact || !newDriver.pin) {
      alert("Missing required fields!");
      return;
    }
    onAddDriver(newDriver);
    setShowDriverModal(false);
  };

  const handleRemovalChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingDeletionId) return;

    const { data: isVerified } = await supabase.rpc('verify_admin_secret', { candidate_secret: removalKey });
    
    if (isVerified) {
      onDeleteDriver(pendingDeletionId);
      setPendingDeletionId(null);
      setRemovalKey('');
    } else {
      alert("Removal Key Invalid. Action Aborted.");
      setRemovalKey('');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsProcessingImages(true);
      try {
        const compressedResults = await Promise.all(
          Array.from(files).map(file => compressImage(file))
        );
        
        onUpdateSettings({
          ...settings,
          aboutMeImages: [...(settings.aboutMeImages || []), ...compressedResults]
        });
      } catch (err) {
        console.error("Image Processing Error:", err);
        alert("Failed to process images.");
      } finally {
        setIsProcessingImages(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingWallpaper(true);
      try {
        const compressed = await compressImage(file, 0.6, 1200);
        onUpdateSettings({
          ...settings,
          appWallpaper: compressed
        });
      } catch (err) {
        console.error("Wallpaper Error:", err);
        alert("Failed to upload wallpaper.");
      } finally {
        setIsProcessingWallpaper(false);
        if (wallpaperInputRef.current) wallpaperInputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    onUpdateSettings({
      ...settings,
      aboutMeImages: settings.aboutMeImages.filter((_, i: number) => i !== index)
    });
  };

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-8 pb-10">
      <div className="flex bg-white/5 p-1 rounded-[1.5rem] border border-white/10 overflow-x-auto no-scrollbar max-w-full">
        <TabBtn active={activeTab === 'monitor'} label="Stats" onClick={() => setActiveTab('monitor')} />
        <TabBtn active={activeTab === 'fleet'} label="Fleet" onClick={() => setActiveTab('fleet')} />
        <TabBtn active={activeTab === 'requests'} label="Credit" onClick={() => setActiveTab('requests')} count={pendingRequests.length} />
        <TabBtn active={activeTab === 'settings'} label="Setup" onClick={() => setActiveTab('settings')} />
        <button onClick={onLock} className="px-6 py-3 text-[9px] font-black uppercase text-rose-500 border-l border-white/5">Lock</button>
      </div>

      {activeTab === 'monitor' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Forming" value={nodes.filter((n:any) => n.status === 'forming').length} icon="fa-users" color="text-amber-400" />
            <StatCard label="Live Fleet" value={drivers.length} icon="fa-taxi" color="text-indigo-400" />
            <StatCard label="Qualified" value={nodes.filter((n:any) => n.status === 'qualified').length} icon="fa-bolt" color="text-emerald-400" />
            <StatCard label="Revenue" value={hubRevenue.toFixed(0)} icon="fa-money-bill" color="text-slate-400" isCurrency />
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-black uppercase italic text-white px-2">Mission Control</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {activeMissions.map((n: any) => {
                  const driver = drivers.find((d: any) => d.id === n.assignedDriverId);
                  return (
                    <div key={n.id} className="glass p-6 rounded-3xl border border-white/5 flex flex-col justify-between gap-4">
                       <div>
                          <p className="text-[8px] font-black uppercase text-amber-500 mb-1">Active Mission</p>
                          <p className="font-bold text-white text-sm">{n.origin} → {n.destination}</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase">Driver: {driver?.name || 'N/A'}</p>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => onCancelRide(n.id)} className="flex-1 py-3 bg-rose-600/10 text-rose-500 rounded-xl text-[8px] font-black uppercase border border-rose-500/20">Refund & Cancel</button>
                          <button onClick={() => onSettleRide(n.id)} className="flex-1 py-3 bg-emerald-600/10 text-emerald-500 rounded-xl text-[8px] font-black uppercase border border-rose-500/20">Force Settle</button>
                       </div>
                    </div>
                  )
               })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fleet' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center px-2">
              <h3 className="text-xl font-black uppercase italic text-white leading-none">Fleet Registry</h3>
              <button onClick={() => setShowDriverModal(true)} className="px-6 py-3 bg-amber-500 text-[#020617] rounded-xl text-[9px] font-black uppercase shadow-xl">Register Unit</button>
           </div>
           <div className="glass rounded-[2rem] overflow-hidden border border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                   <thead className="bg-white/5 text-slate-500 uppercase font-black tracking-widest border-b border-white/5">
                      <tr>
                         <th className="px-8 py-5">Driver Name</th>
                         <th className="px-8 py-5 text-center">Vehicle</th>
                         <th className="px-8 py-5 text-center">Security PIN</th>
                         <th className="px-8 py-5 text-center">Wallet</th>
                         <th className="px-8 py-5 text-right">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                      {filteredDrivers.map((d: any) => (
                         <tr key={d.id} className="text-slate-300 font-bold hover:bg-white/5 transition-colors group">
                            <td className="px-8 py-5">
                                <div className="text-white italic">{d.name}</div>
                                <div className="text-[9px] text-slate-500 font-medium">{d.contact}</div>
                            </td>
                            <td className="px-8 py-5 text-center uppercase text-[9px] text-slate-400">{d.vehicleType}<br/>{d.licensePlate}</td>
                            <td className="px-8 py-5 text-center font-black text-amber-500 tracking-[0.2em]">{d.pin}</td>
                            <td className="px-8 py-5 text-center text-emerald-400 font-black italic">₵{d.walletBalance.toFixed(1)}</td>
                            <td className="px-8 py-5 text-right">
                               <button 
                                  onClick={() => setPendingDeletionId(d.id)} 
                                  className="px-4 py-2 bg-rose-600/10 text-rose-500 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all ml-auto flex items-center gap-2"
                               >
                                  <i className="fas fa-trash-can"></i>
                                  Unregister
                               </button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-8">
           <div className="bg-white/5 p-8 lg:p-12 rounded-[2.5rem] border border-white/10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-amber-500 uppercase px-6">Set New Master Key</label>
                    <input 
                      type="password"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-white placeholder:text-slate-800" 
                      placeholder="••••••••"
                      onChange={e => onUpdateSettings({...settings, adminSecret: e.target.value})} 
                    />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-amber-500 uppercase px-6">Admin MoMo Number</label>
                    <input className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-white" value={settings.adminMomo} onChange={e => onUpdateSettings({...settings, adminMomo: e.target.value})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-amber-500 uppercase px-6">Admin MoMo Name</label>
                    <input className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-white" value={settings.adminMomoName} onChange={e => onUpdateSettings({...settings, adminMomoName: e.target.value})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-emerald-400 uppercase px-6">Solo Multiplier (x)</label>
                    <input type="number" step="0.1" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-emerald-400" value={settings.soloMultiplier} onChange={e => onUpdateSettings({...settings, soloMultiplier: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-emerald-400 uppercase px-6">Hub Profit / Seat (₵)</label>
                    <input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-emerald-400" value={settings.commissionPerSeat} onChange={e => onUpdateSettings({...settings, commissionPerSeat: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-indigo-400 uppercase px-6">Pragia Fare (₵)</label>
                    <input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-indigo-400" value={settings.farePerPragia} onChange={e => onUpdateSettings({...settings, farePerPragia: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-indigo-400 uppercase px-6">Taxi Fare (₵)</label>
                    <input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-indigo-400" value={settings.farePerTaxi} onChange={e => onUpdateSettings({...settings, farePerTaxi: Number(e.target.value)})} />
                 </div>
              </div>
           </div>
           
           <div className="bg-white/5 p-8 lg:p-12 rounded-[2.5rem] border border-white/10 space-y-10">
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white px-6">Branding & Theme</h3>
              <div className="space-y-6 px-6">
                 <div className="p-8 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 space-y-6">
                    <div>
                       <h4 className="text-sm font-black uppercase text-indigo-400 leading-none">Global Hub Wallpaper</h4>
                       <p className="text-[10px] font-medium text-slate-500 mt-1">Sets the background image for all users.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                       <div className="w-full sm:w-48 aspect-video rounded-2xl overflow-hidden bg-black/40 border border-white/10 relative group">
                          {settings.appWallpaper ? (
                            <img src={settings.appWallpaper} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-700 text-[10px] font-bold uppercase tracking-widest">Default Theme</div>
                          )}
                          {isProcessingWallpaper && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                               <i className="fas fa-spinner fa-spin text-white"></i>
                            </div>
                          )}
                       </div>
                       <div className="flex-1 space-y-3 w-full">
                          <button onClick={() => wallpaperInputRef.current?.click()} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-[10px] uppercase text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3">
                             <i className="fas fa-image"></i>
                             Upload Wallpaper
                          </button>
                          {settings.appWallpaper && (
                             <button onClick={() => onUpdateSettings({...settings, appWallpaper: ""})} className="w-full py-2 text-[9px] font-black uppercase text-rose-500 hover:text-rose-400 transition-colors">Reset to Default</button>
                          )}
                       </div>
                       <input ref={wallpaperInputRef} type="file" className="hidden" onChange={handleWallpaperUpload} accept="image/*" />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">About UniHub</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-medium text-sm text-slate-300 h-32 outline-none focus:border-amber-500"
                      value={settings.aboutMeText}
                      onChange={e => onUpdateSettings({...settings, aboutMeText: e.target.value})}
                      placeholder="Hub story..."
                    />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Hub Portfolio Images</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                       {settings.aboutMeImages?.map((img: string, i: number) => (
                         <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 group">
                            <img src={img} className="w-full h-full object-cover" />
                            <button onClick={() => removeImage(i)} className="absolute top-2 right-2 w-6 h-6 bg-rose-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                               <i className="fas fa-times text-[10px]"></i>
                            </button>
                         </div>
                       ))}
                       <button onClick={() => !isProcessingImages && fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-slate-500 hover:text-amber-500 hover:border-amber-500/50 transition-all disabled:opacity-50" disabled={isProcessingImages}>
                          {isProcessingImages ? <i className="fas fa-spinner fa-spin text-xl mb-2"></i> : <i className="fas fa-plus text-xl mb-2"></i>}
                          <span className="text-[8px] font-black uppercase">{isProcessingImages ? 'Processing' : 'Upload'}</span>
                       </button>
                       <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleImageUpload} accept="image/*" />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {pendingRequests.map((req: any) => {
             const driver = drivers.find((d: any) => d.id === req.driverId);
             return (
               <div key={req.id} className="glass p-8 rounded-[2rem] border border-emerald-500/20 space-y-6 relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[9px] font-black text-emerald-400 uppercase mb-1 tracking-widest">Awaiting Approval</p>
                    <h4 className="text-xl font-black uppercase italic text-white leading-none mb-2">{driver?.name || 'User'}</h4>
                    <p className="text-3xl font-black text-white italic mt-6">₵ {req.amount}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-2">Ref: {req.momoReference}</p>
                  </div>
                  <button onClick={() => onApproveTopup(req.id)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-emerald-500 transition-all relative z-10">Approve Credit</button>
               </div>
             );
           })}
        </div>
      )}

      {showDriverModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-sm:px-4 max-w-lg rounded-[2.5rem] p-8 lg:p-10 space-y-8 animate-in zoom-in text-slate-900">
            <h3 className="text-2xl font-black italic tracking-tighter uppercase text-center text-white">Register Unit</h3>
            <form onSubmit={handleRegisterDriver} className="space-y-4">
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Driver Full Name" onChange={e => setNewDriver({...newDriver, name: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                  <select className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold" onChange={e => setNewDriver({...newDriver, vehicleType: e.target.value as VehicleType})}>
                    <option value="Pragia">Pragia</option>
                    <option value="Taxi">Taxi</option>
                  </select>
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold" placeholder="Plate Number" onChange={e => setNewDriver({...newDriver, licensePlate: e.target.value})} />
               </div>
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="WhatsApp Number" onChange={e => setNewDriver({...newDriver, contact: e.target.value})} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-black tracking-widest text-center" placeholder="Set PIN (4-digit)" maxLength={4} onChange={e => setNewDriver({...newDriver, pin: e.target.value})} value={newDriver.pin} />
               <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowDriverModal(false)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-[10px] uppercase text-slate-400">Cancel</button>
                  <button type="submit" className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-xl">Submit</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {pendingDeletionId && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-w-sm rounded-[2.5rem] p-10 space-y-8 animate-in zoom-in text-center border border-white/10">
              <div className="w-20 h-20 bg-rose-500/10 rounded-[2rem] border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto">
                 <i className="fas fa-shield-halved text-3xl"></i>
              </div>
              <div>
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Identity Challenge</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Enter Master Key to unregister</p>
              </div>
              <form onSubmit={handleRemovalChallenge} className="space-y-6">
                 <input 
                    type="password" 
                    placeholder="Master Key" 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-rose-500 font-black text-center text-white"
                    value={removalKey}
                    onChange={e => setRemovalKey(e.target.value)}
                    autoFocus
                 />
                 <div className="flex gap-4">
                    <button type="button" onClick={() => { setPendingDeletionId(null); setRemovalKey(''); }} className="flex-1 py-4 bg-white/5 rounded-xl font-black text-[10px] uppercase text-slate-400">Abort</button>
                    <button type="submit" className="flex-1 py-4 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Confirm</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, label, onClick, count }: any) => (
  <button onClick={onClick} className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${active ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
    {label} {count !== undefined && count > 0 && <span className="ml-1 bg-rose-500 text-white text-[7px] px-1.5 py-0.5 rounded-full ring-2 ring-[#020617]">{count}</span>}
  </button>
);

const StatCard = ({ label, value, icon, color, isCurrency }: any) => (
  <div className="glass p-6 rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col justify-end min-h-[140px] group transition-all hover:border-white/10">
    <i className={`fas ${icon} absolute top-6 left-6 ${color} text-xl transition-transform group-hover:scale-110`}></i>
    <div className="relative z-10">
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-black italic text-white leading-none">{isCurrency ? '₵' : ''}{value}</p>
    </div>
  </div>
);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
