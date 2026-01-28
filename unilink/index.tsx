import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from '@supabase/supabase-js';



// --- Supabase Setup ---
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Types ---
type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed';
type PortalMode = 'passenger' | 'driver' | 'admin';

interface Passenger { id: string; name: string; phone: string; }
interface RideNode {
  id: string; origin: string; destination: string; capacityNeeded: number;
  passengers: Passenger[]; status: NodeStatus; leaderName: string;
  leaderPhone: string; farePerPerson: number; assignedDriverId?: string;
  verificationCode?: string; negotiatedTotalFare?: number;
  isSolo?: boolean; isLongDistance?: boolean; createdAt: string;
}
interface Driver {
  id: string; name: string; vehicleType: VehicleType; licensePlate: string;
  contact: string; walletBalance: number; rating: number; status: string; pin: string;
}
interface Transaction { id: string; driverId: string; amount: number; type: string; timestamp: string; }
interface TopupRequest { id: string; driverId: string; amount: number; momoReference: string; status: string; timestamp: string; }

// --- App ---
const App: React.FC = () => {
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- Fetch & Realtime Setup ---
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const { data: n } = await supabase.from('nodes').select('*');
      const { data: d } = await supabase.from('drivers').select('*');
      const { data: t } = await supabase.from('transactions').select('*');
      const { data: r } = await supabase.from('topup_requests').select('*');
      if (n) setNodes(n as RideNode[]);
      if (d) setDrivers(d as Driver[]);
      if (t) setTransactions(t as Transaction[]);
      if (r) setTopupRequests(r as TopupRequest[]);
      setLoading(false);
    };
    fetchAll();

    // --- Real-time subscriptions ---
    const subs: any[] = [];
    ['nodes','drivers','transactions','topup_requests'].forEach(table => {
      const sub = supabase.from(table).on('*', () => fetchAll()).subscribe();
      subs.push(sub);
    });

    return () => subs.forEach(s => supabase.removeSubscription(s));
  }, []);

  // --- Core Actions ---
  const joinNode = async (nodeId: string, name: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const passengers = [...node.passengers, { id: `P-${Date.now()}`, name, phone }];
    const status = passengers.length >= node.capacityNeeded ? 'qualified' : 'forming';
    await supabase.from('nodes').update({ passengers, status }).eq('id', nodeId);
  };

  const acceptRide = async (nodeId: string, driverId: string, customFare?: number) => {
    const node = nodes.find(n => n.id === nodeId);
    const driver = drivers.find(d => d.id === driverId);
    if (!node || !driver) return alert("Node or Driver not found.");
    if (driver.walletBalance < 2) return alert("Insufficient balance");

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const negotiatedFare = customFare || node.negotiatedTotalFare || node.farePerPerson;
    
    await supabase.from('nodes').update({
      status: 'dispatched',
      assignedDriverId: driverId,
      verificationCode,
      negotiatedTotalFare: negotiatedFare
    }).eq('id', nodeId);

    await supabase.from('drivers').update({
      walletBalance: driver.walletBalance - 2
    }).eq('id', driverId);

    await supabase.from('transactions').insert([{
      id: `TX-${Date.now()}`, driverId, amount: 2, type: 'commission', timestamp: new Date().toISOString()
    }]);
  };

  const verifyRide = async (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (node.verificationCode === code) {
      await supabase.from('nodes').update({ status: 'completed' }).eq('id', nodeId);
      alert("Ride verified!");
    } else alert("Wrong code!");
  };

  const requestTopup = async (driverId: string, amount: number, ref: string) => {
    await supabase.from('topup_requests').insert([{
      id: `REQ-${Date.now()}`, driverId, amount, momoReference: ref, status: 'pending', timestamp: new Date().toISOString()
    }]);
  };

  const approveTopup = async (reqId: string) => {
    const req = topupRequests.find(r => r.id === reqId);
    if (!req || req.status !== 'pending') return;
    const driver = drivers.find(d => d.id === req.driverId);
    if (!driver) return;

    await supabase.from('drivers').update({
      walletBalance: driver.walletBalance + req.amount
    }).eq('id', req.driverId);

    await supabase.from('topup_requests').update({ status: 'approved' }).eq('id', reqId);

    await supabase.from('transactions').insert([{
      id: `TX-${Date.now()}`, driverId: req.driverId, amount: req.amount, type: 'topup', timestamp: new Date().toISOString()
    }]);
  };

  const registerDriver = async (d: Omit<Driver,'id'|'walletBalance'|'rating'|'status'>) => {
    await supabase.from('drivers').insert([{
      ...d, id: `DRV-${Date.now()}`, walletBalance: 0, rating: 5, status: 'online'
    }]);
  };

  const deleteDriver = async (driverId: string) => {
    const activeMission = nodes.some(n => n.assignedDriverId === driverId && (n.status==='qualified'||n.status==='dispatched'));
    if (activeMission) return alert("Cannot delete driver on active mission");
    await supabase.from('drivers').delete().eq('id', driverId);
  };

  // --- Helpers ---
  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  if (loading) return <div style={{color:'white'}}>Loading…</div>;

  return (
    <div style={{color:'white',background:'black',minHeight:'100vh',padding:'1rem'}}>
      <h1>UniHub Dispatch</h1>

      <h2>Ride Nodes</h2>
      {nodes.map(n=>(
        <div key={n.id} style={{border:'1px solid white',padding:'0.5rem',margin:'0.5rem 0'}}>
          {n.origin} → {n.destination} | Seats {n.passengers.length}/{n.capacityNeeded} | Status: {n.status}
          <button onClick={()=>joinNode(n.id,'Test','0241234567')}>Join Node</button>
        </div>
      ))}

      <h2>Drivers</h2>
      {drivers.map(d=>(
        <div key={d.id}>{d.name} | Balance: ₵{d.walletBalance}</div>
      ))}
    </div>
  );
};

// --- Render ---
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
