import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CLIENT SETUP ---
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase env vars missing");
}

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
  type: 'commission' | 'topup';
  timestamp: string;
}

interface AppSettings {
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
  profitPercentage: number;
}

// --- APP COMPONENT ---
const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'requests' | 'settings'>('monitor');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => sessionStorage.getItem('unihub_admin_auth_v11') === 'true');
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => sessionStorage.getItem('unihub_driver_session_v11'));
  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isNewUser, setIsNewUser] = useState(() => !localStorage.getItem('unihub_seen_welcome_v11'));

  // --- STATE ---
  const [settings, setSettings] = useState<AppSettings>({
    adminMomo: '',
    adminMomoName: '',
    whatsappNumber: '',
    commissionPerSeat: 0,
    adminSecret: '',
    farePerPragia: 0,
    farePerTaxi: 0,
    soloMultiplier: 0,
    aboutMeText: '',
    aboutMeImages: [],
    profitPercentage: 0
  });
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  // --- LOAD FROM SUPABASE ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: driversData } = await supabase.from('drivers').select('*');
        if (driversData) setDrivers(driversData);

        const { data: nodesData } = await supabase.from('nodes').select('*');
        if (nodesData) setNodes(nodesData);

        const { data: txData } = await supabase.from('transactions').select('*');
        if (txData) setTransactions(txData);

        const { data: topupData } = await supabase.from('topup_requests').select('*');
        if (topupData) setTopupRequests(topupData);

        const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 'singleton').single();
        if (settingsData) setSettings(settingsData);
      } catch (err) {
        console.error('Supabase fetch error:', err);
      }
    };

    fetchData();
  }, []);

  // --- ACTIONS ---
  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await supabase.from('settings').upsert({ id: 'singleton', ...newSettings });
      setSettings(newSettings);
    } catch (err) {
      console.error('Settings save error:', err);
    }
  };

  const joinNode = async (nodeId: string, name: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.passengers.length >= node.capacityNeeded) return;

    const newPassengers = [...node.passengers, { id: `P-${Date.now()}`, name, phone }];
    const isQualified = newPassengers.length >= node.capacityNeeded;

    const updatedNode = { ...node, passengers: newPassengers, status: isQualified ? 'qualified' : 'forming' };
    setNodes(prev => prev.map(n => n.id === nodeId ? updatedNode : n));

    await supabase.from('nodes').update({
      passengers: newPassengers,
      status: updatedNode.status
    }).eq('id', nodeId);
  };

  const acceptRide = async (nodeId: string, driverId: string, customFare?: number) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver || driver.walletBalance < settings.commissionPerSeat) {
      alert("Insufficient Balance! Top up first.");
      return;
    }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const updatedNode = {
      ...node,
      status: 'dispatched' as NodeStatus,
      assignedDriverId: driverId,
      verificationCode,
      negotiatedTotalFare: customFare || node.negotiatedTotalFare
    };
    setNodes(prev => prev.map(n => n.id === nodeId ? updatedNode : n));

    // Deduct commission
    const newBalance = driver.walletBalance - settings.commissionPerSeat;
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, walletBalance: newBalance } : d));

    // Save to Supabase
    await supabase.from('drivers').update({ walletBalance: newBalance }).eq('id', driverId);
    await supabase.from('nodes').update(updatedNode).eq('id', nodeId);
    await supabase.from('transactions').insert([{
      id: `TX-${Date.now()}`,
      driverId,
      amount: settings.commissionPerSeat,
      type: 'commission',
      timestamp: new Date().toISOString()
    }]);

    alert(customFare ? `Negotiated trip accepted at ₵${customFare}!` : "Job accepted! Route and code shared with you.");
  };

  const approveTopup = async (reqId: string) => {
    const req = topupRequests.find(r => r.id === reqId);
    if (!req || req.status !== 'pending') return;

    const driver = drivers.find(d => d.id === req.driverId);
    if (!driver) return;

    const newBalance = driver.walletBalance + req.amount;
    setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, walletBalance: newBalance } : d));
    setTopupRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'approved' } : r));

    await supabase.from('drivers').update({ walletBalance: newBalance }).eq('id', driver.id);
    await supabase.from('topup_requests').update({ status: 'approved' }).eq('id', reqId);
    await supabase.from('transactions').insert([{
      id: `TX-${Date.now()}`,
      driverId: driver.id,
      amount: req.amount,
      type: 'topup',
      timestamp: new Date().toISOString()
    }]);
  };

  const registerDriver = async (d: Omit<Driver, 'id' | 'walletBalance' | 'rating' | 'status'>) => {
    const newDriver: Driver = {
      ...d,
      id: `DRV-${Date.now()}`,
      walletBalance: 0,
      rating: 5.0,
      status: 'online'
    };
    setDrivers(prev => [newDriver, ...prev]);
    await supabase.from('drivers').insert([newDriver]);
  };

  const deleteDriver = useCallback(async (id: string) => {
    const hasActiveMission = nodes.some(n => n.assignedDriverId === id && (n.status === 'qualified' || n.status === 'dispatched'));
    if (hasActiveMission) {
      alert("Cannot unregister driver with an active mission.");
      return;
    }

    setDrivers(prev => prev.filter(d => d.id !== id));
    if (activeDriverId === id) handleDriverLogout();

    await supabase.from('drivers').delete().eq('id', id);
  }, [nodes, activeDriverId]);

  const hubRevenue = useMemo(() => transactions.filter(t => t.type === 'commission').reduce((a, b) => a + b.amount, 0), [transactions]);
  const pendingRequestsCount = useMemo(() => topupRequests.filter(r => r.status === 'pending').length, [topupRequests]);

  const handleAdminAuth = (password: string) => {
    if (password === settings.adminSecret) {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('unihub_admin_auth_v11', 'true');
    } else alert("Master Key Invalid");
  };

  const handleDriverAuth = (driverId: string, pin: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver && driver.pin === pin) {
      setActiveDriverId(driverId);
      sessionStorage.setItem('unihub_driver_session_v11', driverId);
      setViewMode('driver');
    } else alert("Access Denied: Invalid Driver PIN");
  };

  const handleDriverLogout = () => {
    setActiveDriverId(null);
    sessionStorage.removeItem('unihub_driver_session_v11');
    setViewMode('passenger');
  };

  const dismissWelcome = () => {
    setIsNewUser(false);
    localStorage.setItem('unihub_seen_welcome_v11', 'true');
  };

  // --- SHARE FUNCTIONS ---
  const shareHub = async () => {
    const shareData = {
      title: 'UniHub Dispatch',
      text: 'Join the smartest ride-sharing hub on campus! Form groups, save costs, and move fast.',
      url: window.location.origin,
    };
    try { if (navigator.share) await navigator.share(shareData); else window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`, '_blank'); }
    catch (err) { console.log('Share failed', err); }
  };

  const shareNode = async (node: RideNode) => {
    const seatsLeft = node.capacityNeeded - node.passengers.length;
    const message = node.isLongDistance
      ? `🚀 *UniHub Long Distance!* \n📍 *From:* ${node.origin}\n📍 *To:* ${node.destination}\n🚕 *Bids open for Drivers!*`
      : node.isSolo
      ? `🚀 *UniHub Dropping!* \n📍 *Route:* ${node.origin} → ${node.destination}\n🚕 *Solo Request* needs a driver!`
      : `🚀 *Ride Hub Alert!*\n📍 *Route:* ${node.origin} → ${node.destination}\n👥 *Seats Left:* ${seatsLeft}\n💰 *Price:* ₵${node.farePerPerson}/p\n\nJoin my ride node on UniHub! 👇\n${window.location.origin}`;

    try { if (navigator.share) await navigator.share({ title: 'UniHub Ride Update', text: message, url: window.location.origin }); else window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank'); }
    catch (err) { console.log('Node share failed', err); }
  };

  return (
    <div>
      {/* YOUR UI GOES HERE */}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

