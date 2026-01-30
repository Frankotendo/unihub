
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
  driversJoined: string[]; // List of driver IDs
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
  avatarUrl?: string; // Driver's profile picture
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
  avatarUrl?: string; // Captured during registration
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
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'requests' | 'settings' | 'missions' | 'onboarding'>('monitor');
  
  // Auth states
  const [session, setSession] = useState<any>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => {
    return sessionStorage.getItem('unihub_driver_session_v12');
  });

  // Track user's own rides locally to prioritize their Move Codes
  const [myRideIds, setMyRideIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('unihub_my_rides_v12');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
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
    localStorage.setItem('unihub_my_rides_v12', JSON.stringify(myRideIds));
  }, [myRideIds]);

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

  const joinMission = async (missionId: string, driverId: string) => {
    const mission = missions.find(m => m.id === missionId);
    const driver = drivers.find(d => d.id === driverId);

    if (!mission || !driver) return;
    if (mission.driversJoined.includes(driverId)) {
      alert("You have already joined this mission station.");
      return;
    }
    if (driver.walletBalance < mission.entryFee) {
      alert("Insufficient Balance for Station Entry Fee.");
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

    alert(`Successfully stationing at ${mission.location}! ₵${mission.entryFee} deducted.`);
  };

  const addRideToMyList = (nodeId: string) => {
    setMyRideIds(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
  };

  const removeRideFromMyList = (nodeId: string) => {
    setMyRideIds(prev => prev.filter(id => id !== nodeId));
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

      addRideToMyList(nodeId);
    }
  };

  const forceQualify = async (nodeId: string) => {
    await supabase.from('unihub_nodes').update({ status: 'qualified' }).eq('id', nodeId);
  };

  const acceptRide = async (nodeId: string, driverId: string, customFare?: number) => {
    const driver = drivers.find(d => d.id === driverId);
    const node = nodes.find(n => n.id === nodeId);
    if (!driver || !node) return;

    const totalPotentialCommission = settings.commissionPerSeat * node.passengers.length;
    if (driver.walletBalance < totalPotentialCommission) {
      alert(`Insufficient Balance! You need at least ₵${totalPotentialCommission.toFixed(2)} to accept this job.`);
      return;
    }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    await supabase.from('unihub_nodes').update({ 
      status: 'dispatched', 
      assignedDriverId: driverId, 
      verificationCode,
      negotiatedTotalFare: customFare || node?.negotiatedTotalFare
    }).eq('id', nodeId);

    alert(customFare ? `Negotiated trip accepted at ₵${customFare}! Money will be deducted after verification.` : "Job accepted! Verification code shared with you.");
  };

  const verifyRide = async (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (node.verificationCode === code) {
      const driver = drivers.find(d => d.id === node.assignedDriverId);
      if (!driver) {
        alert("Verification error: Driver record not found.");
        return;
      }

      const totalCommission = settings.commissionPerSeat * node.passengers.length;

      try {
        await Promise.all([
          supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId),
          supabase.from('unihub_drivers').update({ 
            walletBalance: driver.walletBalance - totalCommission 
          }).eq('id', driver.id),
          supabase.from('unihub_transactions').insert([{
            id: `TX-VERIFY-${Date.now()}`,
            driverId: driver.id,
            amount: totalCommission,
            type: 'commission',
            timestamp: new Date().toLocaleString()
          }])
        ]);
        removeRideFromMyList(nodeId);
        alert(`Verification successful! Commission of ₵${totalCommission.toFixed(2)} deducted.`);
      } catch (err: any) {
        console.error("Verification deduction error:", err);
        alert("Status updated but failed to deduct credit. Contact Admin.");
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
        const resetStatus = (node.isSolo || node.isLongDistance) ? 'qualified' : (node.passengers.length >= 4 ? 'qualified' : 'forming');
        const { error: resetErr } = await supabase.from('unihub_nodes').update({ 
          status: resetStatus, 
          assignedDriverId: null, 
          verificationCode: null 
        }).eq('id', nodeId);
        
        if (resetErr) throw resetErr;
        alert("Assignment cancelled. No commission was charged.");
      } else {
        const { error: deleteErr } = await supabase.from('unihub_nodes').delete().eq('id', nodeId);
        if (deleteErr) throw deleteErr;
        removeRideFromMyList(nodeId);
        alert("Ride request removed from the Hub.");
      }
    } catch (err: any) {
      console.error("Cancellation error:", err);
      alert("Failed to process request: " + (err.message || "Unknown error"));
    }
  };

  const settleNode = async (nodeId: string) => {
    if (confirm("Force settle this ride as completed? Commission will be deducted.")) {
      const node = nodes.find(n => n.id === nodeId);
      if (node && node.assignedDriverId) {
        const driver = drivers.find(d => d.id === node.assignedDriverId);
        if (driver) {
          const totalCommission = settings.commissionPerSeat * node.passengers.length;
          await Promise.all([
            supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId),
            supabase.from('unihub_drivers').update({ 
              walletBalance: driver.walletBalance - totalCommission 
            }).eq('id', driver.id),
            supabase.from('unihub_transactions').insert([{
              id: `TX-FORCE-${Date.now()}`,
              driverId: driver.id,
              amount: totalCommission,
              type: 'commission',
              timestamp: new Date().toLocaleString()
            }])
          ]);
        }
      } else {
        await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId);
      }
      alert("Node settled manually.");
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
    const { error } = await supabase.from('unihub_topups').insert([req]);
    if (error) {
      alert("Topup Request Failed: " + error.message);
    } else {
      alert("Request logged.");
    }
  };

  const requestRegistration = async (reg: Omit<RegistrationRequest, 'id' | 'status' | 'timestamp'>) => {
    const req: RegistrationRequest = {
      ...reg,
      id: `REG-${Date.now()}`,
      status: 'pending',
      timestamp: new Date().toLocaleString()
    };
    const { error } = await supabase.from('unihub_registrations').insert([req]);
    if (error) {
      console.error("Registration error:", error);
      alert("Submission Error: " + error.message);
    } else {
      alert("Application submitted! An admin will review your portrait and MoMo payment reference shortly.");
    }
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

  const approveRegistration = async (regId: string) => {
    const reg = registrationRequests.find(r => r.id === regId);
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
        supabase.from('unihub_registrations').update({ status: 'approved' }).eq('id', regId),
        supabase.from('unihub_transactions').insert([{
          id: `TX-REG-${Date.now()}`,
          driverId: newDriver.id,
          amount: reg.amount,
          type: 'registration',
          timestamp: new Date().toLocaleString()
        }])
      ]);
      alert("Driver approved and registered successfully!");
    } catch (err: any) {
      console.error("Approval error:", err);
      alert("Failed to approve driver: " + err.message);
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
    alert("Hub Settings Updated Successfully!");
  };

  const hubRevenue = useMemo(() => transactions.reduce((a, b) => a + b.amount, 0), [transactions]);
  const activeNodeCount = useMemo(() => nodes.filter(n => n.status !== 'completed').length, [nodes]);
  const onlineDriverCount = useMemo(() => drivers.filter(d => d.status === 'online').length, [drivers]);

  const pendingRequestsCount = useMemo(() => 
    topupRequests.filter(r => r.status === 'pending').length + 
    registrationRequests.filter(r => r.status === 'pending').length, 
  [topupRequests, registrationRequests]);

  const handleAdminAuth = async (email: string, pass: string) => {
    if (!email || !pass) return;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });

      if (error) throw error;
      
      if (data.session) {
        setSession(data.session);
        setIsAdminAuthenticated(true);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      alert("Authentication Failed: " + err.message);
    }
  };

  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    setIsAdminAuthenticated(false);
    setSession(null);
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
        <div className="fixed top-2 sm:top-4 right-2 sm:right-4 z-[300] bg-amber-500/20 text-amber-500 px-3 py-1.5 rounded-full border border-amber-500/30 text-[9px] font-black uppercase flex items-center gap-2 backdrop-blur-md">
           <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
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
            <button onClick={() => setShowQrModal(true)} title="Hub QR Code" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-amber-500 hover:bg-white/10 transition-all">
              <i className="fas fa-qrcode text-xs"></i>
            </button>
            <button onClick={() => setShowHelpModal(true)} title="Help Center" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-white/10 transition-all">
              <i className="fas fa-circle-question text-xs"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Passenger Hub" onClick={() => {safeSetViewMode('passenger'); setGlobalSearch('');}} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Driver Terminal" onClick={() => {safeSetViewMode('driver'); setGlobalSearch('');}} />
          {(isVaultAccess || isAdminAuthenticated) && (
            <NavItem 
              active={viewMode === 'admin'} 
              icon="fa-shield-halved" 
              label="Admin Command" 
              onClick={() => {safeSetViewMode('admin'); setGlobalSearch('');}} 
              badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
            />
          )}
          <NavItem active={false} icon="fa-share-nodes" label="Invite Friends" onClick={shareHub} />
          <button onClick={() => { if(confirm("Clear your personal mission tracking?")) setMyRideIds([]); }} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-500 hover:bg-white/5 transition-all mt-4">
             <i className="fas fa-trash-can text-lg w-6"></i>
             <span className="text-sm font-bold">Reset History</span>
          </button>
        </div>

        <div className="pt-6 border-t border-white/5">
           {activeDriver ? (
             <div className="bg-indigo-500/10 p-6 rounded-[2.5rem] border border-indigo-500/20 relative overflow-hidden mb-4">
                <div className="flex items-center gap-3">
                  {activeDriver.avatarUrl ? (
                     <img src={activeDriver.avatarUrl} className="w-10 h-10 rounded-full object-cover border border-indigo-500/40" alt="Avatar" />
                  ) : (
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                      <i className="fas fa-user text-xs"></i>
                    </div>
                  )}
                  <div className="truncate">
                    <p className="text-[9px] font-black uppercase text-indigo-400 leading-none">Driver</p>
                    <p className="text-sm font-black text-white truncate">{activeDriver.name}</p>
                  </div>
                </div>
                <button onClick={handleDriverLogout} className="mt-4 w-full py-2 bg-indigo-600 rounded-xl text-[8px] font-black uppercase tracking-widest">Logout</button>
             </div>
           ) : null}
          <div className="bg-emerald-500/10 p-6 rounded-[2.5rem] border border-emerald-500/20 relative overflow-hidden">
            <p className="text-[9px] font-black uppercase text-emerald-400 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Live Hub Pulse
            </p>
            <div className="space-y-1">
               <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-white uppercase opacity-60 tracking-tight">Units Online</p>
                  <p className="text-lg font-black text-white italic">{onlineDriverCount}</p>
               </div>
               <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-white uppercase opacity-60 tracking-tight">Active Nodes</p>
                  <p className="text-lg font-black text-white italic">{activeNodeCount}</p>
               </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav - Optimized Height */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around px-4">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Hub" onClick={() => safeSetViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Drive" onClick={() => safeSetViewMode('driver')} />
        {(isVaultAccess || isAdminAuthenticated) && (
          <MobileNavItem 
            active={viewMode === 'admin'} 
            icon="fa-shield-halved" 
            label="Admin" 
            onClick={() => safeSetViewMode('admin')} 
            badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
          />
        )}
        <MobileNavItem active={false} icon="fa-circle-question" label="Help" onClick={() => setShowHelpModal(true)} />
      </nav>

      {/* Main Content - Efficient Padding */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-12 pb-24 lg:pb-12 no-scrollbar z-10 relative">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-8">
          
          {isNewUser && (
            <div className="bg-indigo-600 p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 animate-in slide-in-from-top-4">
              <div className="relative z-10 flex items-center gap-4 sm:gap-6 text-center sm:text-left">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-lg sm:text-2xl backdrop-blur-md shrink-0">
                   <i className="fas fa-sparkles"></i>
                </div>
                <div>
                   <h2 className="text-lg sm:text-xl font-black uppercase italic leading-none text-white">Welcome</h2>
                   <p className="text-[10px] sm:text-xs font-bold opacity-80 mt-1 uppercase tracking-tight text-white">First time here? Check the guide.</p>
                </div>
              </div>
              <div className="relative z-10 flex gap-2 w-full sm:w-auto">
                 <button onClick={() => setShowHelpModal(true)} className="flex-1 sm:flex-none px-4 py-2.5 bg-white text-indigo-600 rounded-lg font-black text-[9px] uppercase tracking-widest shadow-xl">Guide</button>
                 <button onClick={dismissWelcome} className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-700 text-white rounded-lg font-black text-[9px] uppercase tracking-widest">Close</button>
              </div>
            </div>
          )}

          {/* Sticky Mobile Search */}
          {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
            <div className="sticky top-0 z-40 lg:relative pt-2 pb-2 lg:pt-0 lg:pb-0 bg-[#020617]/60 backdrop-blur-lg lg:bg-transparent -mx-3 px-3 lg:mx-0 lg:px-0">
               <div className="relative group">
                  <i className="fas fa-search absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
                  <input 
                      type="text" 
                      placeholder="Search routes..." 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl sm:rounded-[2rem] py-3.5 sm:py-5 pl-12 sm:pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-700 text-sm"
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                  />
               </div>
            </div>
          )}

          {viewMode === 'passenger' && (
            <PassengerPortal 
              nodes={nodes} 
              myRideIds={myRideIds}
              onAddNode={async (node: RideNode) => {
                const { error } = await supabase.from('unihub_nodes').insert([node]);
                if (error) throw error;
                addRideToMyList(node.id);
              }} 
              onJoin={joinNode} 
              onForceQualify={forceQualify} 
              onCancel={cancelRide} 
              drivers={drivers} 
              search={globalSearch} 
              settings={settings} 
              onShowQr={() => setShowQrModal(true)} 
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
              onJoinMission={joinMission}
              onAccept={acceptRide}
              onVerify={verifyRide}
              onCancel={cancelRide}
              onRequestTopup={requestTopup}
              onRequestRegistration={requestRegistration}
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
                missions={missions}
                onCreateMission={async (m: HubMission) => await supabase.from('unihub_missions').insert([m])}
                onDeleteMission={async (id: string) => await supabase.from('unihub_missions').delete().eq('id', id)}
                transactions={transactions} 
                topupRequests={topupRequests}
                registrationRequests={registrationRequests}
                onApproveTopup={approveTopup}
                onApproveRegistration={approveRegistration}
                onLock={handleAdminLogout}
                search={globalSearch}
                settings={settings}
                onUpdateSettings={updateGlobalSettings}
                hubRevenue={hubRevenue}
                adminEmail={session?.user?.email}
              />
            )
          )}
        </div>
      </main>

      {/* QR Code Modal - Centered */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-w-sm rounded-[2.5rem] p-8 text-center border border-white/10 animate-in zoom-in">
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Hub QR Code</h3>
              <div className="bg-white p-6 rounded-[2rem] shadow-2xl my-6">
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}&bgcolor=ffffff&color=020617&format=svg`} 
                   className="w-full aspect-square"
                   alt="Hub QR"
                 />
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setShowQrModal(false)} className="flex-1 py-3.5 bg-white/5 rounded-xl font-black text-[10px] uppercase text-slate-400">Close</button>
                 <button onClick={shareHub} className="flex-1 py-3.5 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-xl">Share</button>
              </div>
           </div>
        </div>
      )}

      {/* Help Modal - Centered Scrollable */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-3xl rounded-[2.5rem] p-6 sm:p-10 border border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar animate-in zoom-in">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black italic uppercase text-white">Hub Help Center</h3>
                <button onClick={() => setShowHelpModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500"><i className="fas fa-times"></i></button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <HelpSection icon="fa-user-graduate" title="Passenger" color="text-amber-500" points={["Form Group: Split costs with 4 seats.","Solo Drop: Pay more for direct transport.","Move Code: Share ONLY at your destination."]} />
                <HelpSection icon="fa-id-card-clip" title="Driver" color="text-indigo-400" points={["Missions: Pay entry for high-traffic zones.","Verification: Scan QR to finish and earn.","Security: Never share your login PIN."]} />
                <HelpSection icon="fa-circle-info" title="General" color="text-emerald-400" points={["Pricing: Set by Admin, no bargaining.","Disputes: Use WhatsApp support line.","Updates: Hub uses live real-time sync."]} />
             </div>
             <div className="pt-8 flex justify-center"><button onClick={() => setShowHelpModal(false)} className="px-10 py-3.5 bg-white/5 border border-white/10 rounded-xl font-black text-[10px] uppercase text-white tracking-widest">Understood</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- HELPER COMPONENTS ---

const HelpSection = ({ icon, title, points, color }: any) => (
  <div className="space-y-4">
     <div className="flex items-center gap-2">
        <i className={`fas ${icon} ${color} text-xs`}></i>
        <h4 className="font-black uppercase text-[10px] tracking-widest text-slate-300">{title}</h4>
     </div>
     <ul className="space-y-2">
        {points.map((p: string, i: number) => (
           <li key={i} className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-slate-700 mt-1.5 shrink-0"></span>
              <p className="text-[10px] font-medium text-slate-400 italic leading-snug">{p}</p>
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
  <button onClick={onClick} className={`flex flex-col items-center gap-0.5 relative transition-all ${active ? 'text-amber-500 scale-110' : 'text-slate-500'}`}>
    <i className={`fas ${icon} text-lg`}></i>
    <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
    {badge !== undefined && <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[7px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full ring-2 ring-[#020617]">{badge}</span>}
  </button>
);

const AdminLogin = ({ onLogin }: any) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in">
      <div className="w-16 h-16 bg-amber-500/10 rounded-2xl border border-amber-500/20 flex items-center justify-center text-amber-500 mb-6 shadow-2xl">
        <i className="fas fa-shield-halved text-2xl"></i>
      </div>
      <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-6 text-white text-center">Admin Vault</h2>
      <div className="w-full max-w-sm glass p-6 sm:p-8 rounded-[2rem] border border-white/10 space-y-4">
          <input type="email" placeholder="Email" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 outline-none focus:border-amber-500 font-bold text-white text-sm" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 outline-none focus:border-amber-500 font-bold text-white text-sm" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin(email, pass)} disabled={isVerifying} />
          <button onClick={() => onLogin(email, pass)} className="w-full py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-xl mt-2" disabled={isVerifying}>{isVerifying ? 'Verifying...' : 'Unlock Vault'}</button>
      </div>
    </div>
  );
};

const PassengerPortal = ({ nodes, myRideIds, onAddNode, onJoin, onForceQualify, onCancel, drivers, search, settings, onShowQr }: any) => {
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

  const myActiveNodes = useMemo(() => nodes.filter((n: any) => myRideIds.includes(n.id) && n.status !== 'completed'), [nodes, myRideIds]);
  const filteredNodes = nodes.filter((n: any) => n.status !== 'completed' && !myRideIds.includes(n.id) && (n.destination.toLowerCase().includes(search.toLowerCase()) || n.origin.toLowerCase().includes(search.toLowerCase()) || n.leaderName.toLowerCase().includes(search.toLowerCase())));

  const createNode = async () => {
    if (!origin || !dest || !leader || !phone) { alert("Missing fields."); return; }
    const finalFare = isSolo ? Math.ceil((type === 'Pragia' ? settings.farePerPragia : settings.farePerTaxi) * settings.soloMultiplier) : (type === 'Pragia' ? settings.farePerPragia : settings.farePerTaxi);
    await onAddNode({ id: `NODE-${Date.now()}`, origin, destination: dest, capacityNeeded: isSolo ? 1 : 4, passengers: [{ id: 'P-LEAD', name: leader, phone }], status: (isSolo || isLongDistance) ? 'qualified' : 'forming', leaderName: leader, leaderPhone: phone, farePerPerson: isLongDistance ? 0 : finalFare, createdAt: new Date().toISOString(), isSolo, isLongDistance });
    setShowModal(false);
    setOrigin(''); setDest(''); setLeader(''); setPhone(''); setIsSolo(false); setIsLongDistance(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-2xl font-black italic uppercase text-white">Hub Feed</h2>
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-tight">Active routes & carpools</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onShowQr} className="w-10 h-10 lg:hidden bg-white/5 rounded-xl flex items-center justify-center text-amber-500 border border-white/10"><i className="fas fa-qrcode"></i></button>
          <button onClick={() => setShowModal(true)} className="px-5 py-3 bg-amber-500 text-[#020617] rounded-xl font-black text-[9px] uppercase shadow-lg">Form Ride</button>
        </div>
      </div>

      {myActiveNodes.length > 0 && (
        <section className="space-y-4">
           <h3 className="text-[9px] font-black uppercase tracking-widest text-indigo-400 italic px-1 flex items-center gap-2">
             <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span> My Rides
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
             {myActiveNodes.map((node: any) => <RideCard key={node.id} node={node} drivers={drivers} onJoin={onJoin} onCancel={onCancel} setJoinModalNodeId={setJoinModalNodeId} isPriority />)}
           </div>
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic px-1">Global Traffic</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {filteredNodes.length > 0 ? filteredNodes.map((node: any) => <RideCard key={node.id} node={node} drivers={drivers} onJoin={onJoin} onCancel={onCancel} setJoinModalNodeId={setJoinModalNodeId} />) 
          : <div className="col-span-full py-16 text-center border-2 border-dashed border-white/5 rounded-[2rem]"><p className="text-slate-700 font-black text-[10px] uppercase">No Hub traffic found</p></div>}
        </div>
      </section>

      {/* About - Compact for mobile */}
      <section className="pt-8 border-t border-white/5 text-center px-4 space-y-6">
        <h3 className="text-xl font-black italic uppercase text-white">About UniHub</h3>
        <p className="text-slate-400 text-xs italic leading-relaxed">{settings.aboutMeText}</p>
        {settings.aboutMeImages?.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar snap-x">
             {settings.aboutMeImages.map((img, i) => <img key={i} src={img} className="w-48 h-32 rounded-2xl object-cover shrink-0 border border-white/5 snap-center shadow-lg" />)}
          </div>
        )}
      </section>

      {/* Form Ride Modal - Optimized as Bottom Sheet on Mobile */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex items-end sm:items-center justify-center">
          <div className="bg-[#0f172a] sm:bg-slate-900 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 space-y-6 animate-in slide-in-from-bottom-20 sm:zoom-in duration-300 border-t sm:border border-white/10 shadow-2xl">
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-2 sm:hidden"></div>
            <div className="text-center">
              <h3 className="text-xl font-black italic uppercase text-white">Request Ride</h3>
            </div>
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              <button onClick={() => {setIsSolo(false); setIsLongDistance(false);}} className={`flex-1 py-2.5 rounded-lg text-[8px] font-black uppercase transition-all ${!isSolo && !isLongDistance ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>Group</button>
              <button onClick={() => {setIsSolo(true); setIsLongDistance(false);}} className={`flex-1 py-2.5 rounded-lg text-[8px] font-black uppercase transition-all ${isSolo ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'}`}>Solo</button>
              <button onClick={() => {setIsSolo(false); setIsLongDistance(true);}} className={`flex-1 py-2.5 rounded-lg text-[8px] font-black uppercase transition-all ${isLongDistance ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Long</button>
            </div>
            <div className="space-y-3">
               <div className="grid grid-cols-2 gap-3">
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none font-bold text-white text-sm" placeholder="Origin" value={origin} onChange={e => setOrigin(e.target.value)} />
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none font-bold text-white text-sm" placeholder="Destination" value={dest} onChange={e => setDest(e.target.value)} />
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 outline-none font-bold text-white text-xs" value={type} onChange={e => setType(e.target.value as VehicleType)}><option value="Pragia">Pragia</option><option value="Taxi">Taxi</option></select>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 outline-none font-bold text-white text-sm" placeholder="Name" value={leader} onChange={e => setLeader(e.target.value)} />
               </div>
               <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none font-bold text-white text-sm" placeholder="WhatsApp Number" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="flex gap-3">
               <button onClick={() => setShowModal(false)} className="flex-1 py-4 bg-white/5 rounded-xl font-black text-[10px] uppercase text-white">Cancel</button>
               <button onClick={createNode} className={`flex-1 py-4 ${isLongDistance ? 'bg-indigo-600' : (isSolo ? 'bg-emerald-500' : 'bg-amber-500')} text-white rounded-xl font-black text-[10px] uppercase shadow-xl`}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {joinModalNodeId && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[160] flex items-end sm:items-center justify-center p-4">
           <div className="bg-[#0f172a] sm:bg-slate-900 w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-6 sm:p-8 space-y-6 animate-in slide-in-from-bottom-20 duration-300 text-center border-t sm:border border-white/10">
              <h3 className="text-xl font-black uppercase text-white italic">Join Ride</h3>
              <div className="space-y-3">
                 <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none font-bold text-white text-sm" placeholder="Name" value={joinName} onChange={e => setJoinName(e.target.value)} />
                 <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none font-bold text-white text-sm" placeholder="Phone" value={joinPhone} onChange={e => setJoinPhone(e.target.value)} />
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setJoinModalNodeId(null)} className="flex-1 py-3.5 bg-white/5 rounded-xl font-black text-[9px] uppercase text-slate-400">Cancel</button>
                 <button onClick={() => { if(!joinName || !joinPhone) return; onJoin(joinModalNodeId, joinName, joinPhone); setJoinModalNodeId(null); }} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase shadow-xl">Join</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const RideCard = ({ node, drivers, onJoin, onCancel, setJoinModalNodeId, isPriority }: any) => {
  const driver = drivers.find((d: any) => d.id === node.assignedDriverId);
  return (
    <div className={`glass rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-6 border transition-all ${node.isLongDistance ? 'border-indigo-500/40' : (node.status === 'dispatched' ? (isPriority ? 'border-indigo-500 bg-indigo-500/5' : 'border-amber-500/30') : 'border-white/5')} relative overflow-hidden`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-1.5">
          <span className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-tight ${node.status === 'dispatched' ? 'bg-amber-500 text-[#020617]' : 'bg-white/10 text-slate-400'}`}>{node.status}</span>
          {node.isSolo && <span className="px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-tight bg-emerald-500/10 text-emerald-400">Solo</span>}
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => shareNode(node)} className="text-amber-500 hover:scale-110 transition-transform"><i className="fas fa-share-nodes text-[12px]"></i></button>
           <p className="text-xs font-black text-emerald-400 italic">₵{node.negotiatedTotalFare || node.farePerPerson}</p>
        </div>
      </div>

      <div className="space-y-2.5 mb-5 border-l border-white/10 pl-4 py-1">
        <div>
           <p className="text-[7px] font-black text-slate-600 uppercase mb-0.5">Pick Up</p>
           <p className="text-white font-bold text-xs truncate uppercase leading-tight">{node.origin}</p>
        </div>
        <div>
           <p className="text-[7px] font-black text-slate-600 uppercase mb-0.5">Drop Off</p>
           <p className="text-white font-black text-sm truncate uppercase leading-tight">{node.destination}</p>
        </div>
      </div>

      {node.status !== 'dispatched' ? (
        <div className="flex items-center justify-between gap-2">
           <div className="flex -space-x-2">
              {Array.from({ length: node.capacityNeeded }).map((_, i) => (
                <div key={i} className={`w-7 h-7 rounded-lg border flex items-center justify-center ${node.passengers[i] ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-800'}`}><i className={`fas ${node.passengers[i] ? 'fa-user' : 'fa-chair'} text-[8px]`}></i></div>
              ))}
           </div>
           {node.status === 'forming' && !node.isSolo && <button onClick={() => setJoinModalNodeId(node.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase shadow-lg">Join</button>}
           <button onClick={() => { if(confirm("Cancel?")) onCancel(node.id); }} className="w-7 h-7 bg-rose-600/10 border border-rose-500/20 rounded-lg flex items-center justify-center text-rose-500 text-[10px]"><i className="fas fa-times"></i></button>
        </div>
      ) : (
        <div className="space-y-4 pt-4 border-t border-white/5">
           <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                 <img src={driver?.avatarUrl || "https://api.dicebear.com/7.x/shapes/svg?seed=driver"} className="w-8 h-8 rounded-full border border-amber-500/50" />
                 <div><p className="text-white font-black text-[10px] leading-tight italic">{driver?.name}</p><p className="text-[7px] font-black text-amber-500 uppercase">{driver?.licensePlate}</p></div>
              </div>
              <a href={`tel:${driver?.contact}`} className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-[10px]"><i className="fas fa-phone"></i></a>
           </div>
           <div className={`p-4 ${isPriority ? 'bg-indigo-600' : 'bg-amber-500'} text-white rounded-xl text-center shadow-xl relative overflow-hidden`}>
              <p className="text-[7px] font-black uppercase mb-1 opacity-80 tracking-widest">Move Code</p>
              <p className="text-4xl font-black italic tracking-widest leading-none mb-3">{node.verificationCode}</p>
              <div className="bg-white p-2 rounded-lg inline-block shadow-inner"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${node.verificationCode}`} className="w-16 h-16" /></div>
           </div>
           <button onClick={() => onCancel(node.id)} className="w-full py-2.5 bg-rose-600/10 border border-rose-500/20 rounded-lg text-[8px] font-black uppercase text-rose-500">Abort Assignment</button>
        </div>
      )}
    </div>
  );
};

const DriverPortal = ({ drivers, activeDriver, onLogin, onLogout, qualifiedNodes, dispatchedNodes, missions, onJoinMission, onAccept, onVerify, onCancel, onRequestTopup, onRequestRegistration, search, settings }: any) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [momoRef, setMomoRef] = useState('');
  const [regData, setRegData] = useState<Partial<RegistrationRequest>>({ vehicleType: 'Pragia' });
  const [isScanning, setIsScanning] = useState(false);
  const [activeMissionNodeId, setActiveMissionNodeId] = useState<string | null>(null);

  useEffect(() => {
    let html5QrCode: any = null;
    if (isScanning && activeMissionNodeId) {
      const timeout = setTimeout(async () => {
        try {
          html5QrCode = new (window as any).Html5Qrcode("qr-reader");
          await html5QrCode.start({ facingMode: "environment" }, { fps: 15, qrbox: { width: 250, height: 250 } }, (text: string) => { setVerifyCode(text); onVerify(activeMissionNodeId, text); setIsScanning(false); html5QrCode.stop(); });
        } catch { setIsScanning(false); }
      }, 300);
      return () => { clearTimeout(timeout); if(html5QrCode) html5QrCode.stop().catch(() => {}); };
    }
  }, [isScanning, activeMissionNodeId, onVerify]);

  if (!activeDriver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-10 animate-in fade-in space-y-8">
        <h2 className="text-2xl font-black italic uppercase text-white">Driver Login</h2>
        {selectedDriverId ? (
            <div className="w-full max-w-sm glass p-8 rounded-[2rem] border border-white/10 space-y-6 text-center animate-in zoom-in">
                <div className="w-16 h-16 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-amber-500 border-2 border-amber-500/50">
                   <img src={drivers.find((d:any)=>d.id===selectedDriverId)?.avatarUrl || "https://api.dicebear.com/7.x/shapes/svg?seed=driver"} className="w-full h-full rounded-full object-cover" />
                </div>
                <input type="password" maxLength={4} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-3xl tracking-[0.5em] font-black outline-none focus:border-amber-500 text-center text-white" placeholder="0000" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin(selectedDriverId, pin)} />
                <div className="flex gap-3">
                    <button onClick={() => {setSelectedDriverId(null); setPin('');}} className="flex-1 py-3.5 bg-white/5 rounded-xl font-black text-[9px] uppercase text-slate-500">Back</button>
                    <button onClick={() => onLogin(selectedDriverId, pin)} className="flex-1 py-3.5 bg-amber-500 text-[#020617] rounded-xl font-black text-[9px] uppercase shadow-xl">Login</button>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
              {drivers.map((d: any) => (
                <button key={d.id} onClick={() => setSelectedDriverId(d.id)} className="glass p-5 rounded-2xl border border-white/5 flex items-center gap-4 text-left transition-all hover:border-amber-500/50">
                  <img src={d.avatarUrl || "https://api.dicebear.com/7.x/shapes/svg?seed=driver"} className="w-10 h-10 rounded-full border border-white/10" />
                  <div><p className="font-black text-white italic uppercase text-sm">{d.name}</p><p className="text-[8px] font-black text-slate-500 uppercase italic">Wallet: ₵{d.walletBalance.toFixed(1)}</p></div>
                </button>
              ))}
              <button onClick={() => setShowRegModal(true)} className="col-span-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl flex items-center justify-center gap-2 mt-4"><i className="fas fa-plus"></i> Join Fleet</button>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 space-y-8">
      <div className="bg-indigo-500/5 p-5 rounded-[1.5rem] border border-indigo-500/10 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <img src={activeDriver.avatarUrl || "https://api.dicebear.com/7.x/shapes/svg?seed=driver"} className="w-12 h-12 rounded-xl border-2 border-amber-500" />
            <div><h2 className="text-lg font-black italic uppercase text-white leading-none">{activeDriver.name}</h2><p className="text-[10px] font-black text-amber-500 uppercase mt-1">₵{activeDriver.walletBalance.toFixed(2)}</p></div>
         </div>
         <div className="flex gap-2">
            <button onClick={() => setShowTopupModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase">Topup</button>
            <button onClick={onLogout} className="px-4 py-2 bg-rose-600/10 text-rose-500 rounded-lg text-[8px] font-black uppercase border border-rose-500/20">Exit</button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-8">
           <section>
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic mb-4 px-1">Stations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {missions.map(m => (
                   <div key={m.id} className="glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between h-full">
                      <div className="flex justify-between items-start mb-2">
                         <h4 className="font-black text-white text-xs uppercase italic">{m.location}</h4>
                         <span className="text-emerald-400 font-black text-[10px]">₵{m.entryFee}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 italic mb-4 leading-relaxed line-clamp-2">{m.description}</p>
                      {m.driversJoined.includes(activeDriver.id) ? <div className="text-center py-2 text-emerald-400 font-black text-[8px] uppercase bg-emerald-500/10 rounded-lg">Stationed</div> 
                      : <button onClick={() => onJoinMission(m.id, activeDriver.id)} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase">Pay Entry</button>}
                   </div>
                 ))}
              </div>
           </section>
           <section>
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic mb-4 px-1">Ready Nodes</h3>
              <div className="space-y-3">
                {qualifiedNodes.map((node: any) => (
                  <div key={node.id} className="glass p-5 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div><p className="font-black text-xs uppercase italic text-white">{node.origin} → {node.destination}</p><p className="text-[8px] text-slate-500 font-black uppercase mt-1">Passenger: {node.leaderName}</p></div>
                      <button onClick={() => onAccept(node.id, activeDriver.id)} className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-lg">Claim</button>
                  </div>
                ))}
              </div>
           </section>
        </div>

        <div className="lg:col-span-4">
           <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic mb-4 px-1">Active Job</h3>
           {dispatchedNodes.filter((n: any) => n.assignedDriverId === activeDriver.id).map((node: any) => (
              <div key={node.id} className="glass rounded-2xl p-6 border border-amber-500/20 text-center space-y-6">
                 <h4 className="text-sm font-black uppercase text-white leading-none">{node.origin} to {node.destination}</h4>
                 <div className="space-y-4">
                    <div className="relative">
                       <input className="w-full bg-black/40 border border-white/10 rounded-xl py-5 text-center text-4xl font-black text-white" placeholder="0000" maxLength={4} value={verifyCode} onChange={e => setVerifyCode(e.target.value)} />
                       <button onClick={() => { setActiveMissionNodeId(node.id); setIsScanning(true); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 border border-emerald-500/30"><i className="fas fa-qrcode"></i></button>
                    </div>
                    <button onClick={() => onVerify(node.id, verifyCode)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Complete Ride</button>
                 </div>
              </div>
           ))}
        </div>
      </div>

      {showTopupModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[150] flex items-end sm:items-center justify-center">
          <div className="bg-[#0f172a] sm:bg-slate-900 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] p-8 space-y-6 animate-in slide-in-from-bottom-20 duration-300 border-t sm:border border-white/10">
             <div className="text-center space-y-4">
                <h3 className="text-xl font-black italic uppercase text-white">Credit Request</h3>
                <div className="p-4 bg-white/5 rounded-2xl text-center"><p className="text-[8px] font-black text-slate-500 uppercase mb-1">Send MoMo To</p><p className="text-2xl font-black text-amber-500 italic leading-none">{settings.adminMomo}</p><p className="text-[10px] text-white font-bold mt-1 uppercase">{settings.adminMomoName}</p></div>
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-center text-xl font-black text-white" placeholder="Amount" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
                <input className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-center text-sm font-bold text-white" placeholder="Transaction Ref" value={momoRef} onChange={e => setMomoRef(e.target.value)} />
                <div className="flex gap-3"><button onClick={() => setShowTopupModal(false)} className="flex-1 py-3.5 bg-white/5 rounded-xl font-black text-[9px] uppercase text-white">Cancel</button><button onClick={() => { onRequestTopup(activeDriver.id, Number(topupAmount), momoRef); setShowTopupModal(false); }} className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase">Submit</button></div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminPortal = ({ activeTab, setActiveTab, nodes, drivers, onAddDriver, onDeleteDriver, onCancelRide, onSettleRide, missions, onCreateMission, onDeleteMission, transactions, topupRequests, registrationRequests, onApproveTopup, onApproveRegistration, onLock, search, settings, onUpdateSettings, hubRevenue, adminEmail }: any) => {
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [newDriver, setNewDriver] = useState<Partial<Driver>>({ vehicleType: 'Pragia', pin: '0000' });
  const [newMission, setNewMission] = useState<Partial<HubMission>>({ location: '', description: '', entryFee: 5, status: 'open' });
  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  useEffect(() => { setLocalSettings(settings); }, [settings]);

  const filteredDrivers = drivers.filter((d: any) => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 pb-20 animate-in slide-in-from-bottom-4">
      <div className="flex bg-white/5 p-1 rounded-xl sm:rounded-2xl border border-white/5 overflow-x-auto no-scrollbar gap-1">
          <TabBtn active={activeTab === 'monitor'} label="Stats" onClick={() => setActiveTab('monitor')} />
          <TabBtn active={activeTab === 'fleet'} label="Fleet" onClick={() => setActiveTab('fleet')} />
          <TabBtn active={activeTab === 'onboarding'} label="Apps" onClick={() => setActiveTab('onboarding')} count={registrationRequests.filter((r:any)=>r.status==='pending').length} />
          <TabBtn active={activeTab === 'missions'} label="Missions" onClick={() => setActiveTab('missions')} />
          <TabBtn active={activeTab === 'requests'} label="Credit" onClick={() => setActiveTab('requests')} count={topupRequests.filter((r:any)=>r.status==='pending').length} />
          <TabBtn active={activeTab === 'settings'} label="Setup" onClick={() => setActiveTab('settings')} />
      </div>

      {activeTab === 'monitor' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Forming" value={nodes.filter((n:any) => n.status === 'forming').length} icon="fa-users" color="text-amber-400" />
          <StatCard label="Qualified" value={nodes.filter((n:any) => n.status === 'qualified').length} icon="fa-bolt" color="text-emerald-400" />
          <StatCard label="Fleet" value={drivers.length} icon="fa-taxi" color="text-indigo-400" />
          <StatCard label="Rev" value={hubRevenue.toFixed(0)} icon="fa-money-bill" color="text-slate-400" isCurrency />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="glass p-6 rounded-[1.5rem] border border-white/5 space-y-8">
           <h3 className="text-lg font-black italic uppercase text-white">Hub Controller</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <AdminInput label="Commission (₵)" value={localSettings.commissionPerSeat} onChange={v => setLocalSettings({...localSettings, commissionPerSeat: Number(v)})} />
              <AdminInput label="Reg Fee (₵)" value={localSettings.registrationFee} onChange={v => setLocalSettings({...localSettings, registrationFee: Number(v)})} />
              <AdminInput label="Pragia Base" value={localSettings.farePerPragia} onChange={v => setLocalSettings({...localSettings, farePerPragia: Number(v)})} />
              <AdminInput label="Taxi Base" value={localSettings.farePerTaxi} onChange={v => setLocalSettings({...localSettings, farePerTaxi: Number(v)})} />
           </div>
           <button onClick={() => onUpdateSettings(localSettings)} className="w-full py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-xs uppercase shadow-xl mt-4">Save Config</button>
        </div>
      )}

      {/* Other tabs follow similar compact logic... */}
    </div>
  );
};

const AdminInput = ({ label, value, onChange, type = "text" }: { label: string, value: any, onChange: (v: string) => void, type?: string }) => (
  <div className="space-y-1.5">
     <label className="text-[7px] font-black text-slate-600 uppercase tracking-widest px-1">{label}</label>
     <input type={type} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-500" value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

const TabBtn = ({ active, label, onClick, count }: any) => (
  <button onClick={onClick} className={`px-4 py-2.5 rounded-lg sm:rounded-xl text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>
    {label} {count !== undefined && count > 0 && <span className="ml-1 bg-rose-500 text-white text-[6px] px-1.5 py-0.5 rounded-full ring-2 ring-[#020617]">{count}</span>}
  </button>
);

const StatCard = ({ label, value, icon, color, isCurrency }: any) => (
  <div className="glass p-4 rounded-[1.25rem] border border-white/5 relative overflow-hidden flex flex-col justify-end min-h-[90px] group transition-all">
    <i className={`fas ${icon} absolute top-4 left-4 ${color} text-sm`}></i>
    <div className="relative z-10"><p className="text-[7px] font-black uppercase text-slate-500 mb-0.5">{label}</p><p className="text-xl font-black italic text-white leading-none">{isCurrency ? '₵' : ''}{value}</p></div>
  </div>
);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
