
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
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">Overview</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Tracking movement from market to hostel</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-100 shadow-sm">
           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
           <span className="text-[10px] font-black uppercase text-slate-400">Hub Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Money Earned" value={`GHS ${totalRevenue}`} icon="fa-sack-dollar" color="text-indigo-600" />
        <MetricCard title="My Profit" value={`GHS ${totalProfit}`} icon="fa-arrow-trend-up" color="text-emerald-600" />
        <MetricCard title="Orders Moved" value={orders.length.toString()} icon="fa-truck-ramp-box" color="text-amber-600" />
        <MetricCard title="Active Stock" value={products.filter(p => p.isApproved !== false).length.toString()} icon="fa-box-archive" color="text-slate-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50 relative overflow-hidden">
          <div className="flex justify-between items-center mb-10">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Stream</h3>
             <i className="fas fa-route text-slate-100 text-2xl"></i>
          </div>
          <div className="space-y-6 relative z-10">
            {orders.slice(0, 4).map((order, idx) => (
              <div key={order.id} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-transparent hover:border-slate-100 transition-all group">
                 <div className="flex items-center gap-6">
                    <div className="relative">
                       <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm">
                          <i className="fas fa-truck-fast text-xs group-hover:delivery-move"></i>
                       </div>
                       {idx < 3 && <div className="absolute top-12 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-slate-100 border-dashed border-l-2"></div>}
                    </div>
                    <div>
                       <p className="text-xs font-black uppercase tracking-tight text-slate-800">{order.customerName}</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase">{order.status} • {order.orderDate}</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-sm font-black text-slate-900">GHS {order.amountPaid}</p>
                    <p className="text-[9px] font-black text-emerald-500 uppercase">+{order.profit} Profit</p>
                 </div>
              </div>
            ))}
            {orders.length === 0 && (
               <div className="py-20 text-center text-slate-200">
                  <i className="fas fa-satellite-dish text-4xl mb-4"></i>
                  <p className="text-[10px] font-black uppercase tracking-widest">Awaiting sales traffic...</p>
               </div>
            )}
          </div>
          {/* Background Decorative Path */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.03]" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M10 20 Q 50 10 90 20 T 10 80" fill="none" stroke="currentColor" strokeWidth="2" className="road-animate" />
          </svg>
        </div>

        <div className="bg-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl relative flex flex-col justify-between overflow-hidden">
           <div className="relative z-10">
              <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mb-8 backdrop-blur-md">
                 <i className="fas fa-fire-flame-curved text-2xl"></i>
              </div>
              <h3 className="text-2xl font-black uppercase italic mb-4 leading-tight">Fast<br/>Movement</h3>
              <p className="text-sm font-medium opacity-80 leading-relaxed">Most students order tech gadgets between 7pm and 10pm. Ensure your AI bot drafts posts for this window!</p>
           </div>
           <div className="relative z-10 pt-10">
              <div className="flex justify-between items-end">
                 <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Success Rate</span>
                 <span className="text-3xl font-black">98%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full mt-3 overflow-hidden">
                 <div className="h-full bg-white rounded-full w-[98%]"></div>
              </div>
           </div>
           <i className="fas fa-truck-bolt absolute bottom-[-40px] right-[-40px] text-[180px] opacity-10 -rotate-12 pointer-events-none"></i>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string; icon: string; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-50 flex flex-col justify-between group hover:shadow-xl transition-all">
    <div className={`w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
      <i className={`fas ${icon} text-lg`}></i>
    </div>
    <div className="mt-8">
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
      <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
    </div>
  </div>
);

export default Dashboard;