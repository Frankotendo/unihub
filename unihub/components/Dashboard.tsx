
import React from 'react';
import { Product, Order } from '../types';
import { LayoutDashboard, TrendingUp, ShoppingBag, Box, Activity } from 'lucide-react';

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
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none">Dashboard</h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
              Node Active // Unidrop Dormaa
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Store Status</span>
          <span className="text-sm font-black text-emerald-500 uppercase">Online & Sourcing</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard 
          title="Total Revenue" 
          value={`GHS ${totalRevenue}`} 
          icon={<TrendingUp size={20} />} 
          color="bg-indigo-50 text-indigo-600" 
        />
        <MetricCard 
          title="Total Profit" 
          value={`GHS ${totalProfit}`} 
          icon={<Activity size={20} />} 
          color="bg-emerald-50 text-emerald-600" 
        />
        <MetricCard 
          title="Total Orders" 
          value={orders.length.toString()} 
          icon={<ShoppingBag size={20} />} 
          color="bg-amber-50 text-amber-600" 
        />
        <MetricCard 
          title="Inventory Items" 
          value={products.length.toString()} 
          icon={<Box size={20} />} 
          color="bg-rose-50 text-rose-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
        <div className="lg:col-span-3 bg-white p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[300px] md:min-h-[400px]">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-10">Orders by Source</h3>
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
             <LayoutDashboard size={48} className="opacity-10 mb-4" />
             <p className="text-xs font-bold uppercase tracking-widest">No orders yet to display.</p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-8">Recent Inventory</h3>
          <div className="space-y-2 overflow-x-auto no-scrollbar">
            <div className="min-w-[300px]">
              <div className="grid grid-cols-3 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 pb-4 border-b border-slate-50">
                <span>Product</span>
                <span className="text-center">Source</span>
                <span className="text-right">Margin</span>
              </div>
              <div className="space-y-2 mt-2">
                {products.slice(0, 5).map(product => (
                  <div key={product.id} className="grid grid-cols-3 items-center px-4 py-3 hover:bg-slate-50 rounded-2xl transition-colors">
                    <span className="text-xs font-black text-slate-700 truncate pr-2">{product.name}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase text-center">{product.location.split(' ')[0]}</span>
                    <span className="text-xs font-black text-emerald-500 text-right">GHS {product.sellingPrice - product.sourcePrice}</span>
                  </div>
                ))}
                {products.length === 0 && (
                  <p className="text-center py-10 text-xs font-bold text-slate-300 uppercase tracking-widest">Empty Stock</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4 md:gap-6 group hover:shadow-xl transition-all duration-300">
    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shadow-inner shrink-0 ${color}`}>
      {icon}
    </div>
    <div className="overflow-hidden">
      <p className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 truncate">{title}</p>
      <p className="text-lg md:text-2xl font-black text-slate-900 tracking-tighter truncate">{value}</p>
    </div>
  </div>
);

export default Dashboard;
