
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CLIENT SETUP ---
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase env vars missing");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- TYPES & INTERFACES (same as your original) ---
type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed';
type PortalMode = 'passenger' | 'driver' | 'admin';

interface Passenger { id: string; name: string; phone: string; }
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
interface Driver { id: string; name: string; vehicleType: VehicleType; licensePlate: string; contact: string; walletBalance: number; rating: number; status: 'online' | 'busy' | 'offline'; pin: string; }
interface TopupRequest { id: string; driverId: string; amount: number; momoReference: string; status: 'pending' | 'approved' | 'rejected'; timestamp: string; }
interface Transaction { id: string; driverId: string; amount: number; type: 'commission' | 'topup'; timestamp: string; }
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
}

// --- APP COMPONENT ---
const App: React.FC = () => {
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'requests' | 'settings'>('monitor');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => sessionStorage.getItem('unihub_admin_auth_v11') === 'true');
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => sessionStorage.getItem('unihub_driver_session_v11'));

  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // --- FETCH INITIAL DATA & SUBSCRIBE TO REALTIME ---
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Fetch all data
        const { data: nodesData } = await supabase.from('nodes').select('*');
        const { data: driversData } = await supabase.from('drivers').select('*');
        const { data: txData } = await supabase.from('transactions').select('*');
        const { data: topupData } = await supabase.from('topup_requests').select('*');
        const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 'singleton').single();

        if (nodesData) setNodes(nodesData);
        if (driversData) setDrivers(driversData);
        if (txData) setTransactions(txData);
        if (topupData) setTopupRequests(topupData);
        if (settingsData) setSettings(settingsData);

        // 2. Subscribe to Realtime changes for all tables
        const nodeSub = supabase
          .from('nodes')
          .on('*', payload => {
            setNodes(prev => {
              switch (payload.eventType) {
                case 'INSERT': return [...prev, payload.new];
                case 'UPDATE': return prev.map(n => n.id === payload.new.id ? payload.new : n);
                case 'DELETE': return prev.filter(n => n.id !== payload.old.id);
                default: return prev;
              }
            });
          }).subscribe();

        const driverSub = supabase
          .from('drivers')
          .on('*', payload => {
            setDrivers(prev => {
              switch (payload.eventType) {
                case 'INSERT': return [...prev, payload.new];
                case 'UPDATE': return prev.map(d => d.id === payload.new.id ? payload.new : d);
                case 'DELETE': return prev.filter(d => d.id !== payload.old.id);
                default: return prev;
              }
            });
          }).subscribe();

        const txSub = supabase
          .from('transactions')
          .on('*', payload => setTransactions(prev => [...prev, payload.new]))
          .subscribe();

        const topupSub = supabase
          .from('topup_requests')
          .on('*', payload => setTopupRequests(prev => {
            switch (payload.eventType) {
              case 'INSERT': return [payload.new, ...prev];
              case 'UPDATE': return prev.map(r => r.id === payload.new.id ? payload.new : r);
              default: return prev;
            }
          }))
          .subscribe();

        setLoading(false);

        // Cleanup subscriptions on unmount
        return () => {
          supabase.removeSubscription(nodeSub);
          supabase.removeSubscription(driverSub);
          supabase.removeSubscription(txSub);
          supabase.removeSubscription(topupSub);
        };
      } catch (err) {
        console.error("Failed to load data", err);
        setLoading(false);
      }
    };

    init();
  }, []);

  // --- GUARD UI WHILE LOADING ---
  if (loading || !settings) return <div className="text-white text-center mt-20">Loading UniHub...</div>;

  // --- ACTIVE DRIVER MEMO ---
  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  // --- EXAMPLE ACTION: JOIN NODE ---
  const joinNode = async (nodeId: string, name: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.passengers.length >= node.capacityNeeded) return;

    const newPassenger = { id: `P-${Date.now()}`, name, phone };
    const updatedPassengers = [...node.passengers, newPassenger];
    const updatedStatus = updatedPassengers.length >= node.capacityNeeded ? 'qualified' : 'forming';

    await supabase.from('nodes').update({ passengers: updatedPassengers, status: updatedStatus }).eq('id', nodeId);
    // Supabase Realtime will automatically update state
  };

  // --- RENDER UI ---
  return (
    <div className="app-container text-white">
      <h1>UniHub Dispatch</h1>
      <p>Welcome, {viewMode === 'driver' ? activeDriver?.name : "Passenger"}</p>
      <p>Total nodes: {nodes.length}</p>
      <p>Total drivers: {drivers.length}</p>
      <p>Hub Revenue: ₵{transactions.filter(t => t.type === 'commission').reduce((a, b) => a + b.amount, 0)}</p>

      {/* Add your tabs, modals, buttons etc. here */}
    </div>
  );
};

export default App;
