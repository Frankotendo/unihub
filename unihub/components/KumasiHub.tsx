
import React, { useState } from 'react';
import { Product, Location, Category } from '../types.ts';

interface KumasiHubProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
}

const KumasiHub: React.FC<KumasiHubProps> = ({ products, onAddProduct }) => {
  const kumasiProducts = products.filter(p => p.location === Location.KUMASI);
  
  const [logistics, setLogistics] = useState([
    { name: 'VIP Station (Kumasi)', contact: '0244111222', type: 'Bus Service' },
    { name: 'OA Travel Hub', contact: '0555999888', type: 'Courier' }
  ]);

  return (
    <div className="space-y-8">
      {/* Kumasi Hub Header */}
      <div className="bg-indigo-900 p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl border-b-8 border-indigo-700">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="max-w-md text-center md:text-left">
            <h3 className="text-3xl font-black mb-2 uppercase tracking-tighter italic flex items-center gap-3">
               <i className="fas fa-truck-ramp-box"></i>
               Kumasi Regional Hub
            </h3>
            <p className="opacity-80 font-medium">Regional sourcing from Kejetia, Adum, and Bantama. Managing paid delivery logistics for premium stock.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-indigo-800/50 backdrop-blur-md px-8 py-6 rounded-3xl border border-white/10 text-center">
              <div className="text-3xl font-black text-indigo-300">{kumasiProducts.length}</div>
              <div className="text-[10px] font-black uppercase opacity-60 tracking-widest mt-1">Stock Items</div>
            </div>
            <div className="bg-indigo-800/50 backdrop-blur-md px-8 py-6 rounded-3xl border border-white/10 text-center">
              <div className="text-3xl font-black text-emerald-400">GHS 20</div>
              <div className="text-[10px] font-black uppercase opacity-60 tracking-widest mt-1">Avg Delivery</div>
            </div>
          </div>
        </div>
        <div className="absolute right-[-40px] bottom-[-40px] opacity-10 text-[250px] pointer-events-none transform -rotate-12">
          <i className="fas fa-truck-fast"></i>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Logistics Partners */}
        <div className="lg:col-span-1 space-y-6">
          <div className="px-2 flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Logistics Partners</h4>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></span>
          </div>
          <div className="space-y-4">
            {logistics.map((log, i) => (
              <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <i className="fas fa-bus text-xs"></i>
                  </div>
                  <a href={`tel:${log.contact}`} className="text-slate-300 hover:text-indigo-600 transition-colors">
                    <i className="fas fa-phone"></i>
                  </a>
                </div>
                <h5 className="font-black text-slate-800 uppercase tracking-tight text-sm mb-1">{log.name}</h5>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.type} // {log.contact}</p>
              </div>
            ))}
            <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all text-[10px] font-black uppercase tracking-widest">
              + Add Logistics Partner
            </button>
          </div>
        </div>

        {/* Kumasi Product Feed */}
        <div className="lg:col-span-3 space-y-6">
           <div className="px-2 flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Regional Stock (Paid Delivery)</h4>
            <p className="text-[10px] font-bold text-indigo-400">GHS 20-30 flat rate from Kumasi Hub</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {kumasiProducts.map(p => (
              <div key={p.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex items-center gap-6 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all group">
                <div className="w-24 h-24 bg-indigo-50/50 rounded-[2rem] flex-shrink-0 flex items-center justify-center text-indigo-600 text-4xl group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-inner">
                    <i className="fas fa-box-open"></i>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded-lg">REGIONAL HUB</span>
                    <span className="text-[10px] font-black text-rose-500">+GHS {p.deliveryCost} DELV</span>
                  </div>
                  <h5 className="font-black text-slate-800 leading-tight mb-2 uppercase tracking-tighter text-xl line-clamp-1">{p.name}</h5>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Price</span>
                      <span className="text-2xl font-black text-slate-900">GHS {p.sellingPrice}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Profit</span>
                      <span className="text-lg font-black text-emerald-600">GHS {p.sellingPrice - p.sourcePrice}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {kumasiProducts.length === 0 && (
             <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                <i className="fas fa-truck-fast text-4xl text-slate-200 mb-4"></i>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No Kumasi stock listed yet.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KumasiHub;
