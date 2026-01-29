import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const SUPABASE_URL = "https://vdbpwbjrwrpciehejdiu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkYnB3Ympyd3JwY2llaGVqZGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1ODAxMDEsImV4cCI6MjA4NTE1NjEwMX0.baeolIQRhljeRMP0GL5sXAC3bMEbivS5qAZ2SSham2M";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- TYPES ---
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
  capacity_needed: number;
  passengers: Passenger[];
  status: NodeStatus;
  leader_name: string;
  leader_phone: string;
  fare_per_person: number;
  created_at: string;
  assigned_driver_id?: string;
  verification_code?: string;
  is_solo?: boolean;
  is_long_distance?: boolean;
  negotiated_total_fare?: number;
}

interface Driver {
  id: string;
  name: string;
  vehicle_type: VehicleType;
  license_plate: string;
  contact: string;
  wallet_balance: number; 
  rating: number;
  status: 'online' | 'busy' | 'offline';
  pin: string; 
}

interface TopupRequest {
  id: string;
  driver_id: string;
  amount: number;
  momo_reference: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface Transaction {
  id: string;
  driver_id: string;
  amount: number;
  type: 'commission' | 'topup';
  created_at: string;
}

interface AppSettings {
  admin_momo: string;
  admin_momo_name: string;
  whatsapp_number: string;
  commission_per_seat: number;
  admin_secret: string;
  fare_per_pragia: number;
  fare_per_taxi: number;
  solo_multiplier: number;
  about_me_text: string;
  about_me_images: string[];
}

// --- UTILS ---
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

const shareNode = async (node: RideNode) => {
  const seatsLeft = (node.capacity_needed || 4) - (node.passengers?.length || 0);
  const message = `🚀 *Ride Hub Alert!*\n📍 *Route:* ${node.origin} → ${node.destination}\n👥 *Seats Left:* ${seatsLeft}\n💰 *Price:* ₵${node.fare_per_person}/p\n\nJoin my ride node on UniHub! 👇\n${window.location.origin}`;
  try {
    if (navigator.share) await navigator.share({ title: 'UniHub Ride Update', text: message, url: window.location.origin });
    else window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  } catch (err) { console.log('Node share failed', err); }
};

// --- MAIN APP ---
const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'requests' | 'settings'>('monitor');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => sessionStorage.getItem('unihub_admin_auth') === 'true');
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => sessionStorage.getItem('unihub_driver_session'));

  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isNewUser, setIsNewUser] = useState(() => !localStorage.getItem('unihub_seen_welcome'));

  // Database State
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const { data: s } = await supabase.from('settings').select('*').single();
      if (s) setSettings(s);
      const { data: n } = await supabase.from('ride_nodes').select('*').neq('status', 'completed').order('created_at', { ascending: false });
      if (n) setNodes(n);
      const { data: d } = await supabase.from('drivers').select('*').order('name');
      if (d) setDrivers(d);
      const { data: t } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(50);
      if (t) setTransactions(t);
      const { data: tr } = await supabase.from('topup_requests').select('*').order('created_at', { ascending: false });
      if (tr) setTopupRequests(tr);
    } catch (err) { console.error("Fetch failed", err); }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('hub-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  const joinNode = async (nodeId: string, name: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || (node.passengers?.length || 0) >= (node.capacity_needed || 4)) return;
    const newPassengers = [...(node.passengers || []), { id: `P-${Date.now()}`, name, phone }];
    await supabase.from('ride_nodes').update({
      passengers: newPassengers,
      status: newPassengers.length >= (node.capacity_needed || 4) ? 'qualified' : 'forming'
    }).eq('id', nodeId);
  };

  const acceptRide = async (nodeId: string, driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver || !settings || Number(driver.wallet_balance) < Number(settings.commission_per_seat)) {
      alert("Insufficient Wallet Balance!");
      return;
    }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    await supabase.from('ride_nodes').update({ 
      status: 'dispatched', 
      assigned_driver_id: driverId, 
      verification_code: code 
    }).eq('id', nodeId);
    await supabase.from('drivers').update({ wallet_balance: Number(driver.wallet_balance) - Number(settings.commission_per_seat) }).eq('id', driverId);
    await supabase.from('transactions').insert([{ driver_id: driverId, amount: settings.commission_per_seat, type: 'commission' }]);
  };

  const verifyRide = async (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.verification_code === code) {
      await supabase.from('ride_nodes').update({ status: 'completed' }).eq('id', nodeId);
      alert("Mission Verified!");
    } else alert("Invalid Code!");
  };

  const hubRevenue = useMemo(() => transactions.filter(t => t.type === 'commission').reduce((a, b) => a + Number(b.amount), 0), [transactions]);

  if (!settings) return <div className="h-screen bg-[#020617] flex items-center justify-center text-amber-500 font-black tracking-widest animate-pulse italic uppercase">Syncing Hub...</div>;

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100">
      
      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/10">
            <i className="fas fa-route text-[#020617] text-xl"></i>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">UniHub</h1>
        </div>
        <div className="flex-1 space-y-2">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Passenger Hub" onClick={() => setViewMode('passenger')} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Driver Terminal" onClick={() => setViewMode('driver')} />
          <NavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin Command" onClick={() => setViewMode('admin')} badge={topupRequests.filter(r => r.status === 'pending').length || undefined} />
        </div>
        <div className="pt-6 border-t border-white/5 space-y-4">
           {activeDriver && (
             <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20">
                <p className="text-[8px] font-black uppercase text-indigo-400">Driver Shift</p>
                <p className="text-sm font-black truncate">{activeDriver.name}</p>
                <button onClick={() => {setActiveDriverId(null); setViewMode('passenger');}} className="text-[8px] font-black uppercase text-rose-500 mt-2">End Shift</button>
             </div>
           )}
           <div className="bg-emerald-500/10 p-6 rounded-[2.5rem] border border-emerald-500/20">
              <p className="text-[9px] font-black uppercase text-emerald-400 mb-1">Hub Revenue</p>
              <p className="text-3xl font-black">₵ {hubRevenue.toFixed(2)}</p>
           </div>
        </div>
      </nav>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 glass border-t border-white/5 z-[100] flex items-center justify-around">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Hub" onClick={() => setViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Drive" onClick={() => setViewMode('driver')} />
        <MobileNavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin" onClick={() => setViewMode('admin')} badge={topupRequests.filter(r => r.status === 'pending').length || undefined} />
        <MobileNavItem active={false} icon="fa-circle-question" label="Help" onClick={() => setShowHelpModal(true)} />
      </nav>

      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <div className="relative flex-1 max-w-lg">
               <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
               <input type="text" placeholder="Search routes..." className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-4 pl-14 pr-6 font-bold outline-none focus:border-amber-500 transition-all" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} />
            </div>
            <div className="hidden lg:flex gap-2">
               <button onClick={() => setShowQrModal(true)} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-amber-500 hover:bg-white/10"><i className="fas fa-qrcode"></i></button>
               <button onClick={() => setShowHelpModal(true)} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-indigo-400 hover:bg-white/10"><i className="fas fa-circle-question"></i></button>
            </div>
          </div>

          {viewMode === 'passenger' && <PassengerPortal nodes={nodes} onJoin={joinNode} search={globalSearch} settings={settings} />}
          {viewMode === 'driver' && <DriverPortal drivers={drivers} activeDriver={activeDriver} onLogin={(id, pin) => {
            const d = drivers.find(dr => dr.id === id);
            if (d && d.pin === pin) { setActiveDriverId(id); sessionStorage.setItem('unihub_driver_session', id); }
            else alert("Bad PIN");
          }} onLogout={() => {setActiveDriverId(null); setViewMode('passenger');}} qualifiedNodes={nodes.filter(n => n.status === 'qualified')} dispatchedNodes={nodes.filter(n => n.status === 'dispatched')} onAccept={acceptRide} onVerify={verifyRide} settings={settings} />}
          {viewMode === 'admin' && (!isAdminAuthenticated ? <AdminLogin onLogin={k => {if(k===settings.admin_secret){setIsAdminAuthenticated(true);sessionStorage.setItem('unihub_admin_auth','true');}}} /> : <AdminPortal activeTab={activeTab} setActiveTab={setActiveTab} drivers={drivers} topupRequests={topupRequests} settings={settings} hubRevenue={hubRevenue} nodes={nodes} onApprove={async id => {
            const { error } = await supabase.rpc('approve_topup', { request_id: id, admin_key: settings.admin_secret });
            if (error) alert(error.message); else alert("Approved!");
          }} onLock={() => {setIsAdminAuthenticated(false); sessionStorage.removeItem('unihub_admin_auth');}} />)}
        </div>
      </main>

      {/* Modal Layers */}
      {showQrModal && <QrModal onClose={() => setShowQrModal(false)} />}
      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
    </div>
  );
};

// --- SUB-COMPONENTS ---

const PassengerPortal = ({ nodes, onJoin, search, settings }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ origin: '', destination: '', leader: '', phone: '', type: 'Pragia' });
  const filtered = nodes.filter((n:any) => n.destination.toLowerCase().includes(search.toLowerCase()) || n.origin.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in">
       <div className="flex justify-between items-end">
          <div className="text-left">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase">Passenger Hub</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase">Live Node Network</p>
          </div>
          <button onClick={() => setShowModal(true)} className="px-10 py-4 bg-amber-500 text-black rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-transform">Form Ride</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((node: any) => (
            <div key={node.id} className="glass p-8 rounded-[2.5rem] border border-white/5 space-y-6 text-left">
               <div className="flex justify-between items-start">
                  <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase ${node.status === 'dispatched' ? 'bg-amber-500 text-black' : 'bg-white/5 text-slate-400'}`}>{node.status}</span>
                  <p className="text-lg font-black text-emerald-400">₵ {node.fare_per_person}</p>
               </div>
               <div className="space-y-2">
                  <p className="text-white font-black text-xl italic uppercase truncate leading-none">{node.origin} → {node.destination}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Lead: {node.leader_name}</p>
               </div>
               <div className="flex justify-between items-center pt-4 border-t border-white/5">
                  <div className="flex -space-x-2">
                     {node.passengers.map((p:any, i:number) => <div key={i} className="w-10 h-10 bg-indigo-500 border-4 border-[#020617] rounded-xl flex items-center justify-center text-[10px] font-black">{p.name[0]}</div>)}
                     {Array.from({length: 4 - node.passengers.length}).map((_, i) => <div key={i} className="w-10 h-10 bg-white/5 border-4 border-[#020617] rounded-xl flex items-center justify-center text-[10px] font-black opacity-20"><i className="fas fa-chair"></i></div>)}
                  </div>
                  {node.status === 'forming' && <button onClick={() => onJoin(node.id, prompt("Name?"), prompt("Phone?"))} className="px-6 py-2 bg-white/5 rounded-xl font-black text-[9px] uppercase hover:bg-white/10 transition-all">Join</button>}
                  {node.status === 'dispatched' && (
                    <div className="bg-amber-500/10 px-4 py-2 rounded-xl text-center border border-amber-500/20">
                       <p className="text-[8px] font-black uppercase text-amber-500">Node Code</p>
                       <p className="text-xl font-black text-white">{node.verification_code}</p>
                    </div>
                  )}
               </div>
            </div>
          ))}
       </div>
       {showModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
             <div className="glass-bright w-full max-w-md p-8 rounded-[2.5rem] space-y-6 border border-white/10">
                <h3 className="text-xl font-black italic text-center">New Ride Node</h3>
                <input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none" placeholder="Origin" onChange={e => setForm({...form, origin: e.target.value})} />
                <input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none" placeholder="Destination" onChange={e => setForm({...form, destination: e.target.value})} />
                <input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none" placeholder="Leader Name" onChange={e => setForm({...form, leader: e.target.value})} />
                <input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none" placeholder="Phone" onChange={e => setForm({...form, phone: e.target.value})} />
                <div className="flex gap-4">
                   <button onClick={() => setShowModal(false)} className="flex-1 py-4 text-slate-500 font-black text-[10px] uppercase">Cancel</button>
                   <button onClick={async () => {
                     const fare = form.type === 'Pragia' ? settings.fare_per_pragia : settings.fare_per_taxi;
                     await supabase.from('ride_nodes').insert([{ origin: form.origin, destination: form.destination, leader_name: form.leader, leader_phone: form.phone, passengers: [{id: 'L', name: form.leader, phone: form.phone}], fare_per_person: fare, status: 'forming', capacity_needed: 4 }]);
                     setShowModal(false);
                   }} className="flex-1 py-4 bg-amber-500 text-black rounded-xl font-black text-[10px] uppercase shadow-xl">Launch</button>
                </div>
             </div>
          </div>
       )}
    </div>
  );
};

const DriverPortal = ({ drivers, activeDriver, onLogin, onLogout, qualifiedNodes, dispatchedNodes, onAccept, onVerify }: any) => {
  const [pin, setPin] = useState('');
  const [id, setId] = useState('');

  if (!activeDriver) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 animate-in zoom-in">
       <div className="w-20 h-20 bg-indigo-600/10 rounded-3xl flex items-center justify-center text-indigo-500 border border-indigo-500/20 shadow-2xl"><i className="fas fa-id-card-clip text-3xl"></i></div>
       <h2 className="text-2xl font-black italic uppercase">Terminal Access</h2>
       <div className="w-full max-w-xs space-y-4">
          <select className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold outline-none" onChange={e => setId(e.target.value)}>
             <option value="">Select Profile</option>
             {drivers.map((d:any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input type="password" placeholder="PIN" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-center text-xl font-black outline-none" onChange={e => setPin(e.target.value)} />
          <button onClick={() => onLogin(id, pin)} className="w-full py-4 bg-indigo-600 rounded-xl font-black text-[10px] uppercase shadow-xl">Sign In</button>
       </div>
    </div>
  );

  return (
    <div className="space-y-12 text-left animate-in fade-in">
       <div className="flex justify-between items-center bg-indigo-600/10 p-8 rounded-[2.5rem] border border-indigo-500/20">
          <div>
            <h2 className="text-2xl font-black italic text-white leading-none">{activeDriver.name}</h2>
            <p className="text-amber-500 text-[10px] font-black uppercase mt-2">₵ {Number(activeDriver.wallet_balance).toFixed(2)}</p>
          </div>
          <button onClick={onLogout} className="px-6 py-3 text-rose-500 font-black text-[9px] uppercase border border-rose-500/20 rounded-xl">Exit</button>
       </div>
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-4">
             <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-4">Dispatch Queue</h3>
             {qualifiedNodes.map((n:any) => (
               <div key={n.id} className="glass p-6 rounded-2xl flex justify-between items-center border border-white/5">
                  <p className="font-black text-sm">{n.origin} → {n.destination}</p>
                  <button onClick={() => onAccept(n.id, activeDriver.id)} className="px-6 py-2 bg-indigo-600 rounded-lg text-[9px] font-black uppercase">Accept</button>
               </div>
            ))}
            {qualifiedNodes.length === 0 && <div className="p-20 text-center opacity-10 font-black italic uppercase text-xs">Waiting for nodes...</div>}
          </section>
          <section className="space-y-4">
             <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-4">Active Missions</h3>
             {dispatchedNodes.filter((n:any) => n.assigned_driver_id === activeDriver.id).map((n:any) => (
               <div key={n.id} className="glass p-8 rounded-[2rem] border border-amber-500/20 space-y-6">
                  <p className="text-xl font-black italic uppercase leading-none">{n.destination}</p>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-center text-4xl font-black" placeholder="Verification Code" id={`v-${n.id}`} />
                  <button onClick={() => onVerify(n.id, (document.getElementById(`v-${n.id}`) as HTMLInputElement).value)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Complete Mission</button>
               </div>
            ))}
          </section>
       </div>
    </div>
  );
};

const AdminPortal = ({ activeTab, setActiveTab, drivers, topupRequests, hubRevenue, onApprove, onLock, settings, nodes }: any) => {
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const runAiSync = async () => {
    setAiLoading(true);
    try {
      const prompt = `Analyze current logistics hub health:
      Total Revenue: ₵${hubRevenue}
      Active Drivers: ${drivers.length}
      Pending Topups: ${topupRequests.filter((r:any)=>r.status==='pending').length}
      Active Missions: ${nodes.filter((n:any)=>n.status==='dispatched').length}
      Give a 2-sentence tactical advice for the hub manager in a cool, energetic tone using emojis.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setAiAnalysis(response.text || 'No intel available.');
    } catch (e) { setAiAnalysis('Intel link failed.'); }
    setAiLoading(false);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 text-left">
       <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
          <TabBtn active={activeTab === 'monitor'} label="Monitor" onClick={() => setActiveTab('monitor')} />
          <TabBtn active={activeTab === 'fleet'} label="Fleet" onClick={() => setActiveTab('fleet')} />
          <TabBtn active={activeTab === 'requests'} label="Wallet" onClick={() => setActiveTab('requests')} count={topupRequests.filter((r:any)=>r.status==='pending').length} />
          <button onClick={onLock} className="px-6 py-3 text-rose-500 font-black text-[9px] uppercase border border-rose-500/20 rounded-xl">Lock</button>
       </div>

       {activeTab === 'monitor' && (
          <div className="space-y-8">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Fleet Units" value={drivers.length} icon="fa-taxi" />
                <StatCard label="Live Revenue" value={hubRevenue.toFixed(0)} icon="fa-money-bill" isCurrency />
                <StatCard label="Active Moves" value={nodes.filter((n:any)=>n.status==='dispatched').length} icon="fa-route" />
                <StatCard label="Hub Status" value="Online" icon="fa-bolt" color="text-amber-500" />
             </div>
             <div className="glass p-10 rounded-[3rem] border border-indigo-500/20 space-y-6">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center"><i className="fas fa-robot text-white"></i></div>
                   <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">Logistics Intel (Gemini)</h3>
                </div>
                {aiLoading ? <p className="text-slate-500 animate-pulse italic">Connecting to neural link...</p> : <p className="text-slate-300 italic font-medium leading-relaxed">{aiAnalysis || 'Tap "Update Intel" for tactical advice.'}</p>}
                <button onClick={runAiSync} className="px-8 py-3 bg-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl">Update Intel</button>
             </div>
          </div>
       )}

       {activeTab === 'requests' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {topupRequests.filter((r:any) => r.status === 'pending').map((r:any) => {
               const d = drivers.find((dr:any) => dr.id === r.driver_id);
               return (
                  <div key={r.id} className="glass p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                     <p className="text-[10px] font-black text-slate-500 uppercase italic">Ref: {r.momo_reference}</p>
                     <h4 className="text-2xl font-black italic text-white leading-none">{d?.name || 'Driver'}</h4>
                     <p className="text-3xl font-black text-emerald-400 italic">₵ {r.amount}</p>
                     <button onClick={() => onApprove(r.id)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Approve</button>
                  </div>
               );
             })}
          </div>
       )}

       {activeTab === 'fleet' && (
          <div className="space-y-6">
             <div className="flex justify-between px-4">
                <h3 className="text-xl font-black italic text-white uppercase">Active Fleet Registry</h3>
                <button onClick={() => alert("Registration handled by SQL for security.")} className="text-slate-500 font-black text-[10px] uppercase">Add Unit</button>
             </div>
             <div className="glass rounded-[2rem] overflow-hidden border border-white/5">
                <table className="w-full text-left text-[11px]">
                   <thead className="bg-white/5 text-slate-500 uppercase font-black tracking-widest border-b border-white/5">
                      <tr><th className="px-8 py-5">Driver</th><th className="px-8 py-5">Plate</th><th className="px-8 py-5">PIN</th><th className="px-8 py-5">Wallet</th></tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                      {drivers.map((d:any) => (
                         <tr key={d.id} className="hover:bg-white/5"><td className="px-8 py-5 text-white font-bold">{d.name}</td><td className="px-8 py-5 text-slate-500 uppercase">{d.license_plate}</td><td className="px-8 py-5 font-black text-amber-500 tracking-[0.2em]">{d.pin}</td><td className="px-8 py-5 text-emerald-400 font-black">₵{Number(d.wallet_balance).toFixed(1)}</td></tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
       )}
    </div>
  );
};

const QrModal = ({ onClose }: any) => (
  <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
     <div className="glass-bright w-full max-w-sm rounded-[3rem] p-10 space-y-8 animate-in zoom-in text-center border border-white/10">
        <h3 className="text-2xl font-black italic uppercase text-white">Hub QR Code</h3>
        <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl">
           <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}&bgcolor=ffffff&color=020617&format=svg`} className="w-full aspect-square" alt="QR" />
        </div>
        <button onClick={onClose} className="w-full py-4 bg-white/5 rounded-xl text-slate-500 font-black uppercase text-[10px]">Close</button>
     </div>
  </div>
);

const HelpModal = ({ onClose }: any) => (
  <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
     <div className="glass-bright w-full max-w-2xl rounded-[3rem] p-10 lg:p-14 space-y-10 animate-in zoom-in text-left border border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar">
        <div className="flex justify-between items-center">
           <h3 className="text-3xl font-black italic uppercase text-white">Hub Guide</h3>
           <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500"><i className="fas fa-times"></i></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           <HelpSection icon="fa-user-graduate" title="Passengers" points={["Form nodes to split fare with 4 friends.","Wait for nodes to qualify (4/4 seats).","Verification code is for safety; share ONLY at destination."]} />
           <HelpSection icon="fa-id-card-clip" title="Drivers" points={["Top up your wallet via Admin Command.","Each mission costs ₵2.00 commission.","Verify passenger codes to close missions."]} />
        </div>
        <button onClick={onClose} className="w-full py-4 bg-indigo-600 rounded-xl font-black text-xs uppercase shadow-xl">Understood</button>
     </div>
  </div>
);

const HelpSection = ({ icon, title, points }: any) => (
  <div className="space-y-4">
     <div className="flex items-center gap-3"><i className={`fas ${icon} text-amber-500`}></i><h4 className="font-black uppercase text-xs tracking-widest text-white">{title}</h4></div>
     <ul className="space-y-3">{points.map((p:string, i:number) => <li key={i} className="flex gap-3 text-slate-500 italic text-[11px] leading-relaxed"><span className="w-1 h-1 bg-indigo-500 rounded-full mt-2 shrink-0"></span>{p}</li>)}</ul>
  </div>
);

const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-xl' : 'text-slate-400 hover:bg-white/5'}`}>
    <div className="flex items-center space-x-4"><i className={`fas ${icon} text-lg w-6`}></i><span className="text-sm font-bold">{label}</span></div>
    {badge !== undefined && <span className="bg-rose-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full ring-4 ring-[#020617]">{badge}</span>}
  </button>
);

const MobileNavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 relative ${active ? 'text-amber-500' : 'text-slate-500'}`}>
    <i className={`fas ${icon} text-xl`}></i>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    {badge !== undefined && <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full">{badge}</span>}
  </button>
);

const StatCard = ({ label, value, icon, isCurrency, color = 'text-white' }: any) => (
  <div className="glass p-6 rounded-2xl flex flex-col justify-end min-h-[120px] relative overflow-hidden group hover:border-white/10 transition-all">
    <i className={`fas ${icon} absolute top-6 right-6 text-slate-800 text-2xl group-hover:scale-110 transition-transform`}></i>
    <div className="relative z-10 text-left">
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className={`text-3xl font-black italic leading-none ${color}`}>{isCurrency ? '₵' : ''}{value}</p>
    </div>
  </div>
);

const TabBtn = ({ active, label, onClick, count }: any) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap relative ${active ? 'bg-amber-500 text-black' : 'text-slate-500 hover:text-slate-300'}`}>
    {label} {count !== undefined && count > 0 && <span className="ml-1 bg-rose-500 text-white px-1.5 rounded-full">{count}</span>}
  </button>
);

const AdminLogin = ({ onLogin }: any) => {
  const [val, setVal] = useState('');
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 animate-in zoom-in">
       <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-2xl"><i className="fas fa-shield-halved text-3xl"></i></div>
       <h2 className="text-2xl font-black italic uppercase tracking-tighter">Vault Access</h2>
       <input type="password" placeholder="Master Key" className="bg-white/5 border border-white/10 rounded-xl p-4 text-center text-xl font-black outline-none focus:border-amber-500 transition-all" onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin(val)} />
       <button onClick={() => onLogin(val)} className="px-12 py-4 bg-amber-500 text-black rounded-xl font-black text-[10px] uppercase shadow-xl">Auth</button>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}