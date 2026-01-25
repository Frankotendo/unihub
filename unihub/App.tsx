import React, { useState, useEffect } from 'react';
import { Location, Product, Order, BusinessSettings, LogisticsPartner, LocalVendor, Category } from './types';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Orders from './components/Orders';
import HubManager from './components/HubManager';
import PublicCatalog from './components/PublicCatalog';
import AIAssistant from './components/AIAssistant';

type TabType = 'dashboard' | 'inventory' | 'orders' | 'hubs' | 'ai' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [route, setRoute] = useState<string>(window.location.hash || '');
  const [viewMode, setViewMode] = useState<'admin' | 'store'>(() => {
    const hash = window.location.hash;
    return (hash === '#store' || hash === '#join') ? 'store' : 'admin';
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('unidrop_v4_products');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<BusinessSettings>(() => {
    const saved = localStorage.getItem('unidrop_v4_settings');
    return saved ? JSON.parse(saved) : {
      storeName: 'UniHub',
      whatsappNumber: '233XXXXXXXXX',
      currency: 'GHS',
      deliveryNote: 'Delivering to all hostels within 24 hours.',
      defaultMarkupPercent: 20,
      activeHubs: ['Campus Hub', 'Central Market', 'Regional Post']
    };
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('unidrop_v4_orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [logistics, setLogistics] = useState<LogisticsPartner[]>(() => {
    const saved = localStorage.getItem('unidrop_v4_logistics');
    return saved ? JSON.parse(saved) : [];
  });

  const [vendors, setVendors] = useState<LocalVendor[]>(() => {
    const saved = localStorage.getItem('unidrop_v4_vendors');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('unidrop_v4_products', JSON.stringify(products));
    localStorage.setItem('unidrop_v4_orders', JSON.stringify(orders));
    localStorage.setItem('unidrop_v4_settings', JSON.stringify(settings));
    localStorage.setItem('unidrop_v4_logistics', JSON.stringify(logistics));
    localStorage.setItem('unidrop_v4_vendors', JSON.stringify(vendors));
  }, [products, orders, settings, logistics, vendors]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      setRoute(hash);
      if (hash === '#store' || hash === '#join') setViewMode('store');
      else if (hash === '#admin') setViewMode('admin');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleScoutSubmission = (data: { name: string, itemName: string, price: number, category: Category }) => {
    const markupPrice = Math.ceil(data.price * (1 + settings.defaultMarkupPercent / 100));
    const newProd: Product = {
      id: `ITEM-${Date.now()}`,
      name: data.itemName,
      category: data.category,
      sourcePrice: data.price,
      sellingPrice: markupPrice,
      location: 'Local Market',
      deliveryCost: 0,
      stock: 1,
      description: `Sourced by ${data.name}.`,
      isApproved: false,
      vendorName: data.name,
      createdAt: new Date().toISOString()
    };
    setProducts([newProd, ...products]);
  };

  const handleShareStore = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#store`;
    const shareData = {
      title: `${settings.storeName} - Campus Delivery`,
      text: `Check out the latest drops on ${settings.storeName}! Direct delivery to all hostels. 🚚🎒`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.warn('Share cancelled or failed');
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Store link copied to clipboard! Share it on WhatsApp! 🚀');
    }
  };

  if (viewMode === 'store') {
    return (
      <PublicCatalog 
        products={products.filter(p => p.isApproved !== false)} 
        settings={settings} 
        initialView={route === '#join' ? 'sell' : 'shop'}
        onScoutSubmit={handleScoutSubmission}
      />
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: 'fa-gauge-high' },
    { id: 'inventory', label: 'My Products', icon: 'fa-boxes-stacked' },
    { id: 'orders', label: 'Sales & Orders', icon: 'fa-truck-arrow-right' },
    { id: 'hubs', label: 'Delivery Hubs', icon: 'fa-map-location-dot' },
    { id: 'ai', label: 'Business AI Bot', icon: 'fa-robot' },
    { id: 'settings', label: 'App Settings', icon: 'fa-sliders' }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f1f5f9] font-sans">
      <nav className="hidden md:flex w-72 bg-[#0f172a] text-white p-8 flex-col sticky top-0 h-screen shadow-2xl">
        <div className="flex items-center gap-4 mb-12">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg relative overflow-hidden group">
            <i className="fas fa-truck-fast text-xl relative z-10 delivery-move"></i>
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic">UniHub</h1>
            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Hostel Logistics</p>
          </div>
        </div>
        
        <div className="space-y-1 flex-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as TabType)} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-xl translate-x-1' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <i className={`fas ${item.icon} w-5 text-lg`}></i>
              <span className="text-sm font-bold">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-3 mt-6">
          <button onClick={() => window.location.hash = '#store'} className="w-full bg-slate-800 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-3 border border-slate-700">
            <i className="fas fa-external-link-alt"></i> Open Store
          </button>
          <button onClick={handleShareStore} className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 shadow-lg">
            <i className="fas fa-share-nodes"></i> Share Store
          </button>
        </div>
      </nav>

      <header className="md:hidden bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between sticky top-0 z-[100] border-b border-slate-800">
        <span className="font-black italic uppercase tracking-tighter">UniHub</span>
        <div className="flex gap-2">
          <select value={activeTab} onChange={(e) => setActiveTab(e.target.value as TabType)} className="bg-white/10 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none">
            {navItems.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <button onClick={handleShareStore} className="bg-indigo-600 p-2 rounded-xl"><i className="fas fa-share-nodes"></i></button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard products={products} orders={orders} />}
          {activeTab === 'inventory' && <Inventory products={products} settings={settings} onAddProduct={(p) => setProducts([p, ...products])} onDelete={(id) => setProducts(products.filter(p => p.id !== id))} onApprove={(id) => setProducts(products.map(p => p.id === id ? {...p, isApproved: true} : p))} />}
          {activeTab === 'orders' && <Orders orders={orders} products={products} onAddOrder={(o) => setOrders([o, ...orders])} onUpdateOrder={(u) => setOrders(orders.map(o => o.id === u.id ? u : o))} />}
          {activeTab === 'hubs' && <HubManager products={products} settings={settings} logistics={logistics} vendors={vendors} onAddVendor={(v) => setVendors([v, ...vendors])} onAddLogistics={(l) => setLogistics([l, ...logistics])} onAddProduct={(p) => setProducts([p, ...products])} />}
          {activeTab === 'ai' && <AIAssistant products={products} orders={orders} />}
          {activeTab === 'settings' && (
            <div className="max-w-2xl bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
               <h2 className="text-2xl font-black mb-8 italic uppercase tracking-tighter">System Configuration</h2>
               <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Shop Name</label>
                    <input type="text" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold" value={settings.storeName} onChange={e => setSettings({...settings, storeName: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">WhatsApp Endpoint</label>
                    <input type="text" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold" value={settings.whatsappNumber} onChange={e => setSettings({...settings, whatsappNumber: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Profit Margin (%)</label>
                    <input type="number" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold" value={settings.defaultMarkupPercent} onChange={e => setSettings({...settings, defaultMarkupPercent: Number(e.target.value)})} />
                  </div>
                  <div className="pt-6 grid grid-cols-1 gap-4">
                    <button onClick={handleShareStore} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-indigo-500 transition-all flex items-center justify-center gap-3">
                      <i className="fas fa-share-nodes"></i> Broadcast Store Link
                    </button>
                    <button onClick={() => {
                        const data = JSON.stringify({ products, orders, settings, vendors, logistics });
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `unihub_data_backup.json`;
                        a.click();
                      }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-indigo-600 transition-all">
                      Export Local Ledger
                    </button>
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;