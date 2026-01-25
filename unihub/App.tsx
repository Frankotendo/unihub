import React, { useState, useEffect, useMemo } from 'react';
import { Location, Product, Order, LocalVendor, BusinessSettings } from './types';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Orders from './components/Orders';
import AIAssistant from './components/AIAssistant';
import LocalDeals from './components/LocalDeals';
import KumasiHub from './components/KumasiHub';
import PublicCatalog from './components/PublicCatalog';

const App: React.FC = () => {
  // Navigation state for Admin
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'dormaa' | 'kumasi' | 'orders' | 'ai' | 'settings'>('dashboard');
  
  // Is it the strict customer link? (?view=store)
  const isStrictStealth = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'store';
  }, []);

  // Is the admin just previewing the store?
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Safe initializers to prevent silent failures on bad data
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('unidrop_products');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse products:", e);
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
    } catch (e) {
      return [];
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('unidrop_orders');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
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

  // --- RENDERING LOGIC ---

  if (isStrictStealth) {
    return <PublicCatalog products={products} settings={settings} />;
  }

  if (isPreviewing) {
    return (
      <PublicCatalog 
        products={products} 
        settings={settings} 
        onBack={() => setIsPreviewing(false)} 
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc] font-sans">
      <nav className="w-full md:w-72 bg-[#0a192f] text-white p-8 space-y-8 flex-shrink-0 flex flex-col">
        <div className="flex items-center space-x-4 mb-8">
          <div className="bg-indigo-500 p-3 rounded-2xl shadow-lg shadow-indigo-500/30">
            <i className="fas fa-bolt text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none">{settings.storeName.split(' ')[0]}<span className="text-indigo-400">.</span></h1>
            <p className="text-[10px] font-black text-indigo-400/50 uppercase tracking-widest mt-1">Admin Console</p>
          </div>
        </div>
        
        <div className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
          <NavItem icon="fa-chart-pie" label="Insights" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon="fa-box" label="Inventory" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <NavItem icon="fa-location-dot" label="Dormaa Local" active={activeTab === 'dormaa'} onClick={() => setActiveTab('dormaa')} />
          <NavItem icon="fa-truck-fast" label="Kumasi Hub" active={activeTab === 'kumasi'} onClick={() => setActiveTab('kumasi')} />
          <NavItem icon="fa-receipt" label="Orders & Credit" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavItem icon="fa-wand-magic-sparkles" label="Marketing AI" active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} />
          <NavItem icon="fa-cog" label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>

        <div className="pt-8 border-t border-white/5 space-y-3">
          <button 
            onClick={() => setIsPreviewing(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white transition-all py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
          >
            <i className="fas fa-eye"></i>
            Preview Store
          </button>
          <button 
            onClick={() => {
               const url = window.location.origin + window.location.pathname + '?view=store';
               navigator.clipboard.writeText(url);
               alert("Customer link copied! Send this to your WhatsApp groups.");
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white transition-all py-3 rounded-2xl flex items-center justify-center gap-3 text-[9px] font-bold uppercase tracking-widest"
          >
            <i className="fas fa-share-nodes"></i>
            Copy Customer Link
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-8">
          <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tighter leading-none mb-3 uppercase">
              {activeTab === 'settings' ? 'Global Settings' : activeTab.replace(/([A-Z])/g, ' $1').trim()}
            </h2>
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">Node Active // {settings.storeName}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4">
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Store Status</p>
                <p className="text-xs font-bold text-emerald-500 uppercase">Online & Sourcing</p>
             </div>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard products={products} orders={orders} />}
        {activeTab === 'inventory' && <Inventory products={products} onAddProduct={addProduct} />}
        {activeTab === 'dormaa' && <LocalDeals products={products} vendors={vendors} onAddProduct={addProduct} onAddVendor={addVendor} />}
        {activeTab === 'kumasi' && <KumasiHub products={products} onAddProduct={addProduct} />}
        {activeTab === 'orders' && <Orders orders={orders} products={products} onAddOrder={addOrder} onUpdateOrder={updateOrder} />}
        {activeTab === 'ai' && <AIAssistant products={products} onAddSchedule={() => {}} />}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
             <h3 className="text-2xl font-black text-slate-800 uppercase mb-8">Business Profile</h3>
             <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Store Name</label>
                  <input type="text" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold outline-none ring-2 ring-transparent focus:ring-indigo-100" value={settings.storeName} onChange={e => setSettings({...settings, storeName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp Number (For Orders)</label>
                  <input type="text" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold outline-none ring-2 ring-transparent focus:ring-indigo-100" placeholder="e.g. 233541234567" value={settings.whatsappNumber} onChange={e => setSettings({...settings, whatsappNumber: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Note for Customers</label>
                  <textarea className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold min-h-[100px] outline-none ring-2 ring-transparent focus:ring-indigo-100" value={settings.deliveryNote} onChange={e => setSettings({...settings, deliveryNote: e.target.value})} />
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
    className={`w-full flex items-center space-x-4 px-6 py-4 rounded-2xl transition-all duration-400 ${
      active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <i className={`fas ${icon} w-5 text-lg`}></i>
    <span className="text-xs font-black uppercase tracking-[0.2em]">{label}</span>
  </button>
);

export default App;