import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { ai, supabase, decode, decodeAudioData, compressImage, AppSettings, RideNode, Driver, HubMission, TopupRequest, RegistrationRequest, Transaction } from './lib';
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
                    <button onClick={() => onLeave(node.id, currentUser.phone)} className="flex-1 py-3 bg-white/5 hover:bg-rose-500/20 hover:text-rose-500 text-slate-400 rounded-xl font-black text-[9px] uppercase transition-all">Leave</button>
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
  setActiveTab
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
                                                 <span className="text-[9px] font-black text-slate-500 uppercase">Pending</span>
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
                  
                  <div className="pt-4 border-t border-white/5">
                      <div className="flex justify-between items-center mb-4">
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
  onApproveTopup, 
  onRejectTopup, 
  onApproveRegistration, 
  onRejectRegistration, 
  onLock, 
  settings, 
  onUpdateSettings, 
  hubRevenue, 
  adminEmail 
}: any) => {
  const [newMission, setNewMission] = useState({ location: '', description: '', entryFee: 5 });
  const [newDriver, setNewDriver] = useState({ name: '', contact: '', vehicleType: 'Pragia', licensePlate: '', pin: '1234', avatarUrl: '' });
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  
  // Marketing / Veo
  const [videoPrompt, setVideoPrompt] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  // Pulse
  const [pulseAnalysis, setPulseAnalysis] = useState<any>(null);
  const [isAnalyzingPulse, setIsAnalyzingPulse] = useState(false);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSaveSettings = async () => {
      setIsSaving(true);
      await onUpdateSettings(localSettings);
      setIsSaving(false);
  };

  const handleUpdateCredentials = async () => {
    if (!newAdminEmail && !newAdminPassword) return alert("Enter a new email or password to update.");
    
    const updates: any = {};
    if (newAdminEmail) updates.email = newAdminEmail;
    if (newAdminPassword) updates.password = newAdminPassword;

    const { error } = await supabase.auth.updateUser(updates);
    if (error) alert("Update failed: " + error.message);
    else {
        alert("Credentials updated! Please login again if you changed your password.");
        setNewAdminEmail('');
        setNewAdminPassword('');
    }
  };

  const handleImageUpload = async (e: any, field: 'appLogo' | 'appWallpaper') => {
      const file = e.target.files[0];
      if(file) {
          const base64 = await compressImage(file);
          setLocalSettings({...localSettings, [field]: base64});
      }
  };
  
  const handlePortfolioUpload = async (e: any) => {
      const files = Array.from(e.target.files);
      const newImages = await Promise.all(files.map((f: any) => compressImage(f)));
      setLocalSettings({...localSettings, aboutMeImages: [...(localSettings.aboutMeImages || []), ...newImages]});
  };

  const handleCreatePromo = async () => {
      if (!videoPrompt) return;
      // Note: Removed API key selection check to use default environment key
      setIsGeneratingVideo(true);
      try {
          const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
          let operation = await videoAi.models.generateVideos({
              model: 'veo-3.1-fast-generate-preview',
              prompt: videoPrompt,
              config: {
                 numberOfVideos: 1,
                 resolution: '1080p',
                 aspectRatio: '16:9'
              }
          });
          
          while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await videoAi.operations.getVideosOperation({operation: operation});
          }

          const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (uri) {
              const videoUrl = `${uri}&key=${process.env.API_KEY}`;
              window.open(videoUrl, '_blank');
              setVideoPrompt('');
              alert("Video Generated! Opening in new tab.");
          }
      } catch (err: any) {
          console.error("Video Gen Error", err);
          alert("Video generation failed: " + err.message);
      } finally {
          setIsGeneratingVideo(false);
      }
  };

  const handlePulseAnalysis = async () => {
      setIsAnalyzingPulse(true);
      try {
          const activeRides = nodes.filter((n: any) => n.status !== 'completed').length;
          const onlineDrivers = drivers.filter((d: any) => d.status === 'online').length;
          const hour = new Date().getHours();

          const prompt = `
            Analyze these ride-sharing stats:
            - Active Rides: ${activeRides}
            - Online Drivers: ${onlineDrivers}
            - Time of Day: ${hour}:00
            - Current Settings: Pragia Fare ${settings.farePerPragia}, Multiplier ${settings.soloMultiplier}.

            Output a JSON with:
            - "status": "Surge" or "Normal" or "Quiet"
            - "reason": Short explanation.
            - "suggestedAction": "Raise Pragia Fare by 1", "Lower Multiplier", etc.
          `;
          
          const pulseAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await pulseAi.models.generateContent({
             model: 'gemini-3-flash-preview',
             contents: prompt,
             config: { responseMimeType: 'application/json' }
          });
          
          const json = JSON.parse(response.text || '{}');
          setPulseAnalysis(json);
      } catch (e) {
          console.error("Pulse Failed", e);
      } finally {
          setIsAnalyzingPulse(false);
      }
  };

  return (
    <div className="space-y-6">
       <div className="glass p-5 rounded-[2rem] border border-white/10 flex justify-between items-center">
          <div>
             <h2 className="text-xl font-black italic uppercase text-white">Command Center</h2>
             <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{adminEmail}</p>
          </div>
          <button onClick={onLock} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-white/10 transition-all">
             <i className="fas fa-lock"></i>
          </button>
       </div>

       <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
          {['monitor', 'drivers', 'rides', 'finance', 'missions', 'marketing', 'config'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[70px] px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                 {tab}
              </button>
          ))}
       </div>

       {activeTab === 'monitor' && (
          <div className="space-y-6">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass p-5 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Total Revenue</p>
                    <p className="text-2xl font-black text-white">₵ {hubRevenue.toFixed(2)}</p>
                </div>
                <div className="glass p-5 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Active Drivers</p>
                    <p className="text-2xl font-black text-emerald-400">{drivers.filter((d:any) => d.status === 'online').length} / {drivers.length}</p>
                </div>
                <div className="glass p-5 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Active Rides</p>
                    <p className="text-2xl font-black text-amber-500">{nodes.filter((n:any) => n.status !== 'completed').length}</p>
                </div>
                <div className="glass p-5 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Pending Regs</p>
                    <p className="text-2xl font-black text-indigo-400">{registrationRequests.filter((r:any) => r.status === 'pending').length}</p>
                </div>
             </div>
             
             <div className="glass p-6 rounded-[2rem] border border-white/10">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-black text-white uppercase">Market Pulse (AI)</h3>
                    <button onClick={handlePulseAnalysis} disabled={isAnalyzingPulse} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase disabled:opacity-50">
                        {isAnalyzingPulse ? 'Reasoning...' : 'Analyze Supply/Demand'}
                    </button>
                </div>
                {pulseAnalysis && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 animate-in fade-in">
                        <div className="flex items-center gap-2 mb-2">
                           <span className={`w-2 h-2 rounded-full ${pulseAnalysis.status === 'Surge' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                           <span className="text-sm font-black text-white uppercase">{pulseAnalysis.status}</span>
                        </div>
                        <p className="text-xs text-slate-300 mb-2">{pulseAnalysis.reason}</p>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase">Suggestion: {pulseAnalysis.suggestedAction}</p>
                    </div>
                )}
             </div>
          </div>
       )}
       
       {activeTab === 'marketing' && (
           <div className="glass p-6 rounded-[2.5rem] border border-white/10 space-y-6">
               <div className="flex items-center justify-between">
                   <div>
                       <h3 className="text-xl font-black italic uppercase text-white">Hub Promos (Veo)</h3>
                       <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Generate 1080p Video Content</p>
                   </div>
                   <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                       <i className="fas fa-video"></i>
                   </div>
               </div>
               
               <div className="space-y-4">
                   <textarea 
                     value={videoPrompt} 
                     onChange={(e) => setVideoPrompt(e.target.value)} 
                     placeholder="Describe your promo video (e.g. A futuristic shuttle driving through a busy campus at sunset with neon lights)..." 
                     className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold text-xs outline-none focus:border-purple-500 transition-colors"
                   />
                   <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20 flex gap-3 items-center">
                       <i className="fas fa-info-circle text-purple-400"></i>
                       <p className="text-[9px] text-slate-400">Powered by Veo. Ensure your API Key supports video generation.</p>
                   </div>
                   <button 
                     onClick={handleCreatePromo} 
                     disabled={isGeneratingVideo || !videoPrompt}
                     className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-500 transition-all"
                   >
                     {isGeneratingVideo ? 'Generating Video (This takes time)...' : 'Generate Promo Video'}
                   </button>
               </div>
           </div>
       )}

       {activeTab === 'drivers' && (
           <div className="space-y-6">
               <div className="glass p-6 rounded-[2rem] border border-white/10">
                  <h3 className="text-sm font-black text-white uppercase mb-4">Add Partner</h3>
                  
                  <div className="flex items-center gap-4 mb-4 bg-white/5 p-3 rounded-xl border border-white/10">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden relative group shrink-0">
                          {newDriver.avatarUrl ? (
                              <img src={newDriver.avatarUrl} className="w-full h-full object-cover" />
                          ) : (
                              <i className="fas fa-camera text-slate-400"></i>
                          )}
                          <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                              if (e.target.files?.[0]) {
                                  const base64 = await compressImage(e.target.files[0], 0.5, 300);
                                  setNewDriver({...newDriver, avatarUrl: base64});
                              }
                          }} />
                      </div>
                      <div>
                          <p className="text-[10px] font-black uppercase text-white">Driver Photo</p>
                          <p className="text-[9px] text-slate-400">Required</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                     <input value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} placeholder="Name" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                     <input value={newDriver.contact} onChange={e => setNewDriver({...newDriver, contact: e.target.value})} placeholder="Phone" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                     <select value={newDriver.vehicleType} onChange={e => setNewDriver({...newDriver, vehicleType: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white text-xs font-bold outline-none">
                        <option value="Pragia">Pragia</option>
                        <option value="Taxi">Taxi</option>
                        <option value="Shuttle">Shuttle</option>
                     </select>
                     <input value={newDriver.licensePlate} onChange={e => setNewDriver({...newDriver, licensePlate: e.target.value})} placeholder="Plate" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                     <input value={newDriver.pin} onChange={e => setNewDriver({...newDriver, pin: e.target.value})} placeholder="PIN" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                  </div>
                  <button onClick={() => { onAddDriver(newDriver); setNewDriver({ name: '', contact: '', vehicleType: 'Pragia', licensePlate: '', pin: '1234', avatarUrl: '' }); }} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[9px] uppercase transition-all">Manually Register Driver</button>
               </div>

               <div className="space-y-2">
                   {drivers.map((d: any) => (
                       <div key={d.id} className="glass p-4 rounded-2xl flex justify-between items-center border border-white/5">
                           <div>
                               <p className="text-sm font-black text-white">{d.name}</p>
                               <p className="text-[10px] text-slate-400 font-bold">{d.vehicleType} • {d.licensePlate}</p>
                           </div>
                           <div className="flex items-center gap-4">
                               <span className={`text-[9px] font-black uppercase ${d.status === 'online' ? 'text-emerald-500' : 'text-slate-500'}`}>{d.status}</span>
                               <button onClick={() => onDeleteDriver(d.id)} className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><i className="fas fa-trash text-xs"></i></button>
                           </div>
                       </div>
                   ))}
               </div>
           </div>
       )}

       {activeTab === 'finance' && (
           <div className="space-y-6">
               <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Pending Topups</h3>
                  {topupRequests.filter((r:any) => r.status === 'pending').length === 0 && <p className="text-center text-slate-600 text-xs py-4">No pending requests.</p>}
                  {topupRequests.filter((r:any) => r.status === 'pending').map((r: any) => (
                      <div key={r.id} className="glass p-4 rounded-2xl flex justify-between items-center border border-indigo-500/30">
                          <div>
                              <p className="text-sm font-black text-white">₵ {r.amount}</p>
                              <p className="text-[10px] text-slate-400 font-bold">Ref: {r.momoReference}</p>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => onApproveTopup(r.id)} className="px-4 py-2 bg-emerald-500 text-[#020617] rounded-lg text-[9px] font-black uppercase">Approve</button>
                             <button onClick={() => onRejectTopup(r.id)} className="px-4 py-2 bg-rose-500/10 text-rose-500 rounded-lg text-[9px] font-black uppercase">Reject</button>
                          </div>
                      </div>
                  ))}
               </div>

               <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Pending Registrations</h3>
                  {registrationRequests.filter((r:any) => r.status === 'pending').length === 0 && <p className="text-center text-slate-600 text-xs py-4">No pending applications.</p>}
                  {registrationRequests.filter((r:any) => r.status === 'pending').map((r: any) => (
                      <div key={r.id} className="glass p-4 rounded-2xl border border-indigo-500/30">
                          <div className="flex justify-between items-start mb-2">
                             <div>
                                <p className="text-sm font-black text-white">{r.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold">{r.vehicleType} • {r.contact}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-sm font-black text-emerald-400">Paid: ₵ {r.amount}</p>
                                <p className="text-[10px] text-slate-500 font-bold">Ref: {r.momoReference}</p>
                             </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                             <button onClick={() => onApproveRegistration(r.id)} className="flex-1 py-2 bg-emerald-500 text-[#020617] rounded-lg text-[9px] font-black uppercase">Approve Partner</button>
                             <button onClick={() => onRejectRegistration(r.id)} className="flex-1 py-2 bg-rose-500/10 text-rose-500 rounded-lg text-[9px] font-black uppercase">Reject</button>
                          </div>
                      </div>
                  ))}
               </div>
           </div>
       )}

       {activeTab === 'config' && (
           <div className="glass p-6 rounded-[2.5rem] border border-white/10 space-y-6">
              <div>
                  <h3 className="text-lg font-black italic uppercase text-white">System Config</h3>
                  <p className="text-[10px] text-slate-400 uppercase">Update pricing and contacts</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Pragia Fare (₵)</label>
                      <input type="number" value={localSettings.farePerPragia} onChange={e => setLocalSettings({...localSettings, farePerPragia: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Taxi Fare (₵)</label>
                      <input type="number" value={localSettings.farePerTaxi} onChange={e => setLocalSettings({...localSettings, farePerTaxi: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Comm. Per Seat (₵)</label>
                      <input type="number" value={localSettings.commissionPerSeat} onChange={e => setLocalSettings({...localSettings, commissionPerSeat: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Shuttle Comm. (₵)</label>
                      <input type="number" value={localSettings.shuttleCommission || 0} onChange={e => setLocalSettings({...localSettings, shuttleCommission: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Solo Multiplier</label>
                      <input type="number" step="0.1" value={localSettings.soloMultiplier} onChange={e => setLocalSettings({...localSettings, soloMultiplier: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
              </div>
              
              <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">AI Assistant Name</label>
                  <input value={localSettings.aiAssistantName || ''} onChange={e => setLocalSettings({...localSettings, aiAssistantName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" placeholder="e.g. Kofi, Abena" />
              </div>

              <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">Admin MoMo Name</label>
                  <input value={localSettings.adminMomoName} onChange={e => setLocalSettings({...localSettings, adminMomoName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold mb-2" />
                  <label className="text-[9px] font-bold text-slate-500 uppercase">Admin MoMo Number</label>
                  <input value={localSettings.adminMomo} onChange={e => setLocalSettings({...localSettings, adminMomo: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
              </div>

              <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">WhatsApp Support Number</label>
                  <input value={localSettings.whatsappNumber} onChange={e => setLocalSettings({...localSettings, whatsappNumber: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" placeholder="e.g. 23324..." />
              </div>

              <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">Partner Registration Fee (₵)</label>
                  <input type="number" value={localSettings.registrationFee} onChange={e => setLocalSettings({...localSettings, registrationFee: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
              </div>

              <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">System Announcement</label>
                  <textarea value={localSettings.hub_announcement || ''} onChange={e => setLocalSettings({...localSettings, hub_announcement: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs h-20" placeholder="Broadcast message..." />
              </div>
              
              <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase mb-2 block">App Logo</label>
                   <div className="flex items-center gap-4">
                       {localSettings.appLogo && <img src={localSettings.appLogo} className="w-12 h-12 object-contain bg-white/10 rounded-lg" />}
                       <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'appLogo')} className="text-[9px] text-slate-400" />
                   </div>
              </div>

              <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase mb-2 block">App Wallpaper</label>
                   <div className="flex items-center gap-4">
                       {localSettings.appWallpaper && <img src={localSettings.appWallpaper} className="w-16 h-9 object-cover bg-white/10 rounded-lg border border-white/10" />}
                       <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'appWallpaper')} className="text-[9px] text-slate-400" />
                       {localSettings.appWallpaper && (
                           <button onClick={() => setLocalSettings({...localSettings, appWallpaper: ''})} className="ml-2 text-[9px] font-bold text-rose-500 uppercase hover:text-white">Clear</button>
                       )}
                   </div>
              </div>

              <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase mb-2 block">About Me Text</label>
                   <textarea value={localSettings.aboutMeText || ''} onChange={e => setLocalSettings({...localSettings, aboutMeText: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs h-24" />
              </div>

              <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase mb-2 block">Portfolio Images</label>
                   <div className="flex gap-2 overflow-x-auto pb-2">
                       {localSettings.aboutMeImages?.map((img: string, i: number) => (
                           <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 group">
                               <img src={img} className="w-full h-full object-cover" />
                               <button onClick={() => setLocalSettings({...localSettings, aboutMeImages: localSettings.aboutMeImages.filter((_:any, idx:number) => idx !== i)})} className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white"><i className="fas fa-trash"></i></button>
                           </div>
                       ))}
                       <label className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10">
                           <i className="fas fa-plus text-slate-500"></i>
                           <input type="file" multiple accept="image/*" className="hidden" onChange={handlePortfolioUpload} />
                       </label>
                   </div>
              </div>
              
              <div>
                  <h4 className="text-xs font-black uppercase text-white mb-4">Social Media Handles</h4>
                  <div className="space-y-3">
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Facebook URL</label>
                          <input value={localSettings.facebookUrl || ''} onChange={e => setLocalSettings({...localSettings, facebookUrl: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" placeholder="https://facebook.com/..." />
                      </div>
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Instagram URL</label>
                          <input value={localSettings.instagramUrl || ''} onChange={e => setLocalSettings({...localSettings, instagramUrl: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" placeholder="https://instagram.com/..." />
                      </div>
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">TikTok URL</label>
                          <input value={localSettings.tiktokUrl || ''} onChange={e => setLocalSettings({...localSettings, tiktokUrl: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" placeholder="https://tiktok.com/@..." />
                      </div>
                  </div>
              </div>

              <div>
                  <h4 className="text-xs font-black uppercase text-white mb-4">AdSense Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">AdSense Status</label>
                          <select value={localSettings.adSenseStatus || 'inactive'} onChange={e => setLocalSettings({...localSettings, adSenseStatus: e.target.value as any})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs">
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Client ID (ca-pub-...)</label>
                          <input value={localSettings.adSenseClientId || ''} onChange={e => setLocalSettings({...localSettings, adSenseClientId: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" />
                      </div>
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Slot ID</label>
                          <input value={localSettings.adSenseSlotId || ''} onChange={e => setLocalSettings({...localSettings, adSenseSlotId: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" />
                      </div>
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Layout Key</label>
                          <input value={localSettings.adSenseLayoutKey || ''} onChange={e => setLocalSettings({...localSettings, adSenseLayoutKey: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" />
                      </div>
                  </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <h4 className="text-xs font-black uppercase text-white mb-4">Admin Security</h4>
                <div className="space-y-3">
                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Update Email</label>
                        <input value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" placeholder="New Admin Email" />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Update Password</label>
                        <input type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" placeholder="New Strong Password" />
                    </div>
                    <button onClick={handleUpdateCredentials} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-[9px] uppercase transition-all">Update Credentials</button>
                </div>
              </div>

              <button onClick={handleSaveSettings} disabled={isSaving} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 mt-4">
                  {isSaving ? 'Saving Changes...' : 'Update Configuration'}
              </button>
           </div>
       )}

       {activeTab === 'missions' && (
           <div className="space-y-6">
              <div className="glass p-6 rounded-[2rem] border border-white/10">
                  <h3 className="text-sm font-black text-white uppercase mb-4">Create Hotspot</h3>
                  <div className="space-y-3">
                      <input value={newMission.location} onChange={e => setNewMission({...newMission, location: e.target.value})} placeholder="Location Name" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                      <input value={newMission.description} onChange={e => setNewMission({...newMission, description: e.target.value})} placeholder="Description" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                      <input type="number" value={newMission.entryFee} onChange={e => setNewMission({...newMission, entryFee: parseFloat(e.target.value)})} placeholder="Entry Fee" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                      <button onClick={() => { 
                         onCreateMission({ ...newMission, id: `MSN-${Date.now()}`, driversJoined: [], status: 'open', createdAt: new Date().toISOString() }); 
                         setNewMission({ location: '', description: '', entryFee: 5 }); 
                      }} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[9px] uppercase transition-all">Deploy Mission</button>
                  </div>
              </div>
              <div className="space-y-2">
                 {missions.map((m: any) => (
                    <div key={m.id} className="glass p-4 rounded-2xl flex justify-between items-center border border-white/5">
                        <div>
                           <p className="text-sm font-black text-white">{m.location}</p>
                           <p className="text-[10px] text-slate-400">{m.driversJoined.length} Drivers Stationed • Fee: ₵{m.entryFee}</p>
                        </div>
                        <button onClick={() => onDeleteMission(m.id)} className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><i className="fas fa-trash text-xs"></i></button>
                    </div>
                 ))}
              </div>
           </div>
       )}
       
       {activeTab === 'rides' && (
           <div className="space-y-4">
              {nodes.length === 0 && <p className="text-center text-slate-600 text-xs py-4">No rides in system.</p>}
              {nodes.map((n: any) => (
                  <div key={n.id} className="glass p-4 rounded-2xl border border-white/5 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-2">
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${n.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>{n.status}</span>
                                  <span className="text-[8px] font-bold text-slate-500 uppercase">{n.id}</span>
                              </div>
                              <p className="text-sm font-black text-white">{n.destination}</p>
                              <p className="text-[10px] text-slate-400">From: {n.origin}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-sm font-black text-white">₵ {n.farePerPerson}</p>
                              <p className="text-[9px] text-slate-500">{n.passengers.length} Pax</p>
                          </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                          {n.status !== 'completed' && (
                             <>
                               <button onClick={() => onCancelRide(n.id)} className="flex-1 py-2 bg-rose-500/10 text-rose-500 rounded-lg text-[9px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all">Cancel</button>
                               <button onClick={() => onSettleRide(n.id)} className="flex-1 py-2 bg-emerald-500/10 text-emerald-500 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all">Settle</button>
                             </>
                          )}
                      </div>
                  </div>
              ))}
           </div>
       )}
    </div>
  );
};
