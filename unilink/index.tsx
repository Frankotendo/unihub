
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
  hub_announcement?: string; 
}

// --- UTILS ---

const shareHub = async () => {
  const shareData = {
    title: 'NexRyde Dispatch',
    text: 'Join the smartest ride-sharing platform on campus! Form groups, save costs, and move fast.',
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
    ? `🚀 *NexRyde Premium Ride!* \n📍 *From:* ${node.origin}\n📍 *To:* ${node.destination}\n🚕 *Partners invited to bid!*`
    : node.isSolo 
    ? `🚀 *NexRyde Solo Drop!* \n📍 *Route:* ${node.origin} → ${node.destination}\n🚕 *Express Partner* needed!`
    : `🚀 *NexRyde Group Alert!*\n📍 *Route:* ${node.origin} → ${node.destination}\n👥 *Seats Left:* ${seatsLeft}\n💰 *Price:* ₵${node.farePerPerson}/p\n\nJoin my trip on NexRyde! 👇\n${window.location.origin}`;

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
  const [currentUser, setCurrentUser] = useState<UniUser | null>(() => {
    const saved = localStorage.getItem('nexryde_user_v1');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => {
    return sessionStorage.getItem('nexryde_driver_session_v1');
  });

  // Track user's own rides locally
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
    adminMomo: "024-123-4567",
    adminMomoName: "NexRyde Admin",
    whatsappNumber: "233241234567",
    commissionPerSeat: 2.00,
    farePerPragia: 5.00,
    farePerTaxi: 8.00,
    soloMultiplier: 2.5,
    aboutMeText: "Welcome to NexRyde Logistics.",
    aboutMeImages: [],
    appWallpaper: "",
    registrationFee: 20.00,
    hub_announcement: ""
  });
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [missions, setMissions] = useState<HubMission[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);

  const [globalSearch, setGlobalSearch] = useState('');

  const isVaultAccess = useMemo(() => {
    return new URLSearchParams(window.location.search).get('access') === 'vault';
  }, []);

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
    localStorage.setItem('nexryde_my_rides_v1', JSON.stringify(myRideIds));
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

  const handleGlobalUserAuth = async (username: string, phone: string, mode: 'login' | 'signup') => {
    if (!phone) {
      alert("Verification details required.");
      return;
    }
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from('unihub_users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      if (mode === 'login') {
        if (!data) {
          alert("Profile not found! Please create an account first.");
          setIsSyncing(false);
          return;
        }
        const user = data as UniUser;
        setCurrentUser(user);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(user));
      } else {
        if (data) {
          alert("An account with this phone already exists! Please Sign In.");
          setIsSyncing(false);
          return;
        }
        if (!username) { alert("Please enter a username for your profile."); setIsSyncing(false); return; }
        const newUser = { id: `USER-${Date.now()}`, username, phone };
        const { error: insertErr } = await supabase.from('unihub_users').insert([newUser]);
        if (insertErr) throw insertErr;
        setCurrentUser(newUser);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(newUser));
      }
    } catch (err: any) {
      alert("Identity Error: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Sign out of NexRyde?")) {
      localStorage.removeItem('nexryde_user_v1');
      setCurrentUser(null);
    }
  };

  const joinMission = async (missionId: string, driverId: string) => {
    const mission = missions.find(m => m.id === missionId);
    const driver = drivers.find(d => d.id === driverId);

    if (!mission || !driver) return;
    if (mission.driversJoined.includes(driverId)) {
      alert("You are already stationed at this hotspot.");
      return;
    }
    if (driver.walletBalance < mission.entryFee) {
      alert("Insufficient Balance for Hotspot Entry Fee.");
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

    alert(`Successfully stationed at ${mission.location}! ₵${mission.entryFee} deducted.`);
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
      alert(`Insufficient Credits! You need at least ₵${totalPotentialCommission.toFixed(2)} to accept this ride.`);
      return;
    }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    await supabase.from('unihub_nodes').update({ 
      status: 'dispatched', 
      assignedDriverId: driverId, 
      verificationCode,
      negotiatedTotalFare: customFare || node?.negotiatedTotalFare
    }).eq('id', nodeId);

    alert(customFare ? `Premium trip accepted at ₵${customFare}!` : "Ride accepted! Verification code synced.");
  };

  const verifyRide = async (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (node.verificationCode === code) {
      const driver = drivers.find(d => d.id === node.assignedDriverId);
      if (!driver) {
        alert("Verification error: Partner record not found.");
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
        alert(`Ride verified! Commission of ₵${totalCommission.toFixed(2)} deducted.`);
      } catch (err: any) {
        console.error("Verification deduction error:", err);
        alert("Error deducting credits. Contact Admin.");
      }
    } else {
      alert("Invalid Code! Ask the passenger for their Ride PIN.");
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
        alert("Trip assignment reset. No commission was charged.");
      } else {
        const { error: deleteErr } = await supabase.from('unihub_nodes').delete().eq('id', nodeId);
        if (deleteErr) throw deleteErr;
        removeRideFromMyList(nodeId);
        alert("Ride request removed.");
      }
    } catch (err: any) {
      console.error("Cancellation error:", err);
      alert("Failed to process request: " + (err.message || "Unknown error"));
    }
  };

  const settleNode = async (nodeId: string) => {
    if (confirm("Force complete this trip? Partner commission will be charged.")) {
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
      alert("Trip settled manually.");
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
      alert("Credit request logged.");
    }
  };

  const requestRegistration = async (reg: Omit<RegistrationRequest, 'id' | 'status' | 'timestamp'>) => {
    // Duplicate check
    const existingDriver = drivers.find(d => d.contact === reg.contact || d.licensePlate === reg.licensePlate);
    const existingReq = registrationRequests.find(r => (r.contact === reg.contact || r.licensePlate === reg.licensePlate) && r.status === 'pending');
    
    if (existingDriver) {
      alert("Error: This Partner or Vehicle is already registered with NexRyde.");
      return;
    }
    if (existingReq) {
      alert("Application Pending: You already have an onboarding request under review.");
      return;
    }

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
      alert("Application submitted! NexRyde Admin will review your details shortly.");
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
      console.error("Registration error:", err);
      alert(`Failed to register: ${err.message}.`);
    }
  };

  const deleteDriver = useCallback(async (id: string) => {
    const hasActiveMission = nodes.some(n => n.assignedDriverId === id && (n.status === 'qualified' || n.status === 'dispatched'));
    if (hasActiveMission) {
      alert("Cannot unregister partner with an active trip.");
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
    alert("Settings Updated Successfully!");
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
      alert("Access Denied: " + err.message);
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
      sessionStorage.setItem('nexryde_driver_session_v1', driverId);
      setViewMode('driver');
    } else {
      alert("Access Denied: Invalid Partner Password");
    }
  };

  const handleDriverLogout = () => {
    setActiveDriverId(null);
    sessionStorage.removeItem('nexryde_driver_session_v1');
    setViewMode('passenger');
  };

  const dismissWelcome = () => {
    setIsNewUser(false);
    localStorage.setItem('nexryde_seen_welcome_v1', 'true');
  };

  const handleDismissAnnouncement = () => {
    setDismissedAnnouncement('true');
    sessionStorage.setItem('nexryde_dismissed_announcement', 'true');
  };

  const safeSetViewMode = (mode: PortalMode) => {
    if (activeDriverId && mode !== 'driver') {
      if (confirm("Sign out of Driver Terminal?")) {
        handleDriverLogout();
      } else {
        return;
      }
    }
    setViewMode(mode);
  };

  // --- GATEWAY CHECK ---
  if (!currentUser) {
    return <HubGateway onIdentify={handleGlobalUserAuth} />;
  }

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

      {/* NexRyde Announcement Bar */}
      {settings.hub_announcement && !dismissedAnnouncement && (
        <div className="fixed top-0 left-0 right-0 z-[400] bg-gradient-to-r from-amber-600 to-rose-600 px-4 py-3 flex items-center justify-between shadow-2xl animate-in slide-in-from-top duration-500 border-b border-white/10">
           <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <i className="fas fa-bullhorn text-white text-xs"></i>
              </div>
              <p className="text-[10px] sm:text-xs font-black uppercase italic text-white truncate tracking-tight">{settings.hub_announcement}</p>
           </div>
           <button onClick={handleDismissAnnouncement} className="ml-4 w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-white text-[10px] hover:bg-white/30 transition-all shrink-0">
             <i className="fas fa-times"></i>
           </button>
        </div>
      )}
      
      {isSyncing && (
        <div className={`fixed ${settings.hub_announcement && !dismissedAnnouncement ? 'top-20' : 'top-4'} right-4 z-[300] bg-amber-500/20 text-amber-500 px-4 py-2 rounded-full border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-2 transition-all`}>
           <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
           Live Syncing...
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
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Transit Excellence</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => setShowQrModal(true)} title="NexRyde Code" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-amber-500 hover:bg-white/10 transition-all">
              <i className="fas fa-qrcode text-xs"></i>
            </button>
            <button onClick={() => setShowHelpModal(true)} title="Help Center" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-white/10 transition-all">
              <i className="fas fa-circle-question text-xs"></i>
            </button>
            <button onClick={() => setShowAboutModal(true)} title="Platform Info" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:bg-white/10 transition-all">
              <i className="fas fa-info-circle text-xs"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride Center" onClick={() => {safeSetViewMode('passenger'); setGlobalSearch('');}} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Partner Terminal" onClick={() => {safeSetViewMode('driver'); setGlobalSearch('');}} />
          {(isVaultAccess || isAdminAuthenticated) && (
            <NavItem 
              active={viewMode === 'admin'} 
              icon="fa-shield-halved" 
              label="Control Vault" 
              onClick={() => {safeSetViewMode('admin'); setGlobalSearch('');}} 
              badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
            />
          )}
          <NavItem active={false} icon="fa-share-nodes" label="Invite Others" onClick={shareHub} />
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-500 hover:bg-white/5 transition-all mt-4">
             <i className="fas fa-power-off text-lg w-6"></i>
             <span className="text-sm font-bold">Sign Out</span>
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
                    <p className="text-[9px] font-black uppercase text-indigo-400 leading-none">Partner</p>
                    <p className="text-sm font-black text-white truncate">{activeDriver.name}</p>
                  </div>
                </div>
                <button onClick={handleDriverLogout} className="mt-4 w-full py-2 bg-indigo-600 rounded-xl text-[8px] font-black uppercase tracking-widest">Sign Out Hub</button>
             </div>
           ) : (
             <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 mb-4">
                <p className="text-[9px] font-black uppercase text-slate-500 leading-none">Identity</p>
                <p className="text-sm font-black text-white truncate mt-1">{currentUser.username}</p>
                <p className="text-[10px] text-slate-500 mt-1">{currentUser.phone}</p>
             </div>
           )}
          <div className="bg-emerald-500/10 p-6 rounded-[2.5rem] border border-emerald-500/20 relative overflow-hidden">
            <p className="text-[9px] font-black uppercase text-emerald-400 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Market Pulse
            </p>
            <div className="space-y-1">
               <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-white uppercase opacity-60 tracking-tight">Active Partners</p>
                  <p className="text-lg font-black text-white italic">{onlineDriverCount}</p>
               </div>
               <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-white uppercase opacity-60 tracking-tight">Open Trips</p>
                  <p className="text-lg font-black text-white italic">{activeNodeCount}</p>
               </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around px-4">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride" onClick={() => safeSetViewMode('passenger')} />
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
        <MobileNavItem active={false} icon="fa-info-circle" label="About" onClick={() => setShowAboutModal(true)} />
      </nav>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar z-10 relative transition-all duration-500 ${settings.hub_announcement && !dismissedAnnouncement ? 'pt-24 lg:pt-28' : 'pt-4 lg:pt-12'}`}>
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
          
          {isNewUser && (
            <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
              <div className="relative z-10 flex items-center gap-6 text-center sm:text-left">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white text-2xl backdrop-blur-md shrink-0">
                   <i className="fas fa-sparkles"></i>
                </div>
                <div>
                   <h2 className="text-xl font-black uppercase italic leading-none text-white">Welcome to NexRyde</h2>
                   <p className="text-xs font-bold opacity-80 mt-1 uppercase tracking-tight text-indigo-100">Ready to move? Check out our quick start guide.</p>
                </div>
              </div>
              <div className="relative z-10 flex gap-3 w-full sm:w-auto">
                 <button onClick={() => setShowHelpModal(true)} className="flex-1 sm:flex-none px-6 py-3 bg-white text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl">Guide</button>
                 <button onClick={dismissWelcome} className="flex-1 sm:flex-none px-6 py-3 bg-indigo-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest">Let's Go</button>
              </div>
              <i className="fas fa-route absolute right-[-20px] top-[-20px] text-[150px] opacity-10 pointer-events-none rotate-12"></i>
            </div>
          )}

          {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
            <div className="relative group">
               <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
               <input 
                  type="text" 
                  placeholder="Search routes, destinations, or partners..." 
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-4 lg:py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-700"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
               />
            </div>
          )}

          {viewMode === 'passenger' && (
            <PassengerPortal 
              currentUser={currentUser}
              nodes={nodes} 
              myRideIds={myRideIds}
              onAddNode={async (node: RideNode) => {
                try {
                  const { error } = await supabase.from('unihub_nodes').insert([node]);
                  if (error) throw error;
                  addRideToMyList(node.id);
                } catch (err: any) {
                  alert(`Failed to request ride: ${err.message}`);
                  throw err;
                }
              }} 
              onJoin={joinNode} 
              onForceQualify={forceQualify} 
              onCancel={cancelRide} 
              drivers={drivers} 
              search={globalSearch} 
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

      {/* NexRyde Assistant */}
      <button 
        onClick={() => setShowAiHelp(true)}
        className="fixed bottom-24 right-6 lg:bottom-12 lg:right-12 w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl z-[100] hover:scale-110 transition-transform animate-bounce-slow"
      >
        <i className="fas fa-sparkles"></i>
      </button>

      {showAiHelp && <AiHelpDesk onClose={() => setShowAiHelp(false)} settings={settings} />}

      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-sm:px-4 max-w-sm rounded-[3rem] p-10 space-y-8 animate-in zoom-in text-center border border-white/10">
              <div className="space-y-2">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">NexRyde Code</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Scan to access the platform</p>
              </div>
              
              <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl relative group">
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}&bgcolor=ffffff&color=020617&format=svg`} 
                   className="w-full aspect-square"
                   alt="NexRyde QR"
                 />
              </div>

              <div className="flex gap-4">
                 <button onClick={() => setShowQrModal(false)} className="flex-1 py-4 bg-white/5 rounded-[1.5rem] font-black text-[10px] uppercase text-slate-400">Close</button>
                 <button onClick={shareHub} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl">Share Platform</button>
              </div>
           </div>
        </div>
      )}

      {showAboutModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-w-2xl rounded-[3rem] p-8 lg:p-12 space-y-8 animate-in zoom-in border border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                      <i className="fas fa-info-circle text-xl"></i>
                   </div>
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">NexRyde Manifesto</h3>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">Our Mission & Ethics</p>
                   </div>
                </div>
                <button onClick={() => setShowAboutModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                   <i className="fas fa-times"></i>
                </button>
              </div>

              {settings.aboutMeImages.length > 0 && (
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                   {settings.aboutMeImages.map((img, i) => (
                     <div key={i} className="min-w-[280px] h-[180px] rounded-[2rem] overflow-hidden border border-white/10 shadow-xl shrink-0">
                        <img src={img} className="w-full h-full object-cover" alt="NexRyde Portfolio" />
                     </div>
                   ))}
                </div>
              )}

              <div className="space-y-6">
                 <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 relative overflow-hidden">
                    <i className="fas fa-quote-left absolute top-4 left-4 text-4xl text-emerald-500/10"></i>
                    <p className="text-sm lg:text-base font-medium italic text-slate-300 leading-relaxed relative z-10 whitespace-pre-wrap">{settings.aboutMeText}</p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-emerald-600/10 hover:border-emerald-500/30 transition-all group">
                       <i className="fab fa-whatsapp text-emerald-500 text-2xl group-hover:scale-110 transition-transform"></i>
                       <span className="text-[9px] font-black uppercase text-slate-500">Partner Support</span>
                    </a>
                    <button onClick={shareHub} className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-amber-600/10 hover:border-amber-500/30 transition-all group">
                       <i className="fas fa-share-nodes text-amber-500 text-2xl group-hover:scale-110 transition-transform"></i>
                       <span className="text-[9px] font-black uppercase text-slate-500">Share Platform</span>
                    </button>
                 </div>
              </div>

              <div className="pt-6 border-t border-white/5 text-center">
                 <button onClick={() => setShowAboutModal(false)} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Close Portfolio</button>
              </div>
           </div>
        </div>
      )}

      {showHelpModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-3xl rounded-[3rem] p-8 lg:p-12 space-y-10 animate-in zoom-in border border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                      <i className="fas fa-graduation-cap"></i>
                   </div>
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">NexRyde Help Center</h3>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Operational Standards v1.2</p>
                   </div>
                </div>
                <button onClick={() => setShowHelpModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                   <i className="fas fa-times"></i>
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <HelpSection 
                   icon="fa-user-graduate" 
                   title="Rider Guide" 
                   color="text-amber-500"
                   points={[
                      "Request Ride: Start a pooled trip to split costs (4 seats max). Perfect for daily campus commutes.",
                      "Express Drop: Select 'Solo' for private transport. Dynamic pricing multipliers apply.",
                      "Ride PIN: Your 4-digit code is generated once a partner accepts. Only share it at destination.",
                      "Cancellations: Only the Trip Organizer (the one who created the ride) can delete a trip."
                   ]}
                />
                <HelpSection 
                   icon="fa-id-card-clip" 
                   title="Partner Guide" 
                   color="text-indigo-400"
                   points={[
                      "Hotspots: Station at these zones for higher ride volume. Small entry fees ensure exclusivity.",
                      "Credits: Your wallet balance allows you to accept trips. Fares are collected from riders directly.",
                      "Verification: Input the rider's PIN or scan their code to deduct NexRyde commission and finish.",
                      "Passwords: Use your Partner Password to log in. Keep it secure and private."
                   ]}
                />
                <HelpSection 
                   icon="fa-shield-check" 
                   title="Security Protocols" 
                   color="text-emerald-400"
                   points={[
                      "Authenticity: Partners must provide clear portraits and MoMo references during onboarding.",
                      "Ride Safety: Share ride details with friends using the built-in share feature.",
                      "Account: One NexRyde profile per user. Duplicate identities will be flagged by Admin.",
                      "Support: Use the official Partner Support line for any real-time disputes."
                   ]}
                />
             </div>

             <div className="pt-6 border-t border-white/5 flex justify-center">
                <button onClick={() => setShowHelpModal(false)} className="px-12 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest text-white hover:bg-white/10 transition-all">Acknowledge</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- AUTH GATEWAY ---

const HubGateway = ({ onIdentify }: { onIdentify: (u: string, p: string, m: 'login' | 'signup') => void }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!phone) return;
    setLoading(true);
    await onIdentify(username, phone, mode);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-[#020617] flex items-center justify-center p-6 z-[500]">
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-amber-500/10 pointer-events-none"></div>
      
      <div className="w-full max-w-md space-y-12 text-center relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="space-y-6">
          <div className="w-24 h-24 bg-amber-500 rounded-[2.5rem] flex items-center justify-center text-[#020617] text-4xl shadow-2xl mx-auto shadow-amber-500/20">
            <i className="fas fa-fingerprint"></i>
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none text-white">NexRyde Entry</h1>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mt-3">Smart Transit Identity</p>
          </div>
        </div>

        <div className="glass p-10 rounded-[3.5rem] border border-white/10 space-y-6 shadow-2xl">
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mb-2">
             <button onClick={() => setMode('login')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>Sign In</button>
             <button onClick={() => setMode('signup')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'signup' ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>Sign Up</button>
          </div>

          <div className="space-y-4">
            {mode === 'signup' && (
              <div className="relative group animate-in slide-in-from-top-2">
                 <i className="fas fa-user absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
                 <input 
                   type="text" 
                   placeholder="Your Name / Alias" 
                   className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all"
                   value={username}
                   onChange={e => setUsername(e.target.value)}
                 />
              </div>
            )}
            <div className="relative group">
               <i className="fas fa-phone absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
               <input 
                 type="tel" 
                 placeholder="Phone Number" 
                 className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all"
                 value={phone}
                 onChange={e => setPhone(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSubmit()}
               />
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={loading || !phone}
            className="w-full py-5 bg-amber-500 text-[#020617] rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : (mode === 'login' ? 'Verify Account' : 'Create NexRyde Profile')}
          </button>
          
          <p className="text-[9px] font-medium text-slate-500 leading-relaxed max-w-[200px] mx-auto text-center">
            {mode === 'login' ? 'NexRyde will verify your identity across our secure database.' : 'Join the next generation of campus transit.'}
          </p>
        </div>
      </div>
    </div>
  );
};

// --- AI COMPONENTS ---

const AiHelpDesk = ({ onClose, settings }: { onClose: () => void, settings: AppSettings }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: "Welcome! I'm your NexRyde AI Assistant. How can I help you travel today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const prompt = `You are the NexRyde Dispatch Support AI. 
      NexRyde Info:
      - Admin MoMo: ${settings.adminMomo} (${settings.adminMomoName})
      - WhatsApp Support: ${settings.whatsappNumber}
      - Ride Types: Group (split cost), Solo (express), Long Distance.
      - Verification: Users share 'Ride PINs' only at safe arrival.
      - Fares: Pragia ₵${settings.farePerPragia}, Taxi ₵${settings.farePerTaxi}.
      
      User Question: ${userMsg}
      Keep answers concise and professional. Use emojis.`;

      // Use generateContent for text task as per guidelines
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      setMessages(prev => [...prev, { role: 'bot', text: response.text || "I'm having trouble retrieving that info right now." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Service temporarily unavailable. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-lg bg-[#020617] rounded-[2.5rem] border border-white/10 flex flex-col h-[80vh] overflow-hidden animate-in slide-in-from-bottom-12 shadow-2xl">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-indigo-600">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white"><i className="fas fa-robot"></i></div>
              <div>
                <h3 className="font-black uppercase italic text-white text-sm leading-none">NexRyde Assistant</h3>
                <p className="text-[9px] font-black text-indigo-200 uppercase mt-1">Live Intelligence</p>
              </div>
           </div>
           <button onClick={onClose} className="text-white/50 hover:text-white"><i className="fas fa-times"></i></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
           {messages.map((m, i) => (
             <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-3xl text-xs font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-300 rounded-tl-none'}`}>
                   {m.text}
                </div>
             </div>
           ))}
           {loading && <div className="text-slate-500 text-[10px] font-black uppercase flex items-center gap-2 px-2 animate-pulse"><i className="fas fa-spinner fa-spin"></i> Analyzing...</div>}
        </div>
        <div className="p-6 bg-white/5 border-t border-white/5 flex gap-2">
           <input 
             className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-xs outline-none focus:border-indigo-500 text-white" 
             placeholder="How can I help you move?" 
             value={input}
             onChange={e => setInput(e.target.value)}
             onKeyDown={e => e.key === 'Enter' && handleSend()}
           />
           <button onClick={handleSend} className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white"><i className="fas fa-paper-plane"></i></button>
        </div>
      </div>
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
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleAuth = async () => {
    setIsVerifying(true);
    await onLogin(email, pass);
    setIsVerifying(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in">
      <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] border border-amber-500/20 flex items-center justify-center text-amber-500 mb-8 shadow-2xl">
        <i className="fas fa-shield-halved text-3xl"></i>
      </div>
      <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8 text-white">NexRyde Admin</h2>
      <div className="w-full max-sm:px-4 max-w-sm glass p-8 lg:p-10 rounded-[2.5rem] border border-white/10 space-y-4">
          <input 
            type="email" 
            placeholder="Security Email" 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 font-bold text-white"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Vault Key" 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 font-bold text-white"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            disabled={isVerifying}
          />
        <button 
          onClick={handleAuth} 
          className="w-full py-4 bg-amber-500 text-[#020617] rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 mt-4"
          disabled={isVerifying}
        >
          {isVerifying ? 'Verifying Access...' : 'Unlock Control Panel'}
        </button>
      </div>
    </div>
  );
};

const PassengerPortal = ({ currentUser, nodes, myRideIds, onAddNode, onJoin, onForceQualify, onCancel, drivers, search, settings, onShowQr, onShowAbout }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [joinModalNodeId, setJoinModalNodeId] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [type, setType] = useState<VehicleType>('Pragia');
  const [isSolo, setIsSolo] = useState(false);
  const [isLongDistance, setIsLongDistance] = useState(false);
  
  const [aiInput, setAiInput] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);

  const myActiveNodes = useMemo(() => nodes.filter((n: any) => 
    myRideIds.includes(n.id) && n.status !== 'completed'
  ), [nodes, myRideIds]);

  const filteredNodes = nodes.filter((n: any) => 
    n.status !== 'completed' && 
    !myRideIds.includes(n.id) &&
    (n.destination.toLowerCase().includes(search.toLowerCase()) || 
     n.origin.toLowerCase().includes(search.toLowerCase()) ||
     n.leaderName.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAiFill = async () => {
    if (!aiInput.trim()) return;
    setAiProcessing(true);
    try {
      const prompt = `Parse this campus ride request into JSON: "${aiInput}".
      Available VehicleTypes: "Pragia", "Taxi". 
      Schema: {
        "origin": string,
        "destination": string,
        "isSolo": boolean,
        "vehicleType": VehicleType
      }`;

      // Call generateContent for JSON output
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      if (data.origin) setOrigin(data.origin);
      if (data.destination) setDest(data.destination);
      if (data.isSolo !== undefined) setIsSolo(data.isSolo);
      if (data.vehicleType) setType(data.vehicleType);
      
      setAiInput('');
    } catch (err) {
      console.error(err);
      alert("AI couldn't parse that request. Try typing Departure and Destination.");
    } finally {
      setAiProcessing(false);
    }
  };

  const createNode = async () => {
    if (!origin) { alert("Please enter a Pickup Point."); return; }
    if (!dest) { alert("Please enter a Destination."); return; }
    
    const standardFare = type === 'Pragia' ? settings.farePerPragia : settings.farePerTaxi;
    const finalFare = isSolo ? Math.ceil(standardFare * settings.soloMultiplier) : standardFare;

    const node: RideNode = {
      id: `NODE-${Date.now()}`,
      origin: origin,
      destination: dest,
      capacityNeeded: isSolo ? 1 : 4, 
      passengers: [{ id: 'P-LEAD', name: currentUser.username, phone: currentUser.phone }],
      status: (isSolo || isLongDistance) ? 'qualified' : 'forming',
      leaderName: currentUser.username,
      leaderPhone: currentUser.phone,
      farePerPerson: isLongDistance ? 0 : finalFare,
      createdAt: new Date().toISOString(),
      isSolo: isSolo,
      isLongDistance: isLongDistance
    };

    try {
      await onAddNode(node);
      setShowModal(false);
      setOrigin(''); setDest(''); setIsSolo(false); setIsLongDistance(false);
    } catch (err) {}
  };

  return (
    <div className="animate-in fade-in space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Ride Center</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase mt-1">Express Drops & Group Pooling</p>
          </div>
          <button onClick={onShowAbout} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500 lg:hidden">
            <i className="fas fa-info-circle"></i>
          </button>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={onShowQr} className="w-12 h-12 lg:hidden bg-white/5 rounded-2xl flex items-center justify-center text-amber-500 border border-white/10 shadow-xl">
             <i className="fas fa-qrcode"></i>
          </button>
          <button onClick={() => setShowModal(true)} className="flex-1 sm:flex-none px-8 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-transform">Request Ride</button>
        </div>
      </div>

      <div 
        onClick={onShowAbout}
        className="relative w-full h-44 rounded-[2.5rem] overflow-hidden border border-white/10 group cursor-pointer shadow-2xl"
      >
        {settings.aboutMeImages && settings.aboutMeImages[0] ? (
          <img src={settings.aboutMeImages[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]" />
        ) : (
          <div className="w-full h-full bg-indigo-600/20 flex items-center justify-center">
             <i className="fas fa-sparkles text-4xl text-indigo-500 opacity-20"></i>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/50 to-transparent"></div>
        <div className="absolute bottom-6 left-8 sm:left-10">
           <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-1">NexRyde Experience</p>
           <h3 className="text-2xl font-black italic uppercase text-white leading-none">Our Mission Identity</h3>
           <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 opacity-80">Explore our commitment to quality</p>
        </div>
        <div className="absolute bottom-6 right-8 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 group-hover:bg-amber-500 group-hover:text-[#020617] transition-all">
           <i className="fas fa-arrow-right"></i>
        </div>
      </div>

      {myActiveNodes.length > 0 && (
        <section className="space-y-6">
           <div className="flex items-center gap-4">
              <span className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse shadow-lg shadow-indigo-500/50"></span>
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 italic">My Active Trips</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {myActiveNodes.map((node: any) => (
                <RideCard key={node.id} currentUser={currentUser} node={node} drivers={drivers} onJoin={onJoin} onCancel={onCancel} setJoinModalNodeId={setJoinModalNodeId} isPriority />
             ))}
           </div>
        </section>
      )}

      <section className="space-y-6">
        <div className="flex items-center gap-4">
           <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Marketplace Traffic</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNodes.length > 0 ? filteredNodes.map((node: any) => (
            <RideCard key={node.id} currentUser={currentUser} node={node} drivers={drivers} onJoin={onJoin} onCancel={onCancel} setJoinModalNodeId={setJoinModalNodeId} />
          )) : (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
               <i className="fas fa-route text-slate-800 text-4xl mb-4"></i>
               <p className="text-slate-600 font-black uppercase text-[10px] tracking-widest">No rides in this route yet</p>
            </div>
          )}
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-sm:px-2 max-w-lg rounded-[2.5rem] p-5 sm:p-6 lg:p-8 space-y-4 animate-in zoom-in text-slate-900 overflow-y-auto max-h-[90vh] no-scrollbar">
            <div className="text-center mb-2">
              <h3 className="text-xl font-black italic tracking-tighter uppercase text-white leading-none">Request a Ride</h3>
              <p className="text-slate-400 text-[8px] font-black uppercase mt-1">NexRyde Economy or Express</p>
            </div>

            <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl space-y-2">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 font-black text-[8px] uppercase tracking-widest">
                     <i className="fas fa-sparkles"></i> NexDispatch AI
                  </div>
                  <button 
                    onClick={handleAiFill} 
                    disabled={aiProcessing || !aiInput.trim()}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-black text-[7px] uppercase tracking-widest disabled:opacity-30"
                  >
                    {aiProcessing ? <i className="fas fa-spinner fa-spin"></i> : 'Auto-Fill'}
                  </button>
               </div>
               <textarea 
                 className="w-full bg-[#020617] text-white text-[10px] border border-white/10 rounded-lg p-2 outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700 h-10 resize-none"
                 placeholder="e.g. Solo taxi from Main Gate to Central Lab"
                 value={aiInput}
                 onChange={e => setAiInput(e.target.value)}
               />
            </div>

            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              <button onClick={() => {setIsSolo(false); setIsLongDistance(false);}} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${!isSolo && !isLongDistance ? 'bg-amber-500 text-[#020617]' : 'text-slate-500'}`}>Pool</button>
              <button onClick={() => {setIsSolo(true); setIsLongDistance(false);}} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${isSolo ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'}`}>Solo</button>
              <button onClick={() => {setIsSolo(false); setIsLongDistance(true);}} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${isLongDistance ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Premium</button>
            </div>

            <div className="space-y-3">
               <div className="grid grid-cols-2 gap-3">
                  <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold text-xs" placeholder="Pickup" value={origin} onChange={e => setOrigin(e.target.value)} />
                  <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold text-xs" placeholder="Drop-off" value={dest} onChange={e => setDest(e.target.value)} />
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 outline-none font-bold text-xs" value={type} onChange={e => setType(e.target.value as VehicleType)}>
                    <option value="Pragia">NexRyde Economy (Pragia)</option>
                    <option value="Taxi">NexRyde Standard (Taxi)</option>
                  </select>
                  <div className="flex items-center px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-slate-500 truncate">
                    Organizer: {currentUser.username}
                  </div>
               </div>
            </div>
            
            <div className="flex gap-3 pt-2">
               <button onClick={() => setShowModal(false)} className="flex-1 py-4 bg-white/10 rounded-2xl font-black text-[10px] uppercase text-white">Cancel</button>
               <button onClick={createNode} className={`flex-[1.5] py-4 ${isLongDistance ? 'bg-indigo-600' : (isSolo ? 'bg-emerald-500' : 'bg-amber-500')} text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-transform`}>
                 {isLongDistance ? 'Post Premium' : (isSolo ? 'Request Solo' : 'Form Pool')}
               </button>
            </div>
          </div>
        </div>
      )}

      {joinModalNodeId && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[160] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-sm:px-4 max-w-sm rounded-[2rem] p-8 space-y-6 animate-in zoom-in text-slate-900">
              <h3 className="text-xl font-black italic uppercase text-center text-white">Join NexRyde Pool</h3>
              <div className="space-y-4 text-center">
                 <p className="text-white font-black text-lg">{currentUser.username}</p>
                 <p className="text-slate-500 font-bold">{currentUser.phone}</p>
              </div>
              <p className="text-[9px] text-slate-500 text-center font-black uppercase italic">Adding seat to your active profile</p>
              <div className="flex gap-3">
                 <button onClick={() => setJoinModalNodeId(null)} className="flex-1 py-4 bg-white/10 rounded-xl font-black text-[10px] uppercase text-white">Cancel</button>
                 <button onClick={() => onJoin(joinModalNodeId, currentUser.username, currentUser.phone)} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Confirm Seat</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const RideCard = ({ currentUser, node, drivers, onJoin, onCancel, setJoinModalNodeId, isPriority }: any) => {
  const driver = drivers.find((d: any) => d.id === node.assignedDriverId);
  const isOrganizer = currentUser?.phone === node.leaderPhone;

  return (
    <div className={`glass rounded-[2.5rem] p-8 border transition-all ${node.isLongDistance ? 'border-indigo-500/40 shadow-xl shadow-indigo-500/5' : (node.status === 'dispatched' ? (isPriority ? 'border-indigo-500 shadow-2xl shadow-indigo-500/20' : 'border-amber-500/30') : 'border-white/5 hover:border-white/10')} relative overflow-hidden`}>
      {isPriority && node.status === 'dispatched' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-pulse"></div>
      )}
      
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-2">
          <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest ${node.status === 'dispatched' ? 'bg-amber-500 text-[#020617]' : (node.isLongDistance ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400')}`}>{node.status}</span>
          {node.isSolo && !node.isLongDistance && <span className="px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Solo Drop</span>}
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
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Pickup</p>
          <p className="text-white font-bold text-sm truncate uppercase">{node.origin}</p>
        </div>
        <div className="relative pl-6 border-l-2 border-white/5">
          <div className="absolute left-[-5px] bottom-0 w-2 h-2 rounded-full bg-amber-500"></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Drop-off</p>
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
            {isOrganizer && (
              <button onClick={() => { if(confirm("Delete this ride pool?")) onCancel(node.id); }} className="w-12 h-12 bg-rose-600/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500"><i className="fas fa-trash"></i></button>
            )}
          </div>
        )}

        {(node.status === 'forming' || node.status === 'qualified') && (node.isSolo || node.isLongDistance) && isOrganizer && (
           <button onClick={() => { if(confirm("Cancel this request?")) onCancel(node.id); }} className="w-full py-4 bg-rose-600/10 border border-rose-500/20 rounded-[1.5rem] font-black text-[10px] uppercase text-rose-500">Cancel Request</button>
        )}

        {node.status === 'dispatched' && driver && (
          <div className="space-y-4 animate-in zoom-in">
            <div className="flex items-center justify-between gap-4 mb-2 bg-white/5 p-4 rounded-2xl border border-white/5">
               <div className="flex items-center gap-3">
                  <div className="relative">
                    {driver.avatarUrl ? (
                      <img src={driver.avatarUrl} className="w-12 h-12 rounded-full object-cover border-2 border-amber-500" alt="Driver" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-amber-500 border-2 border-amber-500">
                        <i className="fas fa-user"></i>
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] text-white ring-2 ring-[#020617]">
                      <i className="fas fa-check"></i>
                    </div>
                  </div>
                  <div>
                    <p className="text-white font-black italic text-sm">{driver.name}</p>
                    <p className="text-[9px] font-black text-amber-500 uppercase">{driver.licensePlate}</p>
                  </div>
               </div>
               <a href={`tel:${driver.contact}`} className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xs"><i className="fas fa-phone"></i></a>
            </div>

            <div className={`p-6 ${isPriority ? 'bg-indigo-600' : 'bg-amber-500'} text-white rounded-[1.5rem] text-center shadow-xl flex flex-col items-center gap-4 relative overflow-hidden group`}>
               <div className="relative z-10">
                  <p className="text-[8px] font-black uppercase mb-1 opacity-80 tracking-[0.2em]">Your Ride PIN</p>
                  <p className="text-5xl font-black italic tracking-widest">{node.verificationCode}</p>
               </div>
               <div className="bg-white p-3 rounded-2xl shadow-inner border-4 border-[#020617]/10 relative z-10">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${node.verificationCode}&bgcolor=ffffff&color=020617`} 
                    className="w-24 h-24"
                    alt="Ride Code QR"
                  />
                  <p className="text-[6px] font-black text-slate-500 uppercase mt-1 text-center">Partner Scan Only</p>
               </div>
               {isPriority && <i className="fas fa-certificate absolute top-[-20px] right-[-20px] text-[80px] opacity-10 rotate-12"></i>}
            </div>
            {isOrganizer && (
              <button onClick={() => { if(confirm("Abort this trip assignment?")) onCancel(node.id); }} className="w-full py-3 bg-rose-600/10 border border-rose-500/20 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-500">Abort Assignment</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const DriverPortal = ({ drivers, activeDriver, onLogin, onLogout, qualifiedNodes, dispatchedNodes, missions, allNodes, onJoinMission, onAccept, onVerify, onCancel, onRequestTopup, onRequestRegistration, search, settings }: any) => {
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

  const [hubInsight, setHubInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [portraitScanning, setPortraitScanning] = useState(false);

  const handlePortraitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPortraitScanning(true);
      const compressed = await compressImage(file, 0.6, 400);
      setRegData({ ...regData, avatarUrl: compressed });

      try {
        const base64 = compressed.split(',')[1];
        // Multimodal content must use { parts: [...] } structure
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { text: "Verify if this image is a portrait of a person. If it contains a vehicle, try to extract the license plate. Return JSON: { \"isPortrait\": boolean, \"licensePlate\": string | null }" },
              { inlineData: { mimeType: "image/jpeg", data: base64 } }
            ]
          },
          config: { responseMimeType: "application/json" }
        });

        const visionData = JSON.parse(response.text || '{}');
        if (visionData.licensePlate) setRegData(prev => ({ ...prev, licensePlate: visionData.licensePlate }));
        if (!visionData.isPortrait) {
          alert("Portrait Verification Failed. Please upload a clear photo of your face.");
          setRegData(prev => ({ ...prev, avatarUrl: undefined }));
        }
      } catch (err) {
        console.error("Vision analysis error", err);
      } finally {
        setPortraitScanning(false);
      }
    }
  };

  const generateHubInsight = async () => {
    setInsightLoading(true);
    try {
      const activeTraffic = allNodes.filter((n:any) => n.status !== 'completed').map((n:any) => `${n.origin} -> ${n.destination}`).join(', ');
      const missionLocs = missions.map((m:any) => m.location).join(', ');
      
      const prompt = `Act as a logistics analyst for NexRyde. 
      Market Traffic: ${activeTraffic}
      Available Hotspots: ${missionLocs}
      
      Strategically advise a partner on where to go for maximum profit. 
      Very short answer. Start with 'NexRyde Strategy:'.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      setHubInsight(response.text || "Market strategy unavailable. Shift to hotspots.");
    } catch (err) {
      setHubInsight("NexRyde analysis offline. Move to high-density zones.");
    } finally {
      setInsightLoading(false);
    }
  };

  useEffect(() => {
    let html5QrCode: any = null;
    
    if (isScanning && activeMissionNodeId) {
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
            }
          );
        } catch (err: any) {
          setIsScanning(false);
        }
      }, 300);

      return () => {
        clearTimeout(timeout);
        if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(console.error);
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
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Partner Hub</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase mt-1">Authorized NexRyde Partners Only</p>
        </div>
        
        {selectedDriverId ? (
            <div className="w-full max-md glass p-10 rounded-[3rem] border border-white/10 space-y-8 animate-in zoom-in text-center">
                <div className="flex justify-center mb-4">
                  {drivers.find((d:any)=>d.id===selectedDriverId)?.avatarUrl ? (
                    <img src={drivers.find((d:any)=>d.id===selectedDriverId)?.avatarUrl} className="w-20 h-20 rounded-full object-cover border-4 border-amber-500/50" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-amber-500">
                       <i className="fas fa-user text-2xl"></i>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                   <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Partner Password</p>
                   <input 
                     type="password" 
                     className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-3xl tracking-[0.5em] font-black outline-none focus:border-amber-500 text-center text-white" 
                     placeholder="••••"
                     value={pin}
                     onChange={e => setPin(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && onLogin(selectedDriverId, pin)}
                   />
                </div>
                <div className="flex gap-4">
                    <button onClick={() => {setSelectedDriverId(null); setPin('');}} className="flex-1 py-4 bg-white/5 rounded-xl font-black text-[10px] uppercase text-slate-400">Back</button>
                    <button onClick={() => onLogin(selectedDriverId, pin)} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-xl">Unlock Hub</button>
                </div>
            </div>
        ) : (
            <div className="flex flex-col items-center gap-8 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
                {drivers.map((d: any) => (
                  <button key={d.id} onClick={() => setSelectedDriverId(d.id)} className="glass p-8 rounded-[2rem] border border-white/5 text-left transition-all hover:border-amber-500/50 group flex items-center gap-6">
                    {d.avatarUrl ? (
                      <img src={d.avatarUrl} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                        <i className="fas fa-user"></i>
                      </div>
                    )}
                    <div>
                      <p className="font-black uppercase italic text-xl text-white group-hover:text-amber-500 transition-colors">{d.name}</p>
                      <p className="text-[9px] font-black text-slate-500 uppercase">WALLET: ₵{d.walletBalance.toFixed(1)}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowRegModal(true)} className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-2xl hover:scale-105 transition-transform flex items-center gap-3">
                 <i className="fas fa-plus-circle"></i> Join NexRyde Fleet
              </button>
            </div>
        )}

        {showRegModal && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
            <div className="glass-bright w-full max-sm:px-2 max-w-md rounded-[2.5rem] p-4 sm:p-6 space-y-4 animate-in zoom-in text-slate-900 overflow-y-auto max-h-[95vh] no-scrollbar">
               <div className="text-center">
                  <h3 className="text-xl font-black italic tracking-tighter uppercase text-white leading-none">Partner Onboarding</h3>
                  <p className="text-indigo-400 text-[8px] font-black uppercase mt-1">Activation Fee: ₵{settings.registrationFee || '...'}</p>
               </div>
               
               <div className="flex justify-center flex-col items-center gap-1">
                  <input type="file" id="portrait-upload" className="hidden" accept="image/*" onChange={handlePortraitUpload} />
                  <label htmlFor="portrait-upload" className={`w-16 h-16 rounded-full bg-white/5 border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-all overflow-hidden relative ${portraitScanning ? 'border-indigo-500' : 'border-white/10'}`}>
                    {regData.avatarUrl ? (
                      <img src={regData.avatarUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <i className="fas fa-camera text-slate-600 text-lg mb-0.5"></i>
                        <p className="text-[6px] font-black text-slate-500 uppercase">Portrait</p>
                      </div>
                    )}
                    {portraitScanning && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><i className="fas fa-spinner fa-spin text-white"></i></div>}
                  </label>
                  {portraitScanning && <p className="text-[7px] font-black text-indigo-400 uppercase animate-pulse">AI Verification...</p>}
               </div>

               <div className="bg-indigo-600/10 p-3 rounded-xl border border-indigo-500/20 flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-[7px] font-black text-slate-500 uppercase">Admin MoMo ID</p>
                    <p className="text-sm font-black text-white italic leading-none">{settings.adminMomo}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase mt-1">{settings.adminMomoName}</p>
                  </div>
                  <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><i className="fas fa-wallet text-sm"></i></div>
               </div>

               <div className="space-y-2.5">
                  <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold text-xs" placeholder="Full Legal Name" value={regData.name || ''} onChange={e => setRegData({...regData, name: e.target.value})} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 outline-none font-bold text-xs" value={regData.vehicleType || 'Pragia'} onChange={e => setRegData({...regData, vehicleType: e.target.value as VehicleType})}>
                       <option value="Pragia">Economy (Pragia)</option>
                       <option value="Taxi">Standard (Taxi)</option>
                    </select>
                    <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold text-xs" placeholder="Plate ID" value={regData.licensePlate || ''} onChange={e => setRegData({...regData, licensePlate: e.target.value})} />
                  </div>
                  <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold text-xs" placeholder="WhatsApp Contact" value={regData.contact || ''} onChange={e => setRegData({...regData, contact: e.target.value})} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input type="password" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-black text-center text-xs" placeholder="Hub Password" value={regData.pin || ''} onChange={e => setRegData({...regData, pin: e.target.value})} />
                    <input className="w-full bg-white border border-emerald-500/30 rounded-xl px-4 py-3 outline-none font-black text-center text-emerald-600 text-xs" placeholder="Payment Ref" value={regData.momoReference || ''} onChange={e => setRegData({...regData, momoReference: e.target.value})} />
                  </div>
               </div>

               <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowRegModal(false)} className="flex-1 py-4 bg-white/10 rounded-2xl font-black text-[10px] uppercase text-white">Abort</button>
                  <button onClick={() => { 
                    if (!regData.name || !regData.momoReference || !regData.pin || !regData.avatarUrl) { alert("Please complete all fields, including your photo."); return; }
                    onRequestRegistration({ ...regData as RegistrationRequest, amount: settings.registrationFee }); 
                    setShowRegModal(false); 
                  }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl">Verify & Apply</button>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-12 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 bg-indigo-500/5 p-6 rounded-[2rem] border border-indigo-500/10 relative overflow-hidden">
        <div className="flex items-center gap-6 relative z-10">
          <div className="relative">
            {activeDriver.avatarUrl ? (
              <img src={activeDriver.avatarUrl} className="w-16 h-16 rounded-2xl object-cover border border-amber-500 shadow-xl" />
            ) : (
              <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-[#020617] shadow-xl">
                <i className={`fas ${activeDriver.vehicleType === 'Pragia' ? 'fa-motorcycle' : 'fa-taxi'} text-2xl`}></i>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] text-white ring-2 ring-[#020617]">
               <i className="fas fa-check"></i>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tighter uppercase italic text-white leading-none">{activeDriver.name}</h2>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-2">Balance: ₵ {activeDriver.walletBalance.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto relative z-10">
          <button onClick={() => setShowTopupModal(true)} className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">Top-Up Credits</button>
          <button onClick={onLogout} className="flex-1 sm:flex-none px-6 py-3 bg-rose-600/10 text-rose-500 rounded-xl text-[10px] font-black uppercase border border-rose-500/20">Sign Out</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-12">
           <section>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Partner Hotspots</h3>
                <button 
                   onClick={generateHubInsight} 
                   className="flex items-center gap-2 text-indigo-400 font-black text-[9px] uppercase hover:scale-105 transition-transform bg-indigo-500/10 px-4 py-2 rounded-xl"
                >
                  <i className={`fas fa-sparkles ${insightLoading ? 'animate-spin' : ''}`}></i> NexStrategy
                </button>
              </div>

              {hubInsight && (
                <div className="mb-6 p-4 bg-indigo-600 rounded-[1.5rem] border border-white/20 animate-in zoom-in text-white text-[11px] font-medium italic relative overflow-hidden text-center">
                  <i className="fas fa-lightbulb absolute right-4 top-1/2 -translate-y-1/2 text-4xl opacity-10"></i>
                  <p className="relative z-10">{hubInsight}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {missions.filter(m => m.status === 'open').map(m => (
                   <div key={m.id} className={`glass p-6 rounded-3xl border ${m.driversJoined.includes(activeDriver.id) ? 'border-emerald-500/30' : 'border-white/5'} space-y-4`}>
                      <div className="flex justify-between items-start">
                         <div className="flex items-center gap-2">
                            <i className="fas fa-location-dot text-amber-500 text-sm"></i>
                            <h4 className="font-black text-white uppercase italic text-sm">{m.location}</h4>
                         </div>
                         <p className="text-emerald-400 font-black text-xs">₵{m.entryFee}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium italic leading-relaxed">{m.description}</p>
                      {m.driversJoined.includes(activeDriver.id) ? (
                        <div className="w-full py-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-[8px] font-black uppercase text-center border border-emerald-500/20">Hotspot Active</div>
                      ) : (
                        <button onClick={() => onJoinMission(m.id, activeDriver.id)} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[8px] font-black uppercase shadow-lg">Enter Zone</button>
                      )}
                   </div>
                 ))}
              </div>
           </section>

           <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic mb-6">Ready for Dispatch</h3>
              <div className="space-y-4">
                {qualifiedNodes.map((node: any) => (
                  <div key={node.id} className="glass rounded-[2rem] p-6 border transition-all flex flex-col md:flex-row items-center gap-6 border-white/5 hover:border-indigo-500/30">
                      <div className="flex-1">
                        <p className="font-black text-sm uppercase italic text-white">{node.origin} → {node.destination}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Organized by {node.leaderName}</p>
                      </div>
                      <button onClick={() => onAccept(node.id, activeDriver.id)} className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Accept Ride</button>
                  </div>
                ))}
              </div>
           </section>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Current Trip</h3>
           {dispatchedNodes.filter((n: any) => n.assignedDriverId === activeDriver.id).map((node: any) => (
              <div key={node.id} className="glass rounded-[2rem] p-8 border space-y-6 border-amber-500/20">
                 <h4 className="text-xl font-black uppercase italic text-white leading-none truncate text-center">{node.origin} to {node.destination}</h4>
                 <div className="space-y-4 pt-4 border-t border-white/5 text-center">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Verify Ride PIN to Complete</p>
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
                         className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500 transition-all border border-emerald-500/20 shadow-xl"
                       >
                          <i className="fas fa-qrcode text-lg"></i>
                       </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => onVerify(node.id, verifyCode)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Finish Ride</button>
                      <button onClick={() => { if(confirm("Abandon trip? Partner rating may be affected.")) onCancel(node.id); }} className="w-full py-2 bg-white/5 text-slate-500 rounded-xl font-black text-[9px] uppercase">Unable to Complete</button>
                    </div>
                 </div>
              </div>
           ))}
        </div>
      </div>

      {isScanning && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[200] flex items-center justify-center p-4">
           <div className="w-full max-lg space-y-8 animate-in zoom-in duration-300">
              <div className="flex justify-between items-center text-white px-2">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-[#020617] shadow-xl shadow-emerald-500/20">
                       <i className="fas fa-camera text-xl"></i>
                    </div>
                    <div>
                       <h3 className="text-xl font-black italic uppercase tracking-tighter leading-none">Scanning Ride PIN</h3>
                       <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">Auto Verification Active</p>
                    </div>
                 </div>
                 <button onClick={() => setIsScanning(false)} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-all border border-white/10">
                    <i className="fas fa-times text-lg"></i>
                 </button>
              </div>
              <div id="qr-reader" className="w-full aspect-square bg-black/40 rounded-[2rem] overflow-hidden relative border border-white/10">
                  <div className="scanner-line"></div>
              </div>
           </div>
        </div>
      )}

      {showTopupModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-sm:px-4 max-w-md rounded-[2.5rem] p-8 space-y-8 animate-in zoom-in text-slate-900">
            <div className="text-center">
              <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white leading-none">Credit Acquisition</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase mt-1">MoMo Verification Required</p>
            </div>
            
            <div className="space-y-4">
               <div className="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-center">
                  <p className="text-[9px] font-black text-amber-500 uppercase mb-1">NexRyde Billing ID</p>
                  <p className="text-3xl font-black text-white italic leading-none">{settings.adminMomo}</p>
                  <p className="text-[11px] font-black text-slate-400 uppercase mt-2">{settings.adminMomoName}</p>
               </div>
               <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-black text-emerald-600 text-center text-xl" placeholder="Amount (₵)" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-center" placeholder="Transaction Reference" value={momoRef} onChange={e => setMomoRef(e.target.value)} />
            </div>
            <div className="flex gap-4">
               <button onClick={() => setShowTopupModal(false)} className="flex-1 py-4 bg-white/10 rounded-xl font-black text-[10px] uppercase text-white">Cancel</button>
               <button onClick={() => { 
                 if (!topupAmount || !momoRef) { alert("Please fill all fields."); return; }
                 onRequestTopup(activeDriver.id, Number(topupAmount), momoRef); 
                 setShowTopupModal(false); 
               }} className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Request Activation</button>
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
  const [newDriver, setNewDriver] = useState<Partial<Driver>>({ vehicleType: 'Pragia', pin: '' });
  const [newMission, setNewMission] = useState<Partial<HubMission>>({ location: '', description: '', entryFee: 5, status: 'open' });
  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);
  
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  useEffect(() => { setLocalSettings(settings); }, [settings]);

  const filteredDrivers = drivers.filter((d: any) => d.name.toLowerCase().includes(search.toLowerCase()));

  const handleSettingImage = async (e: React.ChangeEvent<HTMLInputElement>, field: 'wallpaper' | 'about') => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, 0.6, 1200);
      if (field === 'wallpaper') {
        setLocalSettings({...localSettings, appWallpaper: compressed});
      } else {
        setLocalSettings({...localSettings, aboutMeImages: [...localSettings.aboutMeImages, compressed]});
      }
    }
  };

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-8 pb-10">
      <div className="flex items-center justify-between mb-4">
         <div className="flex bg-white/5 p-1 rounded-[1.5rem] border border-white/10 overflow-x-auto no-scrollbar max-w-full">
            <TabBtn active={activeTab === 'monitor'} label="Dashboard" onClick={() => setActiveTab('monitor')} />
            <TabBtn active={activeTab === 'fleet'} label="Partners" onClick={() => setActiveTab('fleet')} />
            <TabBtn active={activeTab === 'onboarding'} label="Onboarding" onClick={() => setActiveTab('onboarding')} count={registrationRequests.filter((r:any)=>r.status==='pending').length} />
            <TabBtn active={activeTab === 'missions'} label="Hotspots" onClick={() => setActiveTab('missions')} />
            <TabBtn active={activeTab === 'requests'} label="Billing" onClick={() => setActiveTab('requests')} count={topupRequests.filter((r:any)=>r.status==='pending').length} />
            <TabBtn active={activeTab === 'settings'} label="System" onClick={() => setActiveTab('settings')} />
         </div>
         <div className="flex items-center gap-4 bg-rose-600/10 px-4 py-2 rounded-xl border border-rose-500/20">
            <button onClick={onLock} className="text-rose-500 hover:text-rose-400 transition-colors">
               <i className="fas fa-lock text-sm"></i>
            </button>
         </div>
      </div>

      {activeTab === 'monitor' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Requests" value={nodes.filter((n:any) => n.status === 'forming').length} icon="fa-users" color="text-amber-400" />
            <StatCard label="Partners" value={drivers.length} icon="fa-taxi" color="text-indigo-400" />
            <StatCard label="Qualified" value={nodes.filter((n:any) => n.status === 'qualified').length} icon="fa-bolt" color="text-emerald-400" />
            <StatCard label="Revenue" value={hubRevenue.toFixed(0)} icon="fa-money-bill" color="text-slate-400" isCurrency />
          </div>
          
          <div className="glass rounded-[2rem] p-8 border border-white/5">
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Live NexRyde Activity</h4>
             <div className="space-y-3">
               {nodes.slice(0, 10).map((n: RideNode) => (
                 <div key={n.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-all">
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-white uppercase italic">{n.origin} → {n.destination}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">{n.status} | {n.passengers.length} Riders</p>
                    </div>
                    <div className="flex gap-2">
                       {n.status !== 'completed' && <button onClick={() => onSettleRide(n.id)} className="px-3 py-1.5 bg-emerald-600/10 text-emerald-500 rounded-lg text-[8px] font-black uppercase border border-emerald-500/20">Settle</button>}
                       <button onClick={() => onCancelRide(n.id)} className="px-3 py-1.5 bg-rose-600/10 text-rose-500 rounded-lg text-[8px] font-black uppercase border border-rose-500/20">Kill</button>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'fleet' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center px-2">
              <h3 className="text-xl font-black uppercase italic text-white leading-none">Partner Registry</h3>
              <button onClick={() => setShowDriverModal(true)} className="px-6 py-3 bg-amber-500 text-[#020617] rounded-xl text-[9px] font-black uppercase shadow-xl">Direct Register</button>
           </div>
           <div className="glass rounded-[2rem] overflow-hidden border border-white/5">
              <table className="w-full text-left text-[11px]">
                 <thead className="bg-white/5 text-slate-500 uppercase font-black tracking-widest border-b border-white/5">
                    <tr><th className="px-8 py-5">Partner</th><th className="px-8 py-5">Asset Info</th><th className="px-8 py-5 text-center">Credit</th><th className="px-8 py-5 text-right">Action</th></tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {filteredDrivers.map((d: any) => (
                       <tr key={d.id} className="text-slate-300 font-bold hover:bg-white/5">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              {d.avatarUrl ? (
                                <img src={d.avatarUrl} className="w-10 h-10 rounded-full object-cover border border-amber-500/30" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-600"><i className="fas fa-user"></i></div>
                              )}
                              <span>{d.name}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5"><div>{d.licensePlate}</div><div className="text-[8px] text-slate-500 uppercase tracking-tighter">{d.contact} | {d.vehicleType}</div></td>
                          <td className="px-8 py-5 text-center text-emerald-400 italic font-black">₵{d.walletBalance.toFixed(1)}</td>
                          <td className="px-8 py-5 text-right"><button onClick={() => setPendingDeletionId(d.id)} className="px-4 py-2 bg-rose-600/10 text-rose-500 rounded-xl text-[8px] font-black uppercase">Revoke</button></td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {activeTab === 'onboarding' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {registrationRequests.filter((r:any)=>r.status==='pending').map((reg: any) => (
             <div key={reg.id} className="glass p-8 rounded-3xl border border-indigo-500/20 space-y-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                       {reg.avatarUrl ? (
                          <img src={reg.avatarUrl} className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
                       ) : (
                          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-slate-700"><i className="fas fa-user text-xl"></i></div>
                       )}
                       <div>
                         <h4 className="text-white font-black uppercase italic text-sm">{reg.name}</h4>
                         <span className="text-[8px] font-black text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-md">{reg.vehicleType}</span>
                       </div>
                    </div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl space-y-2">
                     <p className="text-[8px] font-black uppercase text-slate-500">Plate Number</p>
                     <p className="text-xs font-black text-white">{reg.licensePlate}</p>
                     <p className="text-[8px] font-black uppercase text-slate-500 mt-2">MoMo Reference</p>
                     <p className="text-sm font-black text-emerald-400 italic">REF: {reg.momoReference}</p>
                     <p className="text-[8px] font-black uppercase text-slate-500 mt-2">WhatsApp</p>
                     <p className="text-xs font-black text-white">{reg.contact}</p>
                  </div>
                </div>
                <button onClick={() => onApproveRegistration(reg.id)} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-500 mt-4 transition-all">Activate Partner</button>
             </div>
           ))}
           {registrationRequests.filter((r:any)=>r.status==='pending').length === 0 && (
             <div className="col-span-full py-20 text-center">
                <i className="fas fa-id-card text-slate-800 text-4xl mb-4"></i>
                <p className="text-slate-600 font-black uppercase text-[10px]">No pending onboarding requests</p>
             </div>
           )}
        </div>
      )}

      {activeTab === 'missions' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center px-2">
              <h3 className="text-xl font-black uppercase italic text-white leading-none">NexRyde Hotspots</h3>
              <button onClick={() => setShowMissionModal(true)} className="px-6 py-3 bg-amber-500 text-[#020617] rounded-xl text-[9px] font-black uppercase shadow-xl">New Hotspot</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {missions.map(m => (
                <div key={m.id} className="glass p-8 rounded-3xl border border-white/5 space-y-4 relative overflow-hidden group">
                   <div className="flex justify-between items-start">
                      <div>
                         <h4 className="text-white font-black uppercase italic text-lg leading-none mb-2">{m.location}</h4>
                         <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">₵{m.entryFee} Entry Fee</p>
                      </div>
                      <button onClick={() => onDeleteMission(m.id)} className="w-8 h-8 rounded-full bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white transition-all"><i className="fas fa-trash text-[10px]"></i></button>
                   </div>
                   <p className="text-[11px] text-slate-400 font-medium italic leading-relaxed">{m.description}</p>
                   <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{m.driversJoined.length} Partners Stationed</span>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           {topupRequests.filter((r:any)=>r.status==='pending').map((req: any) => (
             <div key={req.id} className="glass p-8 rounded-3xl border border-emerald-500/20 space-y-6">
                <div>
                  <h4 className="text-white font-black uppercase italic text-sm">{drivers.find((d:any)=>d.id===req.driverId)?.name}</h4>
                  <p className="text-3xl font-black text-white italic mt-4">₵ {req.amount}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">ID: {req.momoReference}</p>
                </div>
                <button onClick={() => onApproveTopup(req.id)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Confirm Credits</button>
             </div>
           ))}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="glass rounded-[2rem] p-8 border border-white/5 space-y-10 animate-in fade-in">
           <div>
              <h3 className="text-xl font-black uppercase italic text-white leading-none">NexRyde Control</h3>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">Global Logistics Engine Settings</p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="space-y-6">
                 <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Ride & Premium Pricing</h4>
                 <div className="space-y-4">
                    <AdminInput label="NexRyde Fee (₵)" value={localSettings.commissionPerSeat} onChange={v => setLocalSettings({...localSettings, commissionPerSeat: Number(v)})} />
                    <AdminInput label="Onboarding Fee (₵)" value={localSettings.registrationFee} onChange={v => setLocalSettings({...localSettings, registrationFee: Number(v)})} />
                    <AdminInput label="Pragia Base (₵)" value={localSettings.farePerPragia} onChange={v => setLocalSettings({...localSettings, farePerPragia: Number(v)})} />
                    <AdminInput label="Taxi Base (₵)" value={localSettings.farePerTaxi} onChange={v => setLocalSettings({...localSettings, farePerTaxi: Number(v)})} />
                    <AdminInput label="Solo Premium (x)" value={localSettings.soloMultiplier} onChange={v => setLocalSettings({...localSettings, soloMultiplier: Number(v)})} />
                 </div>
              </section>

              <section className="space-y-6">
                 <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Communication & Billing</h4>
                 <div className="space-y-4">
                    <AdminInput label="Market Announcement" value={localSettings.hub_announcement || ''} onChange={v => setLocalSettings({...localSettings, hub_announcement: v})} />
                    <AdminInput label="Partner Hotline" value={localSettings.whatsappNumber} onChange={v => setLocalSettings({...localSettings, whatsappNumber: v})} />
                    <AdminInput label="NexBilling MoMo" value={localSettings.adminMomo} onChange={v => setLocalSettings({...localSettings, adminMomo: v})} />
                    <AdminInput label="Billing Name" value={localSettings.adminMomoName} onChange={v => setLocalSettings({...localSettings, adminMomoName: v})} />
                 </div>
              </section>

              <section className="md:col-span-2 space-y-6">
                 <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">NexRyde Experience & Portfolio</h4>
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-600 uppercase">Experience Manifesto</label>
                       <textarea className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-medium text-white h-32 outline-none focus:border-amber-500" value={localSettings.aboutMeText} onChange={e => setLocalSettings({...localSettings, aboutMeText: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="space-y-4">
                          <label className="text-[9px] font-black text-slate-600 uppercase">Brand Wallpaper</label>
                          <input type="file" className="hidden" id="wallpaper-upload" onChange={e => handleSettingImage(e, 'wallpaper')} />
                          <label htmlFor="wallpaper-upload" className="flex flex-col items-center justify-center aspect-video bg-white/5 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all group overflow-hidden">
                             {localSettings.appWallpaper ? <img src={localSettings.appWallpaper} className="w-full h-full object-cover" /> : <div className="text-center"><i className="fas fa-image text-2xl text-slate-700 mb-2"></i><p className="text-[8px] font-black uppercase text-slate-500">Update Brand Imagery</p></div>}
                          </label>
                       </div>
                       <div className="space-y-4">
                          <label className="text-[9px] font-black text-slate-600 uppercase">Gallery Assets</label>
                          <input type="file" className="hidden" id="about-upload" onChange={e => handleSettingImage(e, 'about')} />
                          <div className="grid grid-cols-3 gap-2">
                             {localSettings.aboutMeImages.map((img, i) => (
                               <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10">
                                  <img src={img} className="w-full h-full object-cover" />
                                  <button onClick={() => setLocalSettings({...localSettings, aboutMeImages: localSettings.aboutMeImages.filter((_, idx)=>idx!==i)})} className="absolute inset-0 bg-rose-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-all"><i className="fas fa-trash"></i></button>
                               </div>
                             ))}
                             <label htmlFor="about-upload" className="aspect-square flex flex-col items-center justify-center bg-white/5 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:bg-white/10"><i className="fas fa-plus text-slate-600"></i></label>
                          </div>
                       </div>
                    </div>
                 </div>
              </section>
           </div>

           <div className="pt-8 border-t border-white/5 flex justify-end">
              <button onClick={() => onUpdateSettings(localSettings)} className="px-12 py-4 bg-amber-500 text-[#020617] rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-transform">Sync Ecosystem</button>
           </div>
        </div>
      )}

      {pendingDeletionId && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-sm:px-4 max-w-sm rounded-[2.5rem] p-10 space-y-8 animate-in zoom-in text-center">
              <div className="w-16 h-16 bg-rose-600/10 border border-rose-500/20 rounded-full flex items-center justify-center text-rose-500 mx-auto">
                 <i className="fas fa-user-slash text-2xl"></i>
              </div>
              <div className="space-y-2">
                 <h3 className="text-xl font-black uppercase italic text-white leading-none">Deactivate Partner?</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase">This will revoke all NexRyde terminal access immediately.</p>
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setPendingDeletionId(null)} className="flex-1 py-4 bg-white/5 rounded-xl font-black text-[10px] uppercase text-slate-400">Cancel</button>
                 <button onClick={() => { onDeleteDriver(pendingDeletionId); setPendingDeletionId(null); }} className="flex-1 py-4 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Revoke Access</button>
              </div>
           </div>
        </div>
      )}

      {showMissionModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-lg rounded-[2.5rem] p-8 space-y-8 animate-in zoom-in text-slate-900">
            <h3 className="text-2xl font-black italic uppercase text-center text-white">Declare Hotspot</h3>
            <div className="space-y-4">
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Hotspot Location Name" value={newMission.location} onChange={e => setNewMission({...newMission, location: e.target.value})} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Access Fee (₵)" type="number" value={newMission.entryFee} onChange={e => setNewMission({...newMission, entryFee: Number(e.target.value)})} />
               <textarea className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-medium h-32" placeholder="Area Description & Rules" value={newMission.description} onChange={e => setNewMission({...newMission, description: e.target.value})} />
            </div>
            <div className="flex gap-4">
               <button onClick={() => setShowMissionModal(false)} className="flex-1 py-4 bg-white/10 rounded-xl font-black text-[10px] uppercase text-white">Cancel</button>
               <button onClick={() => { 
                 if(!newMission.location || !newMission.description) { alert("All fields required."); return; }
                 onCreateMission({ id: `MSN-${Date.now()}`, driversJoined: [], ...newMission, status: 'open', createdAt: new Date().toISOString() } as HubMission); 
                 setShowMissionModal(false); 
               }} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-xl">Deploy Hotspot</button>
            </div>
          </div>
        </div>
      )}

      {showDriverModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-lg rounded-[2.5rem] p-8 lg:p-10 space-y-8 animate-in zoom-in text-slate-900">
            <h3 className="text-2xl font-black italic uppercase text-center text-white">Register Partner Asset</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              if(!newDriver.name || !newDriver.contact || !newDriver.pin || !newDriver.licensePlate) { alert("All fields required."); return; }
              onAddDriver(newDriver as Driver);
              setShowDriverModal(false);
            }} className="space-y-4">
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Partner Full Name" onChange={e => setNewDriver({...newDriver, name: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                  <select className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold" onChange={e => setNewDriver({...newDriver, vehicleType: e.target.value as VehicleType})}><option value="Pragia">Pragia</option><option value="Taxi">Taxi</option></select>
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold" placeholder="Asset Plate" onChange={e => setNewDriver({...newDriver, licensePlate: e.target.value})} />
               </div>
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="WhatsApp Line" onChange={e => setNewDriver({...newDriver, contact: e.target.value})} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-black text-center" placeholder="Partner Hub Password" onChange={e => setNewDriver({...newDriver, pin: e.target.value})} />
               <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowDriverModal(false)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-[10px] uppercase text-slate-400">Cancel</button><button type="submit" className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-xl">Create Partner</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminInput = ({ label, value, onChange, type = "text" }: { label: string, value: any, onChange: (v: string) => void, type?: string }) => (
  <div className="space-y-1.5">
     <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{label}</label>
     <input 
       type={type} 
       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-amber-500" 
       value={value} 
       onChange={e => onChange(e.target.value)} 
     />
  </div>
);

const TabBtn = ({ active, label, onClick, count }: any) => (
  <button onClick={onClick} className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}>
    {label} {count !== undefined && count > 0 && <span className="ml-1 bg-rose-500 text-white text-[7px] px-1.5 py-0.5 rounded-full ring-2 ring-[#020617]">{count}</span>}
  </button>
);

const StatCard = ({ label, value, icon, color, isCurrency }: any) => (
  <div className="glass p-6 rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col justify-end min-h-[140px] group transition-all hover:border-white/10">
    <i className={`fas ${icon} absolute top-6 left-6 ${color} text-xl transition-transform group-hover:scale-110`}></i>
    <div className="relative z-10"><p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{label}</p><p className="text-3xl font-black italic text-white leading-none">{isCurrency ? '₵' : ''}{value}</p></div>
  </div>
);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
