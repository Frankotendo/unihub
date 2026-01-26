
import React, { useState, useEffect } from 'react';
import { Product, BusinessSettings, Category } from '../types';

interface PublicCatalogProps {
  products: Product[];
  settings: BusinessSettings;
  initialView?: 'shop' | 'sell';
  onScoutSubmit?: (data: { name: string, itemName: string, price: number, category: Category }) => void;
}

const PublicCatalog: React.FC<PublicCatalogProps> = ({ products, settings, initialView = 'shop', onScoutSubmit }) => {
  const [view, setView] = useState<'shop' | 'sell'>(initialView);
  const [searchTerm, setSearchTerm] = useState('');
  const [scoutForm, setScoutForm] = useState({ name: '', itemName: '', price: '', category: 'General' });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    // We've used the prompt, and can't use it again
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleScoutSubmitInternal = (e: React.FormEvent) => {
    e.preventDefault();
    onScoutSubmit?.({
      name: scoutForm.name,
      itemName: scoutForm.itemName,
      price: Number(scoutForm.price),
      category: scoutForm.category as Category
    });
    alert('Listing pitched to Hub Manager! 🚀');
    setScoutForm({ name: '', itemName: '', price: '', category: 'General' });
    setView('shop');
  };

  const handleOrder = (product: Product) => {
    const cleanNumber = settings.whatsappNumber.replace(/\D/g, '');
    let message = `👋 UniHub Order!\n🛒 *Item:* ${product.name}\n💰 *Price:* GHS ${product.sellingPrice}`;
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-[100] px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
             <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl">
                <i className="fas fa-truck-fast text-lg"></i>
             </div>
             <div>
                <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">{settings.storeName}</h1>
                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1">Hostel Delivery Express</p>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
             {isInstallable && (
               <button 
                 onClick={handleInstallClick}
                 className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
               >
                 <i className="fas fa-download"></i>
                 Install App
               </button>
             )}
             <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                <button onClick={() => setView('shop')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${view === 'shop' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>Shop</button>
                <button onClick={() => setView('sell')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${view === 'sell' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>Supply</button>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        {view === 'shop' ? (
          <div className="space-y-12">
            <div className="relative">
              <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input 
                type="text" 
                placeholder="Find hostel essentials..." 
                className="w-full bg-white border border-slate-100 rounded-3xl py-6 pl-14 pr-6 text-sm font-bold outline-none shadow-sm focus:ring-2 focus:ring-indigo-500/20"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Installation Banner for Mobile */}
            {isInstallable && (
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl shadow-indigo-200">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white">
                      <i className="fas fa-mobile-screen-button text-3xl"></i>
                   </div>
                   <div>
                      <h2 className="text-xl font-black uppercase tracking-tighter italic">Install UniDrop WebApp</h2>
                      <p className="text-indigo-100 text-xs font-medium uppercase tracking-widest opacity-80">Add to home screen for 1-tap orders.</p>
                   </div>
                </div>
                <button 
                  onClick={handleInstallClick}
                  className="bg-white text-indigo-600 px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Get the App
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filtered.map(product => (
                <div key={product.id} className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-2xl transition-all group">
                  <div className="h-52 bg-slate-50 relative overflow-hidden">
                     {product.imageUrl ? (
                       <img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={product.name} />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center"><i className="fas fa-box text-slate-200 text-3xl"></i></div>
                     )}
                     <div className="absolute top-4 left-4 bg-white/90 px-3 py-1 rounded-full text-[8px] font-black text-indigo-600 uppercase tracking-widest">{product.category}</div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col">
                    <h3 className="font-black text-slate-800 text-sm uppercase mb-1 truncate">{product.name}</h3>
                    <div className="flex items-center justify-between mt-auto pt-6">
                       <span className="text-2xl font-black text-slate-900">GHS {product.sellingPrice}</span>
                       <button onClick={() => handleOrder(product)} className="bg-emerald-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all">
                          <i className="fab fa-whatsapp text-xl"></i>
                       </button>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-300">
                  <i className="fas fa-box-open text-5xl mb-4"></i>
                  <p className="text-xs font-black uppercase tracking-widest">Nothing found in stock.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto pt-10">
             <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Supply Hub</h2>
                <p className="text-slate-400 text-xs font-bold mt-2 uppercase tracking-widest">Pitch items to the hub manager.</p>
             </div>
             <form onSubmit={handleScoutSubmitInternal} className="bg-white p-10 rounded-[3rem] space-y-5 shadow-2xl border border-slate-50">
                <input type="text" required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-none font-bold outline-none" placeholder="Your Name" value={scoutForm.name} onChange={e => setScoutForm({...scoutForm, name: e.target.value})} />
                <input type="text" required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-none font-bold outline-none" placeholder="Item Name" value={scoutForm.itemName} onChange={e => setScoutForm({...scoutForm, itemName: e.target.value})} />
                <input type="number" required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-none font-bold outline-none" placeholder="Cost Price (GHS)" value={scoutForm.price} onChange={e => setScoutForm({...scoutForm, price: e.target.value})} />
                <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl mt-4">Submit Pitch</button>
             </form>
          </div>
        )}
      </main>
      <footer className="p-12 text-center bg-slate-100/50">
         <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">{settings.storeName} • Campus Delivery Node</p>
      </footer>
    </div>
  );
};

export default PublicCatalog;
