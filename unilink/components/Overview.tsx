
import React from 'react';
import { PieChart, Zap, Truck, Box, MoreHorizontal, Activity } from 'lucide-react';
import StatCard from './StatCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const data = [
  { name: 'Mon', count: 12 },
  { name: 'Tue', count: 19 },
  { name: 'Wed', count: 15 },
  { name: 'Thu', count: 22 },
  { name: 'Fri', count: 30 },
  { name: 'Sat', count: 25 },
  { name: 'Sun', count: 18 },
];

const Overview: React.FC = () => {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
            Command Center
          </h1>
          <p className="text-sm font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">
            UniHub Logistics Real-Time
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-sm border border-gray-100">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Nodes Active</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Gross Traffic" 
          value="GHS 0" 
          icon={<PieChart size={24} className="text-indigo-600" />} 
          color="bg-indigo-50"
        />
        <StatCard 
          label="Net Profit" 
          value="GHS 0" 
          icon={<Zap size={24} className="text-emerald-500" />} 
          color="bg-emerald-50"
        />
        <StatCard 
          label="Hub Movement" 
          value="0" 
          icon={<Truck size={24} className="text-amber-500" />} 
          color="bg-amber-50"
        />
        <StatCard 
          label="Listed Assets" 
          value="0" 
          icon={<Box size={24} className="text-slate-900" />} 
          color="bg-slate-100"
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Delivery Stream */}
        <div className="lg:col-span-2 bg-white rounded-[40px] p-8 shadow-sm border border-gray-50 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <MoreHorizontal className="text-slate-300" size={20} />
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Delivery Stream</h2>
            </div>
            <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Live Updates</div>
          </div>
          
          <div className="flex-1 min-h-[300px] flex flex-col">
            <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-auto pt-6 border-t border-slate-50">
              <div className="flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold uppercase">Recent: Room 402 Delivered</span>
                  <span className="text-xs font-bold uppercase">• Room 109 Pickup</span>
                </div>
                <button className="text-[10px] font-black uppercase text-indigo-600 hover:underline">View All</button>
              </div>
            </div>
          </div>
        </div>

        {/* Fast Hub Card */}
        <div className="bg-[#1e293b] rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-8">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
               <Activity className="text-indigo-400 animate-pulse" size={24} />
            </div>
          </div>

          <div className="relative z-10">
            <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-4">Fast Hub</h2>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest leading-relaxed max-w-[200px]">
              Optimizing campus routes for maximum delivery efficiency.
            </p>
          </div>

          <div className="relative z-10 mt-12">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-slate-500 font-black text-xs uppercase tracking-widest">Active Fleet</span>
              <div className="h-[2px] w-12 bg-indigo-500"></div>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-6xl font-black">6</span>
              <span className="text-indigo-400 text-sm font-bold uppercase pb-2">Cycles</span>
            </div>
          </div>

          <div className="absolute -bottom-10 -right-10 opacity-10">
            <Truck size={200} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
