
import React, { useState, useEffect, useMemo } from 'react';
import { Location, Product, Order, LocalVendor, BusinessSettings } from './types';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Orders from './components/Orders';
import AIAssistant from './components/AIAssistant';
import LocalDeals from './components/LocalDeals';
import KumasiHub from './components/KumasiHub';
import PublicCatalog from './components/PublicCatalog';

type TabType = 'dashboard' | 'inventory' | 'dormaa' | 'kumasi' | 'orders' | 'ai' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const isStrictStealth = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'store';
  }, []);

  const [isPreviewing, setIsPreviewing] = useState(false);

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('unidrop_products');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [settings, setSettings] = useState<BusinessSettings>(() => {
    try {
      const saved = localStorage.getItem('unidrop_settings');
      return saved ? JSON.parse(saved) : {
        storeName: 'UniDrop Dormaa',
        whatsappNumber: '233XXXXXXXXX',
        currency: 'GHS',
        deliveryNote: 'Hostel delivery within 24 hours.'
      };
    } catch (e) {
      return {
        storeName: 'UniDrop Dormaa',
        whatsappNumber: '233XXXXXXXXX',
        currency: 'GHS',
        deliveryNote: 'Hostel delivery within 24 hours.'
      };
    }
  });

  const [vendors, setVendors] = useState<LocalVendor[]>(() => {
    try {
      const saved = localStorage.getItem('unidrop_vendors');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('unidrop_orders');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    localStorage.setItem('unidrop_products', JSON.stringify(products));
    localStorage.setItem('unidrop_orders', JSON.stringify(orders));
    localStorage.setItem('unidrop_vendors', JSON.stringify(vendors));
    localStorage.setItem('unidrop_settings', JSON.stringify(settings));
  }, [products, orders, vendors, settings]);

  const addProduct = (product: Product) => setProducts([product, ...products]);
  const addOrder = (order: Order) => setOrders([order, ...orders]);
  const addVendor = (vendor: LocalVendor) => setVendors([...vendors, vendor]);
  const updateOrder = (updated: Order) => setOrders(orders.map(o => o.id === updated.id ? updated : o));

  const handleShare = async () => {
    const storeUrl = `${window.location.origin}${window.location.pathname}?view=store`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: settings.storeName,
          text: `Shop ${settings.storeName} for your campus essentials!`,
          url: storeUrl,
        });
      } catch (err) {
        console.log('Share error');
      }
    } else {
      await navigator.clipboard.writeText(storeUrl);
      alert('Link copied to clipboard!');
    }
  };

  if (isStrictStealth) return <PublicCatalog products={products} settings={settings} />;
  if (isPreviewing) return <PublicCatalog products={products} settings={settings} onBack={() => setIsPreviewing(false)} />;

  const navItems: {id: TabType, label: string, icon: string}[] = [
    { id: 'dashboard', label: 'Insights', icon: 'fa-chart-pie' },
    { id: 'inventory', label: 'Inventory', icon: 'fa-box' },
    { id: 'dormaa', label: 'Dormaa Local', icon: 'fa-location-dot' },
    { id: 'kumasi', label: 'Kumasi Hub', icon: 'fa-truck-fast' },
    { id: 'orders', label: 'Orders & Credit', icon: 'fa-receipt' },
    { id: 'ai', label: 'Marketing AI', icon: 'fa-wand-magic-sparkles' },
    { id: 'settings', label: 'Settings', icon: 'fa-cog' }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc] font-sans text-slate-900">
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex w-72 bg-[#0a192f] text-white p-8 space-y-8 flex-shrink-0 flex-col sticky top-0 h-screen">
        <div className="flex items-center space-x-4 mb-8">
          <div className="bg-indigo-500 p-3 rounded-2xl shadow-lg shadow-indigo-500/30">
            <i className="fas fa-bolt text-white text-xl"></i>
          </div>
          <h1 className="text-2xl font-black tracking-tighter uppercase italic">{settings.storeName.split(' ')[0]}<span className="text-indigo-400">.</span></h1>
        </div>
        
        <div className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
          {navItems.map(item => (
            <NavItem key={item.id} icon={item.icon} label={item.label} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />
          ))}
        </div>

        <div className="pt-8 border-t border-white/5 space-y-3">
          <button onClick={() => setIsPreviewing(true)} className="w-full bg-white/5 hover:bg-white/10 text-white transition-all py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest border border-white/5">
            <i className="fas fa-eye"></i> Preview Store
          </button>
          <button onClick={handleShare} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white transition-all py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-lg">
            <i className="fas fa-share-nodes"></i> Share Store
          </button>
        </div>
      </nav>

      {/* Mobile Nav Header */}
      <header className="md:hidden bg-[#0a192f] text-white px-6 py-4 flex items-center justify-between sticky top-0 z-[100]">
        <div className="flex items-center gap-2">
          <i className="fas fa-bolt text-indigo-400"></i>
          <span className="font-black italic uppercase text-sm tracking-tighter">{settings.storeName.split(' ')[0]}</span>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={activeTab} 
            onChange={(e) => setActiveTab(e.target.value as TabType)}
            className="bg-white/10 border-none outline-none rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest"
          >
            {navItems.map(item => <option key={item.id} value={item.id} className="text-slate-900">{item.label}</option>)}
          </select>
          <button onClick={handleShare} className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <i className="fas fa-share-nodes text-xs"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <header className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-8">
          <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tighter leading-none mb-3 uppercase">
              {navItems.find(n => n.id === activeTab)?.label}
            </h2>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">Node Active // {settings.storeName}</p>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard products={products} orders={orders} />}
        {activeTab === 'inventory' && <Inventory products={products} onAddProduct={addProduct} />}
        {activeTab === 'dormaa' && <LocalDeals products={products} vendors={vendors} onAddProduct={addProduct} onAddVendor={addVendor} />}
        {activeTab === 'kumasi' && <KumasiHub products={products} onAddProduct={addProduct} />}
        {activeTab === 'orders' && <Orders orders={orders} products={products} onAddOrder={addOrder} onUpdateOrder={updateOrder} />}
        {activeTab === 'ai' && <AIAssistant products={products} onAddSchedule={() => {}} />}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-xl border border-slate-100">
             <h3 className="text-2xl font-black text-slate-800 uppercase mb-8 italic">Business Profile</h3>
             <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Store Name</label>
                  <input type="text" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold outline-none focus:ring-4 focus:ring-indigo-100" value={settings.storeName} onChange={e => setSettings({...settings, storeName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp Number</label>
                  <input type="text" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold outline-none focus:ring-4 focus:ring-indigo-100" value={settings.whatsappNumber} onChange={e => setSettings({...settings, whatsappNumber: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Note</label>
                  <textarea className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold min-h-[100px] outline-none focus:ring-4 focus:ring-indigo-100" value={settings.deliveryNote} onChange={e => setSettings({...settings, deliveryNote: e.target.value})} />
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

const NavItem: React.FC<{ icon: string; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center space-x-4 px-6 py-4 rounded-2xl transition-all ${
      active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <i className={`fas ${icon} w-5 text-lg`}></i>
    <span className="text-xs font-black uppercase tracking-[0.2em]">{label}</span>
  </button>
);

export default App;
