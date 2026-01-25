
import React from 'react';
import { CircleDollarSign, TrendingUp, Package, Archive, Dot, Truck } from 'lucide-react';
import SummaryCard from './SummaryCard';
import { Product, Order } from '../types';

// Define the interface for the Dashboard props to satisfy TypeScript requirements in App.tsx
interface DashboardProps {
  products: Product[];
  orders: Order[];
}

const Dashboard: React.FC<DashboardProps> = ({ products, orders }) => {
  // Calculate summary statistics from the provided products and orders data
  const totalRevenue = orders.reduce((sum, order) => sum + (order.amountPaid || 0), 0);
  const totalProfit = orders.reduce((sum, order) => sum + (order.profit || 0), 0);
  const ordersCount = orders.length;
  const activeStock = products.filter(p => p.isApproved !== false).length;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <header className="flex justify-between items-start mb-10">
        <div>
          <h2 className="text-4xl font-extrabold text-[#101928] tracking-tight mb-2 uppercase">Overview</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
            Tracking movement from market to hostel
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hub Online</span>
        </div>
      </header>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SummaryCard 
          label="Money Earned" 
          value={`GHS ${totalRevenue.toLocaleString()}`} 
          icon={<CircleDollarSign size={20} />} 
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <SummaryCard 
          label="My Profit" 
          value={`GHS ${totalProfit.toLocaleString()}`} 
          icon={<TrendingUp size={20} />} 
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <SummaryCard 
          label="Orders Moved" 
          value={ordersCount} 
          icon={<Truck size={20} className="-scale-x-100" />} 
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
        <SummaryCard 
          label="Active Stock" 
          value={activeStock} 
          icon={<Archive size={20} />} 
          iconBg="bg-slate-50"
          iconColor="text-slate-600"
        />
      </div>

      {/* Bottom Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Delivery Stream Section */}
        <div className="lg:col-span-8 bg-white rounded-[40px] p-10 border border-slate-50 shadow-sm relative overflow-hidden min-h-[400px]">
           <div className="relative z-10">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em] mb-8">Delivery Stream</h3>
              
              {orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="bg-white p-2 rounded-xl shadow-sm">
                          <Package size={16} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase">{order.customerName}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{order.orderDate}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${
                        order.status === 'delivered' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full mt-20 opacity-20">
                  <div className="flex space-x-4 mb-4">
                    <div className="w-16 h-1 bg-slate-200 rounded-full" />
                    <div className="w-4 h-1 bg-slate-200 rounded-full" />
                    <div className="w-2 h-1 bg-slate-200 rounded-full" />
                  </div>
                  <div className="flex items-center space-x-4">
                     <Package size={48} className="text-slate-400" />
                  </div>
                </div>
              )}
           </div>
           
           {/* Abstract path background */}
           <div className="absolute top-1/2 left-0 w-full px-10">
              <div className="border-b-2 border-dashed border-slate-100 w-full h-1" />
           </div>

           {orders.length === 0 && (
             <div className="absolute bottom-10 left-0 w-full flex flex-col items-center text-center">
                <div className="bg-slate-50 p-3 rounded-full mb-4">
                  <Truck className="text-slate-300 animate-bounce" size={20} />
                </div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Awaiting sales traffic...</p>
             </div>
           )}
        </div>

        {/* Fast Movement Sidebar */}
        <div className="lg:col-span-4 bg-[#4F46E5] text-white rounded-[40px] p-8 relative overflow-hidden flex flex-col justify-end">
          <div className="absolute top-8 left-8 bg-white/10 p-4 rounded-3xl">
            <Dot size={40} className="text-white animate-ping absolute top-0 left-0 opacity-20" />
            <TrendingUp size={24} className="text-white relative z-10" />
          </div>

          <div className="mt-20">
            <h3 className="text-3xl font-black italic uppercase leading-none mb-6">
              Fast<br />Movement
            </h3>
            <p className="text-sm font-medium text-white/80 leading-relaxed mb-6">
              Most students order tech gadgets between 7pm and 10pm. Ensure your AI bot drafts posts for this window.
            </p>
            <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-white/50">
              <span>View Insights</span>
              <span className="text-lg">→</span>
            </div>
          </div>

          {/* Background Decoration */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
