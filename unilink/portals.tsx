
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { ai, supabase, decode, decodeAudioData, compressImage, AppSettings, RideNode, Driver, HubMission, TopupRequest, RegistrationRequest, RefundRequest, Transaction } from './lib';
import { QrScannerModal, InlineAd, AdGate } from './components';

export const HubGateway = ({ 
  onIdentify, 
  settings, 
  formState, 
  setFormState,
  onTriggerVoice 
}: { 
  onIdentify: (username: string, phone: string, pin: string, mode: 'login' | 'signup') => void, 
  settings: AppSettings,
  formState: { username: string, phone: string, pin: string, mode: 'login' | 'signup' },
  setFormState: any,
  onTriggerVoice: () => void
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/20 to-purple-900/20"></div>
      <div className="glass-bright w-full max-md:mt-8 max-w-sm p-6 rounded-[2rem] border border-white/10 relative z-10 animate-in zoom-in duration-500">
        <div className="text-center mb-6">
          {settings.appLogo ? (
            <img src={settings.appLogo} className="w-20 h-20 object-contain mx-auto mb-4 drop-shadow-2xl" alt="Logo" />
          ) : (
            <div className="w-14 h-14 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-orange-500/20 mb-4">
               <i className="fas fa-route text-[#020617] text-2xl"></i>
            </div>
          )}
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">NexRyde</h1>
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">Transit Excellence</p>
        </div>

        <button 
          onClick={onTriggerVoice}
          className="w-full mb-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform shadow-xl shadow-emerald-900/20 group"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <i className="fas fa-microphone text-sm"></i>
          </div>
          <div className="text-left">
             <span className="block text-[8px] font-black uppercase tracking-widest opacity-80">Local Language Support</span>
             <span className="block text-xs font-black italic">Kasa (Speak to Login)</span>
          </div>
        </button>

        <div className="space-y-3">
           {formState.mode === 'signup' && (
             <input 
               value={formState.username} 
               onChange={e => setFormState({...formState, username: e.target.value})}
               className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white font-bold text-sm outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
               placeholder="Choose Username"
             />
           )}
           <input 
             value={formState.phone} 
             onChange={e => setFormState({...formState, phone: e.target.value})}
             className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white font-bold text-sm outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
             placeholder="Phone Number"
           />
           <input 
             value={formState.pin}
             type="password"
             maxLength={4} 
             onChange={e => setFormState({...formState, pin: e.target.value.replace(/\D/g, '').slice(0, 4)})}
             className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white font-bold text-sm outline-none focus:border-amber-500 transition-all placeholder:text-slate-600 tracking-widest text-center"
             placeholder="4-Digit Security PIN"
           />
           <button 
             onClick={() => onIdentify(formState.username, formState.phone, formState.pin, formState.mode)}
             className="w-full bg-amber-500 text-[#020617] py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl"
           >
             {formState.mode === 'login' ? 'Enter Hub' : 'Create Identity'}
           </button>
        </div>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setFormState({...formState, mode: formState.mode === 'login' ? 'signup' : 'login'})}
            className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            {formState.mode === 'login' ? 'New here? Create Account' : 'Have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const PassengerPortal = ({ 
  currentUser, 
  nodes, 
  myRideIds, 
  onAddNode, 
  onJoin, 
  onLeave, 
  onForceQualify, 
  onCancel, 
  drivers, 
  searchConfig, 
  settings, 
  onShowQr, 
  onShowAbout,
  createMode,
  setCreateMode,
  newNode,
  setNewNode,
  onTriggerVoice
}: any) => {
  const [fareEstimate, setFareEstimate] = useState(0);
  const [customOffer, setCustomOffer] = useState<number | null>(null);
  const [offerInput, setOfferInput] = useState<string>(''); 
  const [expandedQr, setExpandedQr] = useState<string | null>(null);
  
  const [showSoloAd, setShowSoloAd] = useState(false);
  const [isSoloUnlocked, setIsSoloUnlocked] = useState(false);

  const filteredNodes = nodes.filter((n: RideNode) => {
    if (searchConfig.query && !n.origin.toLowerCase().includes(searchConfig.query.toLowerCase()) && !n.destination.toLowerCase().includes(searchConfig.query.toLowerCase())) return false;
    if (searchConfig.vehicleType !== 'All' && n.vehicleType !== searchConfig.vehicleType) return false;
    return true;
  });

  const myRides = nodes.filter((n: RideNode) => myRideIds.includes(n.id) && n.status !== 'completed');
  const availableRides = filteredNodes.filter((n: RideNode) => n.status !== 'completed' && n.status !== 'dispatched' && !myRideIds.includes(n.id));

  useEffect(() => {
    let base = newNode.vehicleType === 'Taxi' ? settings.farePerTaxi : settings.farePerPragia;
    if (newNode.isSolo) base *= settings.soloMultiplier;
    setFareEstimate(base);
    
    // Reset custom offer on vehicle/mode change and sync input
    setCustomOffer(null);
    setOfferInput(base.toFixed(2));
  }, [newNode.vehicleType, newNode.isSolo, settings]);

  const handleOfferChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setOfferInput(val);
      const num = parseFloat(val);
      if (!isNaN(num)) setCustomOffer(num);
      else setCustomOffer(null);
  };

  const handleOfferBlur = () => {
      const val = parseFloat(offerInput);
      if (isNaN(val) || val < fareEstimate) {
          setOfferInput(fareEstimate.toFixed(2));
          setCustomOffer(null);
      } else {
          setOfferInput(val.toFixed(2));
      }
  };

  const adjustOffer = (delta: number) => {
      const current = parseFloat(offerInput) || fareEstimate;
      const newVal = Math.max(fareEstimate, current + delta);
      setOfferInput(newVal.toFixed(2));
      setCustomOffer(newVal);
  };

  const toggleSolo = () => {
    if (newNode.isSolo) {
      setNewNode({...newNode, isSolo: false});
    } else {
      if (isSoloUnlocked) {
        setNewNode({...newNode, isSolo: true});
      } else {
        setShowSoloAd(true);
      }
    }
  };

  const handleSoloUnlock = () => {
    setIsSoloUnlocked(true);
    setNewNode({...newNode, isSolo: true});
    setShowSoloAd(false);
  };

  const handleSubmit = () => {
    if (!newNode.origin || !newNode.destination) return alert("Please fill all fields");
    const finalFare = customOffer ? parseFloat(customOffer.toString()) : fareEstimate;

    const node: RideNode = {
      id: `NODE-${Date.now()}`,
      origin: newNode.origin!,
      destination: newNode.destination!,
      vehicleType: newNode.vehicleType,
      isSolo: newNode.isSolo,
      capacityNeeded: newNode.isSolo ? 1 : (newNode.vehicleType === 'Taxi' ? 4 : 3),
      passengers: [{ id: currentUser.id, name: currentUser.username, phone: currentUser.phone }],
      status: newNode.isSolo ? 'qualified' : 'forming',
      leaderName: currentUser.username,
      leaderPhone: currentUser.phone,
      farePerPerson: finalFare,
      createdAt: new Date().toISOString()
    };
    onAddNode(node);
    setCreateMode(false);
    setCustomOffer(null);
  };

  if (createMode) {
    return (
      <div className="glass p-6 rounded-[2rem] border border-white/10 animate-in zoom-in max-w-lg mx-auto relative">
         {showSoloAd && <AdGate onUnlock={handleSoloUnlock} label="Unlock Solo Ride Mode" settings={settings} />}
         
         <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black italic uppercase text-white">New Request</h2>
            <button onClick={() => setCreateMode(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white"><i className="fas fa-times"></i></button>
         </div>
         <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl">
               <button onClick={() => setNewNode({...newNode, isSolo: false})} className={`py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${!newNode.isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Pool (Cheaper)</button>
               <button onClick={toggleSolo} className={`py-2.5 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${newNode.isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
                 Solo (Express)
                 {!isSoloUnlocked && !newNode.isSolo && <i className="fas fa-lock text-[8px] opacity-70"></i>}
               </button>
            </div>
            
            <div className="relative">
              <input value={newNode.origin} onChange={e => setNewNode({...newNode, origin: e.target.value})} placeholder="Pickup Location" className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-white font-bold outline-none text-sm focus:border-indigo-500" />
              <button onClick={onTriggerVoice} className="absolute right-2 top-1.5 w-8 h-8 flex items-center justify-center text-indigo-400 hover:text-white"><i className="fas fa-microphone"></i></button>
            </div>
            <div className="relative">
              <input value={newNode.destination} onChange={e => setNewNode({...newNode, destination: e.target.value})} placeholder="Dropoff Location" className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-white font-bold outline-none text-sm focus:border-indigo-500" />
              <button onClick={onTriggerVoice} className="absolute right-2 top-1.5 w-8 h-8 flex items-center justify-center text-indigo-400 hover:text-white"><i className="fas fa-microphone"></i></button>
            </div>
            
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
               {['Pragia', 'Taxi', 'Shuttle'].map(v => (
                 <button key={v} onClick={() => setNewNode({...newNode, vehicleType: v as any})} className={`px-4 py-2 rounded-lg border border-white/10 font-black text-[10px] uppercase ${newNode.vehicleType === v ? 'bg-amber-500 text-[#020617]' : 'bg-white/5 text-slate-400'}`}>
                    {v}
                 </button>
               ))}
            </div>

            <div className="p-4 bg-indigo-900/30 rounded-2xl border border-indigo-500/20 space-y-3">
               <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase text-indigo-300">Base Fare</span>
                   <span className="text-sm font-bold text-slate-400">₵{fareEstimate.toFixed(2)}</span>
               </div>
               <div>
                   <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-black uppercase text-white">Your Offer (₵)</label>
                      <span className="text-[9px] text-emerald-400 font-bold uppercase">Boost to attract drivers</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <button onClick={() => adjustOffer(-0.5)} className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all">
                          <i className="fas fa-minus"></i>
                      </button>
                      <input 
                          type="number" 
                          step="0.5"
                          value={offerInput}
                          onChange={handleOfferChange}
                          onBlur={handleOfferBlur}
                          className="flex-1 bg-[#020617]/50 border border-white/10 rounded-xl px-4 py-2.5 text-white font-black text-lg text-center outline-none focus:border-emerald-500 transition-colors"
                      />
                      <button onClick={() => adjustOffer(0.5)} className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all">
                          <i className="fas fa-plus"></i>
                      </button>
                   </div>
               </div>
            </div>

            <button onClick={handleSubmit} className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Confirm Request</button>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       {myRides.length > 0 && (
         <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">My Active Trips</h3>
            {myRides.map((node: RideNode) => {
              const myPassengerInfo = node.passengers.find(p => p.phone === currentUser.phone);
              const myPin = myPassengerInfo?.verificationCode;
              const assignedDriver = drivers.find((d: Driver) => d.id === node.assignedDriverId);

              return (
              <div key={node.id} className="glass p-5 rounded-[2rem] border border-indigo-500/30 bg-indigo-900/10 relative overflow-hidden">
                 <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${node.status === 'qualified' ? 'bg-emerald-500 text-[#020617]' : 'bg-amber-500 text-[#020617]'}`}>{node.status}</span>
                          <span className="text-[10px] font-black text-indigo-300 uppercase">{node.vehicleType}</span>
                       </div>
                       <h4 className="text-base font-black text-white">{node.destination}</h4>
                       <p className="text-xs text-slate-400">From: {node.origin}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-lg font-black text-white">₵{node.farePerPerson}</p>
                       {node.assignedDriverId && <p className="text-[9px] font-black text-emerald-400 uppercase animate-pulse">Driver En Route</p>}
                    </div>
                 </div>
                 
                 {assignedDriver && (
                    <div className="bg-white/5 p-3 rounded-xl mb-4 border border-white/5">
                        <div className="flex items-center gap-3 mb-3">
                           <img src={assignedDriver.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${assignedDriver.name}`} className="w-10 h-10 rounded-full object-cover bg-black" alt="Driver" />
                           <div>
                               <p className="text-[10px] text-slate-400 font-bold uppercase">Your Partner</p>
                               <p className="text-sm font-black text-white leading-none">{assignedDriver.name}</p>
                               <div className="flex items-center gap-1 mt-1">
                                    <span className="text-[9px] text-amber-500">★ {assignedDriver.rating}</span>
                                    <span className="text-[9px] text-slate-500">• {assignedDriver.licensePlate}</span>
                               </div>
                           </div>
                        </div>
                        <div className="flex gap-2">
                           <a href={`tel:${assignedDriver.contact}`} className="flex-1 py-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all">
                              <i className="fas fa-phone"></i> Call
                           </a>
                           <a href={`https://wa.me/${assignedDriver.contact.replace(/[^0-9]/g, '')}`} target="_blank" className="flex-1 py-2 bg-emerald-500/20 text-emerald-500 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-[#020617] transition-all">
                              <i className="fab fa-whatsapp"></i> WhatsApp
                           </a>
                        </div>
                    </div>
                 )}

                 {node.assignedDriverId && myPin && (
                    <div className="bg-black/30 p-4 rounded-xl mb-4 flex items-center justify-between gap-4">
                       <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ride PIN</p>
                          <p className="text-2xl font-black text-white tracking-[0.2em]">{myPin}</p>
                          <button onClick={() => setExpandedQr(myPin)} className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-2 border border-white/10 transition-colors">
                             <i className="fas fa-expand"></i> Show QR
                          </button>
                       </div>
                       <div onClick={() => setExpandedQr(myPin)} className="bg-white p-2 rounded-lg cursor-pointer hover:scale-105 transition-transform">
                          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${myPin}`} className="w-20 h-20" alt="Ride QR" />
                       </div>
                    </div>
                 )}

                 <div className="flex gap-2">
                    {node.status === 'forming' && node.passengers.length > 1 && !node.assignedDriverId && (
                       <button onClick={() => onForceQualify(node.id)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase">Go Now (Pay Extra)</button>
                    )}
                    {/* Passenger cannot leave dispatched rides, show status only */}
                    {node.status === 'dispatched' ? (
                        <button disabled className="flex-1 py-3 bg-white/5 text-slate-500 rounded-xl font-black text-[9px] uppercase cursor-not-allowed border border-white/5">
                            Driver En Route • Cannot Cancel
                        </button>
                    ) : (
                        <button onClick={() => onLeave(node.id, currentUser.phone)} className="flex-1 py-3 bg-white/5 hover:bg-rose-500/20 hover:text-rose-500 text-slate-400 rounded-xl font-black text-[9px] uppercase transition-all">Leave</button>
                    )}
                    
                    {node.leaderPhone === currentUser.phone && !node.assignedDriverId && (
                       <button onClick={() => onCancel(node.id)} className="w-10 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-trash text-xs"></i></button>
                    )}
                 </div>
              </div>
            )})}
         </div>
       )}

       <div onClick={() => setCreateMode(true)} className="glass p-6 rounded-[2rem] border-2 border-dashed border-white/10 hover:border-amber-500/50 cursor-pointer group transition-all text-center space-y-2">
          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-500 group-hover:bg-amber-500 group-hover:text-[#020617] transition-all">
             <i className="fas fa-plus"></i>
          </div>
          <h3 className="text-base font-black uppercase italic text-white group-hover:text-amber-500 transition-colors">Start New Trip</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Create a pool or go solo</p>
       </div>

       <div>
          <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2 mb-4">Community Rides</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {availableRides.length === 0 && <p className="text-slate-600 text-xs font-bold uppercase col-span-full text-center py-8">No matching rides found.</p>}
             {availableRides.map((node: RideNode, index: number) => {
               const isPartnerOffer = node.assignedDriverId && (node.status === 'forming' || node.status === 'qualified');
               const seatsLeft = Math.max(0, node.capacityNeeded - node.passengers.length);
               
               return (
               <React.Fragment key={node.id}>
                <div className={`glass p-5 rounded-[2rem] border transition-all ${isPartnerOffer ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'border-white/5 hover:border-white/10'}`}>
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <div className="flex gap-2 items-center mb-1">
                             <span className="px-2 py-1 bg-white/10 rounded-md text-[8px] font-black uppercase text-slate-300">{node.vehicleType}</span>
                             {isPartnerOffer && <span className="px-2 py-1 bg-emerald-500 rounded-md text-[8px] font-black uppercase text-[#020617] animate-pulse">Partner Offer</span>}
                         </div>
                         <h4 className="text-base font-black text-white mt-1">{node.destination}</h4>
                         <p className="text-[10px] text-slate-400 uppercase">From: {node.origin}</p>
                         {node.driverNote && <p className="text-[9px] text-emerald-400 font-bold mt-1">"{node.driverNote}"</p>}
                      </div>
                      <div className="text-right">
                         <p className="text-lg font-black text-amber-500">₵{node.farePerPerson}</p>
                         <p className="text-[9px] font-bold text-slate-500 uppercase">{node.passengers.length}/{node.capacityNeeded} Seats</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2 mb-4 overflow-hidden">
                      {node.capacityNeeded > 5 ? (
                         <div className="flex gap-2 w-full">
                            <div className="flex-1 bg-white/5 p-2 rounded-xl text-center border border-white/5">
                               <p className="text-lg font-black text-white">{seatsLeft}</p>
                               <p className="text-[8px] font-bold text-slate-500 uppercase">Seats Left</p>
                            </div>
                            <div className="flex-1 bg-white/5 p-2 rounded-xl text-center border border-white/5">
                               <p className="text-lg font-black text-white">{node.passengers.length}</p>
                               <p className="text-[8px] font-bold text-slate-500 uppercase">Joined</p>
                            </div>
                         </div>
                      ) : (
                        <>
                          {node.passengers.map((p, i) => (
                             <div key={i} className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white border border-[#020617]" title={p.name}>{p.name[0]}</div>
                          ))}
                          {[...Array(seatsLeft)].map((_, i) => (
                             <div key={i} className="w-6 h-6 rounded-full bg-white/5 border border-white/10 border-dashed"></div>
                          ))}
                        </>
                      )}
                   </div>
                   <button onClick={() => onJoin(node.id, currentUser.username, currentUser.phone)} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase transition-all ${isPartnerOffer ? 'bg-emerald-500 text-white shadow-lg hover:scale-[1.02]' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
                      {isPartnerOffer ? 'Join Instantly' : 'Join Ride'}
                   </button>
                </div>
                {(index + 1) % 3 === 0 && <InlineAd className="col-span-1" settings={settings} />}
               </React.Fragment>
             )})}
          </div>
       </div>

       {expandedQr && (
         <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-6" onClick={() => setExpandedQr(null)}>
            <div className="bg-white p-6 rounded-[2.5rem] w-full max-w-sm text-center animate-in zoom-in relative" onClick={e => e.stopPropagation()}>
               <button onClick={() => setExpandedQr(null)} className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><i className="fas fa-times"></i></button>
               <h3 className="text-2xl font-black uppercase text-[#020617] mb-2">Scan Me</h3>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Present to Partner</p>
               <div className="bg-[#020617] p-2 rounded-2xl inline-block mb-6 shadow-2xl">
                 <div className="bg-white p-2 rounded-xl">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${expandedQr}`} className="w-full aspect-square" alt="Large QR" />
                 </div>
               </div>
               <div className="mb-6">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Confirmation PIN</p>
                  <p className="text-4xl font-black text-[#020617] tracking-[0.5em]">{expandedQr}</p>
               </div>
               <p className="text-[10px] font-bold text-rose-500 uppercase">Only show when ready to board</p>
            </div>
         </div>
       )}
    </div>
  );
};

export const AdminLogin = ({ onLogin }: any) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  return (
    <div className="max-w-sm mx-auto glass p-6 rounded-[2.5rem] border border-white/10 text-center space-y-6 animate-in zoom-in">
       <div className="w-14 h-14 bg-rose-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-rose-900/20">
          <i className="fas fa-shield-halved text-2xl"></i>
       </div>
       <div>
          <h2 className="text-xl font-black italic uppercase text-white">Restricted Access</h2>
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-1">Admin Credentials Required</p>
       </div>
       <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin Email" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs focus:border-rose-500" />
       <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs focus:border-rose-500" />
       <button onClick={() => onLogin(email, pass)} className="w-full py-4 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">Authenticate</button>
    </div>
  );
};

export const DriverPortal = ({ 
  drivers, 
  activeDriver, 
  onLogin, 
  onLogout, 
  qualifiedNodes, 
  dispatchedNodes, 
  missions, 
  allNodes,
  onJoinMission, 
  onAccept, 
  onBroadcast, 
  onStartBroadcast,
  onVerify, 
  onCancel, 
  onRequestTopup, 
  onRequestRegistration,
  searchConfig,
  settings,
  onUpdateStatus,
  isLoading,
  activeTab,
  setActiveTab,
  onReportNoShow // NEW PROP
}: any) => {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [isScanning, setIsScanning] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isPlayingBriefing, setIsPlayingBriefing] = useState(false);
  
  const [regMode, setRegMode] = useState(false);
  const [regData, setRegData] = useState<any>({ name: '', vehicleType: 'Pragia', licensePlate: '', contact: '', pin: '', amount: 20, momoReference: '', avatarUrl: '' });

  const [verifyCode, setVerifyCode] = useState('');
  const [broadcastData, setBroadcastData] = useState({ origin: '', destination: '', seats: '3', fare: 5, note: '' });

  const myActiveRides = dispatchedNodes.filter((n: any) => n.assignedDriverId === activeDriver?.id && n.status !== 'completed');
  const availableRides = qualifiedNodes.filter((n: any) => {
      if (activeDriver && n.vehicleType !== activeDriver.vehicleType) return false;
      if (searchConfig.query && !n.origin.toLowerCase().includes(searchConfig.query.toLowerCase()) && !n.destination.toLowerCase().includes(searchConfig.query.toLowerCase())) return false;
      return true;
  });

  const myBroadcasts = allNodes.filter((n: any) => n.assignedDriverId === activeDriver?.id && n.status === 'forming');

  const isShuttle = activeDriver?.vehicleType === 'Shuttle';
  // SYNC Logic: Match Handler's default capacity logic for Shuttle vs Others
  const estimatedCapacity = parseInt(broadcastData.seats) || (isShuttle ? 10 : 3);
  const commissionRate = isShuttle ? (settings.shuttleCommission || 0) : settings.commissionPerSeat;
  const requiredBalanceForBroadcast = isShuttle ? (estimatedCapacity * commissionRate) : 0; 
  const canAffordBroadcast = activeDriver ? (activeDriver.walletBalance >= requiredBalanceForBroadcast) : false;

  const playMorningBriefing = async () => {
     if (isPlayingBriefing || !activeDriver) return;
     setIsPlayingBriefing(true);
     try {
       const prompt = `TTS the following conversation between Dispatcher Joe and Driver Jane (Keep it short, under 30 seconds):
          Joe: Good morning ${activeDriver.name}! Ready for the road?
          Jane: Always ready, Joe. What's the status on campus?
          Joe: We have ${availableRides.length} pending requests right now. 
          Jane: Any hotspots active?
          Joe: Yes, there are ${missions.length} active missions paying bonuses. Check the map!
          Jane: Copy that. Staying safe. Over.`;

       const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: [
                        { speaker: 'Joe', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                        { speaker: 'Jane', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } }
                  ]
                }
            }
          }
       });

       const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
       if (base64Audio) {
         const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
         const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
         const source = ctx.createBufferSource();
         source.buffer = audioBuffer;
         source.connect(ctx.destination);
         source.start();
         source.onended = () => setIsPlayingBriefing(false);
       } else {
         setIsPlayingBriefing(false);
       }
     } catch (e) {
       console.error("Briefing failed", e);
       setIsPlayingBriefing(false);
     }
  };

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-700">
             <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] animate-pulse">Syncing Network...</p>
          </div>
      );
  }

  if (!activeDriver) {
      if (regMode) {
          return (
              <div className="glass p-6 rounded-[2rem] border border-white/10 max-w-lg mx-auto animate-in zoom-in relative">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-black italic uppercase text-white">Partner Application</h2>
                      <button onClick={() => setRegMode(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white"><i className="fas fa-times"></i></button>
                  </div>
                  <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                         <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center overflow-hidden relative group">
                            {regData.avatarUrl ? (
                               <img src={regData.avatarUrl} className="w-full h-full object-cover" />
                            ) : (
                               <i className="fas fa-camera text-slate-400"></i>
                            )}
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                               if (e.target.files?.[0]) {
                                  const base64 = await compressImage(e.target.files[0], 0.5, 300);
                                  setRegData({...regData, avatarUrl: base64});
                               }
                            }} />
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase text-white">Profile Photo</p>
                            <p className="text-[9px] text-slate-400">Required for Trust Verification</p>
                         </div>
                      </div>

                      <input value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} placeholder="Full Name" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                      <div className="grid grid-cols-2 gap-2">
                         <select value={regData.vehicleType} onChange={e => setRegData({...regData, vehicleType: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs">
                            <option value="Pragia">Pragia</option>
                            <option value="Taxi">Taxi</option>
                            <option value="Shuttle">Shuttle</option>
                         </select>
                         <input value={regData.licensePlate} onChange={e => setRegData({...regData, licensePlate: e.target.value})} placeholder="License Plate" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                      </div>
                      <input value={regData.contact} onChange={e => setRegData({...regData, contact: e.target.value})} placeholder="Phone Number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                      <input type="password" maxLength={4} value={regData.pin} onChange={e => setRegData({...regData, pin: e.target.value})} placeholder="Set a 4-digit PIN" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                      
                      <div className="p-4 bg-indigo-600/10 rounded-xl border border-indigo-600/20">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Registration Fee: ₵{settings.registrationFee}</p>
                          <p className="text-[9px] text-slate-400">Send to <b>{settings.adminMomo}</b> ({settings.adminMomoName}) and enter Ref ID below.</p>
                          <input value={regData.momoReference} onChange={e => setRegData({...regData, momoReference: e.target.value, amount: settings.registrationFee})} placeholder="MoMo Reference ID" className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                      </div>

                      <button onClick={() => { onRequestRegistration(regData); setRegMode(false); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Submit Application</button>
                  </div>
              </div>
          )
      }

      return (
          <div className="glass p-6 rounded-[2rem] border border-white/10 max-w-sm mx-auto text-center space-y-6 animate-in zoom-in">
             <div className="w-14 h-14 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                <i className="fas fa-id-card-clip text-2xl"></i>
             </div>
             <div>
                <h2 className="text-xl font-black italic uppercase text-white">Partner Access</h2>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Authorized Personnel Only</p>
             </div>
             
             <div className="space-y-4 animate-in slide-in-from-right">
                <div className="text-left space-y-3">
                   <div>
                       <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Partner ID</label>
                       <input 
                         type="text" 
                         value={loginIdentifier} 
                         onChange={e => setLoginIdentifier(e.target.value)} 
                         placeholder="Phone Number or Exact Name" 
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs focus:border-indigo-500 transition-colors" 
                       />
                   </div>
                   <div>
                       <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Security PIN</label>
                       <input 
                         type="password" 
                         maxLength={4} 
                         value={loginPin} 
                         onChange={e => setLoginPin(e.target.value)} 
                         placeholder="4-Digit PIN" 
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs text-center tracking-widest focus:border-indigo-500" 
                       />
                   </div>
                </div>
                
                <button onClick={() => {
                   const driver = drivers.find((d: Driver) => 
                      d.contact === loginIdentifier || 
                      d.name.toLowerCase() === loginIdentifier.toLowerCase()
                   );
                   
                   if (driver) {
                       onLogin(driver.id, loginPin);
                   } else {
                       alert("Partner not found. Please check credentials.");
                   }
                }} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition-all">
                   Access Terminal
                </button>
             </div>
             
             <div className="pt-4 border-t border-white/5">
                <button onClick={() => setRegMode(true)} className="text-[9px] font-black text-slate-500 uppercase hover:text-white transition-colors">Join the Fleet</button>
             </div>
          </div>
      );
  }

  return (
      <div className="space-y-6">
          {isScanning && (
             <QrScannerModal 
               onClose={() => setIsScanning(null)}
               onScan={(code) => {
                 if (isScanning) {
                    onVerify(isScanning, code);
                    setIsScanning(null);
                 }
               }}
             />
          )}
          
          <div className="flex justify-between items-center mb-6">
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
               {['market', 'active', 'broadcast', 'wallet'].map(tab => (
                   <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 min-w-[70px] px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                      {tab}
                      {tab === 'active' && myActiveRides.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>}
                   </button>
               ))}
            </div>
            <button onClick={playMorningBriefing} disabled={isPlayingBriefing} className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-[#020617] shadow-lg hover:scale-105 transition-transform disabled:opacity-50">
               {isPlayingBriefing ? <i className="fas fa-volume-high animate-pulse text-xs"></i> : <i className="fas fa-play text-xs"></i>}
            </button>
          </div>

          {activeTab === 'market' && (
              <div className="space-y-6">
                  {missions.length > 0 && (
                      <div className="space-y-2">
                          <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Active Hotspots</h3>
                          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                             {missions.map((m: any) => {
                                 const joined = m.driversJoined.includes(activeDriver.id);
                                 return (
                                     <div key={m.id} className={`min-w-[250px] p-6 rounded-[2rem] border relative overflow-hidden ${joined ? 'bg-emerald-500 text-[#020617] border-emerald-400' : 'glass border-white/10'}`}>
                                         <div className="relative z-10">
                                            <h4 className="text-lg font-black uppercase italic">{m.location}</h4>
                                            <p className={`text-[10px] font-bold uppercase ${joined ? 'text-[#020617]/70' : 'text-indigo-400'}`}>Fee: ₵{m.entryFee}</p>
                                            <p className={`text-xs mt-2 ${joined ? 'text-[#020617]' : 'text-slate-400'}`}>{m.description}</p>
                                            <div className="mt-4 flex justify-between items-center">
                                                <span className={`text-[9px] font-black uppercase ${joined ? 'text-[#020617]/50' : 'text-slate-500'}`}>{m.driversJoined.length} Partners</span>
                                                {!joined && <button onClick={() => onJoinMission(m.id, activeDriver.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase">Station Here</button>}
                                                {joined && <span className="px-3 py-1 bg-[#020617]/20 rounded-lg text-[9px] font-black uppercase">Stationed</span>}
                                            </div>
                                         </div>
                                     </div>
                                 );
                             })}
                          </div>
                      </div>
                  )}

                  <div className="space-y-2">
                      <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Job Board</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {availableRides.length === 0 && <p className="col-span-full text-center text-slate-600 py-8 text-xs font-bold uppercase">No matching jobs.</p>}
                          {availableRides.map((node: any) => {
                             const isSolo = node.isSolo;
                             const paxCount = node.passengers.length;
                             const capacity = node.capacityNeeded;
                             const canAccept = paxCount > 0;
                             
                             const baseFare = node.vehicleType === 'Taxi' ? settings.farePerTaxi : settings.farePerPragia;
                             const expectedFare = node.isSolo ? baseFare * settings.soloMultiplier : baseFare;
                             const isHighFare = node.farePerPerson > expectedFare;

                             return (
                                 <div key={node.id} className={`glass p-5 rounded-[2rem] border transition-all group relative ${isHighFare ? 'border-amber-500/40 shadow-lg shadow-amber-500/10' : 'border-white/5 hover:border-indigo-500/30'}`}>
                                     {node.isSolo && <div className="absolute top-4 right-4 text-[9px] font-black uppercase bg-amber-500 text-[#020617] px-2 py-1 rounded-md animate-pulse">Express</div>}
                                     <div className="mb-4">
                                         <h4 className="text-lg font-black text-white">{node.destination}</h4>
                                         <p className="text-[10px] text-slate-400 uppercase">From: {node.origin}</p>
                                     </div>
                                     <div className="flex justify-between items-center mb-4 p-3 bg-white/5 rounded-xl border border-white/5">
                                         <div>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase">Per Pax</p>
                                            <div className="flex items-center gap-2">
                                                <p className={`text-lg font-black ${isHighFare ? 'text-amber-400' : 'text-white'}`}>₵ {node.farePerPerson}</p>
                                                {isHighFare && <i className="fas fa-fire text-amber-500 text-xs animate-bounce"></i>}
                                            </div>
                                         </div>
                                         <div className="text-right">
                                            <p className="text-[9px] font-bold text-slate-500 uppercase">Est. Total</p>
                                            <p className="text-lg font-black text-emerald-400">₵ {(node.farePerPerson * (isSolo ? 1 : capacity)).toFixed(2)}</p>
                                         </div>
                                     </div>
                                     <div className="flex gap-1 mb-4">
                                         {[...Array(capacity)].map((_, i) => (
                                             <div key={i} className={`h-1.5 flex-1 rounded-full ${i < paxCount ? 'bg-indigo-500' : 'bg-white/10'}`}></div>
                                         ))}
                                     </div>
                                     <button onClick={() => onAccept(node.id, activeDriver.id)} disabled={!canAccept} className="w-full py-3 bg-white text-[#020617] rounded-xl font-black text-[10px] uppercase hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                         Accept Request
                                     </button>
                                 </div>
                             );
                          })}
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'active' && (
              <div className="space-y-4">
                  {myActiveRides.length === 0 && <p className="text-center text-slate-600 py-8 text-xs font-bold uppercase">No active trips.</p>}
                  {myActiveRides.map((node: any) => (
                      <div key={node.id} className="glass p-6 rounded-[2.5rem] border border-indigo-500/30 bg-indigo-900/10 relative overflow-hidden">
                          <div className="relative z-10">
                              <div className="flex justify-between items-start mb-6">
                                  <div>
                                     <span className="px-3 py-1 bg-emerald-500 text-[#020617] rounded-lg text-[9px] font-black uppercase mb-2 inline-block animate-pulse">In Progress</span>
                                     <h3 className="text-xl font-black text-white">{node.destination}</h3>
                                     <p className="text-xs text-slate-300">Pickup: {node.origin}</p>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-2xl font-black text-white">₵ {node.negotiatedTotalFare || (node.farePerPerson * node.passengers.length)}</p>
                                     <p className="text-[10px] font-bold text-indigo-300 uppercase">Total Fare</p>
                                  </div>
                              </div>
                              
                              <div className="bg-black/30 p-5 rounded-2xl mb-6 border border-white/5">
                                 <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Passenger Manifest</h4>
                                 <div className="space-y-3">
                                     {node.passengers.map((p: any) => {
                                         return (
                                             <div key={p.id} className="flex justify-between items-center">
                                                 <div className="flex items-center gap-3">
                                                     <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black">{p.name[0]}</div>
                                                     <div>
                                                         <p className="text-sm font-bold text-white">{p.name}</p>
                                                         <div className="flex gap-3 mt-1">
                                                            <a href={`tel:${p.phone}`} className="text-[10px] text-indigo-400 font-bold flex items-center gap-1 hover:text-white"><i className="fas fa-phone"></i> Call</a>
                                                            <a href={`https://wa.me/${p.phone.replace(/[^0-9]/g, '')}`} target="_blank" className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 hover:text-white"><i className="fab fa-whatsapp"></i> Chat</a>
                                                         </div>
                                                     </div>
                                                 </div>
                                                 {/* NO SHOW BUTTON */}
                                                 <button 
                                                    onClick={() => onReportNoShow && onReportNoShow(node.id, p.phone, p.name)}
                                                    className="w-8 h-8 bg-rose-500/10 text-rose-500 rounded-lg flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
                                                    title="Report No-Show & Refund Seat"
                                                 >
                                                    <i className="fas fa-user-slash text-xs"></i>
                                                 </button>
                                             </div>
                                         );
                                     })}
                                 </div>
                              </div>

                              <button onClick={() => setIsScanning(node.id)} className="w-full py-6 bg-gradient-to-tr from-white to-slate-200 text-indigo-900 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center mb-6 animate-pulse hover:scale-[1.02] transition-transform">
                                  <i className="fas fa-qrcode text-3xl mb-2"></i>
                                  <span className="text-lg font-black uppercase tracking-tight">Scan Rider Code</span>
                                  <span className="text-[9px] font-bold uppercase opacity-60">Tap to Verify</span>
                              </button>

                              <div className="flex justify-center mb-6">
                                  <button onClick={() => setShowManualEntry(!showManualEntry)} className="text-[10px] font-bold text-slate-400 underline uppercase">
                                     Problem scanning? Use Manual Entry
                                  </button>
                              </div>

                              {showManualEntry && (
                                <div className="flex gap-2 mb-6 animate-in slide-in-from-top-2 fade-in">
                                    <input type="number" placeholder="Enter PIN manually" className="flex-[2] bg-white text-[#020617] rounded-xl px-4 text-center font-black text-lg outline-none placeholder:text-slate-400 placeholder:text-xs placeholder:font-bold" value={verifyCode} onChange={e => setVerifyCode(e.target.value)} />
                                    <button onClick={() => { onVerify(node.id, verifyCode); setVerifyCode(''); }} className="flex-1 py-4 bg-emerald-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-lg">Verify</button>
                                </div>
                              )}

                              <div className="text-center">
                                  <button onClick={() => onCancel(node.id)} className="w-10 h-10 mx-auto flex items-center justify-center bg-rose-500/20 text-rose-500 rounded-full hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-ban"></i></button>
                                  <p className="text-[9px] text-rose-500 font-bold uppercase mt-2">Cancel Trip</p>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}

          {activeTab === 'broadcast' && (
              <div className="space-y-8">
                  <div className="glass p-6 rounded-[2.5rem] border border-white/10">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black italic uppercase text-white">Create Route</h3>
                        {isShuttle && (
                          <span className="px-2 py-1 bg-amber-500 text-[#020617] text-[8px] font-black uppercase rounded">Bus Mode</span>
                        )}
                      </div>
                      <div className="space-y-4">
                          <input value={broadcastData.origin} onChange={e => setBroadcastData({...broadcastData, origin: e.target.value})} placeholder="Starting Point" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                          <input value={broadcastData.destination} onChange={e => setBroadcastData({...broadcastData, destination: e.target.value})} placeholder="Destination" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-[8px] text-slate-500 uppercase font-bold pl-2">Fare (₵)</label>
                                  <input type="number" value={broadcastData.fare} onChange={e => setBroadcastData({...broadcastData, fare: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                              </div>
                              <div>
                                  <label className="text-[8px] text-slate-500 uppercase font-bold pl-2">Seats</label>
                                  {isShuttle ? (
                                     <input 
                                       type="number" 
                                       min="5" 
                                       max="60" 
                                       placeholder="Capacity"
                                       value={broadcastData.seats} 
                                       onChange={e => setBroadcastData({...broadcastData, seats: e.target.value})} 
                                       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" 
                                     />
                                  ) : (
                                    <select value={broadcastData.seats} onChange={e => setBroadcastData({...broadcastData, seats: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs">
                                        {[1,2,3,4].map(n => <option key={n} value={n.toString()}>{n}</option>)}
                                    </select>
                                  )}
                              </div>
                          </div>
                          <input value={broadcastData.note} onChange={e => setBroadcastData({...broadcastData, note: e.target.value})} placeholder="Note (e.g. Leaving in 5 mins)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                          
                          {isShuttle && (
                             <div className="p-4 bg-rose-500/10 rounded-xl border border-rose-500/20 text-center">
                                <p className="text-[10px] font-black text-rose-500 uppercase mb-1">Prepayment Required</p>
                                <p className="text-[9px] text-slate-400">
                                   Shuttle commission (₵{(estimatedCapacity * commissionRate).toFixed(2)}) is deducted <b>immediately</b> upon broadcast to reserve slots.
                                </p>
                             </div>
                          )}

                          <button 
                            onClick={() => onBroadcast(broadcastData)} 
                            disabled={!canAffordBroadcast && isShuttle}
                            className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all ${!canAffordBroadcast && isShuttle ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                          >
                             {(!canAffordBroadcast && isShuttle) ? 'Insufficient Funds' : 'Broadcast Route'}
                          </button>
                      </div>
                  </div>

                  {myBroadcasts.length > 0 && (
                      <div className="space-y-4">
                          <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Your Broadcasts</h3>
                          {myBroadcasts.map((node: any) => (
                              <div key={node.id} className="glass p-6 rounded-[2rem] border border-indigo-500/30">
                                  <div className="flex justify-between items-center mb-4">
                                      <div>
                                          <h4 className="text-white font-bold">{node.destination}</h4>
                                          <p className="text-[10px] text-slate-400 uppercase">From: {node.origin}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-lg font-black text-amber-500">₵{node.farePerPerson}</p>
                                          <p className="text-[9px] text-slate-500 uppercase">{node.passengers.length}/{node.capacityNeeded} Joined</p>
                                      </div>
                                  </div>
                                  <div className="space-y-2 mb-4">
                                      {node.passengers.map((p: any) => (
                                          <div key={p.id} className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 p-2 rounded-lg">
                                              <i className="fas fa-user"></i> {p.name}
                                          </div>
                                      ))}
                                      {node.passengers.length === 0 && <p className="text-[10px] text-slate-600 italic">Waiting for passengers...</p>}
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => onStartBroadcast(node.id)} disabled={node.passengers.length === 0} className="flex-[2] py-3 bg-emerald-500 text-[#020617] rounded-xl font-black text-[9px] uppercase disabled:opacity-50">Start Trip</button>
                                      <button onClick={() => onCancel(node.id)} className="flex-1 py-3 bg-rose-500/20 text-rose-500 rounded-xl font-black text-[9px] uppercase">Cancel</button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'wallet' && (
              <div className="glass p-6 rounded-[2.5rem] border border-white/10 space-y-6">
                  <div className="text-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Available Balance</p>
                      <h3 className="text-4xl font-black text-white">₵ {activeDriver.walletBalance.toFixed(2)}</h3>
                  </div>
                  
                  <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5 space-y-4">
                      <h4 className="text-xs font-black uppercase text-white">Top Up Credits</h4>
                      <div className="space-y-3">
                          <input type="number" placeholder="Amount (₵)" id="topup-amount" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                          <input placeholder="MoMo Reference ID" id="topup-ref" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                          <button onClick={() => {
                              const amt = (document.getElementById('topup-amount') as HTMLInputElement).value;
                              const ref = (document.getElementById('topup-ref') as HTMLInputElement).value;
                              onRequestTopup(activeDriver.id, parseFloat(amt), ref);
                          }} className="w-full py-3.5 bg-emerald-500 text-[#020617] rounded-xl font-black text-[9px] uppercase shadow-lg">Request Credit</button>
                      </div>
                      <p className="text-[9px] text-slate-500 text-center">Admin: {settings.adminMomo} ({settings.adminMomoName})</p>
                  </div>
                  
                  <div className="pt-4 border-t border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                          <select value={activeDriver.status} onChange={(e) => onUpdateStatus(e.target.value)} className="bg-white/5 text-white text-[10px] font-bold uppercase rounded-lg px-2 py-1 outline-none border border-white/10">
                              <option value="online">Online</option>
                              <option value="busy">Busy</option>
                              <option value="offline">Offline</option>
                          </select>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Rating</span>
                          <span className="text-white font-black text-sm flex items-center gap-1"><i className="fas fa-star text-amber-500 text-xs"></i> {activeDriver.rating}</span>
                      </div>
                      
                      <button 
                        onClick={onLogout}
                        className="w-full py-3 bg-white/5 border border-white/5 text-slate-400 rounded-xl font-black text-[9px] uppercase hover:bg-rose-500 hover:text-white transition-all"
                      >
                        Sign Out Partner
                      </button>
                  </div>
              </div>
          )}
      </div>
  );
};

export const AdminPortal = ({
  activeTab,
  setActiveTab,
  nodes,
  drivers,
  onAddDriver,
  onDeleteDriver,
  onCancelRide,
  onSettleRide,
  missions,
  onCreateMission,
  onDeleteMission,
  transactions,
  topupRequests,
  registrationRequests,
  refundRequests,
  onApproveTopup,
  onRejectTopup,
  onApproveRegistration,
  onRejectRegistration,
  onApproveRefund,
  onRejectRefund,
  onLock,
  settings,
  onUpdateSettings,
  hubRevenue,
  onForceResetDriver
}: any) => {
  const [newDriver, setNewDriver] = useState<any>({ name: '', vehicleType: 'Pragia', licensePlate: '', contact: '', pin: '1234' });
  const [newMission, setNewMission] = useState<HubMission>({ id: '', location: '', description: '', entryFee: 2, driversJoined: [], status: 'open', createdAt: '' });
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  // Sync settings when props update
  useEffect(() => { setLocalSettings(settings); }, [settings]);

  // Helper component for cleaner settings form
  const SettingInput = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
    <div className="space-y-1">
        <label className="text-[9px] text-slate-500 uppercase font-bold pl-2">{label}</label>
        <input 
            type={type} 
            value={value || ''} 
            onChange={onChange} 
            placeholder={placeholder}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none focus:border-rose-500 transition-colors" 
        />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
        <div className="flex flex-wrap gap-2 mb-6 bg-white/5 p-2 rounded-[1.5rem] border border-white/5">
            {['monitor', 'drivers', 'rides', 'finance', 'missions', 'config'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                    {tab}
                </button>
            ))}
            <button onClick={onLock} className="ml-auto px-5 py-3 bg-white/5 text-rose-500 rounded-xl font-black text-[10px] uppercase hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-lock"></i></button>
        </div>

        {activeTab === 'monitor' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="glass p-6 rounded-[2rem] border border-white/10">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Revenue</p>
                     <p className="text-3xl font-black text-white mt-2">₵ {hubRevenue.toFixed(2)}</p>
                 </div>
                 <div className="glass p-6 rounded-[2rem] border border-white/10">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Partners</p>
                     <p className="text-3xl font-black text-emerald-400 mt-2">{drivers.filter((d: any) => d.status === 'online').length} / {drivers.length}</p>
                 </div>
                 <div className="glass p-6 rounded-[2rem] border border-white/10">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Trips</p>
                     <p className="text-3xl font-black text-amber-500 mt-2">{nodes.filter((n: any) => n.status !== 'completed').length}</p>
                 </div>
                 <div className="glass p-6 rounded-[2rem] border border-white/10">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pending Approvals</p>
                     <p className="text-3xl font-black text-rose-500 mt-2">{topupRequests.filter((r: any) => r.status === 'pending').length + registrationRequests.filter((r: any) => r.status === 'pending').length + refundRequests.filter((r: any) => r.status === 'pending').length}</p>
                 </div>
            </div>
        )}

        {activeTab === 'drivers' && (
            <div className="space-y-6">
                <div className="glass p-6 rounded-[2rem] border border-white/10">
                    <h3 className="text-white font-black uppercase mb-4 text-xs tracking-widest">Add Partner Manually</h3>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                         <input value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} placeholder="Name" className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white font-bold text-xs outline-none" />
                         <input value={newDriver.contact} onChange={e => setNewDriver({...newDriver, contact: e.target.value})} placeholder="Phone" className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white font-bold text-xs outline-none" />
                         <input value={newDriver.licensePlate} onChange={e => setNewDriver({...newDriver, licensePlate: e.target.value})} placeholder="Plate" className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white font-bold text-xs outline-none" />
                         <select value={newDriver.vehicleType} onChange={e => setNewDriver({...newDriver, vehicleType: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white font-bold text-xs outline-none">
                             <option value="Pragia">Pragia</option>
                             <option value="Taxi">Taxi</option>
                             <option value="Shuttle">Shuttle</option>
                         </select>
                         <input value={newDriver.pin} onChange={e => setNewDriver({...newDriver, pin: e.target.value})} placeholder="PIN" className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white font-bold text-xs outline-none" />
                         <button onClick={() => onAddDriver(newDriver)} className="bg-rose-600 text-white rounded-xl font-black text-xs uppercase shadow-lg">Add Partner</button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {drivers.map((d: any) => (
                        <div key={d.id} className="glass p-4 rounded-2xl border border-white/10 flex justify-between items-center group hover:border-white/20 transition-all">
                            <div>
                                <p className="text-white font-black text-sm">{d.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase ${d.status === 'online' ? 'bg-emerald-500 text-black' : 'bg-slate-700 text-slate-300'}`}>{d.status}</span>
                                    <span className="text-[9px] text-slate-400">{d.vehicleType}</span>
                                </div>
                                <p className="text-[9px] text-slate-500 mt-1">{d.contact} • ₵{d.walletBalance.toFixed(2)}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => onForceResetDriver(d.id)} className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[8px] font-black uppercase hover:bg-amber-500 hover:text-black">Reset</button>
                                <button onClick={() => onDeleteDriver(d.id)} className="px-3 py-1 bg-rose-500/10 text-rose-500 rounded-lg text-[8px] font-black uppercase hover:bg-rose-500 hover:text-white">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'rides' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {nodes.length === 0 && <p className="col-span-full text-slate-500 text-xs font-bold uppercase text-center py-10">No active rides in the system.</p>}
                 {nodes.map((n: any) => (
                     <div key={n.id} className="glass p-5 rounded-[2rem] border border-white/10 flex flex-col justify-between relative overflow-hidden">
                         <div className="relative z-10 flex justify-between items-start mb-4">
                             <div>
                                 <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase mb-1 inline-block ${n.status === 'qualified' ? 'bg-emerald-500 text-black' : 'bg-amber-500 text-black'}`}>{n.status}</span>
                                 <p className="text-white font-black text-lg">{n.destination}</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase">From: {n.origin}</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-xl font-black text-white">₵{n.farePerPerson}</p>
                                 <p className="text-[9px] text-slate-500 font-bold uppercase">{n.passengers.length}/{n.capacityNeeded} Pax</p>
                             </div>
                         </div>
                         <div className="flex gap-2 relative z-10">
                             {n.status !== 'completed' && <button onClick={() => onSettleRide(n.id)} className="flex-1 py-2 bg-emerald-500/20 text-emerald-500 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-black transition-all">Force Complete</button>}
                             <button onClick={() => onCancelRide(n.id)} className="flex-1 py-2 bg-rose-500/20 text-rose-500 rounded-xl text-[9px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all">Cancel Trip</button>
                         </div>
                     </div>
                 ))}
            </div>
        )}

        {activeTab === 'finance' && (
            <div className="space-y-6">
                 <div className="glass p-6 rounded-[2rem] border border-white/10">
                     <h3 className="text-white font-black uppercase mb-4 text-xs tracking-widest">Financial Requests</h3>
                     <div className="space-y-3">
                         {topupRequests.filter((r: any) => r.status === 'pending').map((r: any) => (
                             <div key={r.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                                 <div>
                                     <p className="text-white text-xs font-bold uppercase mb-1"><span className="text-emerald-400">Topup</span> • ₵{r.amount}</p>
                                     <p className="text-[9px] text-slate-400 font-mono">Ref: {r.momoReference}</p>
                                 </div>
                                 <div className="flex gap-2">
                                     <button onClick={() => onApproveTopup(r.id)} className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-black transition-all"><i className="fas fa-check"></i></button>
                                     <button onClick={() => onRejectTopup(r.id)} className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
                                 </div>
                             </div>
                         ))}
                         {registrationRequests.filter((r: any) => r.status === 'pending').map((r: any) => (
                             <div key={r.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl border-l-4 border-indigo-500 border-white/5">
                                 <div>
                                     <p className="text-white text-xs font-bold uppercase mb-1"><span className="text-indigo-400">Registration</span> • {r.name}</p>
                                     <p className="text-[9px] text-slate-400">{r.vehicleType} • Ref: {r.momoReference}</p>
                                 </div>
                                 <div className="flex gap-2">
                                     <button onClick={() => onApproveRegistration(r.id)} className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-black transition-all"><i className="fas fa-check"></i></button>
                                     <button onClick={() => onRejectRegistration(r.id)} className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
                                 </div>
                             </div>
                         ))}
                         {refundRequests.filter((r: any) => r.status === 'pending').map((r: any) => (
                             <div key={r.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl border-l-4 border-amber-500 border-white/5">
                                 <div>
                                     <p className="text-white text-xs font-bold uppercase mb-1"><span className="text-amber-400">Refund</span> • ₵{r.amount}</p>
                                     <p className="text-[9px] text-slate-400">Reason: {r.reason}</p>
                                 </div>
                                 <div className="flex gap-2">
                                     <button onClick={() => onApproveRefund(r.id)} className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-black transition-all"><i className="fas fa-check"></i></button>
                                     <button onClick={() => onRejectRefund(r.id)} className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
                                 </div>
                             </div>
                         ))}
                         {topupRequests.filter((r:any) => r.status==='pending').length === 0 && registrationRequests.filter((r:any) => r.status==='pending').length === 0 && refundRequests.filter((r:any) => r.status==='pending').length === 0 && (
                             <p className="text-slate-500 text-xs text-center font-bold uppercase py-4">No pending requests</p>
                         )}
                     </div>
                 </div>
            </div>
        )}

        {activeTab === 'missions' && (
            <div className="space-y-6">
                <div className="glass p-6 rounded-[2rem] border border-white/10">
                     <h3 className="text-white font-black uppercase mb-4 text-xs tracking-widest">Create Mission Hotspot</h3>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                         <input value={newMission.location} onChange={e => setNewMission({...newMission, location: e.target.value})} placeholder="Location Name" className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none" />
                         <input value={newMission.description} onChange={e => setNewMission({...newMission, description: e.target.value})} placeholder="Short Description" className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none" />
                         <input type="number" value={newMission.entryFee} onChange={e => setNewMission({...newMission, entryFee: parseFloat(e.target.value)})} placeholder="Entry Fee" className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none" />
                         <button onClick={() => { onCreateMission({...newMission, id: `MISS-${Date.now()}`, createdAt: new Date().toISOString()}); setNewMission({...newMission, location: '', description: ''}); }} className="bg-rose-600 text-white rounded-xl font-black text-xs uppercase shadow-lg">Deploy Mission</button>
                     </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {missions.map((m: any) => (
                        <div key={m.id} className="flex justify-between items-center bg-white/5 p-5 rounded-[1.5rem] border border-white/5">
                            <div>
                                <p className="text-white font-black uppercase text-sm">{m.location}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{m.description}</p>
                                <div className="flex gap-3 mt-2">
                                    <span className="text-[9px] text-indigo-400 font-bold uppercase">Fee: ₵{m.entryFee}</span>
                                    <span className="text-[9px] text-emerald-400 font-bold uppercase">Joined: {m.driversJoined.length}</span>
                                </div>
                            </div>
                            <button onClick={() => onDeleteMission(m.id)} className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-trash"></i></button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'config' && (
            <div className="glass p-6 rounded-[2rem] border border-white/10 space-y-8">
                 <div className="flex justify-between items-center">
                    <h3 className="text-white font-black uppercase text-xs tracking-widest">Global Configuration</h3>
                    <button onClick={() => onUpdateSettings(localSettings)} className="px-6 py-2 bg-emerald-500 text-[#020617] rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-emerald-400 transition-all">Save Changes</button>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                         <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-500/30 pb-2">Pricing & Fares</h4>
                         <SettingInput label="Pragia Base Fare (₵)" value={localSettings.farePerPragia} onChange={(e: any) => setLocalSettings({...localSettings, farePerPragia: parseFloat(e.target.value)})} type="number" />
                         <SettingInput label="Taxi Base Fare (₵)" value={localSettings.farePerTaxi} onChange={(e: any) => setLocalSettings({...localSettings, farePerTaxi: parseFloat(e.target.value)})} type="number" />
                         <SettingInput label="Solo Multiplier (x)" value={localSettings.soloMultiplier} onChange={(e: any) => setLocalSettings({...localSettings, soloMultiplier: parseFloat(e.target.value)})} type="number" />
                         <SettingInput label="Seat Commission (₵)" value={localSettings.commissionPerSeat} onChange={(e: any) => setLocalSettings({...localSettings, commissionPerSeat: parseFloat(e.target.value)})} type="number" />
                         <SettingInput label="Shuttle Commission (₵)" value={localSettings.shuttleCommission} onChange={(e: any) => setLocalSettings({...localSettings, shuttleCommission: parseFloat(e.target.value)})} type="number" />
                         <SettingInput label="Registration Fee (₵)" value={localSettings.registrationFee} onChange={(e: any) => setLocalSettings({...localSettings, registrationFee: parseFloat(e.target.value)})} type="number" />
                     </div>

                     <div className="space-y-4">
                         <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-b border-amber-500/30 pb-2">Admin Contacts</h4>
                         <SettingInput label="Admin MoMo Number" value={localSettings.adminMomo} onChange={(e: any) => setLocalSettings({...localSettings, adminMomo: e.target.value})} />
                         <SettingInput label="MoMo Account Name" value={localSettings.adminMomoName} onChange={(e: any) => setLocalSettings({...localSettings, adminMomoName: e.target.value})} />
                         <SettingInput label="Support WhatsApp" value={localSettings.whatsappNumber} onChange={(e: any) => setLocalSettings({...localSettings, whatsappNumber: e.target.value})} />
                         <SettingInput label="Facebook URL" value={localSettings.facebookUrl} onChange={(e: any) => setLocalSettings({...localSettings, facebookUrl: e.target.value})} placeholder="https://facebook.com/..." />
                         <SettingInput label="Instagram URL" value={localSettings.instagramUrl} onChange={(e: any) => setLocalSettings({...localSettings, instagramUrl: e.target.value})} placeholder="https://instagram.com/..." />
                         <SettingInput label="TikTok URL" value={localSettings.tiktokUrl} onChange={(e: any) => setLocalSettings({...localSettings, tiktokUrl: e.target.value})} placeholder="https://tiktok.com/@..." />
                     </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-white/5">
                     <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest border-b border-rose-500/30 pb-2">App Content & AI</h4>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SettingInput label="AI Assistant Name" value={localSettings.aiAssistantName} onChange={(e: any) => setLocalSettings({...localSettings, aiAssistantName: e.target.value})} />
                        <SettingInput label="Hub Announcement (Top Banner)" value={localSettings.hub_announcement} onChange={(e: any) => setLocalSettings({...localSettings, hub_announcement: e.target.value})} placeholder="Message for all users..." />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 uppercase font-bold pl-2">About App / Manifesto</label>
                        <textarea 
                            value={localSettings.aboutMeText || ''} 
                            onChange={e => setLocalSettings({...localSettings, aboutMeText: e.target.value})} 
                            className="w-full h-32 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none focus:border-rose-500 resize-none transition-colors"
                        />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 uppercase font-bold pl-2">Portfolio Images (Upload to Add)</label>
                        <input type="file" multiple accept="image/*" onChange={async (e) => {
                            if(e.target.files) {
                                const promises = Array.from(e.target.files).map(f => compressImage(f, 0.6, 800));
                                const results = await Promise.all(promises);
                                setLocalSettings({...localSettings, aboutMeImages: [...(localSettings.aboutMeImages || []), ...results]});
                            }
                        }} className="block w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-white/10 file:text-white hover:file:bg-white/20"/>
                        
                        <div className="flex gap-3 overflow-x-auto py-2">
                            {localSettings.aboutMeImages?.map((img: string, i: number) => (
                                <div key={i} className="relative w-20 h-20 shrink-0 group">
                                    <img src={img} className="w-full h-full object-cover rounded-xl border border-white/10" />
                                    <button onClick={() => {
                                        const newImgs = [...localSettings.aboutMeImages];
                                        newImgs.splice(i, 1);
                                        setLocalSettings({...localSettings, aboutMeImages: newImgs});
                                    }} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><i className="fas fa-times text-[10px]"></i></button>
                                </div>
                            ))}
                        </div>
                     </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-white/5">
                     <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest border-b border-emerald-500/30 pb-2">Monetization (AdSense)</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SettingInput label="AdSense Client ID" value={localSettings.adSenseClientId} onChange={(e: any) => setLocalSettings({...localSettings, adSenseClientId: e.target.value})} />
                        <SettingInput label="AdSense Slot ID" value={localSettings.adSenseSlotId} onChange={(e: any) => setLocalSettings({...localSettings, adSenseSlotId: e.target.value})} />
                        <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 uppercase font-bold pl-2">Ad Status</label>
                            <select value={localSettings.adSenseStatus || 'inactive'} onChange={e => setLocalSettings({...localSettings, adSenseStatus: e.target.value as any})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none focus:border-rose-500">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                     </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-white/5">
                     <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest border-b border-purple-500/30 pb-2">Branding</h4>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[9px] text-slate-500 uppercase font-bold pl-2">App Logo</label>
                            <input type="file" accept="image/*" onChange={async (e) => {
                                if(e.target.files?.[0]) {
                                    const b64 = await compressImage(e.target.files[0], 0.8, 200);
                                    setLocalSettings({...localSettings, appLogo: b64});
                                }
                            }} className="block w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-white/10 file:text-white hover:file:bg-white/20"/>
                            {localSettings.appLogo && <div className="mt-2 w-16 h-16 bg-black/20 rounded-xl p-2 border border-white/10"><img src={localSettings.appLogo} className="w-full h-full object-contain" /></div>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] text-slate-500 uppercase font-bold pl-2">App Wallpaper</label>
                            <input type="file" accept="image/*" onChange={async (e) => {
                                if(e.target.files?.[0]) {
                                    const b64 = await compressImage(e.target.files[0], 0.7, 1024);
                                    setLocalSettings({...localSettings, appWallpaper: b64});
                                }
                            }} className="block w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-white/10 file:text-white hover:file:bg-white/20"/>
                            {localSettings.appWallpaper && <div className="mt-2 w-full h-32 bg-black/20 rounded-xl overflow-hidden border border-white/10 relative"><img src={localSettings.appWallpaper} className="w-full h-full object-cover" /></div>}
                        </div>
                     </div>
                 </div>
            </div>
        )}
    </div>
  );
};
