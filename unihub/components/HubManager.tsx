
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
    <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="bg-white p-2 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-100 flex gap-1 overflow-x-auto no-scrollbar max-w-full md:max-w-fit mx-auto md:mx-0">
        {settings.activeHubs.map(hub => (
          <button 
            key={hub} 
            onClick={() => setActiveHub(hub)}
            className={`px-6 md:px-8 py-3 rounded-[1.5rem] md:rounded-[2rem] text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all relative flex items-center gap-3 shrink-0 ${
              activeHub === hub ? 'bg-[#0f172a] text-white shadow-2xl' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            {activeHub === hub && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>}
            {hub} HUB
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-4 space-y-6 md:space-y-8">
           <section className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[3rem] shadow-lg border border-slate-50">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logistics</h4>
                    <p className="text-sm font-black text-slate-800">Delivery Riders</p>
                 </div>
                 <button onClick={() => setShowLogModal(true)} className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <i className="fas fa-plus text-xs"></i>
                 </button>
              </div>
              <div className="space-y-3">
                 {hubLogistics.map((log) => (
                   <div key={log.id} className="bg-slate-50 p-4 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-500">
                        <i className="fas fa-motorcycle text-xs"></i>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-black text-slate-800 text-[11px] uppercase truncate">{log.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{log.type}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </section>

           <section className="bg-[#0f172a] p-6 md:p-8 rounded-3xl md:rounded-[3rem] shadow-2xl text-white">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Sourcing</h4>
                    <p className="text-sm font-black">Market Vendors</p>
                 </div>
                 <button onClick={() => setShowVendorModal(true)} className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center">
                    <i className="fas fa-plus text-xs"></i>
                 </button>
              </div>
              <div className="space-y-3">
                 {hubVendors.map((v) => (
                   <div key={v.id} className="bg-white/5 p-4 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                        <i className="fas fa-store-alt text-xs"></i>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-black text-[11px] uppercase truncate">{v.name}</p>
                        <p className="text-[9px] font-bold text-indigo-400 uppercase truncate">{v.specialty}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </section>
        </div>

        <div className="lg:col-span-8">
           <div className="bg-white rounded-[2rem] md:rounded-[4rem] shadow-xl border border-slate-100 overflow-hidden h-full flex flex-col min-h-[400px]">
              <div className="px-6 md:px-10 py-6 border-b border-slate-50 flex items-center justify-between">
                 <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{activeHub} Stock</h4>
                 <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">
                    {hubProducts.length} Items
                 </span>
              </div>
              <div className="p-6 md:p-10 flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                 {hubProducts.map(p => (
                   <div key={p.id} className="bg-slate-50 p-5 rounded-3xl flex gap-4 items-center border border-transparent hover:border-indigo-100">
                      <div className="w-16 h-16 bg-white rounded-xl shadow-sm overflow-hidden flex items-center justify-center text-slate-200">
                         {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <i className="fas fa-box text-xl"></i>}
                      </div>
                      <div>
                         <h5 className="font-black text-slate-800 uppercase text-[11px] line-clamp-1">{p.name}</h5>
                         <p className="text-lg font-black text-slate-900 leading-none mt-1">GHS {p.sellingPrice}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {showLogModal && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-6 italic">Add Rider</h3>
            <form onSubmit={handleAddLog} className="space-y-6">
              <input type="text" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Rider Name" onChange={e => setNewLog({...newLog, name: e.target.value})} />
              <input type="tel" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="WhatsApp Number" onChange={e => setNewLog({...newLog, contact: e.target.value})} />
              <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-[2rem] uppercase text-[10px] shadow-xl">Link Rider</button>
              <button type="button" onClick={() => setShowLogModal(false)} className="w-full text-[10px] font-black text-slate-400 uppercase py-2">Close</button>
            </form>
          </div>
        </div>
      )}

      {showVendorModal && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-6 italic">Link Vendor</h3>
            <form onSubmit={handleAddVendor} className="space-y-6">
              <input type="text" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Shop Name" onChange={e => setNewVendor({...newVendor, name: e.target.value})} />
              <input type="tel" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="WhatsApp" onChange={e => setNewVendor({...newVendor, contact: e.target.value})} />
              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-[2rem] uppercase text-[10px] shadow-xl">Link Partner</button>
              <button type="button" onClick={() => setShowVendorModal(false)} className="w-full text-[10px] font-black text-slate-400 uppercase py-2">Close</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HubManager;
