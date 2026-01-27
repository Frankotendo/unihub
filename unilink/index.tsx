
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

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
  whatsappNumber: string;
  commissionPerSeat: number;
  adminSecret: string;
}

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'ledger' | 'requests' | 'settings' | 'ai'>('monitor');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('unihub_admin_auth_v9') === 'true';
  });

  // Global Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('unihub_settings_v9');
    return saved ? JSON.parse(saved) : {
      adminMomo: "024-123-4567",
      whatsappNumber: "233241234567",
      commissionPerSeat: 2.00,
      adminSecret: "2025"
    };
  });

  // Core Data State
  const [nodes, setNodes] = useState<RideNode[]>(() => {
    const saved = localStorage.getItem('unihub_dispatch_nodes_v9');
    return saved ? JSON.parse(saved) : [];
  });
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    const saved = localStorage.getItem('unihub_dispatch_drivers_v9');
    return saved ? JSON.parse(saved) : [
      { id: 'DRV-1', name: 'Kwame Mensah', vehicleType: 'Pragia', licensePlate: 'AS-202-24', contact: '233241234567', walletBalance: 20.0, rating: 4.9, status: 'online' },
      { id: 'DRV-2', name: 'Yaw Boateng', vehicleType: 'Taxi', licensePlate: 'GW-881-23', contact: '233551234567', walletBalance: 5.0, rating: 4.7, status: 'online' }
    ];
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('unihub_dispatch_tx_v9');
    return saved ? JSON.parse(saved) : [];
  });
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>(() => {
    const saved = localStorage.getItem('unihub_dispatch_topups_v9');
    return saved ? JSON.parse(saved) : [];
  });

  const [globalSearch, setGlobalSearch] = useState('');

  // Persist Changes
  useEffect(() => {
    localStorage.setItem('unihub_settings_v9', JSON.stringify(settings));
    localStorage.setItem('unihub_dispatch_nodes_v9', JSON.stringify(nodes));
    localStorage.setItem('unihub_dispatch_drivers_v9', JSON.stringify(drivers));
    localStorage.setItem('unihub_dispatch_tx_v9', JSON.stringify(transactions));
    localStorage.setItem('unihub_dispatch_topups_v9', JSON.stringify(topupRequests));
  }, [settings, nodes, drivers, transactions, topupRequests]);

  // --- ACTIONS ---

  const joinNode = (nodeId: string, name: string, phone: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId && n.passengers.length < n.capacityNeeded) {
        const newPassengers = [...n.passengers, { id: `P-${Date.now()}`, name, phone }];
        const isQualified = newPassengers.length >= n.capacityNeeded;
        return { 
          ...n, 
          passengers: newPassengers, 
          status: isQualified ? 'qualified' : 'forming' as NodeStatus
        };
      }
      return n;
    }));
  };

  const forceQualify = (nodeId: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, status: 'qualified' as NodeStatus } : n));
  };

  const acceptRide = (nodeId: string, driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver || driver.walletBalance < settings.commissionPerSeat) {
      alert("Insufficient Balance! Top up first.");
      return;
    }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    setNodes(prev => prev.map(n => n.id === nodeId ? { 
      ...n, 
      status: 'dispatched' as NodeStatus, 
      assignedDriverId: driverId, 
      verificationCode 
    } : n));

    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, walletBalance: d.walletBalance - settings.commissionPerSeat } : d));
    
    setTransactions(prev => [...prev, {
      id: `TX-${Date.now()}`,
      driverId,
      amount: settings.commissionPerSeat,
      type: 'commission',
      timestamp: new Date().toLocaleString()
    }]);

    alert("Job accepted! View safety code in move terminal.");
  };

  const verifyRide = (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.verificationCode === code) {
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, status: 'completed' as NodeStatus } : n));
      alert("Verification successful!");
    } else {
      alert("Wrong code! Verify with passengers.");
    }
  };

  const requestTopup = (driverId: string, amount: number, ref: string) => {
    if (!amount || !ref) {
      alert("Please enter amount and reference ID.");
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
    setTopupRequests(prev => [req, ...prev]);
    alert("Credit request submitted to Admin Hub.");
  };

  const approveTopup = (reqId: string) => {
    const req = topupRequests.find(r => r.id === reqId);
    if (!req || req.status !== 'pending') return;

    setDrivers(prev => prev.map(d => d.id === req.driverId ? { ...d, walletBalance: d.walletBalance + req.amount } : d));
    setTopupRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'approved' as const } : r));
    setTransactions(prev => [...prev, {
      id: `TX-${Date.now()}`,
      driverId: req.driverId,
      amount: req.amount,
      type: 'topup',
      timestamp: new Date().toLocaleString()
    }]);
  };

  const registerDriver = (d: Omit<Driver, 'id' | 'walletBalance' | 'rating' | 'status'>) => {
    const newDriver: Driver = {
      ...d,
      id: `DRV-${Date.now()}`,
      walletBalance: 0,
      rating: 5.0,
      status: 'online'
    };
    setDrivers(prev => [newDriver, ...prev]);
  };

  const deleteDriver = (id: string) => {
    if(confirm("Permanently delete this driver?")) {
      setDrivers(prev => prev.filter(d => d.id !== id));
    }
  };

  const hubRevenue = useMemo(() => transactions.filter(t => t.type === 'commission').reduce((a, b) => a + b.amount, 0), [transactions]);
  const pendingRequestsCount = useMemo(() => topupRequests.filter(r => r.status === 'pending').length, [topupRequests]);

  const handleAdminAuth = (password: string) => {
    if (password === settings.adminSecret) {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('unihub_admin_auth_v9', 'true');
    } else {
      alert("Master Key Invalid");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans">
      {/* Sidebar */}
      <nav className="w-72 glass border-r border-white/5 flex flex-col p-8 space-y-10 z-50">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl">
            <i className="fas fa-route text-[#020617] text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white">UniHub</h1>
            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Logistics Engine</p>
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Passenger Hub" onClick={() => {setViewMode('passenger'); setGlobalSearch('');}} />
          <NavItem active={viewMode === 'driver'} icon="fa-steering-wheel" label="Driver Terminal" onClick={() => {setViewMode('driver'); setGlobalSearch('');}} />
          <NavItem 
            active={viewMode === 'admin'} 
            icon="fa-shield-halved" 
            label="Admin Command" 
            onClick={() => {setViewMode('admin'); setGlobalSearch('');}} 
            badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
          />
        </div>

        <div className="pt-6 border-t border-white/5">
          <div className="bg-emerald-50/10 p-6 rounded-[2.5rem] border border-emerald-500/20 relative overflow-hidden group">
            <p className="text-[9px] font-black uppercase text-emerald-400 mb-1 relative z-10">Total Profit</p>
            <p className="text-3xl font-black relative z-10 leading-none text-white">₵ {hubRevenue.toFixed(2)}</p>
            <i className="fas fa-sack-dollar absolute bottom-[-10px] right-[-10px] text-4xl text-emerald-500/10 -rotate-12 group-hover:scale-110 transition-transform"></i>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-12 no-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
            <div className="relative group animate-in slide-in-from-top-4 duration-500">
               <i className="fas fa-search absolute left-8 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors"></i>
               <input 
                  type="text" 
                  placeholder={viewMode === 'admin' ? "Search ledger, fleet or requests..." : "Search destinations..."} 
                  className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] py-6 pl-16 pr-8 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
               />
            </div>
          )}

          {viewMode === 'passenger' && (
            <PassengerPortal nodes={nodes} setNodes={setNodes} onJoin={joinNode} onForceQualify={forceQualify} drivers={drivers} search={globalSearch} settings={settings} />
          )}
          {viewMode === 'driver' && (
            <DriverPortal 
              drivers={drivers} 
              qualifiedNodes={nodes.filter(n => n.status === 'qualified')} 
              dispatchedNodes={nodes.filter(n => n.status === 'dispatched')}
              onAccept={acceptRide}
              onVerify={verifyRide}
              onRequestTopup={requestTopup}
              topupRequests={topupRequests}
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
                transactions={transactions} 
                topupRequests={topupRequests}
                onApproveTopup={approveTopup}
                onLock={() => {setIsAdminAuthenticated(false); sessionStorage.removeItem('unihub_admin_auth_v9');}}
                search={globalSearch}
                settings={settings}
                onUpdateSettings={setSettings}
              />
            )
          )}
        </div>
      </main>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-xl' : 'text-slate-400 hover:bg-white/5'}`}
  >
    <div className="flex items-center space-x-4">
      <i className={`fas ${icon} text-lg w-6 text-center`}></i>
      <span className="text-sm font-bold tracking-tight">{label}</span>
    </div>
    {badge !== undefined && (
      <span className="bg-rose-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border border-white/20">
        {badge}
      </span>
    )}
  </button>
);

const AdminLogin = ({ onLogin }: any) => {
  const [pass, setPass] = useState('');
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in">
      <div className="w-24 h-24 bg-amber-500/10 border border-amber-500/30 rounded-[2.5rem] flex items-center justify-center mb-8 text-amber-500 shadow-2xl">
        <i className="fas fa-lock-keyhole text-4xl"></i>
      </div>
      <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-8 text-white">Unlock Command</h2>
      <div className="w-full max-w-sm glass p-10 rounded-[3rem] border border-white/10 space-y-6">
          <input 
            type="password" 
            placeholder="Master Key" 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 outline-none focus:border-amber-500 font-bold text-center text-white"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onLogin(pass)}
          />
        <button 
          onClick={() => onLogin(pass)}
          className="w-full py-5 bg-amber-500 text-[#020617] rounded-2xl font-black text-[11px] uppercase tracking-[0.2em]"
        >
          Enter Vault
        </button>
      </div>
    </div>
  );
};

const PassengerPortal = ({ nodes, setNodes, onJoin, onForceQualify, drivers, search, settings }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [joinModalNodeId, setJoinModalNodeId] = useState<string | null>(null);
  const [dest, setDest] = useState('');
  const [leader, setLeader] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<VehicleType>('Pragia');
  const [joinName, setJoinName] = useState('');
  const [joinPhone, setJoinPhone] = useState('');

  const filteredNodes = nodes.filter((n: any) => 
    n.status !== 'completed' && 
    (n.destination.toLowerCase().includes(search.toLowerCase()) || 
     n.leaderName.toLowerCase().includes(search.toLowerCase()))
  );

  const createNode = () => {
    if (!dest || !leader) return;
    const node: RideNode = {
      id: `NODE-${Date.now()}`,
      destination: dest,
      origin: 'Campus Hub',
      capacityNeeded: (type === 'Pragia' || type === 'Taxi') ? 4 : 3, // Locked Pragia to 4 seats
      passengers: [{ id: 'P-LEAD', name: leader, phone }],
      status: 'forming',
      leaderName: leader,
      leaderPhone: phone,
      farePerPerson: type === 'Pragia' ? 5 : 8,
      createdAt: new Date().toISOString()
    };
    setNodes([node, ...nodes]);
    setShowModal(false);
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">Passenger Hub</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-1">Form groups to reduce costs</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-10 py-5 bg-amber-500 text-[#020617] rounded-[2rem] font-black text-[11px] uppercase shadow-2xl">Form Node</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredNodes.map((node: any) => {
          const driver = drivers.find((d: any) => d.id === node.assignedDriverId);
          return (
            <div key={node.id} className={`glass rounded-[3.5rem] p-10 border transition-all ${node.status === 'dispatched' ? 'border-amber-500/50 bg-amber-500/5' : node.status === 'qualified' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5'}`}>
              <div className="flex justify-between items-start mb-8">
                <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest ${node.status === 'dispatched' ? 'bg-amber-500 text-[#020617]' : node.status === 'qualified' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
                  {node.status}
                </span>
                <p className="text-xl font-black text-emerald-400 leading-none">₵ {node.farePerPerson}/p</p>
              </div>

              <h3 className="text-3xl font-black uppercase tracking-tighter mb-1 italic truncate text-white">{node.destination}</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-8">
                <i className="fas fa-chair text-amber-500"></i>
                {node.passengers.length} / {node.capacityNeeded} SEATS FILLED
              </p>

              <div className="space-y-6">
                <div className="flex gap-2">
                  {Array.from({ length: node.capacityNeeded }).map((_, i) => (
                    <div key={i} className={`w-12 h-12 rounded-xl border flex items-center justify-center ${node.passengers[i] ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-800'}`}>
                      {node.passengers[i] ? <i className="fas fa-user text-xs"></i> : <i className="fas fa-chair text-xs"></i>}
                    </div>
                  ))}
                </div>

                {node.status === 'forming' && (
                  <div className="space-y-3">
                    <button onClick={() => setJoinModalNodeId(node.id)} className="w-full py-5 bg-white/5 rounded-[2rem] font-black text-[10px] uppercase border border-white/10 text-white">Claim Seat</button>
                    <button onClick={() => onForceQualify(node.id)} className="w-full py-2 text-[8px] font-black uppercase text-slate-600 tracking-widest hover:text-emerald-500">Leader Force Deploy</button>
                  </div>
                )}

                {node.status === 'qualified' && (
                  <div className="bg-emerald-500/10 p-8 rounded-[2.5rem] border border-emerald-500/20 text-center animate-pulse">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Qualified Node</p>
                    <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase">Awaiting Driver</p>
                  </div>
                )}

                {node.status === 'dispatched' && driver && (
                  <div className="space-y-6 animate-in zoom-in">
                    <div className="p-8 bg-amber-500 text-[#020617] rounded-[2.5rem] text-center border-4 border-white/10 shadow-xl">
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2">Move Code</p>
                       <p className="text-5xl font-black italic tracking-tighter">{node.verificationCode}</p>
                    </div>
                    <div className="flex gap-4">
                      <a href={`tel:${driver.contact}`} className="flex-1 py-4 bg-indigo-600 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase text-white"><i className="fas fa-phone"></i> Call</a>
                      <a href={`https://wa.me/${driver.contact}`} target="_blank" className="flex-1 py-4 bg-emerald-600 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase text-white"><i className="fab fa-whatsapp"></i> Chat</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Form Node Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="glass-bright w-full max-w-lg rounded-[3.5rem] p-12 space-y-10 animate-in zoom-in duration-300">
            <h3 className="text-3xl font-black italic tracking-tighter uppercase text-center text-white">Form Ride Node</h3>
            <div className="space-y-6 text-slate-900">
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-8 py-5 outline-none focus:border-amber-500 font-bold" placeholder="Destination (Hostel/Building)" onChange={e => setDest(e.target.value)} />
               <div className="grid grid-cols-2 gap-6">
                  <select className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-5 outline-none font-bold" onChange={e => setType(e.target.value as VehicleType)}>
                    <option value="Pragia">Pragia (4 Seats)</option>
                    <option value="Taxi">Taxi (4 Seats)</option>
                  </select>
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-5 outline-none focus:border-amber-500 font-bold" placeholder="Leader Name" onChange={e => setLeader(e.target.value)} />
               </div>
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-8 py-5 outline-none focus:border-amber-500 font-bold" placeholder="WhatsApp Number" onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="flex gap-4">
               <button onClick={() => setShowModal(false)} className="flex-1 py-5 bg-white/10 rounded-[2rem] font-black text-[10px] uppercase text-white">Cancel</button>
               <button onClick={createNode} className="flex-1 py-5 bg-amber-500 text-[#020617] rounded-[2rem] font-black text-[10px] uppercase shadow-xl">Deploy Node</button>
            </div>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {joinModalNodeId && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6">
           <div className="glass-bright w-full max-w-sm rounded-[3rem] p-12 space-y-8 animate-in zoom-in">
              <h3 className="text-2xl font-black italic uppercase text-center text-white">Join Ride</h3>
              <div className="space-y-4 text-slate-900">
                 <input className="w-full bg-white border border-slate-200 rounded-2xl px-8 py-5 outline-none font-bold" placeholder="Your Name" onChange={e => setJoinName(e.target.value)} />
                 <input className="w-full bg-white border border-slate-200 rounded-2xl px-8 py-5 outline-none font-bold" placeholder="WhatsApp / Phone" onChange={e => setJoinPhone(e.target.value)} />
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setJoinModalNodeId(null)} className="flex-1 py-4 bg-white/10 rounded-[2rem] font-black text-[10px] uppercase text-white">Cancel</button>
                 <button onClick={() => { onJoin(joinModalNodeId, joinName, joinPhone); setJoinModalNodeId(null); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-[10px] uppercase shadow-xl">Confirm Seat</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const DriverPortal = ({ drivers, qualifiedNodes, dispatchedNodes, onAccept, onVerify, onRequestTopup, search, settings }: any) => {
  const [activeDriver, setActiveDriver] = useState<Driver | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [momoRef, setMomoRef] = useState('');

  const filteredQualified = qualifiedNodes.filter((n: any) => 
    n.capacityNeeded === (activeDriver?.vehicleType === 'Pragia' || activeDriver?.vehicleType === 'Taxi' ? 4 : 3) &&
    n.destination.toLowerCase().includes(search.toLowerCase())
  );

  if (!activeDriver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-10">
        <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white">Driver Identity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl">
          {drivers.map((d: any) => (
            <button key={d.id} onClick={() => setActiveDriver(d)} className="glass p-10 rounded-[3rem] border border-white/5 hover:border-amber-500/50 transition-all text-left">
              <div className="flex justify-between items-start">
                 <p className="font-black uppercase italic text-2xl text-white">{d.name}</p>
                 <i className={`fas ${d.vehicleType === 'Pragia' ? 'fa-motorcycle' : 'fa-taxi'} text-slate-500`}></i>
              </div>
              <p className="text-[10px] text-slate-500 font-black uppercase mt-4">Wallet Balance: ₵ {d.walletBalance.toFixed(2)}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-8 duration-700 space-y-12">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-8">
          <div className="w-20 h-20 bg-amber-500 rounded-[2.5rem] flex items-center justify-center text-[#020617] shadow-2xl">
            <i className={`fas ${activeDriver.vehicleType === 'Pragia' ? 'fa-motorcycle' : 'fa-taxi'} text-3xl`}></i>
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase italic text-white leading-none">{activeDriver.name}</h2>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-2">Available Credit: ₵ {activeDriver.walletBalance.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setShowTopupModal(true)} className="px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl">Add Funds</button>
          <button onClick={() => setActiveDriver(null)} className="px-8 py-4 bg-white/5 text-slate-400 rounded-2xl text-[10px] font-black uppercase">Switch User</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
           <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 italic">Qualified Jobs ({activeDriver.vehicleType})</h3>
           <div className="space-y-6">
            {filteredQualified.map((node: any) => (
              <div key={node.id} className="glass rounded-[3.5rem] p-10 flex items-center justify-between border border-white/5 hover:border-amber-500/30 transition-all">
                  <div>
                    <h4 className="text-3xl font-black tracking-tighter uppercase italic text-white">{node.destination}</h4>
                    <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest">{node.passengers.length} Students Organized</p>
                  </div>
                  <div className="text-right space-y-4">
                    <p className="text-3xl font-black text-emerald-400">₵ {node.farePerPerson * node.capacityNeeded}</p>
                    <button onClick={() => onAccept(node.id, activeDriver.id)} className="px-14 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-xl">Accept (₵{settings.commissionPerSeat})</button>
                  </div>
              </div>
            ))}
            {filteredQualified.length === 0 && <div className="py-40 glass rounded-[4rem] text-center opacity-30 italic uppercase tracking-[0.5em] text-[10px]">No active qualified nodes...</div>}
           </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 italic">Verify Arrival</h3>
           {dispatchedNodes.filter((n: any) => n.assignedDriverId === activeDriver.id).map((node: any) => (
              <div key={node.id} className="glass rounded-[3.5rem] p-10 border border-amber-500/30 space-y-8">
                 <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[9px] font-black text-amber-500 uppercase mb-1">Active Trip</p>
                      <h4 className="text-2xl font-black uppercase italic truncate text-white leading-tight">{node.destination}</h4>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <input className="w-full bg-[#0f172a] border border-white/10 rounded-[2rem] px-6 py-6 text-center text-5xl font-black outline-none focus:border-emerald-500 text-white" placeholder="0000" maxLength={4} onChange={e => setVerifyCode(e.target.value)} />
                    <button onClick={() => onVerify(node.id, verifyCode)} className="w-full py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black text-[11px] uppercase shadow-2xl">Submit Verification</button>
                 </div>
              </div>
           ))}
        </div>
      </div>

      {showTopupModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="glass-bright w-full max-w-lg rounded-[3.5rem] p-12 space-y-10 animate-in zoom-in">
            <h3 className="text-3xl font-black italic tracking-tighter uppercase text-center text-white">Manual Top-Up</h3>
            <div className="space-y-6 text-slate-900">
               <div className="p-8 bg-amber-500/10 rounded-[2.5rem] border border-amber-500/20 text-center">
                  <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-2">Admin MoMo Number</p>
                  <p className="text-4xl font-black text-white italic">{settings.adminMomo}</p>
                  <p className="text-[9px] text-slate-500 mt-4 uppercase font-black">Send funds first, then provide details below</p>
               </div>
               <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-8 py-5 outline-none font-black text-emerald-600 text-2xl text-center" placeholder="Amount Sent (₵)" onChange={e => setTopupAmount(e.target.value)} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-8 py-5 outline-none font-bold text-center" placeholder="Transaction Reference / MoMo ID" onChange={e => setMomoRef(e.target.value)} />
            </div>
            <div className="flex gap-4">
               <button onClick={() => setShowTopupModal(false)} className="flex-1 py-5 bg-white/10 rounded-[2rem] font-black text-[10px] uppercase text-white">Cancel</button>
               {/* Corrected typo: changed requestTopup to onRequestTopup as provided in the component props */}
               <button onClick={() => { onRequestTopup(activeDriver.id, Number(topupAmount), momoRef); setShowTopupModal(false); }} className="flex-1 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-[10px] uppercase shadow-xl">Request Credit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminPortal = ({ activeTab, setActiveTab, nodes, setNodes, drivers, onAddDriver, onDeleteDriver, transactions, topupRequests, onApproveTopup, onLock, search, settings, onUpdateSettings }: any) => {
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [newDriver, setNewDriver] = useState<Partial<Driver>>({ vehicleType: 'Pragia' });
  const [aiCommand, setAiCommand] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const pendingRequests = topupRequests.filter((r: any) => 
    r.status === 'pending' && 
    (r.momoReference.toLowerCase().includes(search.toLowerCase()) || drivers.find((d:any)=>d.id===r.driverId)?.name.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredDrivers = drivers.filter((d: any) => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.licensePlate.toLowerCase().includes(search.toLowerCase())
  );

  const handleRegisterDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if(!newDriver.name || !newDriver.contact) {
      alert("Missing required driver details");
      return;
    }
    onAddDriver(newDriver);
    setNewDriver({ vehicleType: 'Pragia' });
    setShowDriverModal(false);
  };

  const handleAiArchitect = async () => {
    if(!aiCommand) return;
    setIsAiLoading(true);
    setAiFeedback(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Act as the AI Architect for UniHub Logistics.
        
        System Context:
        - Settings: ${JSON.stringify(settings)}
        - Drivers: ${drivers.map((d:any) => d.name).join(', ')}
        - Nodes: ${nodes.length}
        
        Actions:
        1. UPDATE_SETTINGS: { adminMomo, whatsappNumber, commissionPerSeat, adminSecret }
        2. ADD_DRIVER: { name, vehicleType, contact, licensePlate }
        3. CREATE_NODE: { destination, leaderName, leaderPhone, type }
        4. NOTIFY: { message }

        User Command: "${aiCommand}"

        Rules:
        - Return ONLY JSON.
        - Default Pragia capacity is always 4.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING, enum: ['UPDATE_SETTINGS', 'ADD_DRIVER', 'CREATE_NODE', 'NOTIFY'] },
              payload: { type: Type.OBJECT },
              message: { type: Type.STRING }
            },
            required: ['action', 'message']
          }
        }
      });

      const result = JSON.parse(response.text);
      setAiFeedback(result.message);

      if (result.action === 'UPDATE_SETTINGS') {
        onUpdateSettings({ ...settings, ...result.payload });
      } else if (result.action === 'ADD_DRIVER') {
        onAddDriver(result.payload);
      } else if (result.action === 'CREATE_NODE') {
        const node: RideNode = {
          id: `NODE-${Date.now()}`,
          destination: result.payload.destination,
          origin: 'Campus Hub',
          capacityNeeded: 4,
          passengers: [{ id: 'P-AI', name: result.payload.leaderName, phone: result.payload.leaderPhone }],
          status: 'forming',
          leaderName: result.payload.leaderName,
          leaderPhone: result.payload.leaderPhone,
          farePerPerson: result.payload.type === 'Pragia' ? 5 : 8,
          createdAt: new Date().toISOString()
        };
        setNodes([node, ...nodes]);
      }
      setAiCommand('');
    } catch (e) {
      setAiFeedback("Architect engine error. Please check your command.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="animate-in slide-in-from-bottom-8 duration-500 space-y-12 pb-20">
      <div className="flex justify-between items-center overflow-x-auto no-scrollbar pb-2">
        <div className="flex bg-white/5 p-1 rounded-3xl w-fit border border-white/10 shrink-0">
          <TabBtn active={activeTab === 'monitor'} label="Monitor" onClick={() => setActiveTab('monitor')} />
          <TabBtn active={activeTab === 'fleet'} label="Fleet" onClick={() => setActiveTab('fleet')} />
          <TabBtn 
            active={activeTab === 'requests'} 
            label="Requests" 
            onClick={() => setActiveTab('requests')} 
            count={pendingRequests.length}
          />
          <TabBtn active={activeTab === 'ledger'} label="Finance" onClick={() => setActiveTab('ledger')} />
          <TabBtn active={activeTab === 'settings'} label="Settings" onClick={() => setActiveTab('settings')} />
          <TabBtn active={activeTab === 'ai'} label="AI Command" onClick={() => setActiveTab('ai')} isAi />
        </div>
        <button onClick={onLock} className="px-6 py-4 bg-rose-600/20 text-rose-500 rounded-2xl text-[10px] font-black uppercase border border-rose-500/20 ml-4 shrink-0">Lock</button>
      </div>

      {activeTab === 'monitor' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
           <StatCard label="Forming" value={nodes.filter((n:any) => n.status === 'forming').length} icon="fa-users" color="text-amber-400" />
           <StatCard label="Qualified" value={nodes.filter((n:any) => n.status === 'qualified').length} icon="fa-bolt-lightning" color="text-emerald-400" />
           <StatCard label="Active Moves" value={nodes.filter((n:any) => n.status === 'dispatched').length} icon="fa-location-arrow" color="text-indigo-400" />
           <StatCard label="Live Fleet" value={drivers.length} icon="fa-taxi" color="text-slate-400" />
        </div>
      )}

      {activeTab === 'fleet' && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Driver Registry</h3>
              <button onClick={() => setShowDriverModal(true)} className="px-8 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] text-[10px] font-black uppercase shadow-xl">Register New Driver</button>
           </div>
           <div className="glass rounded-[3.5rem] overflow-hidden border border-white/5">
              <table className="w-full text-left">
                 <thead className="bg-white/5 border-b border-white/5 text-[10px] text-slate-500 uppercase font-black tracking-widest">
                    <tr>
                       <th className="px-10 py-6">Driver</th>
                       <th className="px-10 py-6">Vehicle</th>
                       <th className="px-10 py-6 text-center">Wallet</th>
                       <th className="px-10 py-6 text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {filteredDrivers.map((d: any) => (
                       <tr key={d.id} className="hover:bg-white/5 transition-all text-sm font-bold">
                          <td className="px-10 py-6">
                            <div className="text-white italic">{d.name}</div>
                            <div className="text-[10px] text-slate-500 font-medium">{d.contact}</div>
                          </td>
                          <td className="px-10 py-6 text-slate-400 uppercase text-xs">{d.vehicleType} | {d.licensePlate}</td>
                          <td className="px-10 py-6 text-center text-emerald-400 font-black italic">₵ {d.walletBalance.toFixed(2)}</td>
                          <td className="px-10 py-6 text-right">
                             <button onClick={() => onDeleteDriver(d.id)} className="text-rose-500 hover:text-rose-400 px-4"><i className="fas fa-trash-can"></i></button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="max-w-3xl mx-auto space-y-10 animate-in zoom-in">
           <div className="bg-amber-500/10 p-12 rounded-[4rem] border border-amber-500/20 text-center relative overflow-hidden group">
              <div className="relative z-10 space-y-6">
                 <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center text-[#020617] mx-auto shadow-2xl">
                    <i className="fas fa-microchip text-3xl"></i>
                 </div>
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">AI Architect</h2>
                 <p className="text-slate-400 text-sm font-medium italic">Control the platform with your voice commands</p>
                 <div className="relative pt-6">
                    <input 
                       className="w-full bg-[#020617] border-2 border-white/10 rounded-[2.5rem] py-8 px-10 text-white font-bold text-lg outline-none focus:border-amber-500 transition-all placeholder:text-slate-800"
                       placeholder="Try: 'Register Yaw as a Pragia driver' or 'Set commission to 3'"
                       value={aiCommand}
                       onChange={e => setAiCommand(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleAiArchitect()}
                    />
                    <button 
                       disabled={isAiLoading}
                       onClick={handleAiArchitect}
                       className="absolute right-4 top-[calc(50%+12px)] -translate-y-1/2 w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center text-[#020617] shadow-xl hover:scale-105 disabled:opacity-50"
                    >
                       {isAiLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-bolt-auto"></i>}
                    </button>
                 </div>
              </div>
           </div>
           {aiFeedback && (
              <div className="p-10 bg-white/5 border border-white/10 rounded-[3rem] animate-in slide-in-from-bottom-4">
                 <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500 mb-4">Command Center Logs</p>
                 <p className="text-slate-300 font-bold italic text-lg">{aiFeedback}</p>
              </div>
           )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {pendingRequests.map((req: any) => {
             const driver = drivers.find((d: any) => d.id === req.driverId);
             return (
               <div key={req.id} className="glass p-10 rounded-[3.5rem] border border-emerald-500/30 space-y-8 relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-emerald-400 uppercase mb-1 tracking-widest">Verify MoMo Sent</p>
                    <h4 className="text-2xl font-black uppercase italic text-white">{driver?.name || 'Unknown Driver'}</h4>
                    <p className="text-[11px] text-slate-500 font-bold uppercase mt-2">REF: {req.momoReference}</p>
                    <p className="text-4xl font-black text-white italic mt-6">₵ {req.amount}</p>
                  </div>
                  <button onClick={() => onApproveTopup(req.id)} className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-[11px] uppercase shadow-xl relative z-10 transition-all hover:bg-emerald-500">Approve Funds</button>
               </div>
             );
           })}
           {pendingRequests.length === 0 && <div className="col-span-full py-40 text-center opacity-30 uppercase tracking-widest italic font-black">No pending credit requests</div>}
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="glass rounded-[3.5rem] overflow-hidden border border-white/5 shadow-2xl">
           <table className="w-full text-left">
              <thead className="bg-white/5 border-b border-white/5">
                 <tr>
                    <th className="px-12 py-8 text-[11px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                    <th className="px-12 py-8 text-[11px] font-black text-slate-500 uppercase tracking-widest">Entity</th>
                    <th className="px-12 py-8 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Type</th>
                    <th className="px-12 py-8 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Profit Contribution</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                 {transactions.slice().reverse().map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition-all text-sm font-bold">
                       <td className="px-12 py-10 text-slate-400">{tx.timestamp}</td>
                       <td className="px-12 py-10 uppercase italic text-white">{drivers.find((d:any)=>d.id===tx.driverId)?.name || 'Generic'}</td>
                       <td className="px-12 py-10 text-center">
                          <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${tx.type === 'commission' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>{tx.type}</span>
                       </td>
                       <td className="px-12 py-10 text-right font-black text-emerald-400 text-xl italic uppercase">₵ {tx.type === 'commission' ? tx.amount.toFixed(2) : `0.00`}</td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-white/5 p-12 rounded-[4rem] border border-white/10 space-y-12 animate-in zoom-in">
           <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Platform Control</h3>
           <div className="space-y-8">
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-amber-500 uppercase tracking-widest px-6">Master Vault Password (Key)</label>
                 <input className="w-full bg-white/5 border border-white/10 rounded-[2rem] px-8 py-5 font-black text-2xl text-white outline-none focus:border-amber-500 transition-all" value={settings.adminSecret} onChange={e => onUpdateSettings({...settings, adminSecret: e.target.value})} />
              </div>
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-amber-500 uppercase tracking-widest px-6">Admin MoMo Number</label>
                 <input className="w-full bg-white/5 border border-white/10 rounded-[2rem] px-8 py-5 font-black text-2xl text-white outline-none focus:border-amber-500 transition-all" value={settings.adminMomo} onChange={e => onUpdateSettings({...settings, adminMomo: e.target.value})} />
              </div>
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-amber-500 uppercase tracking-widest px-6">WhatsApp Endpoint</label>
                 <input className="w-full bg-white/5 border border-white/10 rounded-[2rem] px-8 py-5 font-black text-2xl text-white outline-none focus:border-amber-500 transition-all" value={settings.whatsappNumber} onChange={e => onUpdateSettings({...settings, whatsappNumber: e.target.value})} />
              </div>
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-emerald-400 uppercase tracking-widest px-6">Hub Commission per Seat (₵)</label>
                 <input type="number" className="w-full bg-white/5 border border-white/10 rounded-[2rem] px-8 py-5 font-black text-2xl text-emerald-400 outline-none focus:border-emerald-500 transition-all" value={settings.commissionPerSeat} onChange={e => onUpdateSettings({...settings, commissionPerSeat: Number(e.target.value)})} />
              </div>
           </div>
        </div>
      )}

      {/* Driver Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="glass-bright w-full max-w-lg rounded-[3.5rem] p-12 space-y-10 animate-in zoom-in">
            <h3 className="text-3xl font-black italic tracking-tighter uppercase text-center text-white">Register Fleet Unit</h3>
            <form onSubmit={handleRegisterDriver} className="space-y-6 text-slate-900">
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-8 py-5 outline-none font-bold" placeholder="Driver Full Name" onChange={e => setNewDriver({...newDriver, name: e.target.value})} />
               <div className="grid grid-cols-2 gap-6">
                  <select className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-5 outline-none font-bold" onChange={e => setNewDriver({...newDriver, vehicleType: e.target.value as VehicleType})}>
                    <option value="Pragia">Pragia</option>
                    <option value="Taxi">Taxi</option>
                  </select>
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-5 outline-none font-bold" placeholder="Plate Number" onChange={e => setNewDriver({...newDriver, licensePlate: e.target.value})} />
               </div>
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-8 py-5 outline-none font-bold" placeholder="WhatsApp Number" onChange={e => setNewDriver({...newDriver, contact: e.target.value})} />
               <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowDriverModal(false)} className="flex-1 py-5 bg-slate-100 rounded-[2rem] font-black text-[10px] uppercase text-slate-400">Cancel</button>
                  <button type="submit" className="flex-1 py-5 bg-amber-500 text-[#020617] rounded-[2rem] font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">Submit Entry</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, label, onClick, count, isAi }: any) => (
  <button 
    onClick={onClick} 
    className={`px-6 py-3.5 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${
      active 
        ? (isAi ? 'bg-amber-500 text-[#020617] shadow-xl' : 'bg-indigo-600 text-white shadow-xl') 
        : (isAi ? 'text-amber-500/50 hover:text-amber-500' : 'text-slate-500 hover:text-slate-300')
    }`}
  >
    {isAi && <i className="fas fa-microchip mr-2"></i>}
    {label}
    {count !== undefined && count > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] px-2 py-0.5 rounded-full">{count}</span>}
  </button>
);

const StatCard = ({ label, value, icon, color }: any) => (
  <div className="glass p-10 rounded-[3.5rem] border border-white/5 hover:border-white/20 transition-all group overflow-hidden relative">
    <div className={`w-16 h-16 rounded-[2rem] bg-white/5 flex items-center justify-center mb-10 ${color} group-hover:scale-110 transition-all border border-white/10`}>
      <i className={`fas ${icon} text-2xl`}></i>
    </div>
    <div className="relative z-10">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">{label}</p>
      <p className="text-5xl font-black tracking-tighter italic text-white leading-none">{value}</p>
    </div>
    <i className={`fas ${icon} absolute top-[-20px] right-[-20px] text-8xl opacity-[0.03] transition-transform`}></i>
  </div>
);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
