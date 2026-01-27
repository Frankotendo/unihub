
import React, { useState } from 'react';
import { Driver, VehicleType, Location, Transaction } from '../types';
// Added 'Info' to the imports to resolve the missing name error on line 146
import { Trash2, Phone, Star, ShieldCheck, Plus, X, Truck, Wallet, History, TrendingUp, TrendingDown, Info } from 'lucide-react';

interface FleetManagerProps {
  drivers: Driver[];
  onAddDriver: (driver: Driver) => void;
  onDeleteDriver: (id: string) => void;
  onCreditDriver: (id: string, amount: number) => void;
}

const FleetManager: React.FC<FleetManagerProps> = ({ drivers, onAddDriver, onDeleteDriver, onCreditDriver }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [showCredit, setShowCredit] = useState<Driver | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  
  const handleCredit = () => {
    if (showCredit && creditAmount) {
      onCreditDriver(showCredit.id, Number(creditAmount));
      setCreditAmount('');
      setShowCredit(null);
    }
  };

  const [newDriver, setNewDriver] = useState<Partial<Driver>>({
    vehicleType: 'Taxi',
    baseLocation: 'Dormaa',
    isAvailable: true,
    capacity: 4,
    pricePerSeat: 5.0,
    rating: 5.0,
    walletBalance: 0,
    transactions: []
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.name || !newDriver.contact) return;

    onAddDriver({
      id: `DRV-${Date.now()}`,
      name: newDriver.name!,
      vehicleType: newDriver.vehicleType as VehicleType,
      vehicleNumber: newDriver.vehicleNumber || 'N/A',
      contact: newDriver.contact!,
      baseLocation: newDriver.baseLocation || 'Dormaa',
      isAvailable: true,
      capacity: newDriver.capacity || 4,
      pricePerSeat: newDriver.pricePerSeat || 5.0,
      rating: 5.0,
      walletBalance: 0,
      transactions: []
    });
    setShowAdd(false);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900">Fleet Registry</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Verified Sourcing & Logistics Fleet</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-[#0f172a] hover:bg-sky-600 text-white px-8 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 shadow-2xl transition-all"
        >
          <Plus size={16} /> Enroll New Vehicle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {drivers.map(driver => (
          <div key={driver.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative group hover:shadow-2xl transition-all flex flex-col">
             <div className="flex justify-between items-start mb-8">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 shadow-inner">
                  <Truck size={24} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowCredit(driver)} className="text-emerald-500 bg-emerald-50 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500 hover:text-white transition-all">
                    <Wallet size={12} /> Credits
                  </button>
                  <button onClick={() => onDeleteDriver(driver.id)} className="text-slate-200 hover:text-rose-500 p-2 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
             </div>
             
             <div className="space-y-2 flex-1">
                <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">{driver.name}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest bg-sky-50 px-3 py-1 rounded-lg">{driver.vehicleType}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest"># {driver.vehicleNumber}</span>
                </div>
                <div className="mt-4 p-5 bg-slate-900 rounded-3xl text-white relative overflow-hidden group">
                   <div className="relative z-10">
                     <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Terminal Balance</p>
                     <p className="text-2xl font-black italic tracking-tighter">GHS {driver.walletBalance.toFixed(2)}</p>
                   </div>
                   {driver.walletBalance <= 0 && <div className="absolute inset-0 bg-rose-500/20 border border-rose-500/50 rounded-3xl"></div>}
                </div>
             </div>

             <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className={`w-2.5 h-2.5 rounded-full ${driver.isAvailable ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{driver.isAvailable ? 'Broadcasting' : 'Suspended'}</span>
                </div>
                <div className="flex items-center gap-1 text-amber-500 px-3 py-1 bg-amber-50 rounded-xl">
                    <Star size={12} fill="currentColor" />
                    <span className="text-xs font-black">{driver.rating}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Admin Credit & Log View Modal */}
      {showCredit && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[4rem] w-full max-w-4xl max-h-[90vh] shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in">
            <div className="p-10 md:p-14 flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-12">
               <div>
                  <button onClick={() => setShowCredit(null)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 transition-colors">
                     <X size={24} />
                  </button>
                  <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter mb-2">Fleet Management</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-12">Node Control: {showCredit.name}</p>
                  
                  <div className="space-y-8">
                     <div className="p-10 bg-slate-50 rounded-[3rem] border border-slate-100 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Live Node Balance</p>
                        <p className="text-5xl font-black italic tracking-tighter text-slate-900">GHS {showCredit.walletBalance.toFixed(2)}</p>
                     </div>

                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Manual Credit Top-Up</label>
                        <input 
                           type="number" 
                           placeholder="Amount to Credit (GHS)" 
                           className="w-full p-6 bg-slate-100 rounded-2xl font-black text-xl outline-none border-2 border-transparent focus:border-emerald-500 transition-all" 
                           value={creditAmount} 
                           onChange={e => setCreditAmount(e.target.value)} 
                        />
                        <button 
                           onClick={handleCredit} 
                           className="w-full bg-emerald-500 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-xl hover:bg-emerald-600 transition-all"
                        >
                           Commit Credit to Wallet
                        </button>
                        <p className="text-[9px] font-bold text-slate-400 uppercase text-center tracking-widest">
                           Only commit after verifying MoMo / Cash Receipt.
                        </p>
                     </div>
                  </div>
               </div>

               <div className="flex flex-col h-full bg-slate-50/50 rounded-[3rem] p-10 border border-slate-100">
                  <div className="flex items-center gap-3 mb-8">
                     <History className="text-sky-500" size={20} />
                     <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Deduction History</h4>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar">
                     {(showCredit.transactions || []).map(tx => (
                        <div key={tx.id} className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center group">
                           <div>
                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{tx.description}</p>
                              <p className="text-[8px] font-black text-slate-400 uppercase mt-1">{new Date(tx.timestamp).toLocaleString()}</p>
                           </div>
                           <div className={`text-xs font-black ${tx.type === 'credit' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {tx.type === 'credit' ? '+' : '-'}{tx.amount.toFixed(2)}
                           </div>
                        </div>
                     ))}
                     {(!showCredit.transactions || showCredit.transactions.length === 0) && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-50">
                           <Info size={32} className="mb-2" />
                           <p className="text-[9px] font-black uppercase">No Logs Available</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[4rem] w-full max-w-xl shadow-2xl relative animate-in zoom-in duration-300">
            <button onClick={() => setShowAdd(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900"><X size={24} /></button>
            <h3 className="text-3xl font-black italic uppercase mb-8 text-slate-900">Enroll Vehicle</h3>
            <form onSubmit={handleAddSubmit} className="space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Driver Name</label>
                     <input required className="w-full p-5 bg-slate-50 rounded-2xl font-bold" value={newDriver.name || ''} onChange={e => setNewDriver({...newDriver, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Contact Number</label>
                     <input required className="w-full p-5 bg-slate-50 rounded-2xl font-bold" value={newDriver.contact || ''} onChange={e => setNewDriver({...newDriver, contact: e.target.value})} />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Vehicle Type</label>
                     <select className="w-full p-5 bg-slate-50 rounded-2xl font-bold appearance-none" value={newDriver.vehicleType} onChange={e => setNewDriver({...newDriver, vehicleType: e.target.value as VehicleType})}>
                        <option value="Taxi">Taxi</option>
                        <option value="Pragia">Pragia</option>
                        <option value="Private Shuttle">Private Shuttle</option>
                        <option value="Motorbike">Motorbike</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Number Plate</label>
                     <input required className="w-full p-5 bg-slate-50 rounded-2xl font-bold" value={newDriver.vehicleNumber || ''} onChange={e => setNewDriver({...newDriver, vehicleNumber: e.target.value})} />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Fare Per Seat</label>
                     <input type="number" required className="w-full p-5 bg-slate-50 rounded-2xl font-bold" value={newDriver.pricePerSeat || ''} onChange={e => setNewDriver({...newDriver, pricePerSeat: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Vehicle Capacity</label>
                     <input type="number" required className="w-full p-5 bg-slate-50 rounded-2xl font-bold" value={newDriver.capacity || ''} onChange={e => setNewDriver({...newDriver, capacity: Number(e.target.value)})} />
                  </div>
               </div>
               <button type="submit" className="w-full bg-[#0f172a] text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.3em] shadow-xl hover:bg-sky-500 transition-all">Complete Enrollment</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetManager;
