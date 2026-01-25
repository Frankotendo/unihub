
import React from 'react';
import { Product, Order, Location } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

  const locationData = Object.values(Location).map(loc => {
    const count = orders.filter(o => {
      const p = products.find(prod => prod.id === o.productId);
      return p?.location === loc;
    }).length;
    return { name: loc, value: count };
  }).filter(d => d.value > 0);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b'];

  const handleShareStore = async () => {
    const storeUrl = `${window.location.origin}${window.location.pathname}?view=store`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'UniDrop Hub',
          text: 'Check out the latest hostel essentials on my store!',
          url: storeUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      await navigator.clipboard.writeText(storeUrl);
      alert('Store link copied to clipboard!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Share Action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Business Performance</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time metrics</p>
        </div>
        <button 
          onClick={handleShareStore}
          className="w-full md:w-auto bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-indigo-100 hover:scale-105 transition-all"
        >
          <i className="fas fa-share-nodes"></i>
          Share Store Link
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`GHS ${totalRevenue.toLocaleString()}`} icon="fa-wallet" color="text-indigo-600" />
        <StatCard title="Total Profit" value={`GHS ${totalProfit.toLocaleString()}`} icon="fa-chart-line" color="text-emerald-600" />
        <StatCard title="Total Orders" value={orders.length.toString()} icon="fa-shopping-basket" color="text-amber-600" />
        <StatCard title="Inventory Items" value={products.length.toString()} icon="fa-box-open" color="text-rose-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Location */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Orders by Source</h3>
          <div className="h-[300px] w-full">
            {locationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {locationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">No orders yet to display.</div>
            )}
          </div>
        </div>

        {/* Profit Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Recent Inventory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium">Source</th>
                  <th className="pb-3 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.slice(0, 5).map(product => (
                  <tr key={product.id} className="text-sm">
                    <td className="py-4 font-medium text-slate-700">{product.name}</td>
                    <td className="py-4 text-slate-500">{product.location}</td>
                    <td className="py-4 text-emerald-600 font-bold">GHS {product.sellingPrice - product.sourcePrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; icon: string; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 ${color}`}>
      <i className={`fas ${icon} text-xl`}></i>
    </div>
    <div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

export default Dashboard;
