
import React, { useState, useEffect } from 'react';
import { AppView, Product, Order, BusinessSettings, LogisticsPartner, LocalVendor, Category } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Orders from './components/Orders';
import HubManager from './components/HubManager';
import PublicCatalog from './components/PublicCatalog';
import AIAssistant from './components/AIAssistant';
import { Menu, X, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppView>(AppView.INSIGHTS);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
      storeName: 'UniDrop',
      whatsappNumber: '233XXXXXXXXX',
      currency: 'GHS',
      deliveryNote: 'Delivering to all hostels within 24 hours.',
      defaultMarkupPercent: 20,
      activeHubs: ['Dormaa', 'Kumasi', 'Accra']
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
      if (hash === '#store' || hash === '#join') setViewMode('store');
      else setViewMode('admin');
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
    setProducts(prev => [newProd, ...prev]);
  };

  if (viewMode === 'store') {
    return (
      <PublicCatalog 
        products={products.filter(p => p.isApproved !== false)} 
        settings={settings} 
        initialView={window.location.hash === '#join' ? 'sell' : 'shop'}
        onScoutSubmit={handleScoutSubmission}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case AppView.INSIGHTS:
        return <Dashboard products={products} orders={orders} />;
      case AppView.INVENTORY:
        return (
          <Inventory 
            products={products} 
            settings={settings} 
            onAddProduct={(p) => setProducts(prev => [p, ...prev])} 
            onDelete={(id) => setProducts(prev => prev.filter(p => p.id !== id))} 
            onApprove={(id) => setProducts(prev => prev.map(p => p.id === id ? {...p, isApproved: true} : p))} 
          />
        );
      case AppView.DORMAA_LOCAL:
      case AppView.KUMASI_HUB:
        return (
          <HubManager 
            products={products} 
            settings={settings} 
            logistics={logistics} 
            vendors={vendors} 
            onAddVendor={(v) => setVendors(prev => [v, ...prev])} 
            onAddLogistics={(l) => setLogistics(prev => [l, ...prev])} 
            onAddProduct={(p) => setProducts(prev => [p, ...prev])} 
          />
        );
      case AppView.ORDERS_CREDIT:
        return <Orders orders={orders} products={products} onAddOrder={(o) => setOrders(prev => [o, ...prev])} onUpdateOrder={(u) => setOrders(prev => prev.map(o => o.id === u.id ? u : o))} />;
      case AppView.MARKETING_AI:
        return <AIAssistant products={products} orders={orders} />;
      case AppView.SETTINGS:
        return (
          <div className="max-w-2xl bg-white p-6 md:p-10 rounded-3xl md:rounded-[3rem] shadow-xl border border-slate-100 mx-auto">
            <h2 className="text-2xl font-black mb-8 italic uppercase tracking-tighter">System Configuration</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Shop Name</label>
                <input type="text" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-none font-bold outline-none" value={settings.storeName} onChange={e => setSettings({...settings, storeName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">WhatsApp Number</label>
                <input type="text" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-none font-bold outline-none" value={settings.whatsappNumber} onChange={e => setSettings({...settings, whatsappNumber: e.target.value})} />
              </div>
              <button onClick={() => {
                const data = JSON.stringify({ products, orders, settings, vendors, logistics });
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `unidrop_data_backup.json`;
                a.click();
              }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-indigo-600 transition-all">
                Export Local Ledger
              </button>
            </div>
          </div>
        );
      default:
        return <Dashboard products={products} orders={orders} />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#f8fafc]">
      {/* Mobile Top Header */}
      <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-[#0b1224] text-white sticky top-0 z-[60] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap size={18} fill="currentColor" />
          </div>
          <span className="text-lg font-black italic uppercase tracking-tighter">{settings.storeName}</span>
        </div>
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 bg-white/5 rounded-xl text-slate-300 hover:text-white transition-colors"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar - Desktop Sticky, Mobile Fixed Drawer */}
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

      {/* Content Area */}
      <main className="flex-1 lg:h-screen overflow-y-auto p-5 md:p-8 lg:p-12">
        <div className="max-w-7xl mx-auto pb-10">
          {renderContent()}
        </div>
      </main>

      {/* Mobile Menu Backdrop */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] lg:hidden transition-opacity duration-300"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
