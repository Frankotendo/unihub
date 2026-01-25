
import React, { useState, useEffect } from 'react';
import { Product, BusinessSettings, Location } from '../types.ts';

interface PublicCatalogProps {
  products: Product[];
  settings: BusinessSettings;
  onBack?: () => void; // Only passed when Admin is previewing
}

const PublicCatalog: React.FC<PublicCatalogProps> = ({ products, settings, onBack }) => {
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') setInstallPrompt(null);
    } else {
      setShowInstallHelp(true);
    }
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || p.category === filter;
    return matchesSearch && matchesFilter;
  });

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const handleOrder = (product: Product) => {
    const cleanNumber = settings.whatsappNumber.replace(/\D/g, '');
    const message = `👋 Hi! I'm browsing ${settings.storeName}.\n\nI want to order:\n🛒 *${product.name}*\n💰 *Price: ${settings.currency} ${product.sellingPrice}*\n\nIs this available?`;
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col font-sans text-slate-900 selection:bg-indigo-100 relative">
      
      {/* 1. TOP NAV (Hidden from customers unless it's an admin preview) */}
      {onBack && (
        <div className="bg-slate-900 text-white px-6 py-2 flex justify-between items-center z-[200]">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Owner Preview Mode</span>
          <button 
            onClick={onBack}
            className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all"
          >
            Close Preview
          </button>
        </div>
      )}

      {/* 2. APP INSTALL BANNER (Subtle) */}
      {(installPrompt || !window.matchMedia('(display-mode: standalone)').matches) && (
        <div className="bg-indigo-600 px-6 py-3 flex justify-between items-center z-[100]">
          <div className="flex items-center gap-3">
            <i className="fas fa-mobile-screen text-white/80 text-xs"></i>
            <p className="text-white text-[9px] font-black uppercase tracking-widest">Install {settings.storeName} app</p>
          </div>
          <button 
            onClick={handleInstall}
            className="bg-white text-indigo-600 px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm"
          >
            Get App
          </button>
        </div>
      )}

      {/* 3. STOREFRONT HEADER */}
      <header className="bg-white border-b border-slate-100 px-6 py-8 md:py-12 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                <i className="fas fa-shopping-bag text-xl"></i>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter leading-none text-slate-800">{settings.storeName}</h1>
                <p className="text-[10px] text-indigo-500 font-black tracking-[0.3em] uppercase mt-1">Campus Supply Hub</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                <input 
                  type="text" 
                  placeholder="Find your hostel needs..." 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-300"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                  filter === cat 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                  : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200 hover:text-indigo-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 4. MAIN STORE CONTENT */}
      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-10">
            {filtered.map(product => (
              <div key={product.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-2xl hover:-translate-y-1 transition-all group">
                <div className="h-64 bg-slate-50 relative p-8 flex items-center justify-center">
                   <img 
                      src={`https://api.dicebear.com/7.x/shapes/svg?seed=${product.name}&backgroundColor=f0f4f8`} 
                      alt={product.name} 
                      className="w-40 h-40 object-contain opacity-80 group-hover:scale-110 transition-transform duration-500" 
                   />
                   <div className="absolute top-6 left-6 flex flex-col gap-2">
                      <span className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl text-[8px] font-black text-indigo-500 border border-slate-100 uppercase tracking-widest shadow-sm">
                          {product.category}
                      </span>
                      <span className={`px-3 py-1 rounded-xl text-[7px] font-black uppercase tracking-widest ${product.location === Location.DORMAA ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                         {product.location === Location.DORMAA ? 'FREE DELIVERY' : `+ ${product.deliveryCost} delivery`}
                      </span>
                   </div>
                </div>
                <div className="p-8 flex-1 flex flex-col">
                  <h3 className="font-black text-slate-800 text-lg mb-2 uppercase tracking-tight line-clamp-1">{product.name}</h3>
                  <p className="text-slate-400 text-xs font-medium leading-relaxed mb-8 flex-1 line-clamp-2">{product.description || `Fresh ${product.category.toLowerCase()} sourced from the local market.`}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-50">
                     <div>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-0.5">Price</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tighter">{settings.currency} {product.sellingPrice}</span>
                     </div>
                     <button 
                       onClick={() => handleOrder(product)}
                       className="bg-emerald-500 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-100 hover:bg-emerald-600 hover:scale-110 active:scale-95 transition-all"
                       title="Order via WhatsApp"
                     >
                       <i className="fab fa-whatsapp text-2xl"></i>
                     </button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                <p className="text-xs font-black text-slate-300 uppercase tracking-[0.4em]">No matching items found.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-40 bg-white rounded-[3rem] border border-slate-100 shadow-inner">
             <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-8 text-indigo-600">
                <i className="fas fa-box-open text-4xl"></i>
             </div>
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Preparing Fresh Stock</h3>
             <p className="text-sm text-slate-400 font-medium mt-2">New deals are being scouted in the local markets.</p>
          </div>
        )}
      </main>

      {/* 5. FOOTER */}
      <footer className="p-12 text-center bg-white border-t border-slate-50 mt-auto">
        <div className="flex flex-col items-center gap-6">
           <div className="bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 max-w-md">
              <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-2">Hostel Delivery Info</p>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">"{settings.deliveryNote}"</p>
           </div>
           <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 mt-4">Official {settings.storeName} Catalog</p>
        </div>
      </footer>

      {/* iOS Install Help Modal */}
      {showInstallHelp && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 animate-in slide-in-from-bottom duration-300">
            <div className="text-center mb-8">
               <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-600 text-2xl">
                  <i className="fas fa-arrow-up-from-bracket"></i>
               </div>
               <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Install Manually</h3>
               <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-widest">For iPhone / Safari</p>
            </div>
            <ol className="space-y-4 mb-8">
              <li className="flex items-start gap-3 text-sm">
                <span className="bg-slate-100 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0">1</span>
                <span>Tap the <span className="font-bold text-indigo-600">Share</span> icon.</span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <span className="bg-slate-100 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0">2</span>
                <span>Tap <span className="font-bold text-indigo-600">Add to Home Screen</span>.</span>
              </li>
            </ol>
            <button 
              onClick={() => setShowInstallHelp(false)}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicCatalog;
