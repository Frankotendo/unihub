
import React, { useState } from 'react';
import { LocalVendor, Product, Location, LogisticsPartner } from '../types';

interface LocalDealsProps {
  products: Product[];
  vendors: LocalVendor[];
  logistics: LogisticsPartner[];
  onAddProduct: (product: Product) => void;
  onAddVendor: (vendor: LocalVendor) => void;
  onAddLogistics: (partner: LogisticsPartner) => void;
}

const LocalDeals: React.FC<LocalDealsProps> = ({ products, vendors, logistics, onAddVendor, onAddLogistics }) => {
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showLogisticsModal, setShowLogisticsModal] = useState(false);
  const [newVendor, setNewVendor] = useState<Partial<LocalVendor>>({});
  const [newLog, setNewLog] = useState<Partial<LogisticsPartner>>({ type: 'Dispatch Rider' });
  
  const localProducts = products.filter(p => p.location === Location.DORMAA);
  const dormaaLogistics = logistics.filter(l => l.location === 'Dormaa');

  const handleRegisterVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendor.name || !newVendor.contact) return;
    onAddVendor({
      id: `VEND-${Date.now()}`,
      name: newVendor.name!,
      marketLocation: newVendor.marketLocation || 'Dormaa Market',
      contact: newVendor.contact!,
      specialty: newVendor.specialty || 'General Goods'
    });
    setNewVendor({});
    setShowVendorModal(false);
  };

  const handleRegisterLogistics = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.name || !newLog.contact) return;
    onAddLogistics({
      id: `LOG-${Date.now()}`,
      name: newLog.name,
      contact: newLog.contact,
      type: newLog.type || 'Dispatch Rider',
      location: 'Dormaa'
    });
    setNewLog({ type: 'Dispatch Rider' });
    setShowLogisticsModal(false);
  };

  return (
    <div className="space-y-8">
      <div className="bg-emerald-600 p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="max-w-md text-center md:text-left">
            <h3 className="text-3xl font-black mb-2 uppercase tracking-tighter italic flex items-center gap-3">
              <i className="fas fa-shop"></i>
              Dormaa Market Hub
            </h3>
            <p className="opacity-90 font-medium">Daily arbitrage from local markets. No delivery fees for campus customers using internal riders.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/10 backdrop-blur-md px-8 py-6 rounded-3xl border border-white/10 text-center min-w-[120px]">
              <div className="text-3xl font-black text-white">{localProducts.length}</div>
              <div className="text-[10px] font-black uppercase opacity-60 tracking-widest mt-1">Live Deals</div>
            </div>
          </div>
        </div>
        <div className="absolute right-[-30px] top-[-30px] opacity-10 text-[200px] pointer-events-none transform rotate-12">
          <i className="fas fa-store"></i>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Logistics Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex justify-between items-center px-2">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Dormaa Logistics</h4>
            <button onClick={() => setShowLogisticsModal(true)} className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg uppercase tracking-widest">+ Rider</button>
          </div>
          <div className="space-y-4">
            {dormaaLogistics.map(log => (
              <div key={log.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <i className="fas fa-motorcycle text-xs"></i>
                </div>
                <div className="flex-1">
                  <h5 className="font-black text-slate-800 text-[11px] uppercase">{log.name}</h5>
                  <p className="text-[9px] font-bold text-slate-400">{log.contact}</p>
                </div>
                <a href={`tel:${log.contact}`} className="text-emerald-500"><i className="fas fa-phone-alt"></i></a>
              </div>
            ))}
            {dormaaLogistics.length === 0 && <p className="text-[9px] text-slate-300 font-bold uppercase text-center py-4">No local riders registered.</p>}
          </div>

          <div className="pt-6 border-t border-slate-100">
            <div className="flex justify-between items-center px-2 mb-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Market Partners</h4>
              <button onClick={() => setShowVendorModal(true)} className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg uppercase tracking-widest">+ Register</button>
            </div>
            <div className="space-y-3">
              {vendors.map(v => (
                <div key={v.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm group">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-black text-slate-800 uppercase tracking-tight text-[11px]">{v.name}</h5>
                    <a href={`tel:${v.contact}`} className="text-emerald-400 text-xs"><i className="fas fa-phone-alt"></i></a>
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{v.specialty}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">Local Stock Feed</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {localProducts.map(p => (
              <div key={p.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 shadow-sm hover:shadow-xl transition-all group">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex-shrink-0 flex items-center justify-center text-emerald-500 text-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all">
                    <i className="fas fa-tag"></i>
                </div>
                <div className="flex-1 overflow-hidden">
                  <h5 className="font-black text-slate-800 uppercase tracking-tighter text-md line-clamp-1">{p.name}</h5>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xl font-black text-slate-900">GHS {p.sellingPrice}</span>
                    <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase">Local Hub</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Logistics Modal */}
      {showLogisticsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-6 italic">Rider Registration</h3>
            <form onSubmit={handleRegisterLogistics} className="space-y-4">
              <input type="text" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Rider Name" value={newLog.name || ''} onChange={e => setNewLog({...newLog, name: e.target.value})} />
              <input type="tel" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="WhatsApp Number" value={newLog.contact || ''} onChange={e => setNewLog({...newLog, contact: e.target.value})} />
              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-[2rem] uppercase text-xs tracking-widest shadow-lg">Confirm Rider</button>
              <button type="button" onClick={() => setShowLogisticsModal(false)} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {showVendorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg p-10">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-6">Partner Onboarding</h3>
            <form onSubmit={handleRegisterVendor} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <input type="text" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Vendor Name" value={newVendor.name || ''} onChange={e => setNewVendor({...newVendor, name: e.target.value})} />
                <input type="tel" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="WhatsApp" value={newVendor.contact || ''} onChange={e => setNewVendor({...newVendor, contact: e.target.value})} />
              </div>
              <input type="text" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Specialty (e.g. Shoes)" value={newVendor.specialty || ''} onChange={e => setNewVendor({...newVendor, specialty: e.target.value})} />
              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-[2rem] hover:bg-emerald-700 transition-all uppercase text-sm tracking-widest">Confirm Registration</button>
              <button type="button" onClick={() => setShowVendorModal(false)} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocalDeals;
