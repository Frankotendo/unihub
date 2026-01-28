
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CLIENT SETUP ---
// Using import.meta.env for VITE_ variables is the standard and most reliable way in Vite projects.
// We also add .trim() to prevent issues with accidental spaces in environment variables.
const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "").trim();

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

// --- TYPES ---
type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed';
type PortalMode = 'passenger' | 'driver' | 'admin';

interface Passenger { id: string; name: string; phone: string; }

interface RideNode {
  id: string; destination: string; origin: string; capacityNeeded: number;
  passengers: Passenger[]; status: NodeStatus; leaderName: string; leaderPhone: string;
  farePerPerson: number; createdAt: string; assignedDriverId?: string;
  verificationCode?: string; notifiedFull?: boolean;
}

interface Driver {
  id: string; name: string; vehicleType: VehicleType; licensePlate: string;
  contact: string; walletBalance: number; rating: number; status: string; pin: string;
}

interface TopupRequest {
  id: string; driverId: string; amount: number; momoReference: string;
  status: 'pending' | 'approved' | 'rejected'; timestamp: string;
}

interface AppSettings {
  adminMomo: string; adminMomoName: string; whatsappNumber: string;
  commissionPerSeat: number; adminSecret: string; farePerPragia: number;
  farePerTaxi: number; soloMultiplier: number; aboutMeText: string;
}

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'requests' | 'settings'>('monitor');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => sessionStorage.getItem('unihub_admin_auth_v12') === 'true');
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => sessionStorage.getItem('unihub_driver_session_v12'));
  
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeNotification, setActiveNotification] = useState<{title: string, msg: string} | null>(null);

  useEffect(() => {
    if (!supabase) return;

    const fetchInitialData = async () => {
      try {
        const { data: s } = await supabase.from('settings').select('*').single();
        const { data: n } = await supabase.from('nodes').select('*').order('created_at', { ascending: false });
        const { data: d } = await supabase.from('drivers').select('*');
        const { data: tr } = await supabase.from('topup_requests').select('*').order('timestamp', { ascending: false });

        if (s) setSettings(mapSettingsFromDB(s));
        if (n) setNodes(n.map(mapNodeFromDB));
        if (d) setDrivers(d);
        if (tr) setTopupRequests(tr.map(mapTopupFromDB));
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    fetchInitialData();

    const channel = supabase.channel('hub_realtime_v12')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, () => fetchInitialData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchInitialData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'topup_requests' }, () => fetchInitialData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => fetchInitialData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    nodes.forEach(node => {
      if (node.status === 'qualified' && !node.notifiedFull) {
        setActiveNotification({
          title: "SEAT FULL! 🚀",
          msg: `The ride from ${node.origin} to ${node.destination} is full. Dispatching soon.`
        });
        if (supabase) supabase.from('nodes').update({ notified_full: true }).eq('id', node.id).then();
      }
    });
  }, [nodes]);

  const mapNodeFromDB = (db: any): RideNode => ({
    id: db.id, origin: db.origin, destination: db.destination,
    capacityNeeded: db.capacity_needed, passengers: db.passengers || [],
    status: db.status, leaderName: db.leader_name, leaderPhone: db.leader_phone,
    farePerPerson: db.fare_per_person, createdAt: db.created_at,
    assignedDriverId: db.assigned_driver_id, verificationCode: db.verification_code,
    notifiedFull: db.notified_full
  });

  const mapSettingsFromDB = (db: any): AppSettings => ({
    adminMomo: db.admin_momo, adminMomoName: db.admin_momo_name,
    whatsappNumber: db.whatsapp_number, commissionPerSeat: db.commission_per_seat,
    adminSecret: db.admin_secret, farePerPragia: db.fare_per_pragia,
    farePerTaxi: db.fare_per_taxi,
    soloMultiplier: db.solo_multiplier,
    aboutMeText: db.about_me_text
  });

  const mapTopupFromDB = (db: any): TopupRequest => ({
    id: db.id, driverId: db.driver_id, amount: db.amount,
    momoReference: db.momo_reference, status: db.status, timestamp: db.timestamp
  });

  const createNode = async (n: Partial<RideNode>) => {
    if (!supabase) return;
    await supabase.from('nodes').insert([{
      id: `NODE-${Date.now()}`, origin: n.origin, destination: n.destination,
      capacity_needed: n.capacityNeeded, leader_name: n.leaderName,
      leader_phone: n.leaderPhone, fare_per_person: n.farePerPerson,
      status: 'forming', notified_full: false
    }]);
  };

  const joinNode = async (nodeId: string, name: string, phone: string) => {
    if (!supabase) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newPassengers = [...node.passengers, { id: `P-${Date.now()}`, name, phone }];
    const isFull = newPassengers.length >= node.capacityNeeded;
    
    await supabase.from('nodes').update({
      passengers: newPassengers,
      status: isFull ? 'qualified' : 'forming'
    }).eq('id', nodeId);
  };

  const acceptRide = async (nodeId: string, driverId: string) => {
    if (!supabase) return;
    const driver = drivers.find(d => d.id === driverId);
    if (!driver || driver.walletBalance < (settings?.commissionPerSeat || 0)) {
      alert("Insufficient Balance");
      return;
    }
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    await supabase.from('drivers').update({ wallet_balance: driver.walletBalance - (settings?.commissionPerSeat || 0) }).eq('id', driverId);
    await supabase.from('nodes').update({
      status: 'dispatched',
      assigned_driver_id: driverId,
      verification_code: verificationCode
    }).eq('id', nodeId);
  };

  const verifyRide = async (nodeId: string, code: string) => {
    if (!supabase) return;
    const node = nodes.find(n => n.id === nodeId);
    if (node?.verificationCode === code) {
      await supabase.from('nodes').update({ status: 'completed' }).eq('id', nodeId);
      alert("Verification Success!");
    } else {
      alert("Invalid Code");
    }
  };

  const updateGlobalSettings = async (newSettings: AppSettings) => {
    if (!supabase) return;
    await supabase.from('settings').update({
      admin_momo: newSettings.adminMomo,
      admin_momo_name: newSettings.adminMomoName,
      commission_per_seat: newSettings.commissionPerSeat,
      admin_secret: newSettings.adminSecret,
      fare_per_pragia: newSettings.farePerPragia,
      fare_per_taxi: newSettings.farePerTaxi
    }).eq('id', 1);
    alert("Settings Synced");
  };

  const approveTopup = async (reqId: string) => {
    if (!supabase) return;
    const req = topupRequests.find(r => r.id === reqId);
    const driver = drivers.find(d => d.id === req?.driverId);
    if (req && driver) {
      await supabase.from('drivers').update({ wallet_balance: driver.walletBalance + req.amount }).eq('id', driver.id);
      await supabase.from('topup_requests').update({ status: 'approved' }).eq('id', reqId);
    }
  };

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  if (!supabase) return (
    <div className="h-screen w-full bg-[#020617] flex flex-col items-center justify-center p-8 text-center">
       <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mb-6">
          <i className="fas fa-plug-circle-exclamation text-2xl"></i>
       </div>
       <h1 className="text-xl font-black text-white uppercase italic">Setup Required</h1>
       <div className="text-slate-500 text-xs mt-4 max-w-xs leading-relaxed space-y-4">
         <p>Supabase environment variables are missing from the build. Note: You must Redeploy on Vercel after adding variables.</p>
         <div className="bg-white/5 p-4 rounded-xl text-left font-mono text-[10px] space-y-2">
            <p className={isValidUrl(SUPABASE_URL) ? 'text-emerald-500' : 'text-rose-500'}>
              {isValidUrl(SUPABASE_URL) ? '✓ URL detected' : '✗ VITE_SUPABASE_URL missing'}
            </p>
            <p className={SUPABASE_ANON_KEY ? 'text-emerald-500' : 'text-rose-500'}>
              {SUPABASE_ANON_KEY ? '✓ Key detected' : '✗ VITE_SUPABASE_ANON_KEY missing'}
            </p>
         </div>
         <p className="text-[9px] opacity-60">To fix: Go to Vercel Deployments &gt; Redeploy.</p>
       </div>
    </div>
  );

  if (isInitializing || !settings) return (
    <div className="h-screen w-full bg-[#020617] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shadow-2xl shadow-amber-500/20">
           <i className="fas fa-route text-[#020617]"></i>
        </div>
        <p className="text-amber-500 text-[9px] font-black uppercase tracking-[0.4em]">Linking Live Hub...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans">
      {activeNotification && (
        <div className="fixed top-10 inset-x-0 z-[500] px-4 animate-in slide-in-from-top-10">
          <div className="max-w-md mx-auto bg-amber-500 text-[#020617] p-6 rounded-[2rem] shadow-2xl flex items-center gap-6">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fas fa-bell"></i></div>
            <div className="flex-1">
              <p className="font-black uppercase text-xs italic">{activeNotification.title}</p>
              <p className="text-[10px] font-bold mt-1 opacity-80">{activeNotification.msg}</p>
            </div>
            <button onClick={() => setActiveNotification(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5"><i className="fas fa-times"></i></button>
          </div>
        </div>
      )}

      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/10">
            <i className="fas fa-route text-[#020617] text-xl"></i>
          </div>
          <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white">UniHub</h1>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Passenger Hub" onClick={() => setViewMode('passenger')} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Driver Terminal" onClick={() => setViewMode('driver')} />
          <NavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin Command" onClick={() => setViewMode('admin')} badge={topupRequests.filter(r => r.status === 'pending').length || undefined} />
        </div>

        {activeDriver && (
          <div className="bg-indigo-50/10 p-6 rounded-[2.5rem] border border-indigo-500/20 relative overflow-hidden group">
             <p className="text-[9px] font-black uppercase text-indigo-400 mb-1">Active Pilot</p>
             <p className="text-lg font-black text-white truncate">{activeDriver.name}</p>
             <button onClick={() => { setActiveDriverId(null); sessionStorage.removeItem('unihub_driver_session_v12'); setViewMode('passenger'); }} className="mt-4 w-full py-2 bg-rose-600/20 text-rose-500 rounded-xl text-[9px] font-black uppercase">End Shift</button>
          </div>
        )}
      </nav>

      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          {viewMode === 'passenger' && (
            <PassengerPortal nodes={nodes} onCreate={createNode} onJoin={joinNode} search={globalSearch} setSearch={setGlobalSearch} />
          )}
          
          {viewMode === 'driver' && (
            !activeDriver ? (
              <DriverLogin drivers={drivers} onLogin={(id, pin) => {
                const d = drivers.find(drv => drv.id === id);
                if (d && d.pin === pin) { setActiveDriverId(id); sessionStorage.setItem('unihub_driver_session_v12', id); }
                else alert("Invalid PIN");
              }} />
            ) : (
              <DriverTerminal 
                activeDriver={activeDriver} 
                nodes={nodes} 
                onAccept={acceptRide} 
                onVerify={verifyRide} 
                onRequestTopup={async (amt, ref) => {
                  if (supabase) {
                    await supabase.from('topup_requests').insert([{
                      id: `TR-${Date.now()}`, driver_id: activeDriver.id, amount: amt, momo_reference: ref
                    }]);
                    alert("Request Sent");
                  }
                }}
                settings={settings}
              />
            )
          )}

          {viewMode === 'admin' && (
            !isAdminAuthenticated ? (
              <AdminLogin onLogin={(pass) => {
                if (pass === settings.adminSecret) { setIsAdminAuthenticated(true); sessionStorage.setItem('unihub_admin_auth_v12', 'true'); }
                else alert("Denied");
              }} />
            ) : (
              <AdminPanel 
                activeTab={activeTab} setActiveTab={setActiveTab} 
                topupRequests={topupRequests} onApprove={approveTopup} 
                drivers={drivers} nodes={nodes}
                settings={settings} onUpdateSettings={updateGlobalSettings}
                onLock={() => { setIsAdminAuthenticated(false); sessionStorage.removeItem('unihub_admin_auth_v12'); }}
              />
            )
          )}
        </div>
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/95 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Hub" onClick={() => setViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Drive" onClick={() => setViewMode('driver')} />
        <MobileNavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin" onClick={() => setViewMode('admin')} badge={topupRequests.filter(r => r.status === 'pending').length || undefined} />
      </nav>
    </div>
  );
};

const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-xl' : 'text-slate-400 hover:bg-white/5'}`}>
    <div className="flex items-center gap-5">
      <i className={`fas ${icon} text-lg w-6`}></i>
      <span className="text-sm font-black uppercase tracking-tight">{label}</span>
    </div>
    {badge && <span className="bg-rose-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full ring-2 ring-[#020617]">{badge}</span>}
  </button>
);

const MobileNavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 relative ${active ? 'text-amber-500' : 'text-slate-500'}`}>
    <i className={`fas ${icon} text-xl`}></i>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    {badge && <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-[#020617]">{badge}</span>}
  </button>
);

const PassengerPortal = ({ nodes, onCreate, onJoin, search, setSearch }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ origin: '', dest: '', name: '' });
  const filtered = nodes.filter((n: any) => n.status !== 'completed' && (n.destination.toLowerCase().includes(search.toLowerCase()) || n.origin.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-10 animate-in fade-in">
       <div className="relative group">
          <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors"></i>
          <input type="text" placeholder="Search active routes or nodes..." className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-700" value={search} onChange={(e) => setSearch(e.target.value)} />
       </div>
       <div className="flex justify-between items-end">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Live Hub Feed</h2>
          <button onClick={() => setShowModal(true)} className="px-8 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">Form Ride</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((node: any) => (
            <div key={node.id} className={`glass rounded-[2.5rem] p-8 border transition-all ${node.status === 'dispatched' ? 'border-amber-500/30 bg-amber-500/5' : node.status === 'qualified' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5'}`}>
               <div className="flex justify-between items-start mb-6">
                  <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest ${node.status === 'dispatched' ? 'bg-amber-500 text-[#020617]' : node.status === 'qualified' ? 'bg-emerald-50 text-emerald-500' : 'bg-white/5 text-slate-500'}`}>{node.status === 'qualified' ? 'READY' : node.status}</span>
                  <p className="text-lg font-black text-emerald-400">₵ {node.farePerPerson || '5.00'}/p</p>
               </div>
               <div className="space-y-4 mb-8">
                  <div className="pl-4 border-l-2 border-slate-700 font-bold text-white uppercase truncate">{node.origin}</div>
                  <div className="pl-4 border-l-2 border-amber-500 font-black text-white uppercase text-xl truncate">{node.destination}</div>
               </div>
               {node.status === 'forming' && <button onClick={() => { const n = prompt("Name:"); const p = prompt("WhatsApp:"); if (n && p) onJoin(node.id, n, p); }} className="w-full py-4 bg-white/5 rounded-2xl font-black uppercase text-[10px] text-white">Join ({node.passengers.length}/{node.capacityNeeded})</button>}
               {node.status === 'dispatched' && (
                 <div className="bg-amber-500 p-5 rounded-2xl text-center shadow-xl">
                    <p className="text-[10px] font-black uppercase text-[#020617] mb-1">Verify Code</p>
                    <p className="text-4xl font-black italic text-[#020617] tracking-tighter">{node.verificationCode}</p>
                 </div>
               )}
            </div>
          ))}
       </div>
       {showModal && (
         <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
            <div className="glass-bright w-full max-w-lg rounded-[3rem] p-10 space-y-8 animate-in zoom-in">
               <h3 className="text-2xl font-black italic uppercase text-white text-center">New Node</h3>
               <div className="space-y-4">
                  <input className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6" placeholder="Origin" onChange={e => setForm({...form, origin: e.target.value})} />
                  <input className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6" placeholder="Destination" onChange={e => setForm({...form, dest: e.target.value})} />
                  <input className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6" placeholder="Leader Name" onChange={e => setForm({...form, name: e.target.value})} />
               </div>
               <div className="flex gap-4">
                  <button onClick={() => setShowModal(false)} className="flex-1 py-5 bg-white/5 rounded-2xl font-black uppercase text-[10px]">Cancel</button>
                  <button onClick={() => { onCreate({ origin: form.origin, destination: form.dest, leaderName: form.name, capacityNeeded: 4, farePerPerson: 5.0 }); setShowModal(false); }} className="flex-1 py-5 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase text-[10px]">Launch</button>
               </div>
            </div>
         </div>
       )}
    </div>
  );
};

const DriverLogin = ({ drivers, onLogin }: any) => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-10 animate-in fade-in">
    <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-500 shadow-2xl"><i className="fas fa-id-card-clip text-3xl"></i></div>
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
            <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">{activeDriver.name}</h2>
            <p className="text-emerald-400 font-black text-[11px] mt-2 tracking-widest uppercase">Cloud Wallet: ₵{activeDriver.walletBalance.toFixed(2)}</p>
          </div>
          <button onClick={() => {
            const amt = prompt("Amount to Top-up (₵):");
            if (amt) {
              const ref = prompt(`Pay ₵${amt} to ${settings.adminMomo} (${settings.adminMomoName}) and enter reference:`);
              if (ref) onRequestTopup(Number(amt), ref);
            }
          }} className="px-12 py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-[11px] uppercase shadow-xl hover:bg-emerald-500 transition-all">Top Up</button>
       </div>
       
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-6">
             <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 px-6">Nearby Missions</h3>
             <div className="space-y-4">
               {available.map((n: any) => (
                  <div key={n.id} className={`glass p-8 rounded-[2.5rem] border border-white/5 flex justify-between items-center group transition-all ${n.status === 'qualified' ? 'border-emerald-500/20' : ''}`}>
                     <div>
                       <p className="font-black text-white uppercase italic text-lg">{n.origin} → {n.destination}</p>
                       <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">Capacity: {n.passengers.length}/{n.capacityNeeded}</p>
                     </div>
                     <button onClick={() => onAccept(n.id, activeDriver.id)} className={`px-10 py-5 rounded-2xl font-black uppercase text-[10px] transition-all ${n.status === 'qualified' ? 'bg-emerald-600 text-white shadow-xl' : 'bg-white/5 text-slate-400'}`}>
                       {n.status === 'qualified' ? 'Accept Now' : 'Join Node'}
                     </button>
                  </div>
               ))}
             </div>
          </div>
          <div className="lg:col-span-4 space-y-6">
             <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 px-6">Current Mission</h3>
             {active.map((n: any) => (
                <div key={n.id} className="glass p-10 rounded-[3rem] border border-amber-500/20 text-center space-y-8 animate-in zoom-in shadow-2xl">
                   <p className="text-white font-black italic uppercase text-2xl">{n.origin} to {n.destination}</p>
                   <input className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-8 text-center text-5xl font-black text-white outline-none focus:border-amber-500" placeholder="0000" maxLength={4} onChange={e => setCode(e.target.value)} />
                   <button onClick={() => onVerify(n.id, code)} className="w-full py-6 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl">Verify Delivery</button>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
};

const AdminPanel = ({ activeTab, setActiveTab, topupRequests, onApprove, onLock, drivers, nodes, settings, onUpdateSettings }: any) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  
  return (
    <div className="space-y-10 animate-in zoom-in duration-500">
       <div className="flex bg-white/5 p-1.5 rounded-[2rem] border border-white/10 max-w-fit mx-auto shadow-inner">
          <button onClick={() => setActiveTab('monitor')} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'monitor' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500'}`}>Monitor</button>
          <button onClick={() => setActiveTab('fleet')} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'fleet' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500'}`}>Fleet</button>
          <button onClick={() => setActiveTab('requests')} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'requests' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500'}`}>Topups</button>
          <button onClick={() => setActiveTab('settings')} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500'}`}>System</button>
          <button onClick={onLock} className="px-10 py-4 text-rose-500 font-black text-[10px] uppercase tracking-widest">Lock</button>
       </div>

       {activeTab === 'monitor' && (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard label="Active Fleet" value={drivers.length} icon="fa-taxi" color="text-indigo-500" />
            <StatCard label="Active Nodes" value={nodes.filter((n:any) => n.status !== 'completed').length} icon="fa-route" color="text-amber-500" />
            <StatCard label="Pending" value={topupRequests.filter((r:any) => r.status === 'pending').length} icon="fa-clock" color="text-rose-500" />
         </div>
       )}

       {activeTab === 'fleet' && (
         <div className="glass rounded-[3rem] border border-white/10 overflow-hidden">
            <table className="w-full text-left">
               <thead className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">
                  <tr>
                     <th className="px-10 py-6">Pilot</th>
                     <th className="px-10 py-6">Balance</th>
                     <th className="px-10 py-6">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {drivers.map((d: any) => (
                     <tr key={d.id} className="text-sm">
                        <td className="px-10 py-6 font-bold">{d.name}</td>
                        <td className="px-10 py-6 font-black text-emerald-500">₵{d.walletBalance.toFixed(2)}</td>
                        <td className="px-10 py-6 capitalize opacity-60 text-xs">{d.status}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
       )}

       {activeTab === 'requests' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {topupRequests.filter((r:any) => r.status === 'pending').map((req: any) => {
               const driver = drivers.find(d => d.id === req.driver_id);
               return (
                  <div key={req.id} className="glass p-10 rounded-[3rem] border border-emerald-500/20 space-y-6">
                     <div className="flex justify-between items-start">
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Top-Up Request</p>
                           <p className="text-3xl font-black text-white italic">₵{req.amount}</p>
                        </div>
                        <p className="text-sm font-black text-white">{driver?.name || "Pilot"}</p>
                     </div>
                     <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">MoMo Ref</p>
                        <p className="font-mono text-sm text-emerald-400 break-all">{req.momo_reference}</p>
                     </div>
                     <button onClick={() => onApprove(req.id)} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl">Approve & Release</button>
                  </div>
               );
            })}
         </div>
       )}

       {activeTab === 'settings' && (
         <div className="glass rounded-[3rem] border border-white/10 p-12 max-w-4xl mx-auto space-y-10">
            <h3 className="text-xl font-black italic uppercase text-white tracking-tighter">Command Vault</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <ConfigField label="Admin MoMo" value={localSettings.adminMomo} onChange={v => setLocalSettings({...localSettings, adminMomo: v})} />
               <ConfigField label="Admin Secret" value={localSettings.adminSecret} type="password" onChange={v => setLocalSettings({...localSettings, adminSecret: v})} />
               <ConfigField label="Commission/Seat" value={localSettings.commissionPerSeat.toString()} type="number" onChange={v => setLocalSettings({...localSettings, commissionPerSeat: Number(v)})} />
               <ConfigField label="WhatsApp Hub" value={localSettings.whatsappNumber} onChange={v => setLocalSettings({...localSettings, whatsappNumber: v})} />
            </div>
            <button onClick={() => onUpdateSettings(localSettings)} className="w-full py-6 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase text-[11px] shadow-xl">Commit Global Changes</button>
         </div>
       )}
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: any) => (
   <div className="glass p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
      <div className="relative z-10">
         <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</p>
         <p className={`text-4xl font-black italic ${color}`}>{value}</p>
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

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
