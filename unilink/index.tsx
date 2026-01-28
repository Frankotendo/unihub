import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE SETUP ---
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase env vars missing");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- TYPES ---
type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed';
type PortalMode = 'passenger' | 'driver' | 'admin';

interface Passenger { id: string; name: string; phone: string; }
interface RideNode { id: string; destination: string; origin: string; capacityNeeded: number; passengers: Passenger[]; status: NodeStatus; leaderName: string; leaderPhone: string; farePerPerson: number; createdAt: string; assignedDriverId?: string; verificationCode?: string; isSolo?: boolean; isLongDistance?: boolean; negotiatedTotalFare?: number; }
interface Driver { id: string; name: string; vehicleType: VehicleType; licensePlate: string; contact: string; walletBalance: number; rating: number; status: 'online' | 'busy' | 'offline'; pin: string; }
interface TopupRequest { id: string; driverId: string; amount: number; momoReference: string; status: 'pending' | 'approved' | 'rejected'; timestamp: string; }
interface Transaction { id: string; driverId: string; amount: number; type: 'commission' | 'topup'; timestamp: string; }
interface AppSettings { adminMomo: string; adminMomoName: string; whatsappNumber: string; commissionPerSeat: number; adminSecret: string; farePerPragia: number; farePerTaxi: number; soloMultiplier: number; aboutMeText: string; aboutMeImages: string[]; }

// --- APP ---
const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => sessionStorage.getItem('unihub_driver_session_v11'));
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => sessionStorage.getItem('unihub_admin_auth_v11') === 'true');
  const [isNewUser, setIsNewUser] = useState(() => !localStorage.getItem('unihub_seen_welcome_v11'));

  // Core state
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    adminMomo: '', adminMomoName: '', whatsappNumber: '', commissionPerSeat: 0,
    adminSecret: '', farePerPragia: 0, farePerTaxi: 0, soloMultiplier: 1,
    aboutMeText: '', aboutMeImages: []
  });

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);
  
  // --- INITIAL LOAD & REALTIME SUBSCRIPTIONS ---
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

    // Realtime subscriptions
    const subs: any[] = [];

    subs.push(
      supabase.from('drivers').on('*', payload => {
        setDrivers(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(d => d.id !== payload.old.id);
          const idx = prev.findIndex(d => d.id === payload.new.id);
          if (idx >= 0) prev[idx] = payload.new; else prev.push(payload.new);
          return [...prev];
        });
      }).subscribe()
    );

    subs.push(
      supabase.from('nodes').on('*', payload => {
        setNodes(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(n => n.id !== payload.old.id);
          const idx = prev.findIndex(n => n.id === payload.new.id);
          if (idx >= 0) prev[idx] = payload.new; else prev.push(payload.new);
          return [...prev];
        });
      }).subscribe()
    );

    subs.push(
      supabase.from('transactions').on('INSERT', payload => setTransactions(prev => [...prev, payload.new])).subscribe()
    );

    subs.push(
      supabase.from('topup_requests').on('*', payload => {
        setTopupRequests(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(r => r.id !== payload.old.id);
          const idx = prev.findIndex(r => r.id === payload.new.id);
          if (idx >= 0) prev[idx] = payload.new; else prev.push(payload.new);
          return [...prev];
        });
      }).subscribe()
    );

    subs.push(
      supabase.from('settings:id=singleton').on('UPDATE', payload => setSettings(payload.new)).subscribe()
    );

    return () => subs.forEach(s => supabase.removeSubscription(s));
  }, []);

  // --- EXAMPLE ACTIONS USING SUPABASE ---
  const acceptRide = async (nodeId: string, driverId: string, customFare?: number) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver || driver.walletBalance < settings.commissionPerSeat) { alert("Insufficient Balance!"); return; }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    await supabase.from('nodes').update({
      status: 'dispatched',
      assignedDriverId: driverId,
      verificationCode,
      negotiatedTotalFare: customFare || null
    }).eq('id', nodeId);

    await supabase.from('drivers').update({
      walletBalance: driver.walletBalance - settings.commissionPerSeat
    }).eq('id', driverId);

    await supabase.from('transactions').insert([{
      driverId,
      amount: settings.commissionPerSeat,
      type: 'commission',
      timestamp: new Date().toISOString()
    }]);

    alert(customFare ? `Negotiated trip accepted at ₵${customFare}!` : "Job accepted!");
  };

  const joinNode = async (nodeId: string, name: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (node.passengers.length >= node.capacityNeeded) return;

    const newPassengers = [...node.passengers, { id: `P-${Date.now()}`, name, phone }];
    const newStatus = newPassengers.length >= node.capacityNeeded ? 'qualified' : 'forming';

    await supabase.from('nodes').update({
      passengers: newPassengers,
      status: newStatus
    }).eq('id', nodeId);
  };

  const requestTopup = async (driverId: string, amount: number, ref: string) => {
    await supabase.from('topup_requests').insert([{
      driverId,
      amount,
      momoReference: ref,
      status: 'pending',
      timestamp: new Date().toISOString()
    }]);
    alert("Topup request sent!");
  };

  // --- UI-only state persists locally ---
  const dismissWelcome = () => { setIsNewUser(false); localStorage.setItem('unihub_seen_welcome_v11', 'true'); };

  return <div>{/* Your UI JSX here */}</div>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
