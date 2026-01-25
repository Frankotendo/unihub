
import React from 'react';
import { Product, Order } from '../types';

interface DashboardProps {
  products: Product[];
  orders: Order[];
}

const Dashboard: React.FC<DashboardProps> = ({ products, orders }) => {
  const totalRevenue = orders.reduce((acc, order) => {
    const p = products.find(prod => prod.id === order.productId);
    return acc + (p?.sellingPrice || 0);
  }, 0);

  const totalProfit = orders.reduce((acc, order) => acc + order.profit, 0);

  return (
    <div className="space-y-12 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Command Center</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] ml-1">UniHub Logistics Real-Time</p>
        </div>
        <div className="flex items-center gap-4 px-6 py-3 bg-white rounded-full border border-slate-100 shadow-sm">
           <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
           </span>
           <span className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Nodes Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <MetricCard title="Gross Traffic" value={`GHS ${totalRevenue}`} icon="fa-chart-pie" color="text-indigo-600" />
        <MetricCard title="Net Profit" value={`GHS ${totalProfit}`} icon="fa-bolt" color="text-emerald-500" />
        <MetricCard title="Hub Movement" value={orders.length.toString()} icon="fa-truck-fast" color="text-amber-500" />
        <MetricCard title="Listed Assets" value={products.filter(p => p.isApproved !== false).length.toString()} icon="fa-box" color="text-slate-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-50 relative overflow-hidden">
          <div className="flex justify-between items-center mb-12">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                <i className="fas fa-stream"></i>
                Delivery Stream
             </h3>
             <span className="text-[9px] font-bold text-slate-300 uppercase">Live Updates</span>
          </div>
          <div className="space-y-8 relative z-10">
            {orders.slice(0, 4).map((order, idx) => (
              <div key={order.id} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[2rem] border border-transparent hover:border-slate-100 transition-all group hover:bg-white hover:shadow-xl">
                 <div className="flex items-center gap-8">
                    <div className="relative">
                       <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm transition-transform group-hover:scale-110">
                          <i className="fas fa-truck text-sm group-hover:delivery-move"></i>
                       </div>
                       {idx < orders.slice(0, 4).length - 1 && <div className="absolute top-14 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-slate-100"></div>}
                    </div>
                    <div>
                       <p className="text-sm font-black uppercase tracking-tight text-slate-900">{order.customerName}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">GHS {order.amountPaid} • {order.orderDate}</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${order.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                       {order.status}
                    </span>
                 </div>
              </div>
            ))}
            {orders.length === 0 && (
               <div className="py-24 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-radar text-slate-200 text-3xl animate-pulse"></i>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">Awaiting Movement</p>
               </div>
            )}
          </div>
          
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.05]" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M0 50 Q 50 40 100 50" fill="none" stroke="#4f46e5" strokeWidth="1" className="road-animate" />
             <path d="M0 70 Q 50 60 100 70" fill="none" stroke="#4f46e5" strokeWidth="1" className="road-animate" />
          </svg>
        </div>

        <div className="bg-[#0f172a] p-12 rounded-[4rem] text-white shadow-2xl relative flex flex-col justify-between overflow-hidden">
           <div className="relative z-10">
              <div className="w-20 h-20 bg-white/10 rounded-[2.5rem] flex items-center justify-center mb-10 backdrop-blur-md border border-white/5">
                 <i className="fas fa-tachometer-fast text-3xl text-indigo-400"></i>
              </div>
              <h3 className="text-3xl font-black uppercase italic mb-6 leading-tight tracking-tighter">Fast Hub<br/>Metrics</h3>
              <p className="text-sm font-medium opacity-70 leading-relaxed italic">
                "92% of your sales come from 'Hostel Essentials'. The AI recommends stocking more mini-fans this week."
              </p>
           </div>
           
           <div className="relative z-10 mt-12 pt-8 border-t border-white/5">
              <div className="flex justify-between items-end mb-4">
                 <span className="text-[10px] font-black uppercase tracking-widest opacity-40">System Efficiency</span>
                 <span className="text-4xl font-black tracking-tighter">98%</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                 <div className="h-full bg-indigo-500 rounded-full w-[98%] shadow-[0_0_20px_rgba(79,70,229,0.5)]"></div>
              </div>
           </div>
           
           <i className="fas fa-rocket absolute bottom-[-50px] left-[-50px] text-[250px] opacity-[0.03] rotate-45 pointer-events-none"></i>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string; icon: string; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-50 flex flex-col justify-between group hover:shadow-2xl transition-all hover:-translate-y-1">
    <div className={`w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center ${color} group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm`}>
      <i className={`fas ${icon} text-xl`}></i>
    </div>
    <div className="mt-10">
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">{title}</p>
      <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
    </div>
  </div>
);

export default Dashboard;
