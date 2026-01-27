
import React from 'react';
import { Driver, Pool, BusinessSettings } from '../types';
import { LayoutDashboard, TrendingUp, Users, Truck, Activity, Wallet } from 'lucide-react';

interface DashboardProps {
  products: Driver[]; // Using products prop for drivers
  orders: Pool[]; // Using orders prop for pools
  settings: BusinessSettings;
}

const Dashboard: React.FC<DashboardProps> = ({ products: drivers, orders: pools, settings }) => {
  const totalPassengers = pools.reduce((acc, pool) => acc + pool.passengers.length, 0);
  const platformProfit = totalPassengers * (settings.commissionPerSeat || 0);
  const grossDriverRevenue = pools.reduce((acc, pool) => {
    const driver = drivers.find(d => d.id === pool.driverId);
    return acc + (pool.passengers.length * (driver?.pricePerSeat || 0));
  }, 0);

  const activePools = pools.filter(p => p.status === 'pooling').length;

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none italic">Terminal Insights</h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
              Live Monitoring // Ghana National Network
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Commission Rate</span>
          <span className="text-sm font-black text-indigo-600 uppercase italic">{settings.currency} {settings.commissionPerSeat.toFixed(2)} / Seat</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard 
          title="Platform Profit" 
          value={`${settings.currency} ${platformProfit.toFixed(2)}`} 
          icon={<Wallet size={20} />} 
          color="bg-emerald-50 text-emerald-600" 
        />
        <MetricCard 
          title="Driver Earnings" 
          value={`${settings.currency} ${grossDriverRevenue.toFixed(2)}`} 
          icon={<TrendingUp size={20} />} 
          color="bg-indigo-50 text-indigo-600" 
        />
        <MetricCard 
          title="Total Passengers" 
          value={totalPassengers.toString()} 
          icon={<Users size={20} />} 
          color="bg-amber-50 text-amber-600" 
        />
        <MetricCard 
          title="Live Stations" 
          value={activePools.toString()} 
          icon={<Truck size={20} />} 
          color="bg-rose-50 text-rose-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
        <div className="lg:col-span-3 bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[400px]">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic">Regional Activity Flow</h3>
            <div className="flex gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="w-2 h-2 rounded-full bg-slate-200"></span>
              <span className="w-2 h-2 rounded-full bg-slate-200"></span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-24 text-slate-300">
             <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
               <Activity size={40} className="opacity-10" />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em]">Synching Real-time Node Data...</p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-8 italic">Top Fleet Performers</h3>
          <div className="space-y-4">
            {drivers.sort((a,b) => b.rating - a.rating).slice(0, 6).map(driver => {
              const driverPools = pools.filter(p => p.driverId === driver.id);
              const seatsFilled = driverPools.reduce((acc, p) => acc + p.passengers.length, 0);
              return (
                <div key={driver.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl group hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800 uppercase leading-none">{driver.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{driver.vehicleType}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-indigo-600">{seatsFilled} Passengers</p>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">{settings.currency} {(seatsFilled * driver.pricePerSeat).toFixed(2)}</p>
                  </div>
                </div>
              );
            })}
            {drivers.length === 0 && (
              <div className="text-center py-20 text-slate-200">
                <Users size={32} className="mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">No Active Fleet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6 group hover:shadow-xl transition-all duration-300">
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner shrink-0 ${color}`}>
      {icon}
    </div>
    <div className="overflow-hidden">
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 truncate">{title}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tighter truncate italic">{value}</p>
    </div>
  </div>
);

export default Dashboard;
