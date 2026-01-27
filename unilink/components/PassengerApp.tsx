
import React, { useState, useEffect } from 'react';
import { Driver, Pool, BusinessSettings, Ad } from '../types';
import { UserPlus, MessageCircle, MapPin, Users, Zap, Phone, X, Sparkles, Navigation, LayoutGrid } from 'lucide-react';

interface AdSenseProps {
  publisherId?: string;
  slotId?: string;
}

const AdSenseContainer: React.FC<AdSenseProps> = ({ publisherId, slotId }) => {
  useEffect(() => {
    if (publisherId && slotId) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error("AdSense Load Error:", e);
      }
    }
  }, [publisherId, slotId]);

  if (!publisherId || !slotId) return null;

  return (
    <div className="my-10 mx-auto max-w-4xl p-4 bg-white/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center">
      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2">Advertisement</span>
      <ins className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client={publisherId}
           data-ad-slot={slotId}
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
    </div>
  );
};

interface PassengerAppProps {
  drivers: Driver[];
  pools: Pool[];
  settings: BusinessSettings;
  ads: Ad[];
  onJoinPool: (poolId: string, name: string) => void;
  onCreatePool: (driverId: string, from: string, to: string) => void;
}

const PassengerApp: React.FC<PassengerAppProps> = ({ drivers, pools, settings, ads, onJoinPool, onCreatePool }) => {
  const [userName, setUserName] = useState('');
  const [showJoinModal, setShowJoinModal] = useState<string | null>(null);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [newPoolData, setNewPoolData] = useState({ driverId: '', from: '', to: '' });

  const activePools = pools.filter(p => p.status === 'pooling');

  const handleWhatsApp = (pool: Pool) => {
    const driver = drivers.find(d => d.id === pool.driverId);
    if (!driver) return;
    const msg = `UniLink Station Check: Node ${pool.routeFrom} → ${pool.routeTo}. Passenger: ${userName}. Current Status: ${pool.passengers.length}/${pool.capacity}`;
    window.open(`https://wa.me/${driver.contact.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCall = (pool: Pool) => {
    const driver = drivers.find(d => d.id === pool.driverId);
    if (!driver) return;
    window.location.href = `tel:${driver.contact.replace(/\D/g, '')}`;
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 font-sans selection:bg-sky-500/30 pb-20">
      <header className="p-6 md:p-12 bg-[#0f172a] text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-sky-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-sky-500/20">
            <Zap size={28} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter leading-none">{settings.storeName}</h1>
            <p className="text-[9px] font-black text-sky-400 uppercase tracking-[0.4em] mt-2">Ghana Passenger Transit Network</p>
          </div>
        </div>
        <button 
          onClick={() => setShowCreatePool(true)}
          className="bg-[#f59e0b] hover:bg-amber-600 text-[#0f172a] px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
        >
          <Navigation size={14} /> Open Live Node
        </button>
      </header>

      {/* Promoted Ads Carousel */}
      {settings.adsEnabled && ads.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 mt-10">
          <div className="flex items-center gap-2 mb-4">
             <Sparkles className="text-sky-500" size={16} />
             <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transit Highlights</h2>
          </div>
          <div className="flex gap-6 overflow-x-auto no-scrollbar pb-4">
            {ads.map(ad => (
              <div key={ad.id} className="min-w-[300px] md:min-w-[400px] bg-[#0f172a] rounded-[2.5rem] overflow-hidden relative group shrink-0 shadow-xl">
                 {ad.imageUrl && <img src={ad.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-all duration-700" alt="" />}
                 <div className="relative p-8 h-48 flex flex-col justify-between">
                    <div>
                      <h3 className="text-white font-black uppercase italic tracking-tighter text-xl">{ad.title}</h3>
                      <p className="text-sky-300 text-[10px] font-bold uppercase mt-1 line-clamp-2">{ad.description}</p>
                    </div>
                 </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AdSense Top Display */}
      <AdSenseContainer publisherId={settings.adsensePublisherId} slotId={settings.adsenseSlotId} />

      <main className="max-w-7xl mx-auto p-6 md:p-12 space-y-10">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
           <h2 className="text-lg font-black uppercase tracking-tighter text-slate-800 italic flex items-center gap-3">
             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
             Active Passenger Nodes
           </h2>
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{activePools.length} NODES DISCOVERED</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {activePools.map(pool => {
            const driver = drivers.find(d => d.id === pool.driverId);
            const isFull = pool.passengers.length >= pool.capacity;
            const progress = (pool.passengers.length / pool.capacity) * 100;

            return (
              <div key={pool.id} className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden flex flex-col group hover:shadow-2xl transition-all shadow-sm">
                <div className="p-8 space-y-6 flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <div className="bg-sky-50 text-sky-600 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest w-fit border border-sky-100">
                        {driver?.vehicleType}
                      </div>
                      <p className="text-sm font-black uppercase tracking-tight text-slate-800 mt-1">{driver?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Standard Fare</p>
                      <p className="text-lg font-black text-sky-600">{settings.currency} {driver?.pricePerSeat}</p>
                    </div>
                  </div>

                  <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                       <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-300"></div>
                       <p className="font-bold text-xs uppercase text-slate-500">{pool.routeFrom}</p>
                    </div>
                    <div className="h-6 w-[1px] bg-slate-200 ml-[5px]"></div>
                    <div className="flex items-center gap-4">
                       <div className="w-2.5 h-2.5 rounded-full bg-sky-500"></div>
                       <p className="font-bold text-xs uppercase text-slate-800">{pool.routeTo}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Station Occupancy</span>
                      <span className="text-[10px] font-black text-sky-600">{pool.passengers.length}/{pool.capacity} Seats</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-700 ${isFull ? 'bg-emerald-500' : 'bg-sky-500'}`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex gap-3">
                  {isFull ? (
                    <>
                      <button onClick={() => handleCall(pool)} className="flex-1 bg-white border border-slate-200 text-slate-700 py-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:bg-slate-100">
                        <Phone size={14} /> Call Driver
                      </button>
                      <button onClick={() => handleWhatsApp(pool)} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">
                        <MessageCircle size={14} /> WhatsApp Confirm
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => setShowJoinModal(pool.id)}
                      className="w-full bg-[#0f172a] hover:bg-sky-600 text-white py-5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all"
                    >
                      <UserPlus size={16} /> Link to Node
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {activePools.length === 0 && (
          <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-6 opacity-40">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center shadow-sm">
              <Navigation size={40} className="text-slate-300" />
            </div>
            <div>
              <p className="font-black text-xs uppercase tracking-[0.3em] text-slate-500">Scanning National Hubs...</p>
              <p className="text-[10px] font-bold text-slate-400 mt-2">No active terminals broadcasted in your region.</p>
            </div>
          </div>
        )}
      </main>

      {/* Bottom AdSense */}
      <AdSenseContainer publisherId={settings.adsensePublisherId} slotId={settings.adsenseSlotId} />

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-10 md:p-12 rounded-[3.5rem] w-full max-w-md space-y-8 shadow-2xl relative">
            <button onClick={() => setShowJoinModal(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900"><X size={20} /></button>
            <div className="text-center">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 mb-2">Claim Node Seat</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Verify passenger link for terminal logs</p>
            </div>
            <input 
              type="text" 
              placeholder="Your ID / Name"
              className="w-full bg-slate-50 border border-slate-100 py-5 px-8 rounded-2xl text-slate-900 font-bold outline-none focus:ring-2 focus:ring-sky-500 transition-all"
              value={userName}
              onChange={e => setUserName(e.target.value)}
            />
            <button 
              onClick={() => {
                if (userName) {
                  onJoinPool(showJoinModal, userName);
                  setUserName('');
                  setShowJoinModal(null);
                }
              }}
              className="w-full bg-[#0f172a] text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-sky-600 transition-all"
            >
              Confirm Terminal Entry
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreatePool && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-10 md:p-12 rounded-[3.5rem] w-full max-w-md space-y-8 shadow-2xl relative">
            <button onClick={() => setShowCreatePool(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900"><X size={20} /></button>
            <div className="text-center">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 mb-2">Broadcast Route</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Deploy a new pooling terminal</p>
            </div>
            <div className="space-y-5">
              <select 
                className="w-full bg-slate-50 border border-slate-100 py-5 px-8 rounded-2xl text-slate-900 font-bold outline-none appearance-none"
                onChange={e => setNewPoolData({...newPoolData, driverId: e.target.value})}
              >
                <option value="">-- Targeted Driver --</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.vehicleType})</option>)}
              </select>
              <input placeholder="Terminal A (From)" className="w-full bg-slate-50 border border-slate-100 py-5 px-8 rounded-2xl text-slate-900 font-bold outline-none" onChange={e => setNewPoolData({...newPoolData, from: e.target.value})} />
              <input placeholder="Terminal B (To)" className="w-full bg-slate-50 border border-slate-100 py-5 px-8 rounded-2xl text-slate-900 font-bold outline-none" onChange={e => setNewPoolData({...newPoolData, to: e.target.value})} />
            </div>
            <button 
              onClick={() => {
                if (newPoolData.driverId && newPoolData.from && newPoolData.to) {
                  onCreatePool(newPoolData.driverId, newPoolData.from, newPoolData.to);
                  setShowCreatePool(false);
                }
              }}
              className="w-full bg-[#f59e0b] text-[#0f172a] py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-amber-600 transition-all"
            >
              Deploy Node Station
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PassengerApp;
