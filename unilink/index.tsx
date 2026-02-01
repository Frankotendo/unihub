import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CLIENT ---
const SUPABASE_URL = "https://kzjgihwxiaeqzopeuzhm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- GEMINI INITIALIZATION ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- TYPES & INTERFACES ---

type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed'; 
type PortalMode = 'passenger' | 'driver' | 'admin';

interface SearchConfig {
  query: string;
  vehicleType: VehicleType | 'All';
  status: NodeStatus | 'All';
  sortBy: 'newest' | 'price' | 'capacity';
  isSolo: boolean | null;
}

interface UniUser {
  id: string;
  username: string;
  phone: string;
}

interface Passenger {
  id: string;
  name: string;
  phone: string;
  verificationCode?: string;
}

interface HubMission {
  id: string;
  location: string;
  description: string;
  entryFee: number;
  driversJoined: string[]; // List of driver IDs
  status: 'open' | 'closed';
  createdAt: string;
}

interface RideNode {
  id: string;
  destination: string;
  origin: string;
  capacityNeeded: number;
  passengers: Passenger[];
  status: NodeStatus;
  leaderName: string;
  leaderPhone: string;
  farePerPerson: number;
  createdAt: string;
  assignedDriverId?: string;
  verificationCode?: string;
  isSolo?: boolean;
  isLongDistance?: boolean;
  negotiatedTotalFare?: number;
  vehicleType?: VehicleType; 
}

interface Driver {
  id: string;
  name: string;
  vehicleType: VehicleType;
  licensePlate: string;
  contact: string;
  walletBalance: number; 
  rating: number;
  status: 'online' | 'busy' | 'offline';
  pin: string; 
  avatarUrl?: string; 
}

interface TopupRequest {
  id: string;
  driverId: string;
  amount: number;
  momoReference: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

interface RegistrationRequest {
  id: string;
  name: string;
  vehicleType: VehicleType;
  licensePlate: string;
  contact: string;
  pin: string;
  amount: number;
  momoReference: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
  avatarUrl?: string; 
}

interface Transaction {
  id: string;
  driverId: string;
  amount: number;
  type: 'commission' | 'topup' | 'registration'; 
  timestamp: string;
}

interface AppSettings {
  id?: number;
  adminMomo: string;
  adminMomoName: string;
  whatsappNumber: string;
  commissionPerSeat: number;
  adminSecret?: string;
  farePerPragia: number;
  farePerTaxi: number;
  soloMultiplier: number;
  aboutMeText: string;
  aboutMeImages: string[]; // Base64 strings
  appWallpaper?: string; // Base64 string
  appLogo?: string; // Base64 string for custom logo
  registrationFee: number;
  hub_announcement?: string;
  // AdSense Config
  adSenseClientId?: string;
  adSenseSlotId?: string;
  adSenseLayoutKey?: string; // Optional for in-feed
  adSenseStatus?: 'active' | 'inactive';
}

// --- UTILS ---

const shareHub = async () => {
  const shareData = {
    title: 'NexRyde Dispatch',
    text: 'Join the smartest ride-sharing platform! Form groups, save costs, and move fast.',
    url: window.location.origin,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`, '_blank');
    }
  } catch (err) {
    console.log('Share failed', err);
  }
};

const shareNode = async (node: RideNode) => {
  const seatsLeft = node.capacityNeeded - node.passengers.length;
  const message = node.isLongDistance 
    ? `🚀 *NexRyde Premium Ride!* \n📍 *From:* ${node.origin}\n📍 *To:* ${node.destination}\n🚕 *Partners invited to bid!*`
    : node.isSolo 
    ? `🚀 *NexRyde Solo Drop!* \n📍 *Route:* ${node.origin} → ${node.destination}\n🚕 *Express Partner* needed!`
    : `🚀 *NexRyde Group Alert!*\n📍 *Route:* ${node.origin} → ${node.destination}\n👥 *Seats Left:* ${seatsLeft}\n💰 *Price:* ₵${node.farePerPerson}/p\n\nJoin my trip on NexRyde! 👇\n${window.location.origin}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'NexRyde Update',
        text: message,
        url: window.location.origin
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  } catch (err) {
    console.log('Trip share failed', err);
  }
};

const compressImage = (file: File, quality = 0.6, maxWidth = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality)); 
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

// --- SUB-COMPONENTS ---

const InlineAd = ({ className, settings }: { className?: string, settings: AppSettings }) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings.adSenseStatus !== 'active' || !settings.adSenseClientId || !settings.adSenseSlotId) return;

    try {
      // Corrected: prevent double push if ad is already loaded
      if (adRef.current && adRef.current.innerHTML !== "") {
         return; 
      }
      setTimeout(() => {
         try {
           (window as any).adsbygoogle = (window as any).adsbygoogle || [];
           (window as any).adsbygoogle.push({});
         } catch(e) { console.debug("AdSense Push", e); }
      }, 500);
    } catch (e) {
      console.error("AdSense Init Error", e);
    }
  }, [settings.adSenseStatus, settings.adSenseClientId, settings.adSenseSlotId]);

  if (settings.adSenseStatus !== 'active' || !settings.adSenseClientId || !settings.adSenseSlotId) return null;

  return (
    <div className={`glass p-4 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center bg-white/5 overflow-hidden ${className}`}>
        <p className="text-[8px] font-black uppercase text-slate-500 mb-2 tracking-widest">Sponsored</p>
        <div className="w-full flex justify-center bg-transparent" ref={adRef}>
            <ins className="adsbygoogle"
                 style={{display:'block', width: '100%', maxWidth: '300px', height: '100px'}}
                 data-ad-format="fluid"
                 data-ad-layout-key={settings.adSenseLayoutKey || "-fb+5w+4e-db+86"}
                 data-ad-client={settings.adSenseClientId}
                 data-ad-slot={settings.adSenseSlotId}></ins>
        </div>
    </div>
  );
};

const AdGate = ({ onUnlock, label, settings }: { onUnlock: () => void, label: string, settings: AppSettings }) => {
  const [timeLeft, setTimeLeft] = useState(5);
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);

    // Initialize AdSense
    if (settings.adSenseStatus === 'active' && settings.adSenseClientId && settings.adSenseSlotId) {
      try {
        // Corrected: prevent double push if ad is already loaded
        if (adRef.current && adRef.current.innerHTML !== "") {
           // Ad already loaded, do nothing
        } else {
            setTimeout(() => {
               try {
                 (window as any).adsbygoogle = (window as any).adsbygoogle || [];
                 (window as any).adsbygoogle.push({});
               } catch(e) { console.error("AdSense Push Error", e); }
            }, 100);
        }
      } catch (e) {
        console.error("AdSense Init Error", e);
      }
    }

    return () => clearInterval(timer);
  }, [settings.adSenseStatus, settings.adSenseClientId, settings.adSenseSlotId]);

  return (
    <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="glass-bright w-full max-w-sm p-6 rounded-[2.5rem] border border-white/10 text-center relative overflow-hidden animate-in zoom-in">
         <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
            <div className="h-full bg-amber-500 transition-all duration-1000 ease-linear" style={{ width: `${(1 - timeLeft/5) * 100}%` }}></div>
         </div>
         
         <div className="mb-4">
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] animate-pulse">Sponsored Session</span>
            <h3 className="text-xl font-black italic text-white mt-1">{label}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Watch this ad to unlock premium features.</p>
         </div>

         <div className="bg-white rounded-xl overflow-hidden min-h-[250px] flex items-center justify-center mb-6 relative">
             <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-[10px] font-bold uppercase z-0">
               {settings.adSenseStatus !== 'active' ? 'Ads Disabled' : 'Ad Loading...'}
             </div>
             {settings.adSenseStatus === 'active' && settings.adSenseClientId && (
               <div className="relative z-10 w-full flex justify-center bg-white" ref={adRef}>
                  <ins className="adsbygoogle"
                       style={{display:'inline-block', width:'300px', height:'250px'}}
                       data-ad-client={settings.adSenseClientId}
                       data-ad-slot={settings.adSenseSlotId}></ins>
               </div>
             )}
         </div>

         <button 
           onClick={onUnlock} 
           disabled={timeLeft > 0}
           className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${timeLeft > 0 ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-emerald-500 text-white shadow-xl hover:scale-105'}`}
         >
           {timeLeft > 0 ? `Unlocking in ${timeLeft}s` : 'Continue to Feature'}
         </button>
      </div>
    </div>
  );
};

const HubGateway = ({ onIdentify, settings }: { onIdentify: (username: string, phone: string, mode: 'login' | 'signup') => void, settings: AppSettings }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/20 to-purple-900/20"></div>
      <div className="glass-bright w-full max-w-md p-8 rounded-[3rem] border border-white/10 relative z-10 animate-in zoom-in duration-500">
        <div className="text-center mb-8">
          {settings.appLogo ? (
            <img src={settings.appLogo} className="w-24 h-24 object-contain mx-auto mb-4 drop-shadow-2xl" alt="Logo" />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-orange-500/20 mb-4">
               <i className="fas fa-route text-[#020617] text-3xl"></i>
            </div>
          )}
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">NexRyde</h1>
          <p className="text-xs font-black text-amber-500 uppercase tracking-widest mt-2">Transit Excellence</p>
        </div>

        <div className="space-y-4">
           {mode === 'signup' && (
             <input 
               value={username} 
               onChange={e => setUsername(e.target.value)}
               className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
               placeholder="Choose Username"
             />
           )}
           <input 
             value={phone} 
             onChange={e => setPhone(e.target.value)}
             className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
             placeholder="Phone Number"
           />
           <button 
             onClick={() => onIdentify(username, phone, mode)}
             className="w-full bg-amber-500 text-[#020617] py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl"
           >
             {mode === 'login' ? 'Enter Hub' : 'Create Identity'}
           </button>
        </div>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            {mode === 'login' ? 'New here? Create Account' : 'Have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all group ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
  >
    <div className="flex items-center gap-4">
       <i className={`fas ${icon} text-lg w-6 text-center ${active ? 'text-white' : 'group-hover:scale-110 transition-transform'}`}></i>
       <span className="text-sm font-bold">{label}</span>
    </div>
    {badge && <span className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full">{badge}</span>}
  </button>
);

const MobileNavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 relative ${active ? 'text-indigo-400' : 'text-slate-500'}`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600 text-white shadow-lg translate-y-[-10px]' : 'bg-transparent'}`}>
      <i className={`fas ${icon} text-lg`}></i>
    </div>
    <span className={`text-[9px] font-black uppercase tracking-wide ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    {badge && <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 border border-[#020617] rounded-full"></span>}
  </button>
);

const SearchHub = ({ searchConfig, setSearchConfig, portalMode }: any) => {
  return (
    <div className="bg-white/5 border border-white/5 p-2 rounded-[2rem] flex flex-col md:flex-row gap-2">
      <div className="flex-1 relative">
         <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
         <input 
           value={searchConfig.query}
           onChange={(e) => setSearchConfig({...searchConfig, query: e.target.value})}
           className="w-full bg-[#020617]/50 rounded-[1.5rem] pl-14 pr-6 py-4 text-white font-bold outline-none border border-transparent focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
           placeholder={portalMode === 'driver' ? "Find routes or passengers..." : "Where to?"}
         />
      </div>
      {portalMode === 'passenger' && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
           {['All', 'Pragia', 'Taxi', 'Shuttle'].map(type => (
             <button 
               key={type}
               onClick={() => setSearchConfig({...searchConfig, vehicleType: type as any})}
               className={`px-6 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${searchConfig.vehicleType === type ? 'bg-white text-[#020617]' : 'bg-[#020617]/50 text-slate-500 hover:bg-white/10'}`}
             >
               {type}
             </button>
           ))}
        </div>
      )}
    </div>
  );
};

const PassengerPortal = ({ currentUser, nodes, myRideIds, onAddNode, onJoin, onLeave, onForceQualify, onCancel, drivers, searchConfig, settings, onShowQr, onShowAbout }: any) => {
  const [createMode, setCreateMode] = useState(false);
  const [newNode, setNewNode] = useState<Partial<RideNode>>({ origin: '', destination: '', vehicleType: 'Pragia', isSolo: false });
  const [fareEstimate, setFareEstimate] = useState(0);
  const [expandedQr, setExpandedQr] = useState<string | null>(null);
  
  // Ad states
  const [showSoloAd, setShowSoloAd] = useState(false);
  const [isSoloUnlocked, setIsSoloUnlocked] = useState(false);

  // Filter logic
  const filteredNodes = nodes.filter((n: RideNode) => {
    if (searchConfig.query && !n.origin.toLowerCase().includes(searchConfig.query.toLowerCase()) && !n.destination.toLowerCase().includes(searchConfig.query.toLowerCase())) return false;
    if (searchConfig.vehicleType !== 'All' && n.vehicleType !== searchConfig.vehicleType) return false;
    return true;
  });

  const myRides = nodes.filter((n: RideNode) => myRideIds.includes(n.id));
  const availableRides = filteredNodes.filter((n: RideNode) => n.status !== 'completed' && !myRideIds.includes(n.id));

  // Fare estimation effect
  useEffect(() => {
    let base = newNode.vehicleType === 'Taxi' ? settings.farePerTaxi : settings.farePerPragia;
    if (newNode.isSolo) base *= settings.soloMultiplier;
    setFareEstimate(base);
  }, [newNode.vehicleType, newNode.isSolo, settings]);

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
      farePerPerson: fareEstimate,
      createdAt: new Date().toISOString()
    };
    onAddNode(node);
    setCreateMode(false);
  };

  if (createMode) {
    return (
      <div className="glass p-8 rounded-[2.5rem] border border-white/10 animate-in zoom-in max-w-lg mx-auto relative">
         {showSoloAd && <AdGate onUnlock={handleSoloUnlock} label="Unlock Solo Ride Mode" settings={settings} />}
         
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black italic uppercase text-white">New Request</h2>
            <button onClick={() => setCreateMode(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white"><i className="fas fa-times"></i></button>
         </div>
         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl">
               <button onClick={() => setNewNode({...newNode, isSolo: false})} className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${!newNode.isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Pool (Cheaper)</button>
               <button onClick={toggleSolo} className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${newNode.isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
                 Solo (Express)
                 {!isSoloUnlocked && !newNode.isSolo && <i className="fas fa-lock text-[8px] opacity-70"></i>}
               </button>
            </div>
            <input value={newNode.origin} onChange={e => setNewNode({...newNode, origin: e.target.value})} placeholder="Pickup Location" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-sm focus:border-indigo-500" />
            <input value={newNode.destination} onChange={e => setNewNode({...newNode, destination: e.target.value})} placeholder="Dropoff Location" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-sm focus:border-indigo-500" />
            
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
               {['Pragia', 'Taxi', 'Shuttle'].map(v => (
                 <button key={v} onClick={() => setNewNode({...newNode, vehicleType: v as any})} className={`px-4 py-2 rounded-lg border border-white/10 font-black text-[10px] uppercase ${newNode.vehicleType === v ? 'bg-amber-500 text-[#020617]' : 'bg-white/5 text-slate-400'}`}>
                    {v}
                 </button>
               ))}
            </div>

            <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex justify-between items-center">
               <span className="text-xs font-bold text-emerald-400 uppercase">Est. Fare</span>
               <span className="text-xl font-black text-white">₵{fareEstimate.toFixed(2)}</span>
            </div>

            <button onClick={handleSubmit} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Confirm Request</button>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
       {/* Active Rides */}
       {myRides.length > 0 && (
         <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">My Active Trips</h3>
            {myRides.map((node: RideNode) => {
              const myPassengerInfo = node.passengers.find(p => p.phone === currentUser.phone);
              const myPin = myPassengerInfo?.verificationCode || node.verificationCode;
              const assignedDriver = drivers.find((d: Driver) => d.id === node.assignedDriverId);

              return (
              <div key={node.id} className="glass p-6 rounded-[2rem] border border-indigo-500/30 bg-indigo-900/10 relative overflow-hidden">
                 <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${node.status === 'qualified' ? 'bg-emerald-500 text-[#020617]' : 'bg-amber-500 text-[#020617]'}`}>{node.status}</span>
                          <span className="text-[10px] font-black text-indigo-300 uppercase">{node.vehicleType}</span>
                       </div>
                       <h4 className="text-lg font-black text-white">{node.destination}</h4>
                       <p className="text-xs text-slate-400">From: {node.origin}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-xl font-black text-white">₵{node.farePerPerson}</p>
                       {node.assignedDriverId && <p className="text-[9px] font-black text-emerald-400 uppercase animate-pulse">Driver En Route</p>}
                    </div>
                 </div>
                 
                 {assignedDriver && (
                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl mb-4 border border-white/5">
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
                    {node.status === 'forming' && node.passengers.length > 1 && (
                       <button onClick={() => onForceQualify(node.id)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase">Go Now (Pay Extra)</button>
                    )}
                    <button onClick={() => onLeave(node.id, currentUser.phone)} className="flex-1 py-3 bg-white/5 hover:bg-rose-500/20 hover:text-rose-500 text-slate-400 rounded-xl font-black text-[9px] uppercase transition-all">Leave</button>
                    {node.leaderPhone === currentUser.phone && (
                       <button onClick={() => onCancel(node.id)} className="w-10 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-trash text-xs"></i></button>
                    )}
                 </div>
              </div>
            )})}
         </div>
       )}

       {/* Create CTA */}
       <div onClick={() => setCreateMode(true)} className="glass p-8 rounded-[2.5rem] border-2 border-dashed border-white/10 hover:border-amber-500/50 cursor-pointer group transition-all text-center space-y-2">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-500 group-hover:bg-amber-500 group-hover:text-[#020617] transition-all">
             <i className="fas fa-plus"></i>
          </div>
          <h3 className="text-lg font-black uppercase italic text-white group-hover:text-amber-500 transition-colors">Start New Trip</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Create a pool or go solo</p>
       </div>

       {/* Available Rides */}
       <div>
          <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2 mb-4">Community Rides</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {availableRides.length === 0 && <p className="text-slate-600 text-xs font-bold uppercase col-span-full text-center py-8">No matching rides found.</p>}
             {availableRides.map((node: RideNode, index: number) => (
               <React.Fragment key={node.id}>
                <div className="glass p-6 rounded-[2rem] border border-white/5 hover:border-white/10 transition-all">
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <span className="px-2 py-1 bg-white/10 rounded-md text-[8px] font-black uppercase text-slate-300">{node.vehicleType}</span>
                         <h4 className="text-base font-black text-white mt-1">{node.destination}</h4>
                         <p className="text-[10px] text-slate-400 uppercase">From: {node.origin}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-lg font-black text-amber-500">₵{node.farePerPerson}</p>
                         <p className="text-[9px] font-bold text-slate-500 uppercase">{node.passengers.length}/{node.capacityNeeded} Seats</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2 mb-4">
                      {node.passengers.map((p, i) => (
                         <div key={i} className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white border border-[#020617]" title={p.name}>{p.name[0]}</div>
                      ))}
                      {[...Array(Math.max(0, node.capacityNeeded - node.passengers.length))].map((_, i) => (
                         <div key={i} className="w-6 h-6 rounded-full bg-white/5 border border-white/10 border-dashed"></div>
                      ))}
                   </div>
                   <button onClick={() => onJoin(node.id, currentUser.username, currentUser.phone)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-[10px] uppercase transition-all">Join Ride</button>
                </div>
                {/* Insert Ad after every 3rd item */}
                {(index + 1) % 3 === 0 && <InlineAd className="col-span-1" settings={settings} />}
               </React.Fragment>
             ))}
          </div>
       </div>

       {expandedQr && (
         <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-6" onClick={() => setExpandedQr(null)}>
            <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center animate-in zoom-in relative" onClick={e => e.stopPropagation()}>
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
                  <p className="text-5xl font-black text-[#020617] tracking-[0.5em]">{expandedQr}</p>
               </div>
               <p className="text-[10px] font-bold text-rose-500 uppercase">Only show when ready to board</p>
            </div>
         </div>
       )}
    </div>
  );
};

const AdminLogin = ({ onLogin }: any) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  return (
    <div className="max-w-sm mx-auto glass p-8 rounded-[2.5rem] border border-white/10 text-center space-y-6 animate-in zoom-in">
       <div className="w-16 h-16 bg-rose-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-rose-900/20">
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

const HelpSection = ({ icon, title, color, points }: any) => (
  <div className="glass p-6 rounded-[2rem] border border-white/5">
     <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${color}`}>
           <i className={`fas ${icon}`}></i>
        </div>
        <h4 className="text-sm font-black uppercase text-white">{title}</h4>
     </div>
     <ul className="space-y-2">
        {points.map((p: string, i: number) => (
           <li key={i} className="text-[10px] text-slate-400 font-medium leading-relaxed flex gap-2">
              <span className={`mt-1 w-1 h-1 rounded-full shrink-0 ${color.replace('text-', 'bg-')}`}></span>
              {p}
           </li>
        ))}
     </ul>
  </div>
);

const AiHelpDesk = ({ onClose, settings }: any) => {
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    {role: 'model', text: `Hello! I'm the NexRyde AI Assistant. I can help you with app features, pricing, and safety tips. How can I help you today?`}
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<Chat | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
     chatRef.current = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
            systemInstruction: `You are a helpful support assistant for NexRyde, a ride-sharing app for university students in Ghana. 
        App Details:
        - Currency: Cedis (₵)
        - Vehicle Types: Pragia (Tricycle), Taxi, Shuttle.
        - Fares: Pragia (₵${settings.farePerPragia}), Taxi (₵${settings.farePerTaxi}). Solo rides are x${settings.soloMultiplier}.
        - Commission: ₵${settings.commissionPerSeat} per seat.
        - Features: Pooling (cheaper), Solo (express), Hotspots (drivers station there).
        - Admin Contact: ${settings.adminMomo} (${settings.adminMomoName})
        
        Keep answers short, friendly and helpful. Use emojis.`
        }
     });
  }, [settings]);

  const handleSend = async () => {
    if (!input.trim() || !chatRef.current) return;
    const userMsg = input;
    setMessages(prev => [...prev, {role: 'user', text: userMsg}]);
    setInput('');
    setLoading(true);

    try {
      const response = await chatRef.current.sendMessage({
        message: userMsg
      });
      
      const text = response.text;
      setMessages(prev => [...prev, {role: 'model', text: text || "I didn't catch that."}]);
    } catch (err) {
      setMessages(prev => [...prev, {role: 'model', text: "I'm having trouble connecting right now. Please try again later."}]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#020617] w-full max-w-lg h-[80vh] sm:h-[600px] sm:rounded-[2.5rem] flex flex-col border border-white/10 shadow-2xl relative animate-in slide-in-from-bottom">
         <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-indigo-900/20 to-purple-900/20 sm:rounded-t-[2.5rem]">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white shadow-lg animate-pulse">
                  <i className="fas fa-sparkles"></i>
               </div>
               <div>
                  <h3 className="text-lg font-black italic uppercase text-white">NexRyde AI</h3>
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Support Agent</p>
               </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
         </div>
         
         <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
            {messages.map((m, i) => (
               <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white/10 text-slate-200 rounded-bl-none'}`}>
                     {m.text}
                  </div>
               </div>
            ))}
            {loading && (
               <div className="flex justify-start">
                  <div className="bg-white/5 px-4 py-3 rounded-2xl rounded-bl-none flex gap-1">
                     <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                     <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-100"></span>
                     <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-200"></span>
                  </div>
               </div>
            )}
         </div>

         <div className="p-4 border-t border-white/5">
            <div className="flex gap-2 bg-white/5 p-2 rounded-[1.5rem] border border-white/5 focus-within:border-indigo-500/50 transition-colors">
               <input 
                 value={input}
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSend()}
                 className="flex-1 bg-transparent px-4 text-white text-sm outline-none placeholder:text-slate-600"
                 placeholder="Ask about rides, prices..."
               />
               <button onClick={handleSend} disabled={loading || !input.trim()} className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform">
                  <i className="fas fa-paper-plane text-xs"></i>
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState('monitor'); // Admin portal tab state
  
  // Auth states
  const [session, setSession] = useState<any>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UniUser | null>(() => {
    const saved = localStorage.getItem('nexryde_user_v1');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => {
    return sessionStorage.getItem('nexryde_driver_session_v1');
  });

  // Global Search State
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    query: '',
    vehicleType: 'All',
    status: 'All',
    sortBy: 'newest',
    isSolo: null
  });

  // Track user's own rides locally
  const [myRideIds, setMyRideIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nexryde_my_rides_v1');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [isNewUser, setIsNewUser] = useState(() => !localStorage.getItem('nexryde_seen_welcome_v1'));
  const [isSyncing, setIsSyncing] = useState(true);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState(() => sessionStorage.getItem('nexryde_dismissed_announcement'));
  
  // Ad states for global AI feature
  const [showAiAd, setShowAiAd] = useState(false);
  const [isAiUnlocked, setIsAiUnlocked] = useState(false);

  const [settings, setSettings] = useState<AppSettings>({
    adminMomo: "024-123-4567",
    adminMomoName: "NexRyde Admin",
    whatsappNumber: "233241234567",
    commissionPerSeat: 2.00,
    farePerPragia: 5.00,
    farePerTaxi: 8.00,
    soloMultiplier: 2.5,
    aboutMeText: "Welcome to NexRyde Logistics.",
    aboutMeImages: [],
    appWallpaper: "",
    appLogo: "",
    registrationFee: 20.00,
    hub_announcement: "",
    // Default AdSense keys (fallback/example)
    adSenseClientId: "ca-pub-7812709042449387",
    adSenseSlotId: "9489307110",
    adSenseLayoutKey: "-fb+5w+4e-db+86",
    adSenseStatus: "active"
  });
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [missions, setMissions] = useState<HubMission[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);

  const isVaultAccess = useMemo(() => {
    return new URLSearchParams(window.location.search).get('access') === 'vault';
  }, []);

  const fetchData = async () => {
    setIsSyncing(true);
    try {
      const [
        { data: sData },
        { data: nData },
        { data: dData },
        { data: mData },
        { data: tData },
        { data: trData },
        { data: regData }
      ] = await Promise.all([
        supabase.from('unihub_settings').select('*').single(),
        supabase.from('unihub_nodes').select('*').order('createdAt', { ascending: false }),
        supabase.from('unihub_drivers').select('*'),
        supabase.from('unihub_missions').select('*').order('createdAt', { ascending: false }),
        supabase.from('unihub_topups').select('*').order('timestamp', { ascending: false }),
        supabase.from('unihub_transactions').select('*').order('timestamp', { ascending: false }),
        supabase.from('unihub_registrations').select('*').order('timestamp', { ascending: false })
      ]);

      if (sData) {
        setSettings(prev => ({ ...prev, ...sData }));
        const currentMsg = sData.hub_announcement || '';
        if (currentMsg !== sessionStorage.getItem('nexryde_last_announcement')) {
          setDismissedAnnouncement(null);
          sessionStorage.removeItem('nexryde_dismissed_announcement');
          sessionStorage.setItem('nexryde_last_announcement', currentMsg);
        }
      }
      if (nData) setNodes(nData);
      if (dData) setDrivers(dData);
      if (mData) setMissions(mData);
      if (trData) setTransactions(trData);
      if (tData) setTopupRequests(tData);
      if (regData) setRegistrationRequests(regData);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('nexryde_my_rides_v1', JSON.stringify(myRideIds));
  }, [myRideIds]);

  // Inject AdSense Script Dynamically
  useEffect(() => {
    if (settings.adSenseStatus === 'active' && settings.adSenseClientId) {
      const scriptId = 'google-adsense-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${settings.adSenseClientId}`;
        script.async = true;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
      }
    }
  }, [settings.adSenseStatus, settings.adSenseClientId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAdminAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAdminAuthenticated(!!session);
    });

    fetchData();

    const channels = [
      supabase.channel('public:unihub_settings').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_settings' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_nodes').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_nodes' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_drivers').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_drivers' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_missions').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_missions' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_transactions').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_transactions' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_topups').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_topups' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_registrations').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_registrations' }, () => fetchData()).subscribe()
    ];

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      subscription.unsubscribe();
    };
  }, []);

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);
  const onlineDriverCount = useMemo(() => drivers.filter(d => d.status === 'online').length, [drivers]);
  const activeNodeCount = useMemo(() => nodes.filter(n => n.status !== 'completed').length, [nodes]);
  const hubRevenue = useMemo(() => transactions.reduce((a, b) => a + b.amount, 0), [transactions]);
  const pendingRequestsCount = useMemo(() => 
    topupRequests.filter(r => r.status === 'pending').length + 
    registrationRequests.filter(r => r.status === 'pending').length, 
  [topupRequests, registrationRequests]);

  const handleGlobalUserAuth = async (username: string, phone: string, mode: 'login' | 'signup') => {
    if (!phone) {
      alert("Verification details required.");
      return;
    }
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from('unihub_users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      if (mode === 'login') {
        if (!data) {
          alert("Profile not found! Please create an account first.");
          setIsSyncing(false);
          return;
        }
        const user = data as UniUser;
        setCurrentUser(user);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(user));
      } else {
        if (data) {
          alert("An account with this phone already exists! Please Sign In.");
          setIsSyncing(false);
          return;
        }
        if (!username) { alert("Please enter a username for your profile."); setIsSyncing(false); return; }
        const newUser = { id: `USER-${Date.now()}`, username, phone };
        const { error: insertErr } = await supabase.from('unihub_users').insert([newUser]);
        if (insertErr) throw insertErr;
        setCurrentUser(newUser);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(newUser));
      }
    } catch (err: any) {
      alert("Identity Error: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Sign out of NexRyde?")) {
      localStorage.removeItem('nexryde_user_v1');
      setCurrentUser(null);
    }
  };

  const joinMission = async (missionId: string, driverId: string) => {
    const mission = missions.find(m => m.id === missionId);
    const driver = drivers.find(d => d.id === driverId);

    if (!mission || !driver) return;
    if (mission.driversJoined.includes(driverId)) {
      alert("You are already stationed at this hotspot.");
      return;
    }
    if (driver.walletBalance < mission.entryFee) {
      alert("Insufficient Balance for Hotspot Entry Fee.");
      return;
    }

    const newJoined = [...mission.driversJoined, driverId];
    
    await Promise.all([
      supabase.from('unihub_missions').update({ driversJoined: newJoined }).eq('id', missionId),
      supabase.from('unihub_drivers').update({ walletBalance: driver.walletBalance - mission.entryFee }).eq('id', driverId),
      supabase.from('unihub_transactions').insert([{
        id: `TX-MISSION-${Date.now()}`,
        driverId,
        amount: mission.entryFee,
        type: 'commission', 
        timestamp: new Date().toLocaleString()
      }])
    ]);

    alert(`Successfully stationed at ${mission.location}! ₵${mission.entryFee} deducted.`);
  };

  const addRideToMyList = (nodeId: string) => {
    setMyRideIds(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
  };

  const removeRideFromMyList = (nodeId: string) => {
    setMyRideIds(prev => prev.filter(id => id !== nodeId));
  };

  const joinNode = async (nodeId: string, name: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.passengers.length < node.capacityNeeded) {
      const newPassengers = [...node.passengers, { id: `P-${Date.now()}`, name, phone }];
      const isQualified = newPassengers.length >= node.capacityNeeded;
      const updatedStatus = isQualified ? 'qualified' : 'forming';
      
      await supabase.from('unihub_nodes').update({ 
        passengers: newPassengers, 
        status: updatedStatus 
      }).eq('id', nodeId);

      addRideToMyList(nodeId);
    }
  };

  const leaveNode = async (nodeId: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const newPassengers = node.passengers.filter(p => p.phone !== phone);
    // If leader leaves, and there are others, next one becomes leader? For simplicity, if leader leaves, warn them to cancel.
    // Here we implement basic passenger leaving.
    const isQualified = newPassengers.length >= node.capacityNeeded;
    const updatedStatus = newPassengers.length < node.capacityNeeded && node.status === 'qualified' ? 'forming' : node.status;

    await supabase.from('unihub_nodes').update({ 
        passengers: newPassengers, 
        status: updatedStatus
    }).eq('id', nodeId);
    removeRideFromMyList(nodeId);
  };

  const forceQualify = async (nodeId: string) => {
    await supabase.from('unihub_nodes').update({ status: 'qualified' }).eq('id', nodeId);
  };

  const acceptRide = async (nodeId: string, driverId: string, customFare?: number) => {
    const driver = drivers.find(d => d.id === driverId);
    const node = nodes.find(n => n.id === nodeId);
    if (!driver || !node) return;

    // RULE: One active ride at a time
    const activeRide = nodes.find(n => n.assignedDriverId === driverId && n.status === 'dispatched');
    if (activeRide) {
        alert("Please complete your current active ride before accepting a new one.");
        return;
    }

    const totalCommission = settings.commissionPerSeat * node.passengers.length;

    // Check Balance
    if (driver.walletBalance < totalCommission) {
      alert(`Insufficient Credits! You need at least ₵${totalCommission.toFixed(2)} to accept this ride.`);
      return;
    }

    // Generate node-level fallback code
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Generate individual codes for each passenger
    const updatedPassengers = node.passengers.map(p => ({
        ...p,
        verificationCode: Math.floor(1000 + Math.random() * 9000).toString()
    }));

    // UPFRONT DEDUCTION LOGIC
    try {
        await Promise.all([
            supabase.from('unihub_nodes').update({ 
              status: 'dispatched', 
              assignedDriverId: driverId, 
              verificationCode, 
              passengers: updatedPassengers, 
              negotiatedTotalFare: customFare || node?.negotiatedTotalFare
            }).eq('id', nodeId),
            supabase.from('unihub_drivers').update({ 
                walletBalance: driver.walletBalance - totalCommission 
            }).eq('id', driverId),
            supabase.from('unihub_transactions').insert([{
                id: `TX-COMM-${Date.now()}`,
                driverId: driverId,
                amount: totalCommission,
                type: 'commission',
                timestamp: new Date().toLocaleString()
            }])
        ]);
    
        alert(customFare ? `Premium trip accepted at ₵${customFare}! Commission deducted.` : "Ride accepted! Commission deducted. Codes synced.");
    } catch (err: any) {
        console.error("Accept ride error:", err);
        alert("Failed to accept ride. Please try again.");
    }
  };

  const verifyRide = async (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Check master code OR passenger codes
    const isMasterCode = node.verificationCode === code;
    const passengerMatch = node.passengers.find(p => p.verificationCode === code);

    if (isMasterCode || passengerMatch) {
      // Driver verification logic - NO DEDUCTION HERE (already pre-paid)
      try {
        await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId);
        removeRideFromMyList(nodeId);
        
        const successMsg = passengerMatch 
            ? `Ride Verified! Passenger ${passengerMatch.name} confirmed.` 
            : `Ride verified and completed!`;
        
        alert(successMsg);
      } catch (err: any) {
        console.error("Verification error:", err);
        alert("Error closing ride. Contact Admin.");
      }
    } else {
      alert("Invalid Code! Ask the passenger for their Ride PIN.");
    }
  };

  const cancelRide = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    try {
      if (node.status === 'dispatched' && node.assignedDriverId) {
        // REFUND LOGIC
        const driver = drivers.find(d => d.id === node.assignedDriverId);
        if (driver) {
             const totalCommission = settings.commissionPerSeat * node.passengers.length;
             await Promise.all([
                 supabase.from('unihub_drivers').update({ 
                     walletBalance: driver.walletBalance + totalCommission 
                 }).eq('id', driver.id),
                 supabase.from('unihub_transactions').insert([{
                    id: `TX-REFUND-${Date.now()}`,
                    driverId: driver.id,
                    amount: totalCommission,
                    type: 'topup', // Use 'topup' type for refund credit
                    timestamp: new Date().toLocaleString()
                 }])
             ]);
        }

        const resetStatus = (node.isSolo || node.isLongDistance) ? 'qualified' : (node.passengers.length >= 4 ? 'qualified' : 'forming');
        // Clear verifications on reset
        const resetPassengers = node.passengers.map(p => {
            const { verificationCode, ...rest } = p;
            return rest;
        });

        const { error: resetErr } = await supabase.from('unihub_nodes').update({ 
          status: resetStatus, 
          assignedDriverId: null, 
          verificationCode: null,
          passengers: resetPassengers
        }).eq('id', nodeId);
        
        if (resetErr) throw resetErr;
        alert("Trip assignment reset. Commission refunded to partner.");
      } else {
        const { error: deleteErr } = await supabase.from('unihub_nodes').delete().eq('id', nodeId);
        if (deleteErr) throw deleteErr;
        removeRideFromMyList(nodeId);
        alert("Ride request removed.");
      }
    } catch (err: any) {
      console.error("Cancellation error:", err);
      alert("Failed to process request: " + (err.message || "Unknown error"));
    }
  };

  const settleNode = async (nodeId: string) => {
    if (confirm("Force complete this trip? (Assumes commission was prepaid or not applicable)")) {
      await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId);
      alert("Trip settled manually.");
    }
  };

  const requestTopup = async (driverId: string, amount: number, ref: string) => {
    if (!amount || !ref) {
      alert("Details missing.");
      return;
    }
    const req: TopupRequest = {
      id: `REQ-${Date.now()}`,
      driverId,
      amount: Number(amount),
      momoReference: ref,
      status: 'pending',
      timestamp: new Date().toLocaleString()
    };
    const { error } = await supabase.from('unihub_topups').insert([req]);
    if (error) {
      alert("Topup Request Failed: " + error.message);
    } else {
      alert("Credit request logged.");
    }
  };

  const requestRegistration = async (reg: Omit<RegistrationRequest, 'id' | 'status' | 'timestamp'>) => {
    const existingDriver = drivers.find(d => d.contact === reg.contact || d.licensePlate === reg.licensePlate);
    const existingReq = registrationRequests.find(r => (r.contact === reg.contact || r.licensePlate === reg.licensePlate) && r.status === 'pending');
    
    if (existingDriver) {
      alert("Error: This Partner or Vehicle is already registered with NexRyde.");
      return;
    }
    if (existingReq) {
      alert("Application Pending: You already have an onboarding request under review.");
      return;
    }

    const req: RegistrationRequest = {
      ...reg,
      id: `REG-${Date.now()}`,
      status: 'pending',
      timestamp: new Date().toLocaleString()
    };
    const { error } = await supabase.from('unihub_registrations').insert([req]);
    if (error) {
      console.error("Registration error:", error);
      alert("Submission Error: " + error.message);
    } else {
      alert("Application submitted! NexRyde Admin will review your details shortly.");
    }
  };

  const approveTopup = async (reqId: string) => {
    const req = topupRequests.find(r => r.id === reqId);
    if (!req || req.status !== 'pending') return;

    const driver = drivers.find(d => d.id === req.driverId);
    if (!driver) return;

    await Promise.all([
      supabase.from('unihub_drivers').update({ walletBalance: driver.walletBalance + req.amount }).eq('id', req.driverId),
      supabase.from('unihub_topups').update({ status: 'approved' }).eq('id', reqId),
      supabase.from('unihub_transactions').insert([{
        id: `TX-${Date.now()}`,
        driverId: req.driverId,
        amount: req.amount,
        type: 'topup',
        timestamp: new Date().toLocaleString()
      }])
    ]);
  };

  const rejectTopup = async (reqId: string) => {
    if(!confirm("Reject this top-up request?")) return;
    const { error } = await supabase.from('unihub_topups').update({ status: 'rejected' }).eq('id', reqId);
    if (error) alert("Failed to reject: " + error.message);
  };

  const approveRegistration = async (regId: string) => {
    const reg = registrationRequests.find(r => r.id === regId);
    if (!reg || reg.status !== 'pending') return;

    const newDriver: Driver = {
      id: `DRV-${Date.now()}`,
      name: reg.name,
      vehicleType: reg.vehicleType,
      licensePlate: reg.licensePlate,
      contact: reg.contact,
      pin: reg.pin,
      walletBalance: 0,
      rating: 5.0,
      status: 'online',
      avatarUrl: reg.avatarUrl
    };

    try {
      await Promise.all([
        supabase.from('unihub_drivers').insert([newDriver]),
        supabase.from('unihub_registrations').update({ status: 'approved' }).eq('id', regId),
        supabase.from('unihub_transactions').insert([{
          id: `TX-REG-${Date.now()}`,
          driverId: newDriver.id,
          amount: reg.amount,
          type: 'registration',
          timestamp: new Date().toLocaleString()
        }])
      ]);
      alert("Partner approved and activated!");
    } catch (err: any) {
      console.error("Approval error:", err);
      alert("Activation failed: " + err.message);
    }
  };

  const rejectRegistration = async (regId: string) => {
    if(!confirm("Reject this partner application?")) return;
    const { error } = await supabase.from('unihub_registrations').update({ status: 'rejected' }).eq('id', regId);
    if (error) alert("Failed to reject: " + error.message);
  };

  const registerDriver = async (d: Omit<Driver, 'id' | 'walletBalance' | 'rating' | 'status'>) => {
    const newDriver: Driver = {
      ...d,
      id: `DRV-${Date.now()}`,
      walletBalance: 0,
      rating: 5.0,
      status: 'online'
    };
    try {
      const { error } = await supabase.from('unihub_drivers').insert([newDriver]);
      if (error) throw error;
      alert(`Partner ${d.name} registered successfully!`);
    } catch (err: any) {
      console.error("Registration error:", err);
      alert(`Failed to register: ${err.message}.`);
    }
  };

  const deleteDriver = useCallback(async (id: string) => {
    const hasActiveMission = nodes.some(n => n.assignedDriverId === id && (n.status === 'qualified' || n.status === 'dispatched'));
    if (hasActiveMission) {
      alert("Cannot unregister partner with an active trip.");
      return;
    }

    await supabase.from('unihub_drivers').delete().eq('id', id);
    if (activeDriverId === id) {
      handleDriverLogout();
    }
  }, [nodes, activeDriverId]);

  const updateGlobalSettings = async (newSettings: AppSettings) => {
    const { id, ...data } = newSettings;
    await supabase.from('unihub_settings').upsert({ id: 1, ...data });
    alert("Settings Updated Successfully!");
  };

  const handleAdminAuth = async (email: string, pass: string) => {
    if (!email || !pass) return;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });

      if (error) throw error;
      
      if (data.session) {
        setSession(data.session);
        setIsAdminAuthenticated(true);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      alert("Access Denied: " + err.message);
    }
  };

  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    setIsAdminAuthenticated(false);
    setSession(null);
  };

  const handleDriverAuth = (driverId: string, pin: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver && driver.pin === pin) {
      setActiveDriverId(driverId);
      sessionStorage.setItem('nexryde_driver_session_v1', driverId);
      setViewMode('driver');
    } else {
      alert("Access Denied: Invalid Partner Password");
    }
  };

  const handleDriverLogout = () => {
    setActiveDriverId(null);
    sessionStorage.removeItem('nexryde_driver_session_v1');
    setViewMode('passenger');
  };

  const dismissWelcome = () => {
    setIsNewUser(false);
    localStorage.setItem('nexryde_seen_welcome_v1', 'true');
  };

  const handleDismissAnnouncement = () => {
    setDismissedAnnouncement('true');
    sessionStorage.setItem('nexryde_dismissed_announcement', 'true');
  };

  const safeSetViewMode = (mode: PortalMode) => {
    if (activeDriverId && mode !== 'driver') {
      if (confirm("Sign out of Driver Terminal?")) {
        handleDriverLogout();
      } else {
        return;
      }
    }
    setViewMode(mode);
  };

  // Handle AI unlocking logic
  const handleAiAccess = () => {
    if (isAiUnlocked) {
      setShowAiHelp(true);
    } else {
      setShowAiAd(true);
    }
  };

  const handleAiUnlock = () => {
    setIsAiUnlocked(true);
    setShowAiAd(false);
    setShowAiHelp(true);
  };

  // --- GATEWAY CHECK ---
  if (!currentUser) {
    return <HubGateway onIdentify={handleGlobalUserAuth} settings={settings} />;
  }

  return (
    <div 
      className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative"
      style={settings.appWallpaper ? {
        backgroundImage: `url(${settings.appWallpaper})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } : {}}
    >
      {settings.appWallpaper && (
        <div className="absolute inset-0 bg-[#020617]/70 pointer-events-none z-0"></div>
      )}

      {settings.hub_announcement && !dismissedAnnouncement && (
        <div className="fixed top-0 left-0 right-0 z-[400] bg-gradient-to-r from-amber-600 to-rose-600 px-4 py-3 flex items-center justify-between shadow-2xl animate-in slide-in-from-top duration-500 border-b border-white/10">
           <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <i className="fas fa-bullhorn text-white text-xs"></i>
              </div>
              <p className="text-[10px] sm:text-xs font-black uppercase italic text-white truncate tracking-tight">{settings.hub_announcement}</p>
           </div>
           <button onClick={handleDismissAnnouncement} className="ml-4 w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-white text-[10px] hover:bg-white/30 transition-all shrink-0">
             <i className="fas fa-times"></i>
           </button>
        </div>
      )}
      
      {isSyncing && (
        <div className={`fixed ${settings.hub_announcement && !dismissedAnnouncement ? 'top-20' : 'top-4'} right-4 z-[300] bg-amber-500/20 text-amber-500 px-4 py-2 rounded-full border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-2 transition-all`}>
           <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
           Live Syncing...
        </div>
      )}

      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            {settings.appLogo ? (
              <img src={settings.appLogo} className="w-12 h-12 object-contain rounded-xl bg-white/5 p-1 border border-white/10" alt="Logo" />
            ) : (
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl">
                <i className="fas fa-route text-[#020617] text-xl"></i>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white">NexRyde</h1>
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Transit Excellence</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => setShowQrModal(true)} title="NexRyde Code" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-amber-500 hover:bg-white/10 transition-all">
              <i className="fas fa-qrcode text-xs"></i>
            </button>
            <button onClick={() => setShowHelpModal(true)} title="Help Center" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-white/10 transition-all">
              <i className="fas fa-circle-question text-xs"></i>
            </button>
            <button onClick={() => setShowAboutModal(true)} title="Platform Info" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:bg-white/10 transition-all">
              <i className="fas fa-info-circle text-xs"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride Center" onClick={() => {safeSetViewMode('passenger'); setSearchConfig({...searchConfig, query: ''});}} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Partner Terminal" onClick={() => {safeSetViewMode('driver'); setSearchConfig({...searchConfig, query: ''});}} />
          {(isVaultAccess || isAdminAuthenticated) && (
            <NavItem 
              active={viewMode === 'admin'} 
              icon="fa-shield-halved" 
              label="Control Vault" 
              onClick={() => {safeSetViewMode('admin'); setSearchConfig({...searchConfig, query: ''});}} 
              badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
            />
          )}
          <NavItem active={false} icon="fa-share-nodes" label="Invite Others" onClick={shareHub} />
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-500 hover:bg-white/5 transition-all mt-4">
             <i className="fas fa-power-off text-lg w-6"></i>
             <span className="text-sm font-bold">Sign Out</span>
          </button>
        </div>

        <div className="pt-6 border-t border-white/5">
           {activeDriver ? (
             <div className="bg-indigo-500/10 p-6 rounded-[2.5rem] border border-indigo-500/20 relative overflow-hidden mb-4">
                <div className="flex items-center gap-3">
                  {activeDriver.avatarUrl ? (
                     <img src={activeDriver.avatarUrl} className="w-10 h-10 rounded-full object-cover border border-indigo-500/40" alt="Avatar" />
                  ) : (
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                      <i className="fas fa-user text-xs"></i>
                    </div>
                  )}
                  <div className="truncate">
                    <p className="text-[9px] font-black uppercase text-indigo-400 leading-none">Partner</p>
                    <p className="text-sm font-black text-white truncate">{activeDriver.name}</p>
                  </div>
                </div>
                <button onClick={handleDriverLogout} className="mt-4 w-full py-2 bg-indigo-600 rounded-xl text-[8px] font-black uppercase tracking-widest">Sign Out Hub</button>
             </div>
           ) : (
             <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 mb-4">
                <p className="text-[9px] font-black uppercase text-slate-500 leading-none">Identity</p>
                <p className="text-sm font-black text-white truncate mt-1">{currentUser.username}</p>
                <p className="text-[10px] text-slate-500 mt-1">{currentUser.phone}</p>
             </div>
           )}
          <div className="bg-emerald-500/10 p-6 rounded-[2.5rem] border border-emerald-500/20 relative overflow-hidden">
            <p className="text-[9px] font-black uppercase text-emerald-400 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Market Pulse
            </p>
            <div className="space-y-1">
               <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-white uppercase opacity-60 tracking-tight">Active Partners</p>
                  <p className="text-lg font-black text-white italic">{onlineDriverCount}</p>
               </div>
               <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-white uppercase opacity-60 tracking-tight">Open Trips</p>
                  <p className="text-lg font-black text-white italic">{activeNodeCount}</p>
               </div>
            </div>
          </div>
        </div>
      </nav>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around px-4">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride" onClick={() => safeSetViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Drive" onClick={() => safeSetViewMode('driver')} />
        {(isVaultAccess || isAdminAuthenticated) && (
          <MobileNavItem 
            active={viewMode === 'admin'} 
            icon="fa-shield-halved" 
            label="Admin" 
            onClick={() => safeSetViewMode('admin')} 
            badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
          />
        )}
        <MobileNavItem active={false} icon="fa-info-circle" label="About" onClick={() => setShowAboutModal(true)} />
      </nav>

      <main className={`flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar z-10 relative transition-all duration-500 ${settings.hub_announcement && !dismissedAnnouncement ? 'pt-24 lg:pt-28' : 'pt-4 lg:pt-12'}`}>
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
          
          {isNewUser && (
            <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
              <div className="relative z-10 flex items-center gap-6 text-center sm:text-left">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white text-2xl backdrop-blur-md shrink-0">
                   <i className="fas fa-sparkles"></i>
                </div>
                <div>
                   <h2 className="text-xl font-black uppercase italic leading-none text-white">Welcome to NexRyde</h2>
                   <p className="text-xs font-bold opacity-80 mt-1 uppercase tracking-tight text-indigo-100">Ready to move? Check out our quick start guide.</p>
                </div>
              </div>
              <div className="relative z-10 flex gap-3 w-full sm:w-auto">
                 <button onClick={() => setShowHelpModal(true)} className="flex-1 sm:flex-none px-6 py-3 bg-white text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl">Guide</button>
                 <button onClick={dismissWelcome} className="flex-1 sm:flex-none px-6 py-3 bg-indigo-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest">Let's Go</button>
              </div>
              <i className="fas fa-route absolute right-[-20px] top-[-20px] text-[150px] opacity-10 pointer-events-none rotate-12"></i>
            </div>
          )}

          {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
            <SearchHub searchConfig={searchConfig} setSearchConfig={setSearchConfig} portalMode={viewMode} />
          )}

          {viewMode === 'passenger' && (
            <PassengerPortal 
              currentUser={currentUser}
              nodes={nodes} 
              myRideIds={myRideIds}
              onAddNode={async (node: RideNode) => {
                try {
                  const { error } = await supabase.from('unihub_nodes').insert([node]);
                  if (error) throw error;
                  addRideToMyList(node.id);
                } catch (err: any) {
                  alert(`Failed to request ride: ${err.message}`);
                  throw err;
                }
              }} 
              onJoin={joinNode} 
              onLeave={leaveNode}
              onForceQualify={forceQualify} 
              onCancel={cancelRide} 
              drivers={drivers} 
              searchConfig={searchConfig} 
              settings={settings} 
              onShowQr={() => setShowQrModal(true)} 
              onShowAbout={() => setShowAboutModal(true)}
            />
          )}
          {viewMode === 'driver' && (
            <DriverPortal 
              drivers={drivers} 
              activeDriver={activeDriver}
              onLogin={handleDriverAuth}
              onLogout={handleDriverLogout}
              qualifiedNodes={nodes.filter(n => n.status === 'qualified')} 
              dispatchedNodes={nodes.filter(n => n.status === 'dispatched')}
              missions={missions}
              allNodes={nodes}
              onJoinMission={joinMission}
              onAccept={acceptRide}
              onVerify={verifyRide}
              onCancel={cancelRide}
              onRequestTopup={requestTopup}
              onRequestRegistration={requestRegistration}
              searchConfig={searchConfig}
              settings={settings}
            />
          )}
          {viewMode === 'admin' && (
            !isAdminAuthenticated ? (
              <AdminLogin onLogin={handleAdminAuth} />
            ) : (
              <AdminPortal 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                nodes={nodes} 
                setNodes={setNodes}
                drivers={drivers} 
                onAddDriver={registerDriver}
                onDeleteDriver={deleteDriver}
                onCancelRide={cancelRide}
                onSettleRide={settleNode}
                missions={missions}
                onCreateMission={async (m: HubMission) => await supabase.from('unihub_missions').insert([m])}
                onDeleteMission={async (id: string) => await supabase.from('unihub_missions').delete().eq('id', id)}
                transactions={transactions} 
                topupRequests={topupRequests}
                registrationRequests={registrationRequests}
                onApproveTopup={approveTopup}
                onRejectTopup={rejectTopup}
                onApproveRegistration={approveRegistration}
                onRejectRegistration={rejectRegistration}
                onLock={handleAdminLogout}
                searchConfig={searchConfig}
                settings={settings}
                onUpdateSettings={updateGlobalSettings}
                hubRevenue={hubRevenue}
                adminEmail={session?.user?.email}
              />
            )
          )}
        </div>
      </main>

      {/* Global AI Help Trigger */}
      <button 
        onClick={handleAiAccess}
        className="fixed bottom-24 right-6 lg:bottom-12 lg:right-12 w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl z-[100] hover:scale-110 transition-transform animate-bounce-slow"
      >
        <i className="fas fa-sparkles"></i>
      </button>

      {showAiAd && <AdGate onUnlock={handleAiUnlock} label="Launch AI Assistant" settings={settings} />}
      {showAiHelp && <AiHelpDesk onClose={() => setShowAiHelp(false)} settings={settings} />}

      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-sm:px-4 max-w-sm rounded-[3rem] p-10 space-y-8 animate-in zoom-in text-center border border-white/10">
              <div className="space-y-2">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">NexRyde Code</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Scan to access the platform</p>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl relative group">
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}&bgcolor=ffffff&color=020617&format=svg`} 
                   className="w-full aspect-square"
                   alt="NexRyde QR"
                 />
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setShowQrModal(false)} className="flex-1 py-4 bg-white/5 rounded-[1.5rem] font-black text-[10px] uppercase text-slate-400">Close</button>
                 <button onClick={shareHub} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl">Share Platform</button>
              </div>
           </div>
        </div>
      )}

      {showAboutModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-w-2xl rounded-[3rem] p-8 lg:p-12 space-y-8 animate-in zoom-in border border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                      <i className="fas fa-info-circle text-xl"></i>
                   </div>
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">NexRyde Manifesto</h3>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">Our Mission & Ethics</p>
                   </div>
                </div>
                <button onClick={() => setShowAboutModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                   <i className="fas fa-times"></i>
                </button>
              </div>
              {settings.aboutMeImages && settings.aboutMeImages.length > 0 && (
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                   {settings.aboutMeImages.map((img, i) => (
                     <div key={i} className="min-w-[280px] h-[180px] rounded-[2rem] overflow-hidden border border-white/10 shadow-xl shrink-0">
                        <img src={img} className="w-full h-full object-cover" alt="NexRyde Portfolio" />
                     </div>
                   ))}
                </div>
              )}
              <div className="space-y-6">
                 <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 relative overflow-hidden">
                    <i className="fas fa-quote-left absolute top-4 left-4 text-4xl text-emerald-500/10"></i>
                    <p className="text-sm lg:text-base font-medium italic text-slate-300 leading-relaxed relative z-10 whitespace-pre-wrap">{settings.aboutMeText}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-emerald-600/10 hover:border-emerald-500/30 transition-all group">
                       <i className="fab fa-whatsapp text-emerald-500 text-2xl group-hover:scale-110 transition-transform"></i>
                       <span className="text-[9px] font-black uppercase text-slate-500">Partner Support</span>
                    </a>
                    <button onClick={shareHub} className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-amber-600/10 hover:border-amber-500/30 transition-all group">
                       <i className="fas fa-share-nodes text-amber-500 text-2xl group-hover:scale-110 transition-transform"></i>
                       <span className="text-[9px] font-black uppercase text-slate-500">Share Platform</span>
                    </button>
                 </div>
              </div>
              <div className="pt-6 border-t border-white/5 text-center">
                 <button onClick={() => setShowAboutModal(false)} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Close Portfolio</button>
              </div>
           </div>
        </div>
      )}

      {showHelpModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-3xl rounded-[3rem] p-8 lg:p-12 space-y-10 animate-in zoom-in border border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                      <i className="fas fa-graduation-cap"></i>
                   </div>
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">NexRyde Help Center</h3>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Operational Standards v1.2</p>
                   </div>
                </div>
                <button onClick={() => setShowHelpModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                   <i className="fas fa-times"></i>
                </button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <HelpSection 
                   icon="fa-user-graduate" 
                   title="Rider Guide" 
                   color="text-amber-500"
                   points={[
                      "Request Ride: Start a pooled trip to split costs (4 seats max). Perfect for daily campus commutes.",
                      "Express Drop: Select 'Solo' for private transport. Dynamic pricing multipliers apply.",
                      "Ride PIN: Your 4-digit code is generated once a partner accepts. Only share it at destination.",
                      "Cancellations: Only the Trip Organizer (the one who created the ride) can delete a trip."
                   ]}
                />
                <HelpSection 
                   icon="fa-id-card-clip" 
                   title="Partner Guide" 
                   color="text-indigo-400"
                   points={[
                      "Hotspots: Station at these zones for higher ride volume. Small entry fees ensure exclusivity.",
                      "Credits: Your wallet balance allows you to accept trips. Fares are collected from riders directly.",
                      "Verification: Input the rider's PIN or scan their code to deduct NexRyde commission and finish.",
                      "Passwords: Use your Partner Password to log in. Keep it secure and private."
                   ]}
                />
                <HelpSection 
                   icon="fa-shield-check" 
                   title="Security Protocols" 
                   color="text-emerald-400"
                   points={[
                      "Authenticity: Partners must provide clear portraits and MoMo references during onboarding.",
                      "Ride Safety: Share ride details with friends using the built-in share feature.",
                      "Account: One NexRyde profile per user. Duplicate identities will be flagged by Admin.",
                      "Support: Use the official Partner Support line for any real-time disputes."
                   ]}
                />
             </div>
             <div className="pt-6 border-t border-white/5 flex justify-center">
                <button onClick={() => setShowHelpModal(false)} className="px-12 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest text-white hover:bg-white/10 transition-all">Acknowledge</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- QR SCANNER COMPONENT ---

const QrScanner = ({ onScan, onClose }: any) => {
  useEffect(() => {
    // Rely on global Html5QrcodeScanner from CDN script
    const scanner = new (window as any).Html5QrcodeScanner(
      "qr-reader", 
      { fps: 10, qrbox: 250, aspectRatio: 1.0 }, 
      false
    );
    
    scanner.render((decodedText: string) => {
      onScan(decodedText);
      scanner.clear();
    }, (error: any) => {
      // Ignore scan errors, they happen every frame
    });

    return () => {
      try {
        scanner.clear();
      } catch (e) {
        console.error("Scanner clear error", e);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-slate-900 rounded-3xl overflow-hidden border border-white/10 relative">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center">
          <i className="fas fa-times"></i>
        </button>
        <div className="p-4 bg-slate-900 text-center">
           <h3 className="text-white font-black uppercase text-sm">Scan Ride QR</h3>
        </div>
        <div id="qr-reader" className="w-full h-full bg-black"></div>
        <p className="text-center text-slate-500 text-[10px] p-4 font-bold uppercase tracking-widest">Align code within frame</p>
      </div>
    </div>
  );
};

// --- DRIVER PORTAL ---

function DriverPortal({ 
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
  onVerify, 
  onCancel, 
  onRequestTopup, 
  onRequestRegistration, 
  searchConfig, 
  settings 
}: any) {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [loginId, setLoginId] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [regData, setRegData] = useState({ name: '', contact: '', licensePlate: '', pin: '', vehicleType: 'Taxi' as VehicleType, momoReference: '', amount: settings.registrationFee, avatarUrl: '' });
  const [activeTab, setActiveTab] = useState('market');
  const [verifyCode, setVerifyCode] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupRef, setTopupRef] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [missionGate, setMissionGate] = useState<string | null>(null);

  useEffect(() => {
    setRegData(prev => ({ ...prev, amount: settings.registrationFee }));
  }, [settings.registrationFee]);

  const handleLoginSubmit = () => {
     const driver = drivers.find((d: any) => d.contact === loginId || d.id === loginId);
     if (driver) onLogin(driver.id, loginPin);
     else alert("Partner not found. Please check your credentials.");
  };

  const handleScan = (code: string) => {
    // If the scanned code is a URL (from QR server), extract the data param, otherwise assume it's the raw code
    let pin = code;
    try {
      const url = new URL(code);
      const data = url.searchParams.get('data');
      if (data) pin = data;
    } catch (e) {
      // Not a URL, use raw string
    }
    setVerifyCode(pin);
    setShowScanner(false);
  };

  const triggerMissionJoin = (missionId: string) => {
    setMissionGate(missionId);
  };

  const confirmMissionJoin = () => {
    if(missionGate) {
      onJoinMission(missionGate, activeDriver.id);
      setMissionGate(null);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 0.6, 400); // 400px width is enough for avatar
        setRegData({ ...regData, avatarUrl: compressed });
      } catch (err) {
        alert("Photo upload failed");
      }
    }
  };

  const handleRegistrationSubmit = () => {
    if (!regData.name || !regData.contact || !regData.licensePlate || !regData.pin || !regData.momoReference || !regData.avatarUrl) {
      alert("All fields including a profile photo are required for verification.");
      return;
    }
    onRequestRegistration(regData);
  };

  if (!activeDriver) {
    return (
      <div className="max-w-md mx-auto animate-in zoom-in">
         {view === 'login' ? (
           <div className="glass p-8 rounded-[2.5rem] space-y-6 border border-white/10">
              <div className="text-center">
                 <h2 className="text-2xl font-black italic uppercase text-white">Partner Access</h2>
                 <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">Authorized Drivers Only</p>
              </div>
              <input className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-amber-500" placeholder="Phone Number or Driver ID" value={loginId} onChange={e => setLoginId(e.target.value)} />
              <input type="password" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-amber-500" placeholder="Secure PIN" value={loginPin} onChange={e => setLoginPin(e.target.value)} />
              <button onClick={handleLoginSubmit} className="w-full py-4 bg-amber-500 text-[#020617] rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Access Terminal</button>
              <button onClick={() => setView('register')} className="w-full text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white">Apply to Drive</button>
           </div>
         ) : (
           <div className="glass p-8 rounded-[2.5rem] space-y-4 border border-white/10 max-h-[80vh] overflow-y-auto no-scrollbar">
              <div className="text-center">
                 <h2 className="text-2xl font-black italic uppercase text-white">Partner Application</h2>
                 <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">Join the fleet (Fee: ₵{settings.registrationFee})</p>
              </div>
              
              <div className="flex justify-center mb-4">
                 <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" id="driver-avatar-upload" />
                 <label htmlFor="driver-avatar-upload" className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group">
                    {regData.avatarUrl ? (
                        <img src={regData.avatarUrl} className="w-full h-full object-cover" />
                    ) : (
                        <>
                           <i className="fas fa-camera text-slate-500 mb-1"></i>
                           <span className="text-[8px] font-bold text-slate-500 uppercase">Photo</span>
                        </>
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fas fa-edit text-white"></i>
                    </div>
                 </label>
              </div>

              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-amber-500 text-xs" placeholder="Full Name" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-amber-500 text-xs" placeholder="Phone Contact" value={regData.contact} onChange={e => setRegData({...regData, contact: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                 <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-amber-500 text-xs" placeholder="License Plate" value={regData.licensePlate} onChange={e => setRegData({...regData, licensePlate: e.target.value})} />
                 <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-amber-500 text-xs" value={regData.vehicleType} onChange={e => setRegData({...regData, vehicleType: e.target.value as any})}><option value="Pragia">Pragia</option><option value="Taxi">Taxi</option><option value="Shuttle">Shuttle</option></select>
              </div>
              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-amber-500 text-xs" type="password" placeholder="Set a 4-digit PIN" value={regData.pin} onChange={e => setRegData({...regData, pin: e.target.value})} />
              <div className="p-4 bg-indigo-600/20 rounded-2xl border border-indigo-500/30 space-y-2">
                 <p className="text-[9px] font-bold text-indigo-300 uppercase">Send ₵{settings.registrationFee} to {settings.adminMomo} <span className="text-white">({settings.adminMomoName})</span></p>
                 <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-amber-500 text-xs" placeholder="MoMo Reference ID" value={regData.momoReference} onChange={e => setRegData({...regData, momoReference: e.target.value})} />
              </div>
              <button onClick={handleRegistrationSubmit} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Submit Application</button>
              <button onClick={() => setView('login')} className="w-full text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white">Back to Login</button>
           </div>
         )}
      </div>
    );
  }

  const myRides = dispatchedNodes.filter((n: any) => n.assignedDriverId === activeDriver.id);
  const marketRides = qualifiedNodes.filter((n: any) => 
    (searchConfig.vehicleType === 'All' || n.vehicleType === searchConfig.vehicleType) &&
    (n.origin.toLowerCase().includes(searchConfig.query.toLowerCase()) || n.destination.toLowerCase().includes(searchConfig.query.toLowerCase()))
  );

  return (
    <div className="space-y-6">
       {showScanner && <QrScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
       {missionGate && <AdGate onUnlock={confirmMissionJoin} label="Access Prime Hotspot" settings={settings} />}
       
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-emerald-500/10 p-4 rounded-3xl border border-emerald-500/20"><p className="text-[9px] font-black text-emerald-400 uppercase">Wallet</p><p className="text-xl font-black text-white">₵ {activeDriver.walletBalance.toFixed(2)}</p></div>
          <div className="bg-indigo-500/10 p-4 rounded-3xl border border-indigo-500/20"><p className="text-[9px] font-black text-indigo-400 uppercase">Rating</p><p className="text-xl font-black text-white">{activeDriver.rating} ★</p></div>
          <div className="bg-amber-500/10 p-4 rounded-3xl border border-amber-500/20"><p className="text-[9px] font-black text-amber-500 uppercase">Active Job</p><p className="text-xl font-black text-white">{myRides.length > 0 ? 'On Route' : 'Idle'}</p></div>
       </div>

       <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
          {['market', 'active', 'missions', 'wallet'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[80px] py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>{tab} {tab === 'active' && myRides.length > 0 && `(${myRides.length})`}</button>
          ))}
       </div>

       <div className="min-h-[300px]">
          {activeTab === 'market' && (
             <div className="space-y-4">
                {marketRides.length === 0 && <p className="text-center text-slate-500 py-10 font-black uppercase text-[10px]">No rides available</p>}
                {marketRides.map((node: any, index: number) => (
                   <React.Fragment key={node.id}>
                   <div className="glass p-6 rounded-[2rem] border border-white/5 relative">
                      <div className="flex justify-between items-start mb-4">
                         <div><span className="px-3 py-1 bg-amber-500/20 text-amber-500 rounded-lg text-[8px] font-black uppercase">{node.vehicleType}</span><span className="ml-2 px-3 py-1 bg-white/5 text-slate-400 rounded-lg text-[8px] font-black uppercase">{node.isSolo ? 'Solo' : 'Pool'}</span></div>
                         <p className="text-xl font-black text-amber-500">₵ {node.negotiatedTotalFare || (node.farePerPerson * node.passengers.length)}</p>
                      </div>
                      <div className="space-y-2 mb-4"><div className="flex gap-2 text-sm font-bold text-white"><i className="fas fa-location-dot mt-1 text-slate-500"></i> {node.origin}</div><div className="flex gap-2 text-sm font-bold text-white"><i className="fas fa-flag-checkered mt-1 text-slate-500"></i> {node.destination}</div></div>
                      <button 
                        onClick={() => { if(confirm(`Accept trip near ${node.origin}?`)) onAccept(node.id, activeDriver.id); }} 
                        disabled={myRides.length > 0}
                        className={`w-full py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:scale-[1.02] transition-transform ${myRides.length > 0 ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-amber-500 text-[#020617]'}`}
                      >
                          {myRides.length > 0 ? 'Complete Active Job First' : 'Accept Ride'}
                      </button>
                   </div>
                   {/* Insert Ad after every 3rd item */}
                   {(index + 1) % 3 === 0 && <InlineAd settings={settings} />}
                   </React.Fragment>
                ))}
             </div>
          )}
          
          {activeTab === 'active' && (
             <div className="space-y-4">
                {myRides.length === 0 && <p className="text-center text-slate-500 py-10 font-black uppercase text-[10px]">No active jobs</p>}
                {myRides.map((node: any) => (
                   <div key={node.id} className="glass p-6 rounded-[2rem] border border-indigo-500/30 bg-indigo-900/10">
                      <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-black italic uppercase text-white">Current Trip</h3><a href={`tel:${node.leaderPhone}`} className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><i className="fas fa-phone"></i></a></div>
                      <div className="bg-black/20 p-4 rounded-xl mb-4 space-y-2">
                         <div className="flex justify-between text-xs font-bold text-slate-300"><span>Passenger:</span> <span className="text-white">{node.leaderName}</span></div>
                         <div className="flex justify-between text-xs font-bold text-slate-300"><span>Route:</span> <span className="text-white">{node.origin} → {node.destination}</span></div>
                         <div className="flex justify-between text-xs font-bold text-slate-300"><span>Fare:</span> <span className="text-emerald-400">₵ {node.negotiatedTotalFare || (node.farePerPerson * node.passengers.length)}</span></div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => setShowScanner(true)} className="w-12 bg-white/10 rounded-xl flex items-center justify-center text-white border border-white/10 hover:bg-white/20"><i className="fas fa-qrcode"></i></button>
                         <input className="flex-1 bg-white/10 border border-white/10 rounded-xl p-3 text-center text-white font-black tracking-[0.5em] outline-none focus:border-indigo-500" placeholder="PIN" maxLength={4} value={verifyCode} onChange={e => setVerifyCode(e.target.value.trim())} />
                      </div>
                      <div className="flex gap-2 mt-3">
                         <button onClick={() => { if(confirm("Cancel job? Commission will be refunded, but rating may be affected.")) onCancel(node.id); }} className="flex-1 py-3 bg-rose-500/10 text-rose-500 rounded-xl font-black text-[10px] uppercase">Cancel & Refund</button>
                         <button onClick={() => onVerify(node.id, verifyCode)} className="flex-[2] py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Verify Complete</button>
                      </div>
                   </div>
                ))}
             </div>
          )}

          {activeTab === 'missions' && (
             <div className="space-y-4">
                {missions.map((m: any) => (
                   <div key={m.id} className="glass p-6 rounded-[2rem] border border-white/10 relative overflow-hidden">
                      <div className="flex justify-between items-start relative z-10">
                         <div><h3 className="text-lg font-black uppercase text-white">{m.location}</h3><p className="text-xs text-slate-400">{m.description}</p></div>
                         <div className="text-right"><p className="text-xl font-black text-indigo-400">Fee: ₵{m.entryFee}</p><p className="text-[9px] text-slate-500 font-bold uppercase">{m.driversJoined.length} Drivers Here</p></div>
                      </div>
                      <button onClick={() => triggerMissionJoin(m.id)} disabled={m.driversJoined.includes(activeDriver.id)} className="mt-4 w-full py-3 bg-white/10 border border-white/10 hover:bg-indigo-600 hover:border-indigo-500 text-white rounded-xl font-black text-[10px] uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {m.driversJoined.includes(activeDriver.id) ? 'Stationed' : <>Join Hotspot <i className="fas fa-lock text-[8px] opacity-70"></i></>}
                      </button>
                   </div>
                ))}
             </div>
          )}

          {activeTab === 'wallet' && (
             <div className="glass p-8 rounded-[2rem] border border-white/10 space-y-6">
                 <h3 className="text-xl font-black italic uppercase text-white">Top-up Credits</h3>
                 <InlineAd settings={settings} />
                 <div className="p-4 bg-indigo-600/20 rounded-2xl border border-indigo-500/30"><p className="text-[10px] font-bold text-indigo-300 uppercase mb-2">Instructions</p><p className="text-xs text-slate-300">Send amount to <span className="text-white font-bold">{settings.adminMomo}</span> ({settings.adminMomoName}). Enter reference below.</p></div>
                 <div className="space-y-3">
                    <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-amber-500 text-xs" type="number" placeholder="Amount (₵)" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
                    <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-amber-500 text-xs" placeholder="MoMo Reference ID" value={topupRef} onChange={e => setTopupRef(e.target.value)} />
                    <button onClick={() => { onRequestTopup(activeDriver.id, parseFloat(topupAmount), topupRef); setTopupAmount(''); setTopupRef(''); }} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl">Request Top-up</button>
                 </div>
             </div>
          )}
       </div>
    </div>
  );
}

// --- ADMIN PORTAL ---

function AdminPortal({ 
  activeTab, 
  setActiveTab, 
  nodes, 
  setNodes, 
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
  searchConfig, 
  settings, 
  onUpdateSettings, 
  hubRevenue, 
  adminEmail 
}: any) {
  const [newMission, setNewMission] = useState<Partial<HubMission>>({
    location: '', description: '', entryFee: 5
  });

  const [editSettings, setEditSettings] = useState<AppSettings>(settings);
  const [uploadingField, setUploadingField] = useState<'appWallpaper' | 'aboutMeImages' | 'appLogo' | null>(null);

  useEffect(() => {
    // Only update local editSettings if we just loaded the ID for the first time
    // This prevents background syncs from overwriting local edits
    if (settings.id && !editSettings.id) {
      setEditSettings(settings);
    }
  }, [settings]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'appWallpaper' | 'aboutMeImages' | 'appLogo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Fix: Clear input value so selecting the same file triggers onChange again
    e.target.value = '';

    setUploadingField(field);
    try {
      const compressed = await compressImage(file, 0.6, 800);
      if (field === 'appWallpaper') {
        setEditSettings(prev => ({ ...prev, appWallpaper: compressed }));
      } else if (field === 'appLogo') {
        setEditSettings(prev => ({ ...prev, appLogo: compressed }));
      } else {
        setEditSettings(prev => ({ ...prev, aboutMeImages: [...(prev.aboutMeImages || []), compressed] }));
      }
    } catch (err) {
      alert("Image upload failed");
    } finally {
      setUploadingField(null);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...editSettings.aboutMeImages];
    newImages.splice(index, 1);
    setEditSettings({ ...editSettings, aboutMeImages: newImages });
  };

  return (
    <div className="space-y-8 animate-in fade-in">
       <div className="flex justify-between items-center">
          <div><h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Admin Vault</h2><p className="text-slate-500 text-[10px] font-black uppercase mt-1">Logged in as {adminEmail}</p></div>
          <button onClick={onLock} className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-xl"><i className="fas fa-lock"></i></button>
       </div>

       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-emerald-500/10 p-4 rounded-3xl border border-emerald-500/20"><p className="text-[9px] font-black text-emerald-400 uppercase">Hub Revenue</p><p className="text-xl font-black text-white">₵ {hubRevenue.toFixed(2)}</p></div>
          <div className="bg-indigo-500/10 p-4 rounded-3xl border border-indigo-500/20"><p className="text-[9px] font-black text-indigo-400 uppercase">Total Rides</p><p className="text-xl font-black text-white">{nodes.length}</p></div>
          <div className="bg-amber-500/10 p-4 rounded-3xl border border-amber-500/20"><p className="text-[9px] font-black text-amber-500 uppercase">Fleet Size</p><p className="text-xl font-black text-white">{drivers.length}</p></div>
       </div>

       <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
          {['monitor', 'fleet', 'requests', 'missions', 'settings'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[80px] py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>{tab}</button>
          ))}
       </div>

       <div className="min-h-[400px]">
          {activeTab === 'monitor' && (
             <div className="space-y-4">
                {nodes.length === 0 && <p className="text-center text-slate-500">No trip history.</p>}
                {nodes.map((n: any) => (
                   <div key={n.id} className="glass p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                      <div><p className="text-xs font-bold text-white uppercase">{n.origin} → {n.destination}</p><p className="text-[9px] text-slate-500 font-bold uppercase">{n.status} • {n.passengers.length} Pax</p></div>
                      <div className="flex gap-2">
                         <button onClick={() => onSettleRide(n.id)} className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-[8px] font-black uppercase">Settle</button>
                         <button onClick={() => onCancelRide(n.id)} className="px-3 py-2 bg-rose-500/20 text-rose-500 rounded-lg text-[8px] font-black uppercase">Delete</button>
                      </div>
                   </div>
                ))}
             </div>
          )}

          {activeTab === 'fleet' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {drivers.map((d: any) => (
                   <div key={d.id} className="glass p-6 rounded-[2rem] border border-white/10 relative">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="w-10 h-10 rounded-full bg-white/5 overflow-hidden border border-white/10 shrink-0">
                            {d.avatarUrl ? <img src={d.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-indigo-600 text-white font-black">{d.name[0]}</div>}
                         </div>
                         <div><p className="text-white font-bold">{d.name}</p><p className="text-[10px] text-slate-500 uppercase">{d.licensePlate} • {d.vehicleType}</p></div>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl mb-4"><p className="text-xs font-bold text-slate-400">Wallet Balance</p><p className="text-lg font-black text-white">₵ {d.walletBalance.toFixed(2)}</p></div>
                      <button onClick={() => onDeleteDriver(d.id)} className="w-full py-3 bg-rose-600/10 text-rose-500 rounded-xl font-black text-[10px] uppercase hover:bg-rose-600 hover:text-white transition-all">Remove Partner</button>
                   </div>
                ))}
             </div>
          )}

          {activeTab === 'requests' && (
             <div className="space-y-8">
                <div>
                   <h3 className="text-xs font-black uppercase text-slate-500 mb-4 tracking-widest">Top-up Requests</h3>
                   {topupRequests.filter((r: any) => r.status === 'pending').map((r: any) => (
                      <div key={r.id} className="glass p-4 rounded-2xl border border-white/5 flex justify-between items-center mb-2">
                         <div><p className="text-white font-bold">₵ {r.amount}</p><p className="text-[9px] text-slate-500 uppercase">Ref: {r.momoReference}</p></div>
                         <div className="flex gap-2">
                            <button onClick={() => onRejectTopup(r.id)} className="px-3 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors rounded-xl font-black text-[9px] uppercase">Reject</button>
                            <button onClick={() => onApproveTopup(r.id)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase shadow-lg">Approve</button>
                         </div>
                      </div>
                   ))}
                </div>
                <div>
                   <h3 className="text-xs font-black uppercase text-slate-500 mb-4 tracking-widest">Onboarding Applications</h3>
                   {registrationRequests.filter((r: any) => r.status === 'pending').map((r: any) => (
                      <div key={r.id} className="glass p-6 rounded-[2rem] border border-white/10 mb-4 space-y-4">
                         <div className="flex gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 overflow-hidden shrink-0 border border-white/10">
                               {r.avatarUrl ? <img src={r.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><i className="fas fa-user text-slate-500"></i></div>}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between mb-1"><h4 className="font-bold text-white text-lg">{r.name}</h4><span className="px-2 py-1 bg-white/10 rounded-lg text-[8px] text-slate-400 uppercase h-fit">{r.vehicleType}</span></div>
                              <p className="text-xs text-slate-400">Phone: {r.contact}</p><p className="text-xs text-slate-400">Plate: {r.licensePlate}</p>
                            </div>
                         </div>
                         <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"><p className="text-[9px] font-bold text-emerald-400 uppercase">Paid: ₵{r.amount} (Ref: {r.momoReference})</p></div>
                         <div className="flex gap-2 mt-2">
                            <button onClick={() => onRejectRegistration(r.id)} className="flex-1 py-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors rounded-xl font-black text-[10px] uppercase">Reject</button>
                            <button onClick={() => onApproveRegistration(r.id)} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Approve Partner</button>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}

          {activeTab === 'missions' && (
             <div className="space-y-6">
                <div className="glass p-6 rounded-[2rem] border border-white/10 space-y-3 bg-indigo-900/10">
                   <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-2">Launch New Mission</h3>
                   <div className="grid grid-cols-2 gap-3">
                      <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" placeholder="Location (e.g. Main Gate)" value={newMission.location} onChange={e => setNewMission({...newMission, location: e.target.value})} />
                      <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" type="number" placeholder="Entry Fee (₵)" value={newMission.entryFee} onChange={e => setNewMission({...newMission, entryFee: parseFloat(e.target.value)})} />
                   </div>
                   <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" placeholder="Description / Strategy" value={newMission.description} onChange={e => setNewMission({...newMission, description: e.target.value})} />
                   <button onClick={() => {
                      if(!newMission.location) return;
                      onCreateMission({
                         id: `MISS-${Date.now()}`,
                         ...newMission,
                         driversJoined: [],
                         status: 'open',
                         createdAt: new Date().toISOString()
                      });
                      setNewMission({location: '', description: '', entryFee: 5});
                   }} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Deploy Mission</button>
                </div>
                <div className="space-y-3">
                   {missions.map((m: any) => (
                      <div key={m.id} className="glass p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                         <div>
                            <p className="text-white font-bold">{m.location}</p>
                            <p className="text-[9px] text-slate-500 uppercase">{m.driversJoined.length} Agents • Fee: ₵{m.entryFee}</p>
                         </div>
                         <button onClick={() => onDeleteMission(m.id)} className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-trash text-xs"></i></button>
                      </div>
                   ))}
                </div>
             </div>
          )}

          {activeTab === 'settings' && (
             <div className="glass p-8 rounded-[2rem] border border-white/10 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Financials</h3>
                      <div className="grid grid-cols-2 gap-3 mb-2 bg-white/5 p-3 rounded-xl col-span-2">
                         <div className="col-span-1">
                           <label className="text-[8px] text-slate-500 uppercase font-bold">Admin MoMo Number</label>
                           <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs" value={editSettings.adminMomo} onChange={e => setEditSettings({...editSettings, adminMomo: e.target.value})} />
                         </div>
                         <div className="col-span-1">
                           <label className="text-[8px] text-slate-500 uppercase font-bold">Account Name</label>
                           <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs" value={editSettings.adminMomoName} onChange={e => setEditSettings({...editSettings, adminMomoName: e.target.value})} />
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div><label className="text-[8px] text-slate-500 uppercase font-bold">Pragia</label><input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs" type="number" value={editSettings.farePerPragia} onChange={e => setEditSettings({...editSettings, farePerPragia: parseFloat(e.target.value)})} /></div>
                         <div><label className="text-[8px] text-slate-500 uppercase font-bold">Taxi</label><input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs" type="number" value={editSettings.farePerTaxi} onChange={e => setEditSettings({...editSettings, farePerTaxi: parseFloat(e.target.value)})} /></div>
                         <div><label className="text-[8px] text-slate-500 uppercase font-bold">Comm.</label><input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs" type="number" value={editSettings.commissionPerSeat} onChange={e => setEditSettings({...editSettings, commissionPerSeat: parseFloat(e.target.value)})} /></div>
                         <div><label className="text-[8px] text-slate-500 uppercase font-bold">Reg Fee</label><input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs" type="number" value={editSettings.registrationFee} onChange={e => setEditSettings({...editSettings, registrationFee: parseFloat(e.target.value)})} /></div>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visuals</h3>
                      <div>
                         <label className="text-[8px] text-slate-500 uppercase font-bold mb-1 block">App Logo</label>
                         <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'appLogo')} className="hidden" id="logo-upload" />
                         <label htmlFor="logo-upload" className="w-full h-20 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 transition-all bg-center bg-contain bg-no-repeat mb-4 relative overflow-hidden" style={editSettings.appLogo ? {backgroundImage: `url(${editSettings.appLogo})`} : {}}>
                            {uploadingField === 'appLogo' ? (
                               <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-black uppercase text-white animate-pulse">Compressing...</div>
                            ) : !editSettings.appLogo && (
                               <><i className="fas fa-camera text-slate-500 mb-1"></i><span className="text-[8px] font-bold text-slate-600 uppercase">Upload Logo</span></>
                            )}
                         </label>
                         {editSettings.appLogo && <button onClick={() => setEditSettings({...editSettings, appLogo: ''})} className="text-[8px] text-rose-500 uppercase font-bold underline mb-4">Remove Logo</button>}

                         <label className="text-[8px] text-slate-500 uppercase font-bold mb-1 block">App Wallpaper</label>
                         <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'appWallpaper')} className="hidden" id="wallpaper-upload" />
                         <label htmlFor="wallpaper-upload" className="w-full h-20 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 transition-all bg-center bg-cover relative overflow-hidden" style={editSettings.appWallpaper ? {backgroundImage: `url(${editSettings.appWallpaper})`} : {}}>
                            {uploadingField === 'appWallpaper' ? (
                               <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-black uppercase text-white animate-pulse">Compressing...</div>
                            ) : !editSettings.appWallpaper && (
                               <><i className="fas fa-image text-slate-500 mb-1"></i><span className="text-[8px] font-bold text-slate-600 uppercase">Upload BG</span></>
                            )}
                         </label>
                         {editSettings.appWallpaper && <button onClick={() => setEditSettings({...editSettings, appWallpaper: ''})} className="mt-1 text-[8px] text-rose-500 uppercase font-bold underline">Remove Wallpaper</button>}
                      </div>
                   </div>
                </div>

                <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                    <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3">Google AdSense Configuration</h3>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="col-span-2">
                          <label className="text-[8px] text-slate-500 uppercase font-bold">Status</label>
                          <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs" value={editSettings.adSenseStatus || 'inactive'} onChange={e => setEditSettings({...editSettings, adSenseStatus: e.target.value as any})}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                       </div>
                       <div>
                          <label className="text-[8px] text-slate-500 uppercase font-bold">Client ID (ca-pub-xxx)</label>
                          <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs" placeholder="ca-pub-..." value={editSettings.adSenseClientId || ''} onChange={e => setEditSettings({...editSettings, adSenseClientId: e.target.value})} />
                       </div>
                       <div>
                          <label className="text-[8px] text-slate-500 uppercase font-bold">Slot ID (Numeric)</label>
                          <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs" placeholder="9489..." value={editSettings.adSenseSlotId || ''} onChange={e => setEditSettings({...editSettings, adSenseSlotId: e.target.value})} />
                       </div>
                       <div className="col-span-2">
                          <label className="text-[8px] text-slate-500 uppercase font-bold">Layout Key (-fb+...)</label>
                          <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs" placeholder="-fb+5w+4e-db+86" value={editSettings.adSenseLayoutKey || ''} onChange={e => setEditSettings({...editSettings, adSenseLayoutKey: e.target.value})} />
                       </div>
                    </div>
                </div>

                <div>
                   <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Portfolio Gallery</h3>
                   <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'aboutMeImages')} className="hidden" id="portfolio-upload" disabled={uploadingField !== null} />
                      <label htmlFor="portfolio-upload" className={`w-24 h-24 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 transition-all shrink-0 ${uploadingField !== null ? 'opacity-50 cursor-not-allowed' : ''}`}>
                         {uploadingField === 'aboutMeImages' ? (
                             <i className="fas fa-spinner fa-spin text-indigo-500"></i>
                         ) : (
                             <><i className="fas fa-plus text-slate-500 mb-1"></i><span className="text-[8px] font-bold text-slate-600 uppercase">Add</span></>
                         )}
                      </label>
                      {editSettings.aboutMeImages?.map((img, i) => (
                         <div key={i} className="w-24 h-24 rounded-xl overflow-hidden relative shrink-0 group border border-white/10">
                            <img src={img} className="w-full h-full object-cover" />
                            <button onClick={() => removeImage(i)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"><i className="fas fa-trash"></i></button>
                         </div>
                      ))}
                   </div>
                </div>

                <div>
                   <label className="text-[9px] text-slate-500 uppercase font-bold">Announcement Banner</label>
                   <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs mt-1" placeholder="Message..." value={editSettings.hub_announcement || ''} onChange={e => setEditSettings({...editSettings, hub_announcement: e.target.value})} />
                </div>
                <div>
                   <label className="text-[9px] text-slate-500 uppercase font-bold">About Text</label>
                   <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs h-24 mt-1" value={editSettings.aboutMeText} onChange={e => setEditSettings({...editSettings, aboutMeText: e.target.value})} />
                </div>
                <button onClick={() => onUpdateSettings(editSettings)} disabled={uploadingField !== null} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                   {uploadingField !== null ? 'Processing...' : 'Save Changes'}
                </button>
             </div>
          )}
       </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
