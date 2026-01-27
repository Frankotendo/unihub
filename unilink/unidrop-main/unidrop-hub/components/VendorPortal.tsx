
import React, { useState, useRef } from 'react';
import { Location, Category, BusinessSettings } from '../types';

interface VendorPortalProps {
  settings: BusinessSettings;
  onBack?: () => void;
}

const CATEGORIES: Category[] = ['Hostel Essentials', 'School Items', 'Tech & Gadgets', 'Fashion', 'Food & Snacks', 'Cosmetics', 'General'];

const VendorPortal: React.FC<VendorPortalProps> = ({ settings, onBack }) => {
  const [scoutName, setScoutName] = useState(() => localStorage.getItem('unidrop_scout_name') || '');
  const [isRegistered, setIsRegistered] = useState(!!scoutName);
  const [form, setForm] = useState({ name: '', price: '', category: 'General' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (scoutName) {
      localStorage.setItem('unidrop_scout_name', scoutName);
      setIsRegistered(true);
    }
  };

  const calculateHubPrice = (cost: number) => Math.ceil(cost * (1 + settings.defaultMarkupPercent / 100));

  const handleSendPitch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) return;

    const hubPrice = calculateHubPrice(Number(form.price));
    const message = `🚀 *NEW STOCK PITCH*\n*BY:* ${scoutName} | *LOC:* Dormaa\n\n*ITEM:* ${form.name} | *COST:* GHS ${form.price}\n*HUB PRICE:* GHS ${hubPrice}\n*CAT:* ${form.category}\n\nHi Hub Manager! I found this item at the market. Do you want to list it? (Attach Photo Below)`;
    
    const cleanAdminNum = settings.whatsappNumber.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanAdminNum}?text=${encodeURIComponent(message)}`, '_blank');
    
    setForm({ name: '', price: '', category: 'General' });
  };

  if (!isRegistered) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-10 md:p-14 shadow-2xl animate-in zoom-in duration-500 relative">
          {onBack && <button onClick={onBack} className="absolute top-8 left-8 text-slate-300 hover:text-slate-900"><i className="fas fa-arrow-left"></i></button>}
          <div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/20"><i className="fas fa-handshake text-3xl"></i></div>
          <h2 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter text-center mb-2">Scout Hub</h2>
          <p className="text-slate-400 font-medium text-center mb-10 text-sm">Join the student supplier network.</p>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Your Name</label>
              <input type="text" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-emerald-500 outline-none font-bold transition-all" placeholder="e.g. Ama" value={scoutName} onChange={e => setScoutName(e.target.value)} />
            </div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-emerald-700 transition-all mt-4">Start Scouting</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      <nav className="bg-[#020617] text-white px-8 py-6 sticky top-0 z-[100] flex justify-between items-center shadow-xl">
        <div className="flex items-center gap-4">
           {onBack && <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"><i className="fas fa-arrow-left text-xs"></i></button>}
           <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-bolt"></i></div>
           <div><h1 className="text-lg font-black italic uppercase tracking-tighter leading-none">Scout <span className="text-emerald-500">Node</span></h1><p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mt-1">{scoutName}</p></div>
        </div>
        <button onClick={() => {localStorage.removeItem('unidrop_scout_name'); setIsRegistered(false)}} className="bg-white/5 text-white/40 px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest">Logout</button>
      </nav>

      <main className="max-w-xl mx-auto p-6 md:p-12 animate-in fade-in duration-500">
         <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">Submit Market Deal</h2>
            <p className="text-slate-400 text-sm font-medium mt-1">Found a bargain? Submit it to the hub manager.</p>
         </div>

         <form onSubmit={handleSendPitch} className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8">
            <div className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Name</label>
                  <input type="text" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold" placeholder="e.g. LED Desk Lamp" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Market Cost (GHS)</label>
                  <input type="number" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold" placeholder="How much does it cost?" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                  {form.price && <p className="text-[10px] font-bold text-emerald-600 italic px-2">Manager will sell for: GHS {calculateHubPrice(Number(form.price))}</p>}
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                  <select className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold outline-none appearance-none" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                     {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
               </div>
            </div>

            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-start gap-4">
               <i className="fas fa-camera text-amber-500 mt-1"></i>
               <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase">Important: After clicking send, make sure to attach a photo of the item in WhatsApp!</p>
            </div>

            <button type="submit" className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all">
               Send Pitch to Hub via WhatsApp
            </button>
         </form>
      </main>
    </div>
  );
};

export default VendorPortal;
