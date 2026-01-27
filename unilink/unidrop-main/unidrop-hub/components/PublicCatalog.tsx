
import React, { useState } from 'react';
import { Product, BusinessSettings, Category } from '../types.ts';

interface PublicCatalogProps {
  products: Product[];
  settings: BusinessSettings;
  initialView?: 'shop' | 'sell';
  onScoutSubmit?: (data: { name: string, itemName: string, price: number, category: Category }) => void;
}

const CATEGORIES: Category[] = ['Hostel Essentials', 'School Items', 'Tech & Gadgets', 'Fashion', 'Food & Snacks', 'Cosmetics', 'General'];

const PublicCatalog: React.FC<PublicCatalogProps> = ({ products, settings, initialView = 'shop', onScoutSubmit }) => {
  const [view, setView] = useState<'shop' | 'sell'>(initialView);
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [scoutForm, setScoutForm] = useState({ name: '', itemName: '', price: '', category: 'General' });

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || p.category === filter;
    return matchesSearch && matchesFilter;
  });

  const productCategories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const handleOrder = (product: Product) => {
    const cleanNumber = settings.whatsappNumber.replace(/\D/g, '');
    const message = `👋 UniHub Order!\n🛒 *Item:* ${product.name}\n💰 *Price:* GHS ${product.sellingPrice}\n\nPlease deliver to my hostel!`;
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSubmitDeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (onScoutSubmit) {
      onScoutSubmit({
        name: scoutForm.name,
        itemName: scoutForm.itemName,
        price: Number(scoutForm.price),
        category: scoutForm.category as Category
      });
    }
    alert("Deal Sent! Check WhatsApp for the manager's reply.");
    setView('shop');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-[100] px-6 py-5 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-4">
                <div className="bg-indigo-600 w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-indigo-100 relative group overflow-hidden">
                   <i className="fas fa-truck-fast text-lg group-hover:delivery-move transition-all"></i>
                   <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <div>
                   <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-slate-900">UniHub</h1>
                   <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1">Direct Hostel Logistics</p>
                </div>
             </div>
             <div className="hidden sm:flex items-center gap-3">
                <div className="flex flex-col items-end">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Delivery Route</span>
                   <span className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping"></span>
                      Market Active
                   </span>
                </div>
             </div>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-[1.25rem] max-w-xs mx-auto w-full shadow-inner">
             <button onClick={() => setView('shop')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${view === 'shop' ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-400'}`}>
                <i className="fas fa-shopping-bag text-xs"></i>
                Shop
             </button>
             <button onClick={() => setView('sell')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${view === 'sell' ? 'bg-white shadow-lg text-emerald-600' : 'text-slate-400'}`}>
                <i className="fas fa-hand-holding-dollar text-xs"></i>
                Supply
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        {view === 'shop' ? (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="relative group">
              <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"></i>
              <input 
                type="text" 
                placeholder="Search hostel essentials..." 
                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-50 rounded-[1.5rem] py-5 pl-14 pr-6 text-sm font-bold outline-none transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filtered.map(product => (
                <div key={product.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-2xl hover:-translate-y-1 transition-all group">
                  <div className="h-52 bg-slate-50 relative flex items-center justify-center overflow-hidden">
                     {product.imageUrl ? (
                       <img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={product.name} />
                     ) : (
                       <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                          <i className="fas fa-box-open text-slate-200 text-4xl"></i>
                       </div>
                     )}
                     <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full text-[8px] font-black text-indigo-600 uppercase tracking-widest shadow-sm border border-slate-50">{product.category}</div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col">
                    <h3 className="font-black text-slate-800 text-sm uppercase mb-1 truncate leading-none">{product.name}</h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                       <i className="fas fa-bolt-lightning text-amber-500 text-[8px]"></i>
                       Express Hub Shipping
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                       <span className="text-2xl font-black text-slate-900 leading-none">GHS {product.sellingPrice}</span>
                       <button onClick={() => handleOrder(product)} className="bg-emerald-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100 hover:bg-emerald-600 active:scale-90 transition-all">
                          <i className="fab fa-whatsapp text-xl"></i>
                       </button>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full py-40 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Hub inventory currently empty</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto animate-in fade-in duration-500 pt-10">
             <div className="text-center mb-10">
                <div className="bg-emerald-50 w-20 h-20 rounded-[2rem] flex items-center justify-center text-emerald-600 mx-auto mb-6 shadow-inner border border-emerald-100/50">
                    <i className="fas fa-truck-ramp-box text-3xl"></i>
                </div>
                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Supply Node</h2>
                <p className="text-slate-400 text-xs font-bold mt-2 uppercase tracking-widest">Help us stock the hub & get paid</p>
             </div>
             <form onSubmit={handleSubmitDeal} className="bg-white p-10 rounded-[3rem] space-y-5 shadow-2xl border border-slate-50">
                <div className="space-y-4">
                  <input type="text" required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-50 transition-all" value={scoutForm.name} onChange={e => setScoutForm({...scoutForm, name: e.target.value})} placeholder="Full Name" />
                  <input type="text" required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-50 transition-all" value={scoutForm.itemName} onChange={e => setScoutForm({...scoutForm, itemName: e.target.value})} placeholder="What is the item?" />
                  <div className="grid grid-cols-1 gap-4">
                    <input type="number" required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-50 transition-all" value={scoutForm.price} onChange={e => setScoutForm({...scoutForm, price: e.target.value})} placeholder="Market Price (GHS)" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all mt-4">Submit Pitch</button>
             </form>
          </div>
        )}
      </main>

      <footer className="p-12 text-center bg-slate-50/50">
         <div className="flex justify-center items-center gap-10 mb-8 opacity-20 grayscale">
            <i className="fas fa-truck text-2xl"></i>
            <i className="fas fa-box text-2xl"></i>
            <i className="fas fa-map-pin text-2xl"></i>
         </div>
         <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">UniHub • Hostel Delivery Express</p>
      </footer>
    </div>
  );
};

export default PublicCatalog;