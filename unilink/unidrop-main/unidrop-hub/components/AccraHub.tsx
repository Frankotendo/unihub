
import React, { useState } from 'react';
import { Product, Location, LogisticsPartner } from '../types';

interface AccraHubProps {
  products: Product[];
  logistics: LogisticsPartner[];
  onAddProduct: (product: Product) => void;
  onAddLogistics: (partner: LogisticsPartner) => void;
}

const AccraHub: React.FC<AccraHubProps> = ({ products, logistics, onAddLogistics }) => {
  const [showModal, setShowModal] = useState(false);
  const [newPartner, setNewPartner] = useState<Partial<LogisticsPartner>>({ type: 'Bus Service' });
  const accraProducts = products.filter(p => p.location === Location.ACCRA);
  const accraLogistics = logistics.filter(l => l.location === 'Accra');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name || !newPartner.contact) return;
    onAddLogistics({
      id: `ACC-LOG-${Date.now()}`,
      name: newPartner.name,
      contact: newPartner.contact,
      type: newPartner.type || 'Bus Service',
      location: 'Accra'
    });
    setNewPartner({ type: 'Bus Service' });
    setShowModal(false);
  };

  return (
    <div className="space-y-8">
      <div className="bg-sky-900 p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl border-b-8 border-sky-700">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="max-w-md text-center md:text-left">
            <h3 className="text-3xl font-black mb-2 uppercase tracking-tighter italic flex items-center gap-3">
               <i className="fas fa-city"></i>
               Accra Global Hub
            </h3>
            <p className="opacity-80 font-medium">Sourcing high-end electronics and fashion from Madina, Makola and Circle. Integrated bus logistics to Dormaa.</p>
          </div>
          <div className="bg-sky-800/50 backdrop-blur-md px-10 py-6 rounded-3xl border border-white/10 text-center">
            <div className="text-3xl font-black text-sky-300">{accraProducts.length}</div>
            <div className="text-[10px] font-black uppercase opacity-60 tracking-widest mt-1">Capital Stock</div>
          </div>
        </div>
        <div className="absolute left-[-20px] top-[-20px] opacity-10 text-[200px] pointer-events-none transform rotate-12">
          <i className="fas fa-plane-arrival"></i>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="px-2 flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Accra Logistics</h4>
          </div>
          <div className="space-y-4">
            {accraLogistics.map((log) => (
              <div key={log.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-all">
                    <i className="fas fa-bus text-xs"></i>
                  </div>
                  <a href={`tel:${log.contact}`} className="text-sky-600"><i className="fas fa-phone"></i></a>
                </div>
                <h5 className="font-black text-slate-800 uppercase tracking-tight text-sm mb-1">{log.name}</h5>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.type} // {log.contact}</p>
              </div>
            ))}
            <button onClick={() => setShowModal(true)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-sky-600 hover:border-sky-200 hover:bg-sky-50 transition-all text-[10px] font-black uppercase tracking-widest">
              + Add Accra Logistics
            </button>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
           <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">Accra Warehouse stock</h4>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accraProducts.map(p => (
              <div key={p.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex items-center gap-6 shadow-sm hover:shadow-2xl transition-all group">
                <div className="w-24 h-24 bg-sky-50/50 rounded-[2rem] flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <i className="fas fa-mobile-screen text-sky-200 text-3xl"></i>}
                </div>
                <div className="flex-1 overflow-hidden">
                  <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest px-2 py-0.5 bg-sky-50 rounded-lg">ACCRA HUB</span>
                  <h5 className="font-black text-slate-800 uppercase tracking-tighter text-xl line-clamp-1 mt-2">{p.name}</h5>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-2xl font-black text-slate-900">GHS {p.sellingPrice}</span>
                    <span className="text-sm font-black text-emerald-600">GHS {p.sellingPrice - p.sourcePrice}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10 animate-in zoom-in">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-6 italic">Accra Partner</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Partner Name" value={newPartner.name || ''} onChange={e => setNewPartner({...newPartner, name: e.target.value})} />
              <input type="tel" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="WhatsApp Number" value={newPartner.contact || ''} onChange={e => setNewPartner({...newPartner, contact: e.target.value})} />
              <select className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" value={newPartner.type} onChange={e => setNewPartner({...newPartner, type: e.target.value})}>
                <option value="Bus Service">Bus Service</option>
                <option value="Dispatch">Dispatch</option>
                <option value="Courier">FedEx/DHL</option>
              </select>
              <button type="submit" className="w-full bg-sky-600 text-white font-black py-5 rounded-[2rem] uppercase text-xs shadow-lg">Register Accra Partner</button>
              <button type="button" onClick={() => setShowModal(false)} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccraHub;
