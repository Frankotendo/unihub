
import React, { useState, useEffect } from 'react';
import { AppView, Driver, Pool, BusinessSettings, Ad, Transaction } from './types.ts';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import FleetManager from './components/FleetManager.tsx';
import PassengerApp from './components/PassengerApp.tsx';
import MarketingAI from './components/MarketingAI.tsx';
import AdminLogin from './components/AdminLogin.tsx';
import AdsManager from './components/AdsManager.tsx';
import DriverPortal from './components/DriverPortal.tsx';
import { LogOut, Info, Wallet, Radio, ShieldCheck, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppView>(AppView.TERMINAL_INSIGHTS);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('unilink_auth') === 'true');
  
  // Stealth View Mode: Managed via URL Hash only
  const [viewMode, setViewMode] = useState<'admin' | 'passenger' | 'driver'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'admin') return 'admin';
    if (hash === 'driver') return 'driver';
    return 'passenger'; // Default to public passenger view
  });

  const [drivers, setDrivers] = useState<Driver[]>(() => {
    const saved = localStorage.getItem('unilink_drivers');
    return saved ? JSON.parse(saved) : [];
  });

  const [pools, setPools] = useState<Pool[]>(() => {
    const saved = localStorage.getItem('unilink_pools');
    return saved ? JSON.parse(saved) : [];
  });

  const [ads, setAds] = useState<Ad[]>(() => {
    const saved = localStorage.getItem('unilink_ads');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<BusinessSettings>(() => {
    const saved = localStorage.getItem('unilink_settings');
    return saved ? JSON.parse(saved) : {
      storeName: 'UniLink Ghana',
      whatsappNumber: '233XXXXXXXXX',
      currency: 'GHS',
      poolingThreshold: 3,
      commissionPerSeat: 1.50,
      adminPassword: 'UNIDROP_ADMIN_2025',
      adsEnabled: true,
      adsensePublisherId: '',
      adsenseSlotId: '',
      activeHubs: ['Accra', 'Kumasi', 'Dormaa'],
      defaultMarkupPercent: 15,
      momoDetails: 'MTN MoMo: 054XXXXXXX (UniLink Central Ops)'
    };
  });

  // Persist state
  useEffect(() => {
    localStorage.setItem('unilink_drivers', JSON.stringify(drivers));
    localStorage.setItem('unilink_pools', JSON.stringify(pools));
    localStorage.setItem('unilink_settings', JSON.stringify(settings));
    localStorage.setItem('unilink_ads', JSON.stringify(ads));
  }, [drivers, pools, settings, ads]);

  // Listen for hash changes for secret navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'admin') setViewMode('admin');
      else if (hash === 'driver') setViewMode('driver');
      else setViewMode('passenger');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogin = (password: string) => {
    if (password === (settings.adminPassword || 'UNIDROP_ADMIN_2025')) {
      setIsAuthenticated(true);
      sessionStorage.setItem('unilink_auth', 'true');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('unilink_auth');
    window.location.hash = ''; // Return to passenger view
  };

  const handleJoinPool = (poolId: string, passengerName: string) => {
    setPools(prevPools => {
      const pool = prevPools.find(p => p.id === poolId);
      if (!pool) return prevPools;

      const driverId = pool.driverId;
      setDrivers(prevDrivers => prevDrivers.map(d => {
        if (d.id === driverId) {
          const deduction = settings.commissionPerSeat;
          const newBalance = d.walletBalance - deduction;
          const newTx: Transaction = {
            id: `TX-${Date.now()}`,
            type: 'deduction',
            amount: deduction,
            description: `Seat link by ${passengerName} (${pool.routeFrom} -> ${pool.routeTo})`,
            timestamp: new Date().toISOString()
          };
          return { 
            ...d, 
            walletBalance: newBalance,
            isAvailable: newBalance > 0 ? d.isAvailable : false,
            transactions: [newTx, ...(d.transactions || [])]
          };
        }
        return d;
      }));

      return prevPools.map(p => {
        if (p.id === poolId && p.passengers.length < p.capacity) {
          return { ...p, passengers: [...p.passengers, passengerName] };
        }
        return p;
      });
    });
  };

  // View Routing: Passenger is the Default / Public face
  if (viewMode === 'passenger') {
    return (
      <PassengerApp 
        drivers={drivers.filter(d => d.walletBalance > 0)} 
        pools={pools.filter(p => p.status !== 'completed')} 
        settings={settings}
        ads={ads.filter(a => a.isActive)}
        onJoinPool={handleJoinPool}
        onCreatePool={(driverId, from, to) => {
          const driver = drivers.find(d => d.id === driverId);
          if (!driver || driver.walletBalance <= 0) {
             alert("Driver terminal currently unavailable (Low Balance).");
             return;
          }
          const newPool: Pool = {
            id: `POOL-${Date.now()}`,
            driverId,
            routeFrom: from,
            routeTo: to,
            passengers: [],
            capacity: driver.capacity,
            status: 'pooling',
            createdAt: new Date().toISOString()
          };
          setPools(prev => [newPool, ...prev]);
        }}
      />
    );
  }

  // Driver Portal: Accessed via #driver
  if (viewMode === 'driver') {
    return (
      <DriverPortal 
        drivers={drivers} 
        onAddDriver={(d) => setDrivers(prev => [d, ...prev])}
        onUpdateDriver={(d) => setDrivers(prev => prev.map(old => old.id === d.id ? d : old))}
        settings={settings}
      />
    );
  }

  // Admin Section: Secretly accessed via #admin
  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} storeName={settings.storeName} />;
  }

  const renderAdminContent = () => {
    switch (activeTab) {
      case AppView.TERMINAL_INSIGHTS:
        return <Dashboard products={drivers as any} orders={pools as any} settings={settings} />;
      case AppView.FLEET_REGISTRY:
        return (
          <FleetManager 
            drivers={drivers} 
            onAddDriver={(d) => setDrivers(prev => [d, ...prev])} 
            onDeleteDriver={(id) => setDrivers(prev => prev.filter(d => d.id !== id))}
            onCreditDriver={(id, amount) => setDrivers(prev => prev.map(d => {
              if (d.id === id) {
                const newTx: Transaction = {
                  id: `TX-CRED-${Date.now()}`,
                  type: 'credit',
                  amount: amount,
                  description: 'Manual credit top-up by Admin',
                  timestamp: new Date().toISOString()
                };
                return {
                  ...d,
                  walletBalance: d.walletBalance + amount,
                  transactions: [newTx, ...(d.transactions || [])]
                };
              }
              return d;
            }))}
          />
        );
      case AppView.ADS_MANAGER:
        return <AdsManager ads={ads} onUpdateAds={setAds} />;
      case AppView.MARKETING_STUDIO:
        return <MarketingAI products={drivers as any} />;
      case AppView.SETTINGS:
        return (
          <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in slide-in-from-bottom-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black italic uppercase text-slate-900">Platform Control</h2>
              <button onClick={handleLogout} className="flex items-center gap-2 px-6 py-3 bg-white text-rose-500 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border border-slate-100 hover:bg-rose-50 shadow-sm">
                <LogOut size={14} /> Exit Admin
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Core Business Config */}
              <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8">
                <div className="flex items-center gap-3">
                  <Zap size={20} className="text-sky-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Core Configuration</h3>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Terminal Brand</label>
                    <input className="w-full p-4 bg-slate-50 rounded-xl font-bold" value={settings.storeName} onChange={e => setSettings({...settings, storeName: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Platform Fee (GHS)</label>
                      <input type="number" step="0.1" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold" value={settings.commissionPerSeat} onChange={e => setSettings({...settings, commissionPerSeat: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Ops WhatsApp</label>
                      <input className="w-full p-4 bg-slate-50 rounded-xl font-bold" value={settings.whatsappNumber} onChange={e => setSettings({...settings, whatsappNumber: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white">
                  <label className="text-[10px] font-black text-sky-400 uppercase tracking-widest block mb-4">Momo Payment Details (Shown to Drivers)</label>
                  <textarea className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-bold h-24" value={settings.momoDetails} onChange={e => setSettings({...settings, momoDetails: e.target.value})} />
                </div>
              </div>

              {/* Monetization & AdSense Config */}
              <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Radio size={20} className="text-indigo-500" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Monetization Engine</h3>
                  </div>
                  <button 
                    onClick={() => setSettings({...settings, adsEnabled: !settings.adsEnabled})}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${settings.adsEnabled ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {settings.adsEnabled ? 'Ads Active' : 'Ads Paused'}
                  </button>
                </div>

                <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-start gap-4">
                  <Info className="text-indigo-500 shrink-0" size={18} />
                  <p className="text-[10px] font-bold text-indigo-700 leading-relaxed uppercase">
                    Connect your Google AdSense account to display ads in the Passenger terminal. This generates revenue from student traffic.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">AdSense Publisher ID</label>
                    <input 
                      placeholder="e.g. ca-pub-XXXXXXXXXXXXXXXX"
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs font-bold" 
                      value={settings.adsensePublisherId || ''} 
                      onChange={e => setSettings({...settings, adsensePublisherId: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Ad Unit Slot ID</label>
                    <input 
                      placeholder="e.g. 1234567890"
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs font-bold" 
                      value={settings.adsenseSlotId || ''} 
                      onChange={e => setSettings({...settings, adsenseSlotId: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <div className="bg-slate-50 p-6 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-900 uppercase">Internal Promos</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">AI Generated Route Highlights</p>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <Dashboard products={drivers as any} orders={pools as any} settings={settings} />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#f1f5f9]">
      <Sidebar 
        activeView={activeTab} 
        onViewChange={(view) => {
          setActiveTab(view);
          setIsMenuOpen(false);
        }} 
        storeName={settings.storeName}
        isMobileOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />
      <main className="flex-1 lg:h-screen overflow-y-auto p-5 md:p-8 lg:p-12">
        <div className="max-w-7xl mx-auto pb-24">
          {renderAdminContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
