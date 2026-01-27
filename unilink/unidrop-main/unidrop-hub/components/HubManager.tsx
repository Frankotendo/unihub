
import React, { useState } from 'react';
import { Product, LogisticsPartner, LocalVendor, BusinessSettings } from '../types';

interface HubManagerProps {
  products: Product[];
  settings: BusinessSettings;
  logistics: LogisticsPartner[];
  vendors: LocalVendor[];
  onAddProduct: (product: Product) => void;
  onAddVendor: (vendor: LocalVendor) => void;
  onAddLogistics: (partner: LogisticsPartner) => void;
}

const HubManager: React.FC<HubManagerProps> = ({ products, settings, logistics, vendors, onAddVendor, onAddLogistics }) => {
  const [activeHub, setActiveHub] = useState<string>(settings.activeHubs[0] || 'Dormaa');
  const [showLogModal, setShowLogModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [newLog, setNewLog] = useState<Partial<LogisticsPartner>>({ type: 'Dispatch Rider' });
  const [newVendor, setNewVendor] = useState<Partial<LocalVendor>>({});

  const hubProducts = products.filter(p => p.location.toLowerCase().includes(activeHub.toLowerCase()));
  const hubLogistics = logistics.filter(l => l.location.toLowerCase().includes(activeHub.toLowerCase()));
  const hubVendors = vendors.filter(v => v.marketLocation.toLowerCase().includes(activeHub.toLowerCase()));

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.name || !newLog.contact) return;
    onAddLogistics({
      id: `LOG-${Date.now()}`,
      name: newLog.name,
      contact: newLog.contact,
      type: newLog.type || 'Dispatch Rider',
      location: activeHub
    });
    setNewLog({ type: 'Dispatch Rider' });
    setShowLogModal(false);
  };

  const handleAddVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendor.name || !newVendor.contact) return;
    onAddVendor({
      id: `VEND-${Date.now()}`,
      name: newVendor.name,
      contact: newVendor.contact,
      marketLocation: activeHub,
      specialty: newVendor.specialty || 'General'
    });
    setNewVendor({});
    setShowVendorModal(false);
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Premium Hub Selector */}
      <div className="bg-white p-2 rounded-[2.5rem] shadow-xl border border-slate-100 flex gap-1 overflow-x-auto no-scrollbar max-w-fit mx-auto md:mx-0">
        {settings.activeHubs.map(hub => (
          <button 
            key={hub} 
            onClick={() => setActiveHub(hub)}
            className={`px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all relative flex items-center gap-3 ${
              activeHub === hub ? 'bg-[#0f172a] text-white shadow-2xl' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            {activeHub === hub && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>}
            {hub} HUB
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Logistics & Vendors */}
        <div className="lg:col-span-4 space-y-8">
           {/* Logistics Section */}
           <section className="bg-white p-8 rounded-[3rem] shadow-lg border border-slate-50">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logistics</h4>
                    <p className="text-sm font-black text-slate-800">Delivery Riders</p>
                 </div>
                 <button onClick={() => setShowLogModal(true)} className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all">
                    <i className="fas fa-plus text-xs"></i>
                 </button>
              </div>
              <div className="space-y-3">
                 {hubLogistics.map((log, idx) => (
                   <div key={log.id} style={{animationDelay: `${idx * 100}ms`}} className="group bg-slate-50 p-5 rounded-2xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all animate-in slide-in-from-left-4">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                            <i className="fas fa-motorcycle text-xs"></i>
                         </div>
                         <div className="flex-1">
                            <p className="font-black text-slate-800 text-[11px] uppercase">{log.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{log.type}</p>
                         </div>
                         <a href={`tel:${log.contact}`} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-emerald-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <i className="fas fa-phone-alt text-[10px]"></i>
                         </a>
                      </div>
                   </div>
                 ))}
                 {hubLogistics.length === 0 && <div className="py-10 text-center opacity-30 font-black text-[9px] uppercase tracking-widest">No riders found</div>}
              </div>
           </section>

           {/* Vendors Section */}
           <section className="bg-[#0f172a] p-8 rounded-[3rem] shadow-2xl text-white">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Sourcing</h4>
                    <p className="text-sm font-black">Market Vendors</p>
                 </div>
                 <button onClick={() => setShowVendorModal(true)} className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-emerald-500 transition-all">
                    <i className="fas fa-plus text-xs"></i>
                 </button>
              </div>
              <div className="space-y-3">
                 {hubVendors.map((v, idx) => (
                   <div key={v.id} style={{animationDelay: `${idx * 150}ms`}} className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all animate-in slide-in-from-left-4">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                            <i className="fas fa-store-alt text-xs"></i>
                         </div>
                         <div>
                            <p className="font-black text-[11px] uppercase">{v.name}</p>
                            <p className="text-[9px] font-bold text-indigo-400 uppercase">{v.specialty}</p>
                         </div>
                      </div>
                   </div>
                 ))}
                 {hubVendors.length === 0 && <div className="py-10 text-center opacity-20 font-black text-[9px] uppercase tracking-widest">No vendors linked</div>}
              </div>
           </section>
        </div>

        {/* Right Column: Inventory Overview */}
        <div className="lg:col-span-8">
           <div className="bg-white rounded-[4rem] shadow-xl border border-slate-100 overflow-hidden h-full flex flex-col">
              <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
                 <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                    <i className="fas fa-warehouse text-indigo-500"></i>
                    {activeHub} Hub Inventory
                 </h4>
                 <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">
                    {hubProducts.length} Items Listed
                 </span>
              </div>
              <div className="p-10 flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 md:grid-cols-2 gap-6">
                 {hubProducts.map((p, idx) => (
                   <div key={p.id} style={{animationDelay: `${idx * 100}ms`}} className="bg-slate-50 p-6 rounded-[2.5rem] border border-transparent hover:border-indigo-100 hover:bg-white transition-all group animate-in zoom-in duration-300">
                      <div className="flex gap-6 items-center">
                         <div className="w-20 h-20 bg-white rounded-[1.5rem] shadow-sm flex items-center justify-center text-slate-300 overflow-hidden">
                            {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <i className="fas fa-box text-xl"></i>}
                         </div>
                         <div className="flex-1">
                            <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1 block">{p.category}</span>
                            <h5 className="font-black text-slate-800 uppercase text-xs line-clamp-1 mb-2">{p.name}</h5>
                            <div className="flex items-center justify-between">
                               <p className="text-lg font-black text-slate-900 leading-none">GHS {p.sellingPrice}</p>
                               <div className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                  +GHS {p.sellingPrice - p.sourcePrice}
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                 ))}
                 {hubProducts.length === 0 && (
                    <div className="col-span-full py-20 text-center opacity-30 flex flex-col items-center">
                       <i className="fas fa-satellite-dish text-4xl mb-4"></i>
                       <p className="text-[10px] font-black uppercase tracking-[0.4em]">Node Waiting for Feed</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* Modals - Simplified & Styled */}
      {showLogModal && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-8 italic">Add Rider</h3>
            <form onSubmit={handleAddLog} className="space-y-6">
              <input type="text" required className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Rider Name" value={newLog.name || ''} onChange={e => setNewLog({...newLog, name: e.target.value})} />
              <input type="tel" required className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="WhatsApp Number" value={newLog.contact || ''} onChange={e => setNewLog({...newLog, contact: e.target.value})} />
              <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-[2rem] uppercase text-[10px] tracking-widest shadow-xl">Link Rider</button>
              <button type="button" onClick={() => setShowLogModal(false)} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">Close</button>
            </form>
          </div>
        </div>
      )}

      {showVendorModal && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-8 italic">Link Vendor</h3>
            <form onSubmit={handleAddVendor} className="space-y-6">
              <input type="text" required className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Vendor Shop Name" value={newVendor.name || ''} onChange={e => setNewVendor({...newVendor, name: e.target.value})} />
              <input type="text" required className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Specialty (e.g. Rice, Tech)" value={newVendor.specialty || ''} onChange={e => setNewVendor({...newVendor, specialty: e.target.value})} />
              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-[2rem] uppercase text-[10px] tracking-widest shadow-xl">Link Partner</button>
              <button type="button" onClick={() => setShowVendorModal(false)} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">Close</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HubManager;
