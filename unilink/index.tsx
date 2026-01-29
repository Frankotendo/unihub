// src/index.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../index.css'; // <-- ensures index.css is bundled (adjust path if needed)

const root = createRoot(document.getElementById('root'));
root.render(<App />);

/**
 * Supabase client setup
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Types (in-file)
 */
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed' | 'cancelled';

type Passenger = {
  id: string;
  name: string;
  phone: string;
};

type RideNode = {
  id: string;
  origin?: string;
  destination?: string;
  capacityneeded: number;
  passengers?: Passenger[] | null;
  status: NodeStatus;
  leadername?: string;
  leaderphone?: string;
  fareperperson?: number | null;
  createdat?: string | null;
  assigneddriverid?: string | null;
  verificationcode?: string | null;
  issolo?: boolean;
  islongdistance?: boolean;
  negotiatedtotalfare?: number | null;
};

type Driver = {
  id: string;
  name: string;
  vehicle_type?: string;
  license_plate?: string;
  contact?: string;
  walletBalance?: number;
  walletbalance?: number;
  rating?: number;
  status?: string;
  pin?: string;
};

type Transaction = {
  id: string;
  driverId?: string;
  driverid?: string;
  amount: number;
  type: string;
  timestamp: string;
};

type TopupRequest = {
  id: string;
  driverId?: string;
  driverid?: string;
  amount: number;
  momoReference?: string;
  momoreference?: string;
  status: string;
  timestamp: string;
};

type AppSettings = {
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
};

/**
 * Utility helpers
 */
const uid = (prefix = '') => `${prefix}${Date.now()}`;

/**
 * Main App
 */
function App() {
  const [viewMode, setViewMode] = useState<'admin' | 'driver' | 'public'>('admin');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('unihub_admin_auth_v11') === 'true';
  });
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => {
    return sessionStorage.getItem('unihub_driver_session_v11');
  });

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);

  const [globalSearch, setGlobalSearch] = useState('');

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  // Load initial data and subscribe to realtime
  useEffect(() => {
    let mounted = true;

    const loadInitial = async () => {
      try {
        // settings
        const { data: sData } = await supabase.from('settings').select('*').limit(1).single();
        if (mounted && sData) {
          const mapped: AppSettings = {
            adminMomo: (sData.admin_momo ?? sData.adminMomo) || '024-123-4567',
            adminMomoName: (sData.admin_momo_name ?? sData.adminMomoName) || 'UniHub Admin',
            whatsappNumber: (sData.whatsapp_number ?? sData.whatsappNumber) || '233241234567',
            commissionPerSeat: Number(sData.commission_rate ?? sData.commissionRate ?? 2.0),
            adminSecret: (sData.admin_secret ?? sData.adminSecret) || '2025',
            farePerPragia: Number(sData.fare_per_pragia ?? sData.farePerPragia ?? 5.0),
            farePerTaxi: Number(sData.fare_per_taxi ?? sData.farePerTaxi ?? 8.0),
            soloMultiplier: Number(sData.solo_multiplier ?? sData.soloMultiplier ?? 2.5),
            aboutMeText: (sData.about_me_text ?? sData.aboutMeText) || 'Welcome to UniHub Dispatch.',
            aboutMeImages: sData.about_me_images ?? sData.aboutMeImages ?? []
          };
          setSettings(mapped);
        }

        const [nodesRes, driversRes, txRes, topupsRes] = await Promise.all([
          supabase.from('nodes').select('*').order('createdat', { ascending: false }),
          supabase.from('drivers').select('*').order('name', { ascending: true }),
          supabase.from('transactions').select('*').order('timestamp', { ascending: false }),
          supabase.from('topup_requests').select('*').order('timestamp', { ascending: false }),
        ]);

        if (!mounted) return;
        if (nodesRes.data) setNodes(nodesRes.data as RideNode[]);
        if (driversRes.data) setDrivers(driversRes.data as Driver[]);
        if (txRes.data) setTransactions(txRes.data as Transaction[]);
        if (topupsRes.data) setTopupRequests(topupsRes.data as TopupRequest[]);
      } catch (e) {
        console.error('Initial load error', e);
      }
    };

    loadInitial();

    // Subscribe to realtime changes for nodes, drivers, transactions, topup_requests
    // Note: using the new channel API for broadcasting postgres_changes
    const nodesChannel = supabase.channel('public:nodes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, (payload) => {
        const ev = payload.eventType;
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        setNodes(prev => {
          if (ev === 'INSERT') return [newRow, ...prev];
          if (ev === 'UPDATE') return prev.map(n => (n.id === newRow.id ? { ...n, ...newRow } : n));
          if (ev === 'DELETE') return prev.filter(n => n.id !== oldRow.id);
          return prev;
        });
      })
      .subscribe();

    const driversChannel = supabase.channel('public:drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload) => {
        const ev = payload.eventType;
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        setDrivers(prev => {
          if (ev === 'INSERT') return [newRow, ...prev];
          if (ev === 'UPDATE') return prev.map(d => (d.id === newRow.id ? { ...d, ...newRow } : d));
          if (ev === 'DELETE') return prev.filter(d => d.id !== oldRow.id);
          return prev;
        });
      })
      .subscribe();

    const txChannel = supabase.channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        const ev = payload.eventType;
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        setTransactions(prev => {
          if (ev === 'INSERT') return [newRow, ...prev];
          if (ev === 'UPDATE') return prev.map(t => (t.id === newRow.id ? { ...t, ...newRow } : t));
          if (ev === 'DELETE') return prev.filter(t => t.id !== oldRow.id);
          return prev;
        });
      })
      .subscribe();

    const topupChannel = supabase.channel('public:topup_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'topup_requests' }, (payload) => {
        const ev = payload.eventType;
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        setTopupRequests(prev => {
          if (ev === 'INSERT') return [newRow, ...prev];
          if (ev === 'UPDATE') return prev.map(r => (r.id === newRow.id ? { ...r, ...newRow } : r));
          if (ev === 'DELETE') return prev.filter(r => r.id !== oldRow.id);
          return prev;
        });
      })
      .subscribe();

    return () => {
      // cleanup
      supabase.removeChannel(nodesChannel);
      supabase.removeChannel(driversChannel);
      supabase.removeChannel(txChannel);
      supabase.removeChannel(topupChannel);
      mounted = false;
    };
  }, []);

  /**
   * Actions
   */

  const joinNode = useCallback(async (nodeId: string, name: string, phone: string) => {
    try {
      const { data: node, error: fetchErr } = await supabase.from('nodes').select('*').eq('id', nodeId).single();
      if (fetchErr || !node) { alert('Node not found'); return; }

      const passengers = Array.isArray(node.passengers) ? [...node.passengers] : (node.passengers ? node.passengers : []);
      if (passengers.length >= node.capacityneeded) { alert('No seats left'); return; }

      passengers.push({ id: uid('P-'), name, phone });
      const isQualified = passengers.length >= node.capacityneeded;

      const { data: updated, error: updErr } = await supabase
        .from('nodes')
        .update({ passengers, status: isQualified ? 'qualified' : 'forming' })
        .eq('id', nodeId)
        .select()
        .single();

      if (updErr) { console.error(updErr); alert('Failed to join'); return; }
      setNodes(prev => prev.map(n => n.id === nodeId ? (updated as RideNode) : n));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const forceQualify = useCallback(async (nodeId: string) => {
    const { data, error } = await supabase.from('nodes').update({ status: 'qualified' }).eq('id', nodeId).select().single();
    if (!error && data) setNodes(prev => prev.map(n => n.id === nodeId ? (data as RideNode) : n));
  }, []);

  const acceptRide = useCallback(async (nodeId: string, driverId: string, customFare?: number) => {
    try {
      const { data: drv, error: drvErr } = await supabase.from('drivers').select('*').eq('id', driverId).single();
      if (drvErr || !drv) { alert('Driver not found'); return; }
      const currentWallet = Number(drv.walletbalance ?? drv.walletBalance ?? 0);
      const commission = Number(settings?.commissionPerSeat ?? 0);
      if (currentWallet < commission) { alert('Insufficient Balance! Top up first.'); return; }

      const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

      const txRecord = {
        id: uid('TX-'),
        driverid: driverId,
        amount: commission,
        type: 'commission',
        timestamp: new Date().toISOString()
      };

      const [nodeRes, driverRes, transRes] = await Promise.all([
        supabase.from('nodes').update({
          status: 'dispatched',
          assigneddriverid: driverId,
          verificationcode: verificationCode,
          negotiatedtotalfare: customFare ?? null
        }).eq('id', nodeId).select().single(),
        supabase.from('drivers').update({ walletbalance: currentWallet - commission }).eq('id', driverId).select().single(),
        supabase.from('transactions').insert(txRecord)
      ]);

      if ((nodeRes as any).error) { console.error((nodeRes as any).error); alert('Failed to accept job'); return; }
      const updatedNode = (nodeRes as any).data ?? (nodeRes as any);
      setNodes(prev => prev.map(n => n.id === nodeId ? (updatedNode as RideNode) : n));
      if (!(driverRes as any).error && (driverRes as any).data) setDrivers(prev => prev.map(d => d.id === driverId ? ((driverRes as any).data as Driver) : d));
      setTransactions(prev => [txRecord as Transaction, ...prev]);

      alert(customFare ? `Negotiated trip accepted at ₵${customFare}!` : 'Job accepted!');
    } catch (e) {
      console.error(e);
    }
  }, [settings]);

  const verifyRide = useCallback(async (nodeId: string, code: string) => {
    try {
      const { data: node, error } = await supabase.from('nodes').select('*').eq('id', nodeId).single();
      if (error || !node) return alert('Node not found');
      if (node.verificationcode === code) {
        const { data: updated, error: updErr } = await supabase.from('nodes').update({ status: 'completed' }).eq('id', nodeId).select().single();
        if (updErr) { console.error(updErr); alert('Failed to verify'); return; }
        setNodes(prev => prev.map(n => n.id === nodeId ? (updated as RideNode) : n));
        alert('Verification successful!');
      } else {
        alert('Wrong code! Ask the passenger for their code.');
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const requestTopup = useCallback(async (driverId: string, amount: number, ref: string) => {
    if (!amount || !ref) { alert('Details missing.'); return; }
    const req = {
      id: uid('REQ-'),
      driverid: driverId,
      amount: Number(amount),
      momoreference: ref,
      status: 'pending',
      timestamp: new Date().toISOString()
    };
    const { error } = await supabase.from('topup_requests').insert(req);
    if (error) { console.error(error); alert('Failed to log request'); return; }
    setTopupRequests(prev => [req as TopupRequest, ...prev]);
    alert('Request logged.');
  }, []);

  const approveTopup = useCallback(async (reqId: string) => {
    try {
      const { data: req } = await supabase.from('topup_requests').select('*').eq('id', reqId).single();
      if (!req || req.status !== 'pending') return;

      const { data: driver } = await supabase.from('drivers').select('*').eq('id', req.driverid).single();
      if (!driver) return;

      const newWallet = Number(driver.walletbalance ?? driver.walletBalance ?? 0) + Number(req.amount);

      await Promise.all([
        supabase.from('drivers').update({ walletbalance: newWallet }).eq('id', req.driverid),
        supabase.from('topup_requests').update({ status: 'approved' }).eq('id', reqId),
        supabase.from('transactions').insert({
          id: uid('TX-'),
          driverid: req.driverid,
          amount: req.amount,
          type: 'topup',
          timestamp: new Date().toISOString()
        })
      ]);

      setDrivers(prev => prev.map(d => d.id === req.driverid ? { ...d, walletBalance: newWallet } : d));
      setTopupRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'approved' } : r));
      setTransactions(prev => [{
        id: uid('TX-'),
        driverId: req.driverid,
        amount: req.amount,
        type: 'topup',
        timestamp: new Date().toISOString()
      }, ...prev]);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const registerDriver = useCallback(async (d: { name: string; vehicle_type?: string; license_plate?: string; contact?: string; pin?: string; }) => {
    try {
      const newDriver: any = {
        id: uid('DRV-'),
        name: d.name,
        vehicle_type: d.vehicle_type,
        license_plate: d.license_plate,
        contact: d.contact,
        walletbalance: 0,
        rating: 5.0,
        status: 'online',
        pin: d.pin
      };
      const { data, error } = await supabase.from('drivers').insert(newDriver).select().single();
      if (error) { console.error(error); alert('Failed to register driver'); return; }
      setDrivers(prev => [data, ...prev]);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const deleteDriver = useCallback(async (id: string) => {
    const hasActiveMission = nodes.some(n => n.assigneddriverid === id && (n.status === 'qualified' || n.status === 'dispatched'));
    if (hasActiveMission) {
      alert("Cannot unregister driver with an active mission. Finish or cancel current rides first.");
      return;
    }

    try {
      const { error } = await supabase.from('drivers').delete().eq('id', id);
      if (error) { console.error(error); alert('Failed to remove driver'); return; }
      setDrivers(prev => prev.filter(d => d.id !== id));
      if (activeDriverId === id) {
        setActiveDriverId(null);
        sessionStorage.removeItem('unihub_driver_session_v11');
      }
    } catch (e) {
      console.error(e);
    }
  }, [nodes, activeDriverId]);

  const handleDriverAuth = useCallback((driverId: string, pin: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver && (driver.pin === pin || (driver as any).pin === pin)) {
      setActiveDriverId(driverId);
      sessionStorage.setItem('unihub_driver_session_v11', driverId);
      setViewMode('driver');
    } else {
      alert("Access Denied: Invalid Driver PIN");
    }
  }, [drivers]);

  const handleDriverLogout = useCallback(() => {
    setActiveDriverId(null);
    sessionStorage.removeItem('unihub_driver_session_v11');
    setViewMode('public');
  }, []);

  const hubRevenue = useMemo(() => transactions.filter(t => t.type === 'commission').reduce((a, b) => a + Number(b.amount), 0), [transactions]);
  const pendingRequestsCount = useMemo(() => topupRequests.filter(r => r.status === 'pending').length, [topupRequests]);

  /**
   * Simple UI
   */
  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <h1>UniHub Dispatch — Single File Demo</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setViewMode('admin')}>Admin</button>{' '}
        <button onClick={() => setViewMode('driver')}>Driver</button>{' '}
        <button onClick={() => setViewMode('public')}>Public</button>
        <span style={{ marginLeft: 12 }}>Mode: <strong>{viewMode}</strong></span>
      </div>

      <section style={{ marginBottom: 18 }}>
        <h2>Overview</h2>
        <div>Drivers: {drivers.length} • Nodes: {nodes.length} • Pending Topups: {pendingRequestsCount} • Hub revenue: ₵{hubRevenue}</div>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2>Settings</h2>
        {settings ? <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(settings, null, 2)}</pre> : <div>Loading settings...</div>}
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2>Quick Actions</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={async () => {
            const name = prompt('Passenger name?') || 'Passenger';
            const phone = prompt('Phone?') || 'N/A';
            const nodeId = prompt('Node id to join?');
            if (nodeId) await joinNode(nodeId, name, phone);
          }}>Join Node</button>

          <button onClick={async () => {
            const nodeId = prompt('Node id to force qualify?');
            if (nodeId) await forceQualify(nodeId);
          }}>Force Qualify</button>

          <button onClick={async () => {
            const nodeId = prompt('Node id to accept?');
            const driverId = prompt('Driver id?');
            const fareRaw = prompt('Custom fare (optional)?');
            const fare = fareRaw ? Number(fareRaw) : undefined;
            if (nodeId && driverId) await acceptRide(nodeId, driverId, fare);
          }}>Accept Ride</button>

          <button onClick={async () => {
            const nodeId = prompt('Node id to verify?');
            const code = prompt('Verification code?');
            if (nodeId && code) await verifyRide(nodeId, code);
          }}>Verify Ride</button>

          <button onClick={async () => {
            const name = prompt('Driver name?') || 'New Driver';
            const vehicle = prompt('Vehicle type?') || '';
            const plate = prompt('License plate?') || '';
            const contact = prompt('Contact?') || '';
            const pin = prompt('PIN?') || '';
            await registerDriver({ name, vehicle_type: vehicle, license_plate: plate, contact, pin });
          }}>Register Driver</button>
        </div>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2>Drivers</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 8 }}>
          {drivers.map(d => (
            <div key={d.id} style={{ border: '1px solid #ddd', padding: 8 }}>
              <div><strong>{d.name}</strong></div>
              <div>{d.vehicle_type} • {d.license_plate}</div>
              <div>Wallet: ₵{Number(d.walletbalance ?? d.walletBalance ?? 0)}</div>
              <div>Status: {d.status}</div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => {
                  const pin = prompt('Enter PIN to impersonate driver:') || '';
                  if (pin) handleDriverAuth(d.id, pin);
                }}>Login as Driver</button>{' '}
                <button onClick={() => deleteDriver(d.id)}>Unregister</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2>Nodes (Latest)</h2>
        {nodes.length === 0 && <div>No nodes yet</div>}
        {nodes.slice(0, 20).map(n => (
          <div key={n.id} style={{ border: '1px solid #eee', padding: 10, marginBottom: 8 }}>
            <div><strong>{n.origin} → {n.destination}</strong></div>
            <div>Needed: {n.capacityneeded} • Passengers: {Array.isArray(n.passengers) ? n.passengers.length : 0}</div>
            <div>Status: {n.status}</div>
            <div>Leader: {n.leadername} • {n.leaderphone}</div>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => {
                const name = prompt('Passenger name?') || 'Passenger';
                const phone = prompt('Phone?') || 'N/A';
                joinNode(n.id, name, phone);
              }}>Join</button>{' '}
              <button onClick={() => {
                const driverId = prompt('Driver id to accept?');
                if (driverId) acceptRide(n.id, driverId);
              }}>Accept</button>{' '}
              <button onClick={() => {
                const code = prompt('Enter verification code');
                if (code) verifyRide(n.id, code);
              }}>Verify</button>
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2>Topup Requests</h2>
        {topupRequests.length === 0 && <div>No requests</div>}
        {topupRequests.slice(0, 10).map(r => (
          <div key={r.id} style={{ border: '1px solid #eee', padding: 8, marginBottom: 6 }}>
            <div>Driver: {r.driverid} • Amount: ₵{r.amount} • Status: {r.status}</div>
            <div>
              {r.status === 'pending' && <button onClick={() => approveTopup(r.id)}>Approve</button>}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2>Transactions (latest)</h2>
        {transactions.slice(0, 10).map(t => (
          <div key={t.id} style={{ borderBottom: '1px dashed #ddd', padding: 6 }}>
            <div>{t.type} • ₵{t.amount} • {t.driverid ?? t.driverId}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{new Date(t.timestamp).toLocaleString()}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

/**
 * Render
 */
const root = document.getElementById('root') ?? document.getElementById('app');
if (!root) {
  const el = document.createElement('div');
  el.id = 'root';
  document.body.appendChild(el);
}
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

export default App;
