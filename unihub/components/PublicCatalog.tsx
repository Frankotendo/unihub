
import React, { useState } from 'react';
import { Product, BusinessSettings, Category, DeliveryOption } from '../types';

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
  const [selectedDelivery, setSelectedDelivery] = useState<Record<string, DeliveryOption>>({});

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleScoutSubmitInternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onScoutSubmit) return;
    
    onScoutSubmit({
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
    const delivery = selectedDelivery[product.id];
    const cleanNumber = settings.whatsappNumber.replace(/\D/g, '');
    let message = `👋 UniHub Order!\n🛒 *Item:* ${product.name}\n💰 *Price:* GHS ${product.sellingPrice}`;
    
    if (delivery) {
      message += `\n🚚 *Delivery:* ${delivery.location} (GHS ${delivery.cost})\n💵 *Total:* GHS ${product.sellingPrice + delivery.cost}`;
    } else {
      message += `\n🚚 *Delivery:* Please calculate for my hall!`;
    }
    
    message += `\n\nPlease confirm availability!`;
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-[100] px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-4">
                <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl">
                   <i className="fas fa-truck-fast text-lg"></i>
                </div>
                <div>
                   <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">{settings.storeName}</h1>
                   <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1">Hostel Delivery Node</p>
                </div>
             </div>
             <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                <button onClick={() => setView('shop')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${view === 'shop' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>Shop</button>
                <button onClick={() => setView('sell')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${view === 'sell' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>Supply</button>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filtered.map(product => (
                <div key={product.id} className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-2xl transition-all group">
                  <div className="h-52 bg-slate-50 relative overflow-hidden">
                     {product.imageUrl ? (
                       <img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={product.name} />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center"><i className="fas fa-box text-slate-200 text-3xl"></i></div>
                     )}
                     <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[8px] font-black text-indigo-600 uppercase tracking-widest">{product.category}</div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col">
                    <h3 className="font-black text-slate-800 text-sm uppercase mb-1 truncate">{product.name}</h3>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-6">Hostel Express</p>
                    
                    <div className="flex items-center justify-between mt-auto">
                       <span className="text-2xl font-black text-slate-900 leading-none">GHS {product.sellingPrice}</span>
                       <button onClick={() => handleOrder(product)} className="bg-emerald-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all">
                          <i className="fab fa-whatsapp text-xl"></i>
                       </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto pt-10">
             <div className="text-center mb-10">
                <div className="bg-emerald-50 w-20 h-20 rounded-3xl flex items-center justify-center text-emerald-600 mx-auto mb-6"><i className="fas fa-hand-holding-dollar text-3xl"></i></div>
                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Supply Hub</h2>
                <p className="text-slate-400 text-xs font-bold mt-2 uppercase tracking-widest leading-relaxed">Pitched items will appear in the manager's pending inventory.</p>
             </div>
             <form onSubmit={handleScoutSubmitInternal} className="bg-white p-10 rounded-[3rem] space-y-5 shadow-2xl border border-slate-50">
                <input type="text" required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 outline-none" placeholder="Your Name" value={scoutForm.name} onChange={e => setScoutForm({...scoutForm, name: e.target.value})} />
                <input type="text" required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 outline-none" placeholder="Item Name" value={scoutForm.itemName} onChange={e => setScoutForm({...scoutForm, itemName: e.target.value})} />
                <input type="number" required className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 outline-none" placeholder="Cost Price (GHS)" value={scoutForm.price} onChange={e => setScoutForm({...scoutForm, price: e.target.value})} />
                <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl mt-4 hover:bg-indigo-700 transition-colors">Submit Pitch</button>
             </form>
          </div>
        )}
      </main>

      <footer className="p-12 text-center bg-slate-100/50">
         <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">{settings.storeName} • Campus Delivery Express</p>
      </footer>
    </div>
  );
};

export default PublicCatalog;
