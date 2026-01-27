
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  isSolo?: boolean;
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
  whatsappNumber: string;
  commissionPerSeat: number;
  adminSecret: string;
  farePerPragia: number;
  farePerTaxi: number;
  soloMultiplier: number;
  aboutMeText: string;
  aboutMeImages: string[]; // Base64 strings
}

// --- UTILS ---

const shareHub = async () => {
  const shareData = {
    title: 'UniHub Dispatch',
    text: 'Join the smartest ride-sharing hub on campus! Form groups, save costs, and move fast.',
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
  const message = node.isSolo 
    ? `🚀 *UniHub Dropping!* \n📍 *Route:* ${node.origin} → ${node.destination}\n🚕 *Solo Request* needs a driver!`
    : `🚀 *Ride Hub Alert!*\n📍 *Route:* ${node.origin} → ${node.destination}\n👥 *Seats Left:* ${seatsLeft}\n💰 *Price:* ₵${node.farePerPerson}/p\n\nJoin my ride node on UniHub! 👇\n${window.location.origin}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'Join my UniHub Ride',
        text: message,
        url: window.location.origin
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  } catch (err) {
    console.log('Node share failed', err);
  }
};

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'ledger' | 'requests' | 'settings' | 'ai'>('monitor');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('unihub_admin_auth_v11') === 'true';
  });
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => {
    return sessionStorage.getItem('unihub_driver_session_v11');
  });

  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isNewUser, setIsNewUser] = useState(() => !localStorage.getItem('unihub_seen_welcome_v11'));

  // Global Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('unihub_settings_v11');
    return saved ? JSON.parse(saved) : {
      adminMomo: "024-123-4567",
      whatsappNumber: "233241234567",
      commissionPerSeat: 2.00,
      adminSecret: "2025",
      farePerPragia: 5.00,
      farePerTaxi: 8.00,
      soloMultiplier: 2.5,
      aboutMeText: "Welcome to UniHub Dispatch. We provide the safest and most efficient campus logistics solutions. Formed by students, for students.",
      aboutMeImages: []
    };
  });

  // Core Data State
  const [nodes, setNodes] = useState<RideNode[]>(() => {
    const saved = localStorage.getItem('unihub_dispatch_nodes_v11');
    return saved ? JSON.parse(saved) : [];
  });
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    const saved = localStorage.getItem('unihub_dispatch_drivers_v11');
    return saved ? JSON.parse(saved) : [
      { id: 'DRV-1', name: 'Kwame Mensah', vehicleType: 'Pragia', licensePlate: 'AS-202-24', contact: '233241234567', walletBalance: 20.0, rating: 4.9, status: 'online', pin: '1111' },
      { id: 'DRV-2', name: 'Yaw Boateng', vehicleType: 'Taxi', licensePlate: 'GW-881-23', contact: '233551234567', walletBalance: 5.0, rating: 4.7, status: 'online', pin: '2222' }
    ];
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('unihub_dispatch_tx_v11');
    return saved ? JSON.parse(saved) : [];
  });
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>(() => {
    const saved = localStorage.getItem('unihub_dispatch_topups_v11');
    return saved ? JSON.parse(saved) : [];
  });

  const [globalSearch, setGlobalSearch] = useState('');

  // Persist Changes
  useEffect(() => {
    localStorage.setItem('unihub_settings_v11', JSON.stringify(settings));
    localStorage.setItem('unihub_dispatch_nodes_v11', JSON.stringify(nodes));
    localStorage.setItem('unihub_dispatch_drivers_v11', JSON.stringify(drivers));
    localStorage.setItem('unihub_dispatch_tx_v11', JSON.stringify(transactions));
    localStorage.setItem('unihub_dispatch_topups_v11', JSON.stringify(topupRequests));
  }, [settings, nodes, drivers, transactions, topupRequests]);

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

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

    alert("Job accepted! Route and code shared with you.");
  };

  const verifyRide = (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.verificationCode === code) {
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, status: 'completed' as NodeStatus } : n));
      alert("Verification successful!");
    } else {
      alert("Wrong code! Ask the passenger for their code.");
    }
  };

  const requestTopup = (driverId: string, amount: number, ref: string) => {
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
    setTopupRequests(prev => [req, ...prev]);
    alert("Request logged.");
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
    if(confirm("Confirm deletion?")) {
      setDrivers(prev => prev.filter(d => d.id !== id));
    }
  };

  const hubRevenue = useMemo(() => transactions.filter(t => t.type === 'commission').reduce((a, b) => a + b.amount, 0), [transactions]);
  const pendingRequestsCount = useMemo(() => topupRequests.filter(r => r.status === 'pending').length, [topupRequests]);

  const handleAdminAuth = (password: string) => {
    if (password === settings.adminSecret) {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('unihub_admin_auth_v11', 'true');
    } else {
      alert("Master Key Invalid");
    }
  };

  const handleDriverAuth = (driverId: string, pin: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver && driver.pin === pin) {
      setActiveDriverId(driverId);
      sessionStorage.setItem('unihub_driver_session_v11', driverId);
      setViewMode('driver');
    } else {
      alert("Access Denied: Invalid Driver PIN");
    }
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

  // Nav Guard
  const safeSetViewMode = (mode: PortalMode) => {
    if (activeDriverId && mode !== 'driver') {
      if (confirm("Logout from Driver Terminal?")) {
        handleDriverLogout();
      } else {
        return;
      }
    }
    setViewMode(mode);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans">
      
      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl">
              <i className="fas fa-route text-[#020617] text-xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white">UniHub</h1>
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Logistics Engine</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => setShowQrModal(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-amber-500 hover:bg-white/10 transition-all">
              <i className="fas fa-qrcode text-xs"></i>
            </button>
            <button onClick={() => setShowHelpModal(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-white/10 transition-all">
              <i className="fas fa-circle-question text-xs"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Passenger Hub" onClick={() => {safeSetViewMode('passenger'); setGlobalSearch('');}} />
          <NavItem active={viewMode === 'driver'} icon="fa-steering-wheel" label="Driver Terminal" onClick={() => {safeSetViewMode('driver'); setGlobalSearch('');}} />
          <NavItem 
            active={viewMode === 'admin'} 
            icon="fa-shield-halved" 
            label="Admin Command" 
            onClick={() => {safeSetViewMode('admin'); setGlobalSearch('');}} 
            badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
          />
          <NavItem active={false} icon="fa-share-nodes" label="Invite Friends" onClick={shareHub} />
        </div>

        <div className="pt-6 border-t border-white/5">
           {activeDriver ? (
             <div className="bg-indigo-500/10 p-6 rounded-[2.5rem] border border-indigo-500/20 relative overflow-hidden mb-4">
                <p className="text-[9px] font-black uppercase text-indigo-400 mb-1">Active Driver</p>
                <p className="text-lg font-black text-white truncate">{activeDriver.name}</p>
                <button onClick={handleDriverLogout} className="mt-4 w-full py-2 bg-indigo-600 rounded-xl text-[8px] font-black uppercase tracking-widest">Logout</button>
             </div>
           ) : null}
          <div className="bg-emerald-500/10 p-6 rounded-[2.5rem] border border-emerald-500/20 relative overflow-hidden">
            <p className="text-[9px] font-black uppercase text-emerald-400 mb-1">Total Hub Profit</p>
            <p className="text-3xl font-black text-white">₵ {hubRevenue.toFixed(2)}</p>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around px-4">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Hub" onClick={() => safeSetViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-steering-wheel" label="Drive" onClick={() => safeSetViewMode('driver')} />
        <MobileNavItem 
          active={viewMode === 'admin'} 
          icon="fa-shield-halved" 
          label="Admin" 
          onClick={() => safeSetViewMode('admin')} 
          badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
        />
        <MobileNavItem active={false} icon="fa-circle-question" label="Help" onClick={() => setShowHelpModal(true)} />
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
          
          {isNewUser && (
            <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
              <div className="relative z-10 flex items-center gap-6 text-center sm:text-left">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white text-2xl backdrop-blur-md shrink-0">
                   <i className="fas fa-sparkles"></i>
                </div>
                <div>
                   <h2 className="text-xl font-black uppercase italic leading-none">Welcome to the Hub</h2>
                   <p className="text-xs font-bold opacity-80 mt-1 uppercase tracking-tight">First time here? Check out our quick start guide.</p>
                </div>
              </div>
              <div className="relative z-10 flex gap-3 w-full sm:w-auto">
                 <button onClick={() => setShowHelpModal(true)} className="flex-1 sm:flex-none px-6 py-3 bg-white text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl">Open Guide</button>
                 <button onClick={dismissWelcome} className="flex-1 sm:flex-none px-6 py-3 bg-indigo-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest">Got it</button>
              </div>
              <i className="fas fa-route absolute right-[-20px] top-[-20px] text-[150px] opacity-10 pointer-events-none rotate-12"></i>
            </div>
          )}

          {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
            <div className="relative group">
               <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
               <input 
                  type="text" 
                  placeholder="Search routes or users..." 
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-4 lg:py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-700"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
               />
            </div>
          )}

          {viewMode === 'passenger' && (
            <PassengerPortal nodes={nodes} setNodes={setNodes} onJoin={joinNode} onForceQualify={forceQualify} drivers={drivers} search={globalSearch} settings={settings} onShowQr={() => setShowQrModal(true)} />
          )}
          {viewMode === 'driver' && (
            <DriverPortal 
              drivers={drivers} 
              activeDriver={activeDriver}
              onLogin={handleDriverAuth}
              onLogout={handleDriverLogout}
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
                onLock={() => {setIsAdminAuthenticated(false); sessionStorage.removeItem('unihub_admin_auth_v11');}}
                search={globalSearch}
                settings={settings}
                onUpdateSettings={setSettings}
                hubRevenue={hubRevenue}
              />
            )
          )}
        </div>
      </main>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-sm:px-4 max-w-sm rounded-[3rem] p-10 space-y-8 animate-in zoom-in text-center border border-white/10">
              <div className="space-y-2">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">Hub QR Code</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Direct Link to UniHub Dispatch</p>
              </div>
              
              <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl relative group">
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}&bgcolor=ffffff&color=020617&format=svg`} 
                   className="w-full aspect-square"
                   alt="Hub QR"
                 />
                 <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-[2.5rem]">
                    <p className="text-[#020617] font-black uppercase text-[10px] mb-4">Print for Station</p>
                    <a 
                      href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(window.location.origin)}&format=png`} 
                      download="unihub-qr.png" 
                      target="_blank"
                      className="px-6 py-3 bg-amber-500 text-[#020617] rounded-xl text-[10px] font-black uppercase shadow-xl"
                    >
                      <i className="fas fa-download mr-2"></i> Download HD
                    </a>
                 </div>
              </div>

              <div className="flex gap-4">
                 <button onClick={() => setShowQrModal(false)} className="flex-1 py-4 bg-white/5 rounded-[1.5rem] font-black text-[10px] uppercase text-slate-400">Close</button>
                 <button onClick={shareHub} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-transform">Share Link</button>
              </div>
           </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-3xl rounded-[3rem] p-8 lg:p-12 space-y-10 animate-in zoom-in border border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                      <i className="fas fa-graduation-cap"></i>
                   </div>
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">Hub Help Center</h3>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Operational Guides v1.0</p>
                   </div>
                </div>
                <button onClick={() => setShowHelpModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                   <i className="fas fa-times"></i>
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <HelpSection 
                   icon="fa-user-graduate" 
                   title="Passenger Guide" 
                   color="text-amber-500"
                   points={[
                      "Form Node: Start a group ride to split costs (4 seats).",
                      "Quick Drop: Request a solo ride if you're in a hurry (fixed price).",
                      "Verification: Give your 4-digit code to the driver only when you reach your destination.",
                      "Safety: Share your node link with friends for tracking."
                   ]}
                />
                <HelpSection 
                   icon="fa-steering-wheel" 
                   title="Driver Guide" 
                   color="text-indigo-400"
                   points={[
                      "Earnings: Check 'Ready for Dispatch' to find waiting jobs.",
                      "Verification: You must input the passenger's code to complete the trip.",
                      "Commission: ₵2.00 per seat is deducted from your hub wallet.",
                      "Top-Up: Send money to the Admin MoMo and log the reference to get credit."
                   ]}
                />
                <HelpSection 
                   icon="fa-circle-info" 
                   title="General Rules" 
                   color="text-emerald-400"
                   points={[
                      "Pricing: Fares are determined by vehicle type and solo multipliers.",
                      "Cancellation: Use the WhatsApp chat to resolve trip issues.",
                      "Privacy: Contact details are only visible to matched drivers.",
                      "Support: Click 'Invite' to spread the hub to more hostels."
                   ]}
                />
             </div>

             <div className="pt-6 border-t border-white/5 flex justify-center">
                <button onClick={() => setShowHelpModal(false)} className="px-12 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest text-white hover:bg-white/10 transition-all">Understood</button>
             </div>
          </div>
        </div>
      )}
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
  const [pass, setPass] = useState('');
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in">
      <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] border border-amber-500/20 flex items-center justify-center text-amber-500 mb-8 shadow-2xl">
        <i className="fas fa-shield-halved text-3xl"></i>
      </div>
      <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8 text-white">Admin Vault</h2>
      <div className="w-full max-sm:px-4 max-w-sm glass p-8 lg:p-10 rounded-[2.5rem] border border-white/10 space-y-6">
          <input 
            type="password" 
            placeholder="Master Key" 
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-amber-500 font-bold text-center text-white"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onLogin(pass)}
          />
        <button onClick={() => onLogin(pass)} className="w-full py-4 bg-amber-500 text-[#020617] rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Enter Vault</button>
      </div>
    </div>
  );
};

const PassengerPortal = ({ nodes, setNodes, onJoin, onForceQualify, drivers, search, settings, onShowQr }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [joinModalNodeId, setJoinModalNodeId] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [leader, setLeader] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<VehicleType>('Pragia');
  const [isSolo, setIsSolo] = useState(false);
  
  const [joinName, setJoinName] = useState('');
  const [joinPhone, setJoinPhone] = useState('');

  const filteredNodes = nodes.filter((n: any) => 
    n.status !== 'completed' && 
    (n.destination.toLowerCase().includes(search.toLowerCase()) || 
     n.origin.toLowerCase().includes(search.toLowerCase()) ||
     n.leaderName.toLowerCase().includes(search.toLowerCase()))
  );

  const createNode = () => {
    if (!dest || !origin || !leader) return;
    
    const standardFare = type === 'Pragia' ? settings.farePerPragia : settings.farePerTaxi;
    const finalFare = isSolo ? Math.ceil(standardFare * settings.soloMultiplier) : standardFare;

    const node: RideNode = {
      id: `NODE-${Date.now()}`,
      origin: origin,
      destination: dest,
      capacityNeeded: isSolo ? 1 : 4, 
      passengers: [{ id: 'P-LEAD', name: leader, phone }],
      status: isSolo ? 'qualified' : 'forming',
      leaderName: leader,
      leaderPhone: phone,
      farePerPerson: finalFare,
      createdAt: new Date().toISOString(),
      isSolo: isSolo
    };
    setNodes([node, ...nodes]);
    setShowModal(false);
    // Reset fields
    setOrigin(''); setDest(''); setLeader(''); setPhone(''); setIsSolo(false);
  };

  return (
    <div className="animate-in fade-in space-y-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Passenger Hub</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Request drops or form nodes</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={onShowQr} className="w-12 h-12 lg:hidden bg-white/5 rounded-2xl flex items-center justify-center text-amber-500 border border-white/10 shadow-xl">
             <i className="fas fa-qrcode"></i>
          </button>
          <button onClick={() => setShowModal(true)} className="flex-1 sm:flex-none px-8 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-transform">Form Ride</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNodes.map((node: any) => {
          const driver = drivers.find((d: any) => d.id === node.assignedDriverId);
          return (
            <div key={node.id} className={`glass rounded-[2.5rem] p-8 border transition-all ${node.status === 'dispatched' ? 'border-amber-500/30' : 'border-white/5 hover:border-white/10'}`}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-2">
                  <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest ${node.status === 'dispatched' ? 'bg-amber-500 text-[#020617]' : 'bg-white/5 text-slate-400'}`}>{node.status}</span>
                  {node.isSolo && <span className="px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Solo Drop</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => shareNode(node)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-amber-500 hover:bg-amber-500 hover:text-[#020617] transition-all">
                    <i className="fas fa-share-nodes text-[10px]"></i>
                  </button>
                  <p className="text-lg font-black text-emerald-400 leading-none">₵ {node.farePerPerson}/p</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="relative pl-6 border-l-2 border-white/5">
                  <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-slate-500"></div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">From</p>
                  <p className="text-white font-bold text-sm truncate uppercase">{node.origin}</p>
                </div>
                <div className="relative pl-6 border-l-2 border-white/5">
                  <div className="absolute left-[-5px] bottom-0 w-2 h-2 rounded-full bg-amber-500"></div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">To</p>
                  <p className="text-white font-black text-lg truncate uppercase">{node.destination}</p>
                </div>
              </div>

              <div className="space-y-6">
                {!node.isSolo && (
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

                {node.status === 'forming' && !node.isSolo && (
                  <button onClick={() => setJoinModalNodeId(node.id)} className="w-full py-4 bg-white/5 border border-white/10 rounded-[1.5rem] font-black text-[10px] uppercase text-white hover:bg-white/10 transition-all">Claim Seat</button>
                )}

                {node.status === 'dispatched' && driver && (
                  <div className="space-y-4 animate-in zoom-in">
                    <div className="p-6 bg-amber-500 text-[#020617] rounded-[1.5rem] text-center shadow-xl">
                       <p className="text-[8px] font-black uppercase mb-1">Move Code</p>
                       <p className="text-4xl font-black italic">{node.verificationCode}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <a href={`tel:${driver.contact}`} className="py-3 bg-indigo-600 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase text-white"><i className="fas fa-phone"></i> Call</a>
                      <a href={`https://wa.me/${driver.contact}`} target="_blank" className="py-3 bg-emerald-600 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase text-white"><i className="fab fa-whatsapp"></i> Chat</a>
                    </div>
                  </div>
                )}

                {node.status === 'qualified' && !driver && (
                  <div className="py-4 text-center bg-white/5 rounded-2xl border border-white/5">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Awaiting driver pick-up...</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filteredNodes.length === 0 && (
           <div className="col-span-full py-20 text-center opacity-30 flex flex-col items-center animate-in zoom-in">
              <i className="fas fa-satellite text-4xl text-slate-500 mb-6"></i>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] italic">No active nodes in this sector...</p>
           </div>
        )}
      </div>

      {/* About Section */}
      <section className="pt-12 border-t border-white/5">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-4">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">About UniHub</h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mx-auto italic">{settings.aboutMeText}</p>
          </div>
          
          {settings.aboutMeImages && settings.aboutMeImages.length > 0 && (
            <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar snap-x">
               {settings.aboutMeImages.map((img, idx) => (
                 <div key={idx} className="flex-shrink-0 w-72 h-48 rounded-[2rem] overflow-hidden border border-white/10 snap-center shadow-2xl">
                    <img src={img} className="w-full h-full object-cover" alt={`Hub preview ${idx}`} />
                 </div>
               ))}
            </div>
          )}
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-lg rounded-[2.5rem] p-8 lg:p-10 space-y-8 animate-in zoom-in text-slate-900">
            <div className="text-center">
              <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white">Create Ride Request</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase mt-1">Choose between Carpooling or Quick Drop</p>
            </div>

            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
              <button onClick={() => setIsSolo(false)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${!isSolo ? 'bg-amber-500 text-[#020617]' : 'text-slate-400'}`}>Form Group (Cheap)</button>
              <button onClick={() => setIsSolo(true)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isSolo ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}>Quick Drop (Solo)</button>
            </div>

            <div className="space-y-4">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Departure Point" value={origin} onChange={e => setOrigin(e.target.value)} />
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Destination" value={dest} onChange={e => setDest(e.target.value)} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <select className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold" value={type} onChange={e => setType(e.target.value as VehicleType)}>
                    <option value="Pragia">Pragia</option>
                    <option value="Taxi">Taxi</option>
                  </select>
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold" placeholder="Your Name" value={leader} onChange={e => setLeader(e.target.value)} />
               </div>
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="WhatsApp Number" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            
            <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 text-center">
              <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Estimated Fare</p>
              <p className="text-2xl font-black text-white italic">
                ₵ {isSolo 
                  ? Math.ceil((type === 'Pragia' ? settings.farePerPragia : settings.farePerTaxi) * settings.soloMultiplier)
                  : (type === 'Pragia' ? settings.farePerPragia : settings.farePerTaxi)} / Person
              </p>
            </div>

            <div className="flex gap-4">
               <button onClick={() => setShowModal(false)} className="flex-1 py-4 bg-white/10 rounded-[1.5rem] font-black text-[10px] uppercase text-white">Cancel</button>
               <button onClick={createNode} className={`flex-1 py-4 ${isSolo ? 'bg-emerald-500' : 'bg-amber-500'} text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-transform`}>
                 {isSolo ? 'Request Drop' : 'Form Node'}
               </button>
            </div>
          </div>
        </div>
      )}

      {joinModalNodeId && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[160] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-sm:px-4 max-w-sm rounded-[2rem] p-8 space-y-6 animate-in zoom-in text-slate-900">
              <h3 className="text-xl font-black italic uppercase text-center text-white">Join Ride</h3>
              <div className="space-y-4">
                 <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Name" onChange={e => setJoinName(e.target.value)} />
                 <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Phone" onChange={e => setJoinPhone(e.target.value)} />
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setJoinModalNodeId(null)} className="flex-1 py-4 bg-white/10 rounded-xl font-black text-[10px] uppercase text-white">Cancel</button>
                 <button onClick={() => { onJoin(joinModalNodeId, joinName, joinPhone); setJoinModalNodeId(null); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Join</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const DriverPortal = ({ drivers, activeDriver, onLogin, onLogout, qualifiedNodes, dispatchedNodes, onAccept, onVerify, onRequestTopup, search, settings }: any) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [momoRef, setMomoRef] = useState('');

  const filteredQualified = qualifiedNodes.filter((n: any) => 
    (n.destination.toLowerCase().includes(search.toLowerCase()) || n.origin.toLowerCase().includes(search.toLowerCase()))
  );

  if (!activeDriver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-10 px-4 animate-in fade-in">
        <div className="text-center">
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Driver Authentication</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-2">Select your profile to begin shift</p>
        </div>
        
        {selectedDriverId ? (
            <div className="w-full max-w-md glass p-10 rounded-[3rem] border border-white/10 space-y-8 animate-in zoom-in text-center">
                <div>
                   <p className="text-[10px] font-black text-amber-500 uppercase mb-1">Verify PIN for</p>
                   <h3 className="text-2xl font-black text-white italic">{drivers.find((d:any)=>d.id === selectedDriverId)?.name}</h3>
                </div>
                <input 
                  type="password" 
                  maxLength={4}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-4xl tracking-[1em] font-black outline-none focus:border-amber-500 text-center text-white" 
                  placeholder="0000"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onLogin(selectedDriverId, pin)}
                />
                <div className="flex gap-4">
                    <button onClick={() => {setSelectedDriverId(null); setPin('');}} className="flex-1 py-4 bg-white/5 rounded-xl font-black text-[10px] uppercase text-slate-400">Back</button>
                    <button onClick={() => onLogin(selectedDriverId, pin)} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-xl">Login</button>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
              {drivers.map((d: any) => (
                <button key={d.id} onClick={() => setSelectedDriverId(d.id)} className="glass p-8 rounded-[2rem] border border-white/5 text-left transition-all hover:border-amber-500/50 group">
                  <div className="flex justify-between items-start">
                     <p className="font-black uppercase italic text-xl text-white mb-4 group-hover:text-amber-500 transition-colors">{d.name}</p>
                     <i className="fas fa-lock-keyhole text-slate-700 text-xs mt-1"></i>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
                     <span>{d.vehicleType}</span>
                     <span>WALLET: ₵{d.walletBalance.toFixed(1)}</span>
                  </div>
                </button>
              ))}
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 bg-indigo-500/5 p-6 rounded-[2rem] border border-indigo-500/10">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-[#020617] shadow-xl">
            <i className={`fas ${activeDriver.vehicleType === 'Pragia' ? 'fa-motorcycle' : 'fa-taxi'} text-2xl`}></i>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tighter uppercase italic text-white leading-none">{activeDriver.name}</h2>
            <div className="flex items-center gap-4 mt-2">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">₵ {activeDriver.walletBalance.toFixed(2)}</p>
                <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                <p className="text-[9px] font-bold text-slate-500 uppercase">{activeDriver.vehicleType} | {activeDriver.licensePlate}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button onClick={() => setShowTopupModal(true)} className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">Top-Up</button>
          <button onClick={onLogout} className="flex-1 sm:flex-none px-6 py-3 bg-rose-600/10 text-rose-500 rounded-xl text-[10px] font-black uppercase border border-rose-500/20">End Shift</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
           <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic px-2">Ready for Dispatch</h3>
           
           <div className="space-y-4">
            {filteredQualified.map((node: any) => (
              <div key={node.id} className="glass rounded-[2rem] p-6 border border-white/5 hover:border-indigo-500/30 transition-all flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest ${node.isSolo ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-[#020617]'}`}>
                        {node.isSolo ? 'Quick Drop' : 'Node Carpool'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-white">
                        <p className="text-[8px] font-black text-slate-500 uppercase">Route Path</p>
                        <p className="font-black text-sm uppercase italic">{node.origin} → {node.destination}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Requested by {node.leaderName}</p>
                  </div>
                  <div className="flex items-center gap-6 w-full md:w-auto justify-between border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-500 uppercase">Payout</p>
                      <p className="text-2xl font-black text-emerald-400 leading-none">₵ {node.farePerPerson * (node.isSolo ? 1 : node.capacityNeeded)}</p>
                    </div>
                    <button onClick={() => onAccept(node.id, activeDriver.id)} className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-transform">Accept Job</button>
                  </div>
              </div>
            ))}
            {filteredQualified.length === 0 && <div className="py-20 text-center opacity-30 text-[10px] font-black uppercase tracking-[0.5em] italic">No active jobs in your area...</div>}
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic px-2">Active Mission</h3>
           {dispatchedNodes.filter((n: any) => n.assignedDriverId === activeDriver.id).map((node: any) => (
              <div key={node.id} className="glass rounded-[2rem] p-8 border border-amber-500/20 space-y-6 animate-in slide-in-from-right-4">
                 <div className="text-center">
                    <p className="text-[8px] font-black text-amber-500 uppercase mb-1">{node.isSolo ? 'Solo Mission' : 'Transit Operation'}</p>
                    <h4 className="text-xl font-black uppercase italic text-white leading-none truncate">{node.origin} to {node.destination}</h4>
                 </div>
                 <div className="space-y-4 pt-4 border-t border-white/5">
                    <p className="text-[9px] font-black text-slate-500 text-center uppercase">Verify Code to finish</p>
                    <input className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-5 text-center text-4xl font-black outline-none focus:border-emerald-500 text-white" placeholder="0000" maxLength={4} onChange={e => setVerifyCode(e.target.value)} />
                    <button onClick={() => onVerify(node.id, verifyCode)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Complete Ride</button>
                 </div>
              </div>
           ))}
        </div>
      </div>

      {showTopupModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-md rounded-[2.5rem] p-8 space-y-8 animate-in zoom-in text-slate-900">
            <h3 className="text-2xl font-black italic tracking-tighter uppercase text-center text-white">Credit Request</h3>
            <div className="space-y-4">
               <div className="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-center">
                  <p className="text-[9px] font-black text-amber-500 uppercase mb-1">Hub MoMo</p>
                  <p className="text-3xl font-black text-white italic">{settings.adminMomo}</p>
               </div>
               <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-black text-emerald-600 text-center text-xl" placeholder="Amount (₵)" onChange={e => setTopupAmount(e.target.value)} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-center" placeholder="Transaction Reference" onChange={e => setMomoRef(e.target.value)} />
            </div>
            <div className="flex gap-4">
               <button onClick={() => setShowTopupModal(false)} className="flex-1 py-4 bg-white/10 rounded-xl font-black text-[10px] uppercase text-white">Cancel</button>
               <button onClick={() => { onRequestTopup(activeDriver.id, Number(topupAmount), momoRef); setShowTopupModal(false); }} className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Send Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminPortal = ({ activeTab, setActiveTab, nodes, setNodes, drivers, onAddDriver, onDeleteDriver, transactions, topupRequests, onApproveTopup, onLock, search, settings, onUpdateSettings, hubRevenue }: any) => {
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [newDriver, setNewDriver] = useState<Partial<Driver>>({ vehicleType: 'Pragia', pin: '0000' });
  const [aiCommand, setAiCommand] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingRequests = topupRequests.filter((r: any) => 
    r.status === 'pending' && 
    (r.momoReference.toLowerCase().includes(search.toLowerCase()) || drivers.find((d:any)=>d.id===r.driverId)?.name.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredDrivers = drivers.filter((d: any) => 
    d.name.toLowerCase().includes(search.toLowerCase()) || d.licensePlate.toLowerCase().includes(search.toLowerCase())
  );

  const handleRegisterDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if(!newDriver.name || !newDriver.contact || !newDriver.pin) return;
    onAddDriver(newDriver);
    setNewDriver({ vehicleType: 'Pragia', pin: '0000' });
    setShowDriverModal(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          onUpdateSettings({
            ...settings,
            aboutMeImages: [...(settings.aboutMeImages || []), reader.result as string]
          });
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    onUpdateSettings({
      ...settings,
      aboutMeImages: settings.aboutMeImages.filter((_, i) => i !== index)
    });
  };

  const handleAiArchitect = async () => {
    if(!aiCommand) return;
    setIsAiLoading(true);
    setAiFeedback(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Interpret: "${aiCommand}". Context: Settings: ${JSON.stringify(settings)}. Return JSON ONLY: {action: 'UPDATE_SETTINGS'|'ADD_DRIVER'|'CREATE_NODE'|'NOTIFY', payload, message}.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
      
      const text = response.text;
      if (text) {
        const result = JSON.parse(text.trim());
        setAiFeedback(result.message);
        if (result.action === 'UPDATE_SETTINGS') onUpdateSettings({ ...settings, ...result.payload });
        else if (result.action === 'ADD_DRIVER') onAddDriver({ pin: '0000', ...result.payload });
      } else {
        setAiFeedback("No response from AI engine.");
      }
      setAiCommand('');
    } catch (e) { 
      console.error(e);
      setAiFeedback("Architect engine error."); 
    } finally { 
      setIsAiLoading(false); 
    }
  };

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-8 pb-10">
      <div className="flex bg-white/5 p-1 rounded-[1.5rem] border border-white/10 overflow-x-auto no-scrollbar max-w-full">
        <TabBtn active={activeTab === 'monitor'} label="Stats" onClick={() => setActiveTab('monitor')} />
        <TabBtn active={activeTab === 'fleet'} label="Fleet" onClick={() => setActiveTab('fleet')} />
        <TabBtn active={activeTab === 'requests'} label="Credit" onClick={() => setActiveTab('requests')} count={pendingRequests.length} />
        <TabBtn active={activeTab === 'settings'} label="Setup" onClick={() => setActiveTab('settings')} />
        <TabBtn active={activeTab === 'ai'} label="AI" onClick={() => setActiveTab('ai')} isAi />
        <button onClick={onLock} className="px-6 py-3 text-[9px] font-black uppercase text-rose-500 border-l border-white/5">Lock</button>
      </div>

      {activeTab === 'monitor' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <StatCard label="Forming" value={nodes.filter((n:any) => n.status === 'forming').length} icon="fa-users" color="text-amber-400" />
           <StatCard label="Live Fleet" value={drivers.length} icon="fa-taxi" color="text-indigo-400" />
           <StatCard label="Qualified" value={nodes.filter((n:any) => n.status === 'qualified').length} icon="fa-bolt" color="text-emerald-400" />
           <StatCard label="Revenue" value={hubRevenue.toFixed(0)} icon="fa-money-bill" color="text-slate-400" isCurrency />
        </div>
      )}

      {activeTab === 'fleet' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center px-2">
              <h3 className="text-xl font-black uppercase italic text-white leading-none">Fleet Registry</h3>
              <button onClick={() => setShowDriverModal(true)} className="px-6 py-3 bg-amber-500 text-[#020617] rounded-xl text-[9px] font-black uppercase shadow-xl">Register Unit</button>
           </div>
           <div className="glass rounded-[2rem] overflow-hidden border border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                   <thead className="bg-white/5 text-slate-500 uppercase font-black tracking-widest border-b border-white/5">
                      <tr>
                         <th className="px-8 py-5">Driver Name</th>
                         <th className="px-8 py-5 text-center">Vehicle</th>
                         <th className="px-8 py-5 text-center">Security PIN</th>
                         <th className="px-8 py-5 text-center">Wallet</th>
                         <th className="px-8 py-5"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                      {filteredDrivers.map((d: any) => (
                         <tr key={d.id} className="text-slate-300 font-bold hover:bg-white/5 transition-colors">
                            <td className="px-8 py-5">
                                <div className="text-white italic">{d.name}</div>
                                <div className="text-[9px] text-slate-500 font-medium">{d.contact}</div>
                            </td>
                            <td className="px-8 py-5 text-center uppercase text-[9px] text-slate-400">{d.vehicleType}<br/>{d.licensePlate}</td>
                            <td className="px-8 py-5 text-center font-black text-amber-500 tracking-[0.2em]">{d.pin}</td>
                            <td className="px-8 py-5 text-center text-emerald-400 font-black italic">₵{d.walletBalance.toFixed(1)}</td>
                            <td className="px-8 py-5 text-right"><button onClick={() => onDeleteDriver(d.id)} className="text-rose-500 hover:text-rose-400"><i className="fas fa-trash"></i></button></td>
                         </tr>
                      ))}
                   </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-8">
           <div className="bg-white/5 p-8 lg:p-12 rounded-[2.5rem] border border-white/10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-amber-500 uppercase px-6">Master Vault Key</label>
                    <input className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-white" value={settings.adminSecret} onChange={e => onUpdateSettings({...settings, adminSecret: e.target.value})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-amber-500 uppercase px-6">Admin MoMo</label>
                    <input className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-white" value={settings.adminMomo} onChange={e => onUpdateSettings({...settings, adminMomo: e.target.value})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-emerald-400 uppercase px-6">Solo Multiplier (x)</label>
                    <input type="number" step="0.1" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-emerald-400" value={settings.soloMultiplier} onChange={e => onUpdateSettings({...settings, soloMultiplier: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-emerald-400 uppercase px-6">Hub Profit / Seat (₵)</label>
                    <input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-emerald-400" value={settings.commissionPerSeat} onChange={e => onUpdateSettings({...settings, commissionPerSeat: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-indigo-400 uppercase px-6">Pragia Fare / Seat (₵)</label>
                    <input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-indigo-400" value={settings.farePerPragia} onChange={e => onUpdateSettings({...settings, farePerPragia: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-indigo-400 uppercase px-6">Taxi Fare / Seat (₵)</label>
                    <input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black text-lg text-indigo-400" value={settings.farePerTaxi} onChange={e => onUpdateSettings({...settings, farePerTaxi: Number(e.target.value)})} />
                 </div>
              </div>
           </div>

           <div className="bg-white/5 p-8 lg:p-12 rounded-[2.5rem] border border-white/10 space-y-10">
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white px-6">Branding & About Me</h3>
              <div className="space-y-6 px-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">About UniHub Description</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-medium text-sm text-slate-300 h-32 outline-none focus:border-amber-500"
                      value={settings.aboutMeText}
                      onChange={e => onUpdateSettings({...settings, aboutMeText: e.target.value})}
                      placeholder="Tell your story..."
                    />
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Team & Hub Images</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                       {settings.aboutMeImages?.map((img, i) => (
                         <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 group">
                            <img src={img} className="w-full h-full object-cover" />
                            <button onClick={() => removeImage(i)} className="absolute top-2 right-2 w-6 h-6 bg-rose-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                               <i className="fas fa-times text-[10px]"></i>
                            </button>
                         </div>
                       ))}
                       <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-slate-500 hover:text-amber-500 hover:border-amber-500/50 transition-all">
                          <i className="fas fa-plus text-xl mb-2"></i>
                          <span className="text-[8px] font-black uppercase tracking-widest">Upload</span>
                       </button>
                       <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleImageUpload} accept="image/*" />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {pendingRequests.map((req: any) => {
             const driver = drivers.find((d: any) => d.id === req.driverId);
             return (
               <div key={req.id} className="glass p-8 rounded-[2rem] border border-emerald-500/20 space-y-6 relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[9px] font-black text-emerald-400 uppercase mb-1 tracking-widest">Awaiting Approval</p>
                    <h4 className="text-xl font-black uppercase italic text-white leading-none mb-2">{driver?.name || 'User'}</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate">REF: {req.momoReference}</p>
                    <p className="text-3xl font-black text-white italic mt-6">₵ {req.amount}</p>
                  </div>
                  <button onClick={() => onApproveTopup(req.id)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-emerald-500 transition-all relative z-10">Approve Credit</button>
               </div>
             );
           })}
           {pendingRequests.length === 0 && <div className="col-span-full py-20 text-center opacity-30 font-black text-[10px] uppercase tracking-widest">No pending credit requests</div>}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="max-w-xl mx-auto space-y-8 animate-in zoom-in">
           <div className="bg-amber-500/10 p-10 rounded-[2.5rem] border border-amber-500/20 text-center relative overflow-hidden">
              <i className="fas fa-microchip text-3xl text-amber-500 mb-6"></i>
              <h2 className="text-2xl font-black uppercase italic text-white mb-2 leading-none">Architect Engine</h2>
              <div className="relative">
                 <input className="w-full bg-[#020617] border border-white/10 rounded-xl py-5 px-6 text-white font-bold outline-none focus:border-amber-500 transition-all" placeholder="e.g. 'Set solo multiplier to 3.0'" value={aiCommand} onChange={e => setAiCommand(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAiArchitect()} />
                 <button disabled={isAiLoading} onClick={handleAiArchitect} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center text-[#020617] disabled:opacity-50">
                    {isAiLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-bolt"></i>}
                 </button>
              </div>
           </div>
           {aiFeedback && <div className="p-8 bg-indigo-500/10 border border-indigo-500/20 rounded-[2rem] text-slate-300 font-bold italic text-sm animate-in slide-in-from-bottom-2">{aiFeedback}</div>}
        </div>
      )}

      {/* Driver Registration Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-sm:px-4 max-w-lg rounded-[2.5rem] p-8 lg:p-10 space-y-8 animate-in zoom-in text-slate-900">
            <h3 className="text-2xl font-black italic tracking-tighter uppercase text-center text-white">Register Fleet Unit</h3>
            <form onSubmit={handleRegisterDriver} className="space-y-4">
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Driver Full Name" onChange={e => setNewDriver({...newDriver, name: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                  <select className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold" onChange={e => setNewDriver({...newDriver, vehicleType: e.target.value as VehicleType})}>
                    <option value="Pragia">Pragia</option>
                    <option value="Taxi">Taxi</option>
                  </select>
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold" placeholder="Plate Number" onChange={e => setNewDriver({...newDriver, licensePlate: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="WhatsApp Number" onChange={e => setNewDriver({...newDriver, contact: e.target.value})} />
                  <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-black tracking-widest text-center" placeholder="Set PIN (4-digit)" maxLength={4} onChange={e => setNewDriver({...newDriver, pin: e.target.value})} value={newDriver.pin} />
               </div>
               <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowDriverModal(false)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-[10px] uppercase text-slate-400">Cancel</button>
                  <button type="submit" className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-xl">Submit Entry</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, label, onClick, count, isAi }: any) => (
  <button onClick={onClick} className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${active ? (isAi ? 'bg-amber-500 text-[#020617]' : 'bg-indigo-600 text-white') : 'text-slate-500 hover:text-slate-300'}`}>
    {label} {count !== undefined && count > 0 && <span className="ml-1 bg-rose-500 text-white text-[7px] px-1.5 py-0.5 rounded-full ring-2 ring-[#020617]">{count}</span>}
  </button>
);

const StatCard = ({ label, value, icon, color, isCurrency }: any) => (
  <div className="glass p-6 rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col justify-end min-h-[140px] group transition-all hover:border-white/10">
    <i className={`fas ${icon} absolute top-6 left-6 ${color} text-xl transition-transform group-hover:scale-110`}></i>
    <div className="relative z-10">
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-black italic text-white leading-none">{isCurrency ? '₵' : ''}{value}</p>
    </div>
  </div>
);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
