
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// --- INITIALIZATION ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Using process.env instead of import.meta.env to resolve TypeScript errors and ensure environment compatibility.
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || "").trim();

const isValidUrl = (url: string) => {
  try {
    return url && typeof url === 'string' && url.startsWith('http');
  } catch {
    return false;
  }
};

const supabase = (isValidUrl(SUPABASE_URL) && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

// --- TYPES & INTERFACES ---
type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed';
type PortalMode = 'passenger' | 'driver' | 'admin';

interface Passenger { id: string; name: string; phone: string; }

interface RideNode {
  id: string; destination: string; origin: string; capacityNeeded: number;
  passengers: Passenger[]; status: NodeStatus; leaderName: string; leaderPhone: string;
  farePerPerson: number; createdAt: string; assignedDriverId?: string;
  verificationCode?: string; isSolo?: boolean; isLongDistance?: boolean;
  negotiatedTotalFare?: number;
}

interface Driver {
  id: string; name: string; vehicleType: VehicleType; licensePlate: string;
  contact: string; walletBalance: number; rating: number; status: 'online' | 'busy' | 'offline';
  pin: string;
}

interface TopupRequest {
  id: string; driverId: string; amount: number; momoReference: string;
  status: 'pending' | 'approved' | 'rejected'; timestamp: string;
}

interface Transaction {
  id: string; driverId: string; amount: number; type: 'commission' | 'topup';
  timestamp: string;
}

interface AppSettings {
  adminMomo: string; adminMomoName: string; whatsappNumber: string;
  commissionPerSeat: number; adminSecret: string; farePerPragia: number;
  farePerTaxi: number; soloMultiplier: number; aboutMeText: string;
  aboutMeImages: string[];
}

// --- UTILS ---
const shareNode = async (node: RideNode) => {
  const seatsLeft = node.capacityNeeded - node.passengers.length;
  const message = node.isLongDistance 
    ? `🚀 *UniHub Long Distance!* \n📍 *From:* ${node.origin}\n📍 *To:* ${node.destination}\n🚕 *Bids open for Drivers!*`
    : node.isSolo 
    ? `🚀 *UniHub Dropping!* \n📍 *Route:* ${node.origin} → ${node.destination}\n🚕 *Solo Request* needs a driver!`
    : `🚀 *Ride Hub Alert!*\n📍 *Route:* ${node.origin} → ${node.destination}\n👥 *Seats Left:* ${seatsLeft}\n💰 *Price:* ₵${node.farePerPerson}/p\n\nJoin my ride node on UniHub! 👇\n${window.location.origin}`;

  try {
    if (navigator.share) {
      await navigator.share({ title: 'UniHub Ride Update', text: message, url: window.location.origin });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  } catch (err) { console.log('Node share failed', err); }
};

const shareHub = async () => {
  const shareData = {
    title: 'UniHub Dispatch',
    text: 'Join the smartest ride-sharing hub on campus!',
    url: window.location.origin,
  };
  try {
    if (navigator.share) await navigator.share(shareData);
    else window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`, '_blank');
  } catch (err) { console.log('Share failed', err); }
};

// --- APP COMPONENT ---
const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'requests' | 'settings'>('monitor');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => sessionStorage.getItem('unihub_admin_auth_v11') === 'true');
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => sessionStorage.getItem('unihub_driver_session_v11'));
  
  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isNewUser, setIsNewUser] = useState(() => !localStorage.getItem('unihub_seen_welcome_v11'));

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  // --- SUPABASE DATA FETCHING ---
  const fetchAllData = useCallback(async () => {
    if (!supabase) return;
    try {
      const [
        { data: sData },
        { data: nData },
        { data: dData },
        { data: trData },
        { data: txData }
      ] = await Promise.all([
        supabase.from('settings').select('*').single(),
        supabase.from('nodes').select('*').order('created_at', { ascending: false }),
        supabase.from('drivers').select('*'),
        supabase.from('topup_requests').select('*').order('timestamp', { ascending: false }),
        supabase.from('transactions').select('*').order('timestamp', { ascending: false })
      ]);

      if (sData) setSettings({
        adminMomo: sData.admin_momo, adminMomoName: sData.admin_momo_name,
        whatsappNumber: sData.whatsapp_number, commissionPerSeat: sData.commission_per_seat,
        adminSecret: sData.admin_secret, farePerPragia: sData.fare_per_pragia,
        farePerTaxi: sData.fare_per_taxi, soloMultiplier: sData.solo_multiplier,
        aboutMeText: sData.about_me_text, aboutMeImages: sData.about_me_images || []
      });

      if (nData) setNodes(nData.map((db: any) => ({
        id: db.id, origin: db.origin, destination: db.destination,
        capacityNeeded: db.capacity_needed, passengers: db.passengers || [],
        status: db.status, leaderName: db.leader_name, leaderPhone: db.leader_phone,
        farePerPerson: db.fare_per_person, createdAt: db.created_at,
        assignedDriverId: db.assigned_driver_id, verification_code: db.verification_code,
        isSolo: db.is_solo, isLongDistance: db.is_long_distance,
        negotiatedTotalFare: db.negotiated_total_fare
      })));

      if (dData) setDrivers(dData.map((db: any) => ({
        id: db.id, name: db.name, vehicleType: db.vehicle_type,
        licensePlate: db.license_plate, contact: db.contact,
        walletBalance: db.wallet_balance, rating: db.rating,
        status: db.status, pin: db.pin
      })));

      if (trData) setTopupRequests(trData.map((db: any) => ({
        id: db.id, driverId: db.driver_id, amount: db.amount,
        momoReference: db.momo_reference, status: db.status,
        timestamp: db.timestamp
      })));

      if (txData) setTransactions(txData.map((db: any) => ({
        id: db.id, driverId: db.driver_id, amount: db.amount,
        type: db.type, timestamp: db.timestamp
      })));

    } catch (err) { console.error("Supabase Sync Error:", err); }
    finally { setIsInitializing(false); }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    fetchAllData();

    // REALTIME SUBSCRIPTIONS
    const channel = supabase.channel('hub_realtime_main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'topup_requests' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchAllData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAllData]);

  // --- ACTIONS ---
  const createNode = async (n: Partial<RideNode>) => {
    if (!supabase) return;
    const { error } = await supabase.from('nodes').insert([{
      origin: n.origin, destination: n.destination, capacity_needed: n.capacityNeeded,
      passengers: n.passengers, status: n.status, leader_name: n.leaderName,
      leader_phone: n.leaderPhone, fare_per_person: n.farePerPerson,
      is_solo: n.isSolo, is_long_distance: n.isLongDistance
    }]);
    if (error) alert(error.message);
  };

  const joinNode = async (nodeId: string, name: string, phone: string) => {
    if (!supabase) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.passengers.length >= node.capacityNeeded) return;
    const newPassengers = [...node.passengers, { id: `P-${Date.now()}`, name, phone }];
    const isFull = newPassengers.length >= node.capacityNeeded;
    await supabase.from('nodes').update({ passengers: newPassengers, status: isFull ? 'qualified' : 'forming' }).eq('id', nodeId);
  };

  const acceptRide = async (nodeId: string, driverId: string, customFare?: number) => {
    if (!supabase || !settings) return;
    const driver = drivers.find(d => d.id === driverId);
    if (!driver || driver.walletBalance < settings.commissionPerSeat) {
      alert("Insufficient Balance! Top up first.");
      return;
    }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    await Promise.all([
      supabase.from('nodes').update({ status: 'dispatched', assigned_driver_id: driverId, verification_code: code, negotiated_total_fare: customFare || null }).eq('id', nodeId),
      supabase.from('drivers').update({ wallet_balance: driver.walletBalance - settings.commissionPerSeat }).eq('id', driverId),
      supabase.from('transactions').insert([{ driver_id: driverId, amount: settings.commissionPerSeat, type: 'commission' }])
    ]);
  };

  const verifyRide = async (nodeId: string, code: string) => {
    if (!supabase) return;
    const node = nodes.find(n => n.id === nodeId);
    if (node?.verificationCode === code) await supabase.from('nodes').update({ status: 'completed' }).eq('id', nodeId);
    else alert("Invalid verification code.");
  };

  const requestTopup = async (driverId: string, amount: number, ref: string) => {
    if (!supabase) return;
    await supabase.from('topup_requests').insert([{ driver_id: driverId, amount: Number(amount), momo_reference: ref, status: 'pending' }]);
    alert("Request logged.");
  };

  const approveTopup = async (reqId: string) => {
    if (!supabase) return;
    const req = topupRequests.find(r => r.id === reqId);
    const driver = drivers.find(d => d.id === req?.driverId);
    if (req && driver) {
      await Promise.all([
        supabase.from('drivers').update({ wallet_balance: driver.walletBalance + req.amount }).eq('id', driver.id),
        supabase.from('topup_requests').update({ status: 'approved' }).eq('id', reqId),
        supabase.from('transactions').insert([{ driver_id: driver.id, amount: req.amount, type: 'topup' }])
      ]);
    }
  };

  const updateSettings = async (newS: AppSettings) => {
    if (!supabase) return;
    const { error } = await supabase.from('settings').update({
      admin_momo: newS.adminMomo, admin_momo_name: newS.adminMomoName, whatsapp_number: newS.whatsappNumber,
      commission_per_seat: newS.commissionPerSeat, admin_secret: newS.adminSecret, fare_per_pragia: newS.fare_per_pragia,
      fare_per_taxi: newS.fare_per_taxi, solo_multiplier: newS.solo_multiplier, about_me_text: newS.about_me_text,
      about_me_images: newS.about_me_images
    }).eq('id', 1);
    if (error) alert(error.message);
    else alert("Settings synced.");
  };

  const registerDriver = async (d: any) => {
    if (!supabase) return;
    await supabase.from('drivers').insert([{ ...d, wallet_balance: 0, rating: 5.0, status: 'online' }]);
  };

  const deleteDriver = async (id: string) => {
    if (!supabase) return;
    await supabase.from('drivers').delete().eq('id', id);
  };

  const hubRevenue = useMemo(() => transactions.filter(t => t.type === 'commission').reduce((a, b) => a + b.amount, 0), [transactions]);
  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  // --- RENDER HELPERS ---
  if (!supabase) return (
    <div className="h-screen w-full bg-[#020617] flex flex-col items-center justify-center p-8 text-center">
       <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mb-6"><i className="fas fa-plug-circle-exclamation text-2xl"></i></div>
       <h1 className="text-xl font-black text-white uppercase italic">Config Missing</h1>
       <div className="text-slate-500 text-xs mt-4 max-w-xs leading-relaxed space-y-4">
         <p>VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY are required for operations.</p>
         <div className="bg-white/5 p-4 rounded-xl text-left font-mono text-[10px] space-y-2">
            <p className={isValidUrl(SUPABASE_URL) ? 'text-emerald-500' : 'text-rose-500'}>{isValidUrl(SUPABASE_URL) ? '✓ URL detected' : '✗ URL missing'}</p>
            <p className={SUPABASE_ANON_KEY ? 'text-emerald-500' : 'text-rose-500'}>{SUPABASE_ANON_KEY ? '✓ Key detected' : '✗ Key missing'}</p>
         </div>
       </div>
    </div>
  );

  if (isInitializing || !settings) return (
    <div className="h-screen w-full bg-[#020617] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center"><i className="fas fa-route text-[#020617]"></i></div>
        <p className="text-amber-500 text-[9px] font-black uppercase tracking-[0.4em]">Syncing Hub...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans">
      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-xl"><i className="fas fa-route text-[#020617]"></i></div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic text-white">UniHub</h1>
          </div>
          <button onClick={() => setShowQrModal(true)} className="text-slate-500 hover:text-amber-500 transition-colors"><i className="fas fa-qrcode"></i></button>
        </div>
        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Passenger Hub" onClick={() => setViewMode('passenger')} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Driver Terminal" onClick={() => setViewMode('driver')} />
          <NavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin Command" onClick={() => setViewMode('admin')} badge={topupRequests.filter(r => r.status === 'pending').length || undefined} />
          <NavItem active={false} icon="fa-share-nodes" label="Invite Friends" onClick={shareHub} />
        </div>
        {activeDriver && (
          <div className="bg-indigo-500/10 p-6 rounded-[2rem] border border-indigo-500/20">
             <p className="text-[9px] font-black uppercase text-indigo-400 mb-1">Active Unit</p>
             <p className="text-lg font-black text-white truncate">{activeDriver.name}</p>
             <button onClick={() => { setActiveDriverId(null); sessionStorage.removeItem('unihub_driver_session_v11'); setViewMode('passenger'); }} className="mt-4 w-full py-2 bg-rose-600/20 text-rose-500 rounded-xl text-[8px] font-black uppercase">Logout</button>
          </div>
        )}
        <div className="bg-emerald-500/10 p-6 rounded-[2rem] border border-emerald-500/20">
          <p className="text-[9px] font-black uppercase text-emerald-400 mb-1">Hub Revenue</p>
          <p className="text-2xl font-black text-white">₵ {hubRevenue.toFixed(2)}</p>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          {viewMode === 'passenger' && <PassengerPortal nodes={nodes} onCreate={createNode} onJoin={joinNode} drivers={drivers} search={globalSearch} settings={settings} onShowQr={() => setShowQrModal(true)} setSearch={setGlobalSearch} />}
          {viewMode === 'driver' && (
            !activeDriver ? (
              <DriverLogin drivers={drivers} onLogin={(id, pin) => {
                const d = drivers.find(drv => drv.id === id);
                if (d && d.pin === pin) { setActiveDriverId(id); sessionStorage.setItem('unihub_driver_session_v11', id); setViewMode('driver'); }
                else alert("Invalid PIN");
              }} />
            ) : <DriverTerminal activeDriver={activeDriver} nodes={nodes} onAccept={acceptRide} onVerify={verifyRide} onRequestTopup={requestTopup} settings={settings} />
          )}
          {viewMode === 'admin' && (
            !isAdminAuthenticated ? (
              <AdminLogin onLogin={(pass) => {
                if (pass === settings.adminSecret) { setIsAdminAuthenticated(true); sessionStorage.setItem('unihub_admin_auth_v11', 'true'); }
                else alert("Access Denied");
              }} />
            ) : <AdminPortal activeTab={activeTab} setActiveTab={setActiveTab} nodes={nodes} drivers={drivers} onAddDriver={registerDriver} onDeleteDriver={deleteDriver} transactions={transactions} topupRequests={topupRequests} onApproveTopup={approveTopup} onLock={() => {setIsAdminAuthenticated(false); sessionStorage.removeItem('unihub_admin_auth_v11');}} search={globalSearch} settings={settings} onUpdateSettings={updateSettings} hubRevenue={hubRevenue} />
          )}
        </div>
      </main>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/95 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Hub" onClick={() => setViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Drive" onClick={() => setViewMode('driver')} />
        <MobileNavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin" onClick={() => setViewMode('admin')} badge={topupRequests.filter(r => r.status === 'pending').length || undefined} />
        <MobileNavItem active={false} icon="fa-circle-question" label="Help" onClick={() => setShowHelpModal(true)} />
      </nav>

      {/* Modals */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-w-sm rounded-[3rem] p-10 space-y-8 animate-in zoom-in border border-white/10 text-center">
              <h3 className="text-xl font-black uppercase text-white">Hub QR Code</h3>
              <div className="bg-white p-4 rounded-[2rem] shadow-2xl">
                 <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}&bgcolor=ffffff&color=020617&format=svg`} className="w-full aspect-square" alt="Hub QR" />
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setShowQrModal(false)} className="flex-1 py-4 bg-white/5 rounded-2xl font-black text-[10px] uppercase text-slate-400">Close</button>
                 <button onClick={shareHub} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-2xl font-black text-[10px] uppercase shadow-xl">Share Link</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-xl' : 'text-slate-400 hover:bg-white/5'}`}>
    <div className="flex items-center gap-4">
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

const PassengerPortal = ({ nodes, onCreate, onJoin, search, settings, setSearch }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ origin: '', dest: '', name: '', phone: '', isSolo: false });
  const filtered = nodes.filter((n: any) => n.status !== 'completed' && (n.destination.toLowerCase().includes(search.toLowerCase()) || n.origin.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-10 animate-in fade-in">
       <div className="relative group">
          <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors"></i>
          <input type="text" placeholder="Search routes..." className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-700" value={search} onChange={(e) => setSearch(e.target.value)} />
       </div>
       <div className="flex justify-between items-end">
          <h2 className="text-2xl font-black italic uppercase text-white">Live Hub Feed</h2>
          <button onClick={() => setShowModal(true)} className="px-8 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">Form Ride</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((node: any) => (
            <div key={node.id} className={`glass rounded-[2.5rem] p-8 border transition-all ${node.status === 'dispatched' ? 'border-amber-500/30' : 'border-white/5'}`}>
               <div className="flex justify-between items-start mb-6">
                  <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest ${node.status === 'dispatched' ? 'bg-amber-500 text-[#020617]' : 'bg-white/5 text-slate-500'}`}>{node.status}</span>
                  <div className="flex gap-2">
                    <button onClick={() => shareNode(node)} className="text-slate-500 hover:text-amber-500"><i className="fas fa-share-nodes text-xs"></i></button>
                    <p className="text-lg font-black text-emerald-400">₵ {node.farePerPerson}/p</p>
                  </div>
               </div>
               <div className="space-y-4 mb-8">
                  <div className="pl-4 border-l-2 border-slate-700 font-bold text-white uppercase truncate">{node.origin}</div>
                  <div className="pl-4 border-l-2 border-amber-500 font-black text-white uppercase text-xl truncate">{node.destination}</div>
               </div>
               {node.status === 'forming' && <button onClick={() => { const n = prompt("Name:"); const p = prompt("WhatsApp:"); if (n && p) onJoin(node.id, n, p); }} className="w-full py-4 bg-white/5 rounded-2xl font-black uppercase text-[10px] text-white">Join ({node.passengers.length}/{node.capacityNeeded})</button>}
               {node.status === 'dispatched' && (
                 <div className="bg-amber-500 p-5 rounded-2xl text-center shadow-xl">
                    <p className="text-[10px] font-black uppercase text-[#020617] mb-1">Move Code</p>
                    <p className="text-4xl font-black italic text-[#020617] tracking-tighter">{node.verificationCode}</p>
                 </div>
               )}
            </div>
          ))}
       </div>
       {showModal && (
         <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
            <div className="glass-bright w-full max-w-lg rounded-[3rem] p-10 space-y-8 animate-in zoom-in text-slate-900">
               <h3 className="text-2xl font-black italic uppercase text-white text-center">New Mission</h3>
               <div className="space-y-4">
                  <input className="w-full bg-white border rounded-2xl py-5 px-6 font-bold" placeholder="Departure" onChange={e => setForm({...form, origin: e.target.value})} />
                  <input className="w-full bg-white border rounded-2xl py-5 px-6 font-bold" placeholder="Destination" onChange={e => setForm({...form, dest: e.target.value})} />
                  <input className="w-full bg-white border rounded-2xl py-5 px-6 font-bold" placeholder="Your Name" onChange={e => setForm({...form, name: e.target.value})} />
                  <input className="w-full bg-white border rounded-2xl py-5 px-6 font-bold" placeholder="WhatsApp" onChange={e => setForm({...form, phone: e.target.value})} />
               </div>
               <div className="flex gap-4">
                  <button onClick={() => setShowModal(false)} className="flex-1 py-5 bg-white/10 rounded-2xl font-black uppercase text-[10px] text-white">Cancel</button>
                  <button onClick={() => { onCreate({ origin: form.origin, destination: form.dest, leaderName: form.name, leaderPhone: form.phone, capacityNeeded: form.isSolo ? 1 : 4, farePerPerson: settings.farePerPragia, passengers: [{ id: 'LEADER', name: form.name, phone: form.phone }], status: form.isSolo ? 'qualified' : 'forming', isSolo: form.isSolo }); setShowModal(false); }} className="flex-1 py-5 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase text-[10px]">Launch Hub</button>
               </div>
            </div>
         </div>
       )}
    </div>
  );
};

const DriverLogin = ({ drivers, onLogin }: any) => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-10 animate-in fade-in">
    <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-500"><i className="fas fa-id-card-clip text-3xl"></i></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4">
      {drivers.map((d: any) => (
        <button key={d.id} onClick={() => { const pin = prompt(`PIN for ${d.name}`); if (pin) onLogin(d.id, pin); }} className="glass p-8 rounded-2xl text-left hover:border-amber-500 group transition-all">
           <p className="text-xl font-black text-white italic uppercase group-hover:text-amber-500">{d.name}</p>
           <p className="text-emerald-500 font-black text-[10px] mt-2 uppercase tracking-widest">₵{d.walletBalance.toFixed(2)} Balance</p>
        </button>
      ))}
    </div>
  </div>
);

const DriverTerminal = ({ activeDriver, nodes, onAccept, onVerify, onRequestTopup, settings }: any) => {
  const [code, setCode] = useState('');
  const available = nodes.filter((n:any) => n.status === 'qualified' || n.status === 'forming');
  const active = nodes.filter((n:any) => n.status === 'dispatched' && n.assignedDriverId === activeDriver.id);

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-8">
       <div className="bg-indigo-600/10 p-10 rounded-[3rem] border border-indigo-600/20 flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">{activeDriver.name}</h2>
            <p className="text-emerald-400 font-black text-[11px] mt-2 tracking-widest uppercase">Cloud Wallet: ₵{activeDriver.walletBalance.toFixed(2)}</p>
          </div>
          <button onClick={() => {
            const amt = prompt("Amount (₵):");
            if (amt) {
              const ref = prompt(`Pay ₵${amt} to ${settings.adminMomo} (${settings.adminMomoName}) and enter reference:`);
              if (ref) onRequestTopup(activeDriver.id, Number(amt), ref);
            }
          }} className="px-12 py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-[11px] uppercase shadow-xl hover:bg-emerald-500 transition-all">Top Up</button>
       </div>
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-6">
             <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Missions Available</h3>
             <div className="space-y-4">
               {available.map((n: any) => (
                  <div key={n.id} className="glass p-8 rounded-[2.5rem] border border-white/5 flex justify-between items-center transition-all hover:border-indigo-500/30">
                     <div>
                       <p className="font-black text-white uppercase italic text-lg">{n.origin} → {n.destination}</p>
                       <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">Load: {n.passengers.length}/{n.capacityNeeded}</p>
                     </div>
                     <button onClick={() => onAccept(n.id, activeDriver.id)} className={`px-10 py-5 rounded-2xl font-black uppercase text-[10px] transition-all ${n.status === 'qualified' ? 'bg-emerald-600 text-white shadow-xl' : 'bg-white/5 text-slate-400'}`}>
                       {n.status === 'qualified' ? 'Accept Now' : 'Join Node'}
                     </button>
                  </div>
               ))}
             </div>
          </div>
          <div className="lg:col-span-4 space-y-6">
             <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Live Mission</h3>
             {active.map((n: any) => (
                <div key={n.id} className="glass p-10 rounded-[3rem] border border-amber-500/20 text-center space-y-8 animate-in zoom-in shadow-2xl">
                   <p className="text-white font-black italic uppercase text-2xl">{n.origin} to {n.destination}</p>
                   <input className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-8 text-center text-5xl font-black text-white outline-none focus:border-amber-500" placeholder="0000" maxLength={4} onChange={e => setCode(e.target.value)} />
                   <button onClick={() => onVerify(n.id, code)} className="w-full py-6 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl">Verify Deliverable</button>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
};

// Renamed AdminPanel to AdminPortal to fix the "Cannot find name 'AdminPortal'" error and implemented the missing fleet management view.
const AdminPortal = ({ 
  activeTab, 
  setActiveTab, 
  topupRequests, 
  onApproveTopup, 
  onLock, 
  drivers, 
  nodes, 
  settings, 
  onUpdateSettings, 
  hubRevenue,
  onAddDriver,
  onDeleteDriver,
  transactions,
  search
}: any) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  return (
    <div className="space-y-10 animate-in zoom-in">
       <div className="flex bg-white/5 p-1.5 rounded-[2rem] border border-white/10 max-w-fit mx-auto shadow-inner">
          <button onClick={() => setActiveTab('monitor')} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'monitor' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500'}`}>Monitor</button>
          <button onClick={() => setActiveTab('fleet')} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'fleet' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500'}`}>Fleet</button>
          <button onClick={() => setActiveTab('requests')} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'requests' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500'}`}>Topups</button>
          <button onClick={() => setActiveTab('settings')} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500'}`}>System</button>
          <button onClick={onLock} className="px-10 py-4 text-rose-500 font-black text-[10px] uppercase">Lock</button>
       </div>

       {activeTab === 'monitor' && (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard label="Live Units" value={drivers.length} icon="fa-taxi" color="text-indigo-500" />
            <StatCard label="Forming Nodes" value={nodes.filter((n:any) => n.status === 'forming').length} icon="fa-users" color="text-amber-500" />
            <StatCard label="Ready Nodes" value={nodes.filter((n:any) => n.status === 'qualified').length} icon="fa-bolt" color="text-emerald-500" />
            <StatCard label="Revenue" value={hubRevenue.toFixed(0)} icon="fa-money-bill" color="text-slate-400" isCurrency />
         </div>
       )}

       {activeTab === 'fleet' && (
         <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-black italic uppercase text-white">Fleet Management</h3>
               <button onClick={() => {
                 const name = prompt("Driver Name:");
                 const plate = prompt("License Plate:");
                 const phone = prompt("Contact Number:");
                 const pin = prompt("PIN (4 digits):");
                 if (name && plate && phone && pin) {
                   onAddDriver({ name, license_plate: plate, contact: phone, pin, vehicle_type: 'Pragia' });
                 }
               }} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">Register Unit</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {drivers.map((d: any) => (
                  <div key={d.id} className="glass p-6 rounded-2xl border border-white/5 flex justify-between items-center group transition-all hover:border-indigo-500/30">
                     <div>
                        <p className="font-black text-white uppercase italic">{d.name}</p>
                        <p className="text-[9px] font-bold text-slate-500 mt-1">{d.licensePlate} • {d.contact}</p>
                        <p className="text-emerald-400 font-black text-[10px] mt-2">₵{d.walletBalance.toFixed(2)}</p>
                     </div>
                     <button onClick={() => confirm(`Decommission ${d.name}?`) && onDeleteDriver(d.id)} className="w-10 h-10 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white"><i className="fas fa-trash-can"></i></button>
                  </div>
               ))}
            </div>
         </div>
       )}

       {activeTab === 'requests' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {topupRequests.filter((r:any) => r.status === 'pending').map((req: any) => {
               const driver = drivers.find(d => d.id === req.driverId);
               return (
                  <div key={req.id} className="glass p-10 rounded-[3rem] border border-emerald-500/20 space-y-6">
                     <p className="text-[10px] font-black uppercase text-emerald-500">Top-Up Request</p>
                     <h4 className="text-3xl font-black text-white italic">₵{req.amount}</h4>
                     <p className="text-sm font-bold text-slate-400">{driver?.name || "Unknown Unit"}</p>
                     <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <p className="text-[9px] font-black uppercase text-slate-500 mb-1">MoMo Ref</p>
                        <p className="font-mono text-sm text-emerald-400 break-all">{req.momoReference}</p>
                     </div>
                     <button onClick={() => onApproveTopup(req.id)} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px]">Approve & Release</button>
                  </div>
               );
            })}
         </div>
       )}

       {activeTab === 'settings' && (
         <div className="glass rounded-[3rem] border border-white/10 p-12 max-w-4xl mx-auto space-y-10">
            <h3 className="text-xl font-black italic uppercase text-white">Command Config</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <ConfigField label="Admin MoMo" value={localSettings.adminMomo} onChange={v => setLocalSettings({...localSettings, adminMomo: v})} />
               <ConfigField label="Master Key" value={localSettings.adminSecret} type="password" onChange={v => setLocalSettings({...localSettings, adminSecret: v})} />
               <ConfigField label="Commission (₵)" value={localSettings.commissionPerSeat.toString()} type="number" onChange={v => setLocalSettings({...localSettings, commissionPerSeat: Number(v)})} />
               <ConfigField label="Pragia Fare (₵)" value={localSettings.farePerPragia.toString()} type="number" onChange={v => setLocalSettings({...localSettings, farePerPragia: Number(v)})} />
            </div>
            <button onClick={() => onUpdateSettings(localSettings)} className="w-full py-6 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase text-[11px] shadow-xl">Commit Globally</button>
         </div>
       )}
    </div>
  );
};

const StatCard = ({ label, value, icon, color, isCurrency }: any) => (
   <div className="glass p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
      <div className="relative z-10">
         <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</p>
         <p className={`text-4xl font-black italic ${color}`}>{isCurrency ? '₵' : ''}{value}</p>
      </div>
      <i className={`fas ${icon} absolute -bottom-4 -right-4 text-7xl opacity-[0.03] group-hover:rotate-12 transition-all`}></i>
   </div>
);

const ConfigField = ({ label, value, onChange, type = "text" }: any) => (
   <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-4">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-4 px-6 font-bold text-white outline-none focus:border-indigo-500 transition-all" />
   </div>
);

const AdminLogin = ({ onLogin }: any) => {
  const [p, setP] = useState('');
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 animate-in zoom-in">
       <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center text-amber-500 shadow-2xl"><i className="fas fa-lock text-3xl"></i></div>
       <input type="password" placeholder="••••" className="glass py-6 px-10 rounded-3xl text-center text-4xl font-black outline-none border border-white/10 w-64 focus:border-amber-500" onKeyDown={e => e.key === 'Enter' && onLogin(p)} value={p} onChange={e => setP(e.target.value)} />
    </div>
  );
};

// --- APP MOUNT ---
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
