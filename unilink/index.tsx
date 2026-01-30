
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
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

interface UniUser {
  id: string;
  username: string;
  phone: string;
}

interface Passenger {
  id: string;
  name: string;
  phone: string;
}

interface HubMission {
  id: string;
  location: string;
  description: string;
  entryFee: number;
  driversJoined: string[]; 
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
  aboutMeImages: string[];
  appWallpaper?: string;
  registrationFee: number;
}

// --- UTILS ---

const shareHub = async () => {
  const shareData = {
    title: 'UniHub Dispatch',
    text: 'Join the smartest ride-sharing hub on campus! Form groups, save costs, and move fast.',
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
    ? `🚀 *UniHub Long Distance!* \n📍 *From:* ${node.origin}\n📍 *To:* ${node.destination}\n🚕 *Bids open for Drivers!*`
    : node.isSolo 
    ? `🚀 *UniHub Dropping!* \n📍 *Route:* ${node.origin} → ${node.destination}\n🚕 *Solo Request* needs a driver!`
    : `🚀 *Ride Hub Alert!*\n📍 *Route:* ${node.origin} → ${node.destination}\n👥 *Seats Left:* ${seatsLeft}\n💰 *Price:* ₵${node.farePerPerson}/p\n\nJoin my ride node on UniHub! 👇\n${window.location.origin}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'UniHub Ride Update',
        text: message,
        url: window.location.origin
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  } catch (err) {
    console.log('Node share failed', err);
  }
};

const compressImage = (file: File, quality = 0.7, maxWidth = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = maxWidth; 
        const MAX_HEIGHT = maxWidth;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
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

const HubGateway = ({ onIdentify }: { onIdentify: (u: string, p: string) => void }) => {
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
      <div className="max-w-md w-full glass p-10 rounded-[3rem] border border-white/10 space-y-8 animate-in zoom-in">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl mb-4">
            <i className="fas fa-route text-slate-900 text-3xl"></i>
          </div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">UniHub</h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Campus Logistics Network</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Username</label>
            <input 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500" 
              placeholder="e.g. Kwame_99"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-2">WhatsApp Phone</label>
            <input 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500" 
              placeholder="024 XXX XXXX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
        </div>
        <button 
          onClick={() => onIdentify(username, phone)}
          className="w-full py-5 bg-amber-500 text-[#020617] rounded-2xl font-black uppercase text-xs shadow-2xl hover:scale-105 transition-transform"
        >
          Enter the Hub
        </button>
      </div>
    </div>
  );
};

const AdminLogin = ({ onLogin }: { onLogin: (e: string, p: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div className="max-w-md mx-auto glass p-10 rounded-[3rem] border border-white/10 space-y-8 animate-in zoom-in">
      <div className="text-center">
        <div className="w-16 h-16 bg-rose-600/10 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-4 border border-rose-500/20">
          <i className="fas fa-shield-halved text-2xl"></i>
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic">Vault Access</h2>
      </div>
      <div className="space-y-4">
        <input 
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-rose-500" 
          placeholder="Admin Email" 
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input 
          type="password"
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-rose-500" 
          placeholder="Access Key" 
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>
      <button 
        onClick={() => onLogin(email, password)}
        className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl"
      >
        Decrypt Access
      </button>
    </div>
  );
};

const RideCard = ({ node, drivers, onJoin, onCancel, setJoinModalNodeId, isPriority }: any) => {
  const seatsLeft = node.capacityNeeded - node.passengers.length;
  const isFull = seatsLeft <= 0;
  const driver = drivers.find((d: any) => d.id === node.assignedDriverId);

  return (
    <div className={`glass p-8 rounded-[2.5rem] border relative overflow-hidden group transition-all ${isPriority ? 'border-indigo-500/30' : 'border-white/5'} hover:border-white/10`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${node.status === 'forming' ? 'bg-amber-500 animate-pulse' : node.status === 'qualified' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{node.status}</span>
          </div>
          <h4 className="text-xl font-black text-white uppercase italic leading-tight truncate max-w-[150px]">{node.destination}</h4>
          <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">From: {node.origin}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-white italic leading-none">₵{node.farePerPerson}</p>
          <p className="text-[8px] font-black text-slate-500 uppercase mt-1">Per Seat</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2">
            {node.passengers.map((p: any, i: number) => (
              <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#020617] flex items-center justify-center text-[10px] font-black text-white" title={p.name}>
                {p.name[0]}
              </div>
            ))}
            {!isFull && Array.from({ length: seatsLeft }).map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-[10px] text-slate-700">
                <i className="fas fa-plus"></i>
              </div>
            ))}
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase">{isFull ? 'FULL' : `${seatsLeft} LEFT`}</span>
        </div>

        {node.status === 'dispatched' && driver && (
          <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 flex items-center gap-4">
            {driver.avatarUrl ? (
              <img src={driver.avatarUrl} className="w-10 h-10 rounded-xl object-cover" alt="Driver" />
            ) : (
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                <i className="fas fa-id-card"></i>
              </div>
            )}
            <div>
              <p className="text-[9px] font-black uppercase text-indigo-400">Assigned Driver</p>
              <p className="text-xs font-black text-white">{driver.name}</p>
              <p className="text-[8px] text-slate-500 uppercase">{driver.licensePlate}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {!isFull && node.status === 'forming' && (
            <button 
              onClick={() => setJoinModalNodeId(node.id)} 
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase text-white transition-all"
            >
              Join Node
            </button>
          )}
          <button 
            onClick={() => shareNode(node)} 
            className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/10"
          >
            <i className="fas fa-share-nodes"></i>
          </button>
          <button 
            onClick={() => { if(confirm("Cancel this request?")) onCancel(node.id); }} 
            className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-500 transition-all border border-rose-500/20 group-hover:opacity-100"
          >
            <i className="fas fa-trash-can"></i>
          </button>
        </div>
        
        {node.verificationCode && (
           <div className="pt-4 border-t border-white/5 text-center">
              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Move Code</p>
              <p className="text-2xl font-black text-white tracking-[0.5em]">{node.verificationCode}</p>
           </div>
        )}
      </div>
    </div>
  );
};

const AiHelpDesk = ({ onClose, settings }: any) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // Corrected extracting text output from GenerateContentResponse
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
          systemInstruction: `You are the UniHub Dispatch Assistant. 
          The Hub is a student ride-sharing app.
          Fares: Pragia is ₵${settings.farePerPragia}, Taxi is ₵${settings.farePerTaxi}.
          Solo multiplier is ${settings.soloMultiplier}x.
          Commission per seat is ₵${settings.commissionPerSeat}.
          Drivers must verify a 4-digit code from passengers to finish a ride.
          Be helpful, concise, and professional. Use emojis sparingly.`
        }
      });
      setMessages(prev => [...prev, { role: 'assistant', content: response.text || "AI response error." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Hub AI offline." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[300] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#020617] rounded-[3rem] border border-white/10 flex flex-col h-[85vh] relative overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-white/5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20 animate-pulse">
              <i className="fas fa-sparkles"></i>
            </div>
            <div>
              <h3 className="text-xl font-black italic uppercase text-white leading-none">Hub AI Assistant</h3>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Real-time Logistics Help</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-6 rounded-[2rem] text-sm font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-200 rounded-tl-none'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/5 p-6 rounded-[2rem] rounded-tl-none flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-white/5 shrink-0">
          <div className="relative">
            <input 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-20 text-white outline-none focus:border-indigo-500" 
              placeholder="Ask about fares, rules..." 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} className="absolute right-2 top-2 bottom-2 px-6 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Send</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const HelpSection = ({ icon, title, points, color }: any) => (
  <div className="space-y-4">
     <div className="flex items-center gap-3">
        <i className={`fas ${icon} ${color} text-sm`}></i>
        <h4 className="font-black uppercase text-xs tracking-widest text-slate-300">{title}</h4>
     </div>
     <ul className="space-y-3">
        {points.map((p: string, i: number) => (
           <li key={i} className="flex items-start gap-3 group">
              <span className="w-1 h-1 rounded-full bg-slate-700 mt-2 shrink-0 group-hover:bg-indigo-500 transition-colors"></span>
              <p className="text-[11px] font-medium text-slate-400 leading-relaxed italic">{p}</p>
           </li>
        ))}
     </ul>
  </div>
);

const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${active ? 'bg-amber-500 text-[#020617] shadow-xl' : 'text-slate-400 hover:bg-white/5'}`}>
    <div className="flex items-center space-x-4">
      <i className={`fas ${icon} text-lg w-6`}></i>
      <span className="text-sm font-bold">{label}</span>
    </div>
    {badge !== undefined && <span className="bg-rose-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full ring-4 ring-[#020617]">{badge}</span>}
  </button>
);

const MobileNavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 relative ${active ? 'text-amber-500' : 'text-slate-500'}`}>
    <i className={`fas ${icon} text-xl`}></i>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    {badge !== undefined && <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-[#020617]">{badge}</span>}
  </button>
);

const AdminInput = ({ label, value, onChange, type = "text" }: { label: string, value: any, onChange: (v: string) => void, type?: string }) => (
  <div className="space-y-1.5">
     <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{label}</label>
     <input 
       type={type} 
       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-amber-500" 
       value={value} 
       onChange={e => onChange(e.target.value)} 
     />
  </div>
);

const TabBtn = ({ active, label, onClick, count }: any) => (
  <button onClick={onClick} className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}>
    {label} {count !== undefined && count > 0 && <span className="ml-1 bg-rose-500 text-white text-[7px] px-1.5 py-0.5 rounded-full ring-2 ring-[#020617]">{count}</span>}
  </button>
);

const StatCard = ({ label, value, icon, color, isCurrency }: any) => (
  <div className="glass p-6 rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col justify-end min-h-[140px] group transition-all hover:border-white/10">
    <i className={`fas ${icon} absolute top-6 left-6 ${color} text-xl transition-transform group-hover:scale-110`}></i>
    <div className="relative z-10"><p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{label}</p><p className="text-3xl font-black italic text-white leading-none">{isCurrency ? '₵' : ''}{value}</p></div>
  </div>
);

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState<'monitor' | 'fleet' | 'requests' | 'settings' | 'missions' | 'onboarding'>('monitor');
  
  const [session, setSession] = useState<any>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UniUser | null>(() => {
    const saved = localStorage.getItem('unihub_user_v12');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => {
    return sessionStorage.getItem('unihub_driver_session_v12');
  });

  const [myRideIds, setMyRideIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('unihub_my_rides_v12');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [isNewUser, setIsNewUser] = useState(() => !localStorage.getItem('unihub_seen_welcome_v12'));
  const [isSyncing, setIsSyncing] = useState(true);

  const [settings, setSettings] = useState<AppSettings>({
    adminMomo: "024-123-4567",
    adminMomoName: "UniHub Admin",
    whatsappNumber: "233241234567",
    commissionPerSeat: 2.00,
    farePerPragia: 5.00,
    farePerTaxi: 8.00,
    soloMultiplier: 2.5,
    aboutMeText: "Welcome to UniHub Dispatch.",
    aboutMeImages: [],
    appWallpaper: "",
    registrationFee: 20.00
  });
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [missions, setMissions] = useState<HubMission[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);

  const [globalSearch, setGlobalSearch] = useState('');

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

      if (sData) setSettings(sData as AppSettings);
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
    localStorage.setItem('unihub_my_rides_v12', JSON.stringify(myRideIds));
  }, [myRideIds]);

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

  const handleGlobalUserAuth = async (username: string, phone: string) => {
    if (!username || !phone) {
      alert("Identification details required.");
      return;
    }
    
    setIsSyncing(true);
    try {
      const { data } = await supabase
        .from('unihub_users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      let user: UniUser;
      if (data) {
        user = data as UniUser;
      } else {
        const newUser = { id: `USER-${Date.now()}`, username, phone };
        const { error: insertErr } = await supabase.from('unihub_users').insert([newUser]);
        if (insertErr) throw insertErr;
        user = newUser;
      }

      setCurrentUser(user);
      localStorage.setItem('unihub_user_v12', JSON.stringify(user));
    } catch (err: any) {
      alert("Access Error: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Disconnect your Hub identity?")) {
      localStorage.removeItem('unihub_user_v12');
      setCurrentUser(null);
    }
  };

  const joinMission = async (missionId: string, driverId: string) => {
    const mission = missions.find(m => m.id === missionId);
    const driver = drivers.find(d => d.id === driverId);

    if (!mission || !driver) return;
    if (mission.driversJoined.includes(driverId)) {
      alert("You have already joined this mission station.");
      return;
    }
    if (driver.walletBalance < mission.entryFee) {
      alert("Insufficient Balance.");
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

    alert(`Stationed at ${mission.location}! ₵${mission.entryFee} deducted.`);
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

  const acceptRide = async (nodeId: string, driverId: string, customFare?: number) => {
    const driver = drivers.find(d => d.id === driverId);
    const node = nodes.find(n => n.id === nodeId);
    if (!driver || !node) return;

    const totalPotentialCommission = settings.commissionPerSeat * node.passengers.length;
    if (driver.walletBalance < totalPotentialCommission) {
      alert(`Insufficient Balance! Min: ₵${totalPotentialCommission.toFixed(2)}`);
      return;
    }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    await supabase.from('unihub_nodes').update({ 
      status: 'dispatched', 
      assignedDriverId: driverId, 
      verificationCode,
      negotiatedTotalFare: customFare || node?.negotiatedTotalFare
    }).eq('id', nodeId);

    alert("Job accepted!");
  };

  const verifyRide = async (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (node.verificationCode === code) {
      const driver = drivers.find(d => d.id === node.assignedDriverId);
      if (!driver) return;

      const totalCommission = settings.commissionPerSeat * node.passengers.length;

      try {
        await Promise.all([
          supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId),
          supabase.from('unihub_drivers').update({ 
            walletBalance: driver.walletBalance - totalCommission 
          }).eq('id', driver.id),
          supabase.from('unihub_transactions').insert([{
            id: `TX-VERIFY-${Date.now()}`,
            driverId: driver.id,
            amount: totalCommission,
            type: 'commission',
            timestamp: new Date().toLocaleString()
          }])
        ]);
        removeRideFromMyList(nodeId);
        alert(`Verified! Commission of ₵${totalCommission.toFixed(2)} deducted.`);
      } catch (err) {
        alert("Verification error.");
      }
    } else {
      alert("Wrong code!");
    }
  };

  const cancelRide = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    try {
      if (node.status === 'dispatched' && node.assignedDriverId) {
        const resetStatus = (node.isSolo || node.isLongDistance) ? 'qualified' : (node.passengers.length >= 4 ? 'qualified' : 'forming');
        await supabase.from('unihub_nodes').update({ 
          status: resetStatus, 
          assignedDriverId: null, 
          verificationCode: null 
        }).eq('id', nodeId);
        alert("Assignment cancelled.");
      } else {
        await supabase.from('unihub_nodes').delete().eq('id', nodeId);
        removeRideFromMyList(nodeId);
        alert("Removed.");
      }
    } catch (err) {
      alert("Fail.");
    }
  };

  const settleNode = async (nodeId: string) => {
    if (confirm("Force settle?")) {
      const node = nodes.find(n => n.id === nodeId);
      if (node && node.assignedDriverId) {
        const driver = drivers.find(d => d.id === node.assignedDriverId);
        if (driver) {
          const totalCommission = settings.commissionPerSeat * node.passengers.length;
          await Promise.all([
            supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId),
            supabase.from('unihub_drivers').update({ 
              walletBalance: driver.walletBalance - totalCommission 
            }).eq('id', driver.id),
            supabase.from('unihub_transactions').insert([{
              id: `TX-FORCE-${Date.now()}`,
              driverId: driver.id,
              amount: totalCommission,
              type: 'commission',
              timestamp: new Date().toLocaleString()
            }])
          ]);
        }
      } else {
        await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId);
      }
    }
  };

  const requestTopup = async (driverId: string, amount: number, ref: string) => {
    const req: TopupRequest = {
      id: `REQ-${Date.now()}`,
      driverId,
      amount: Number(amount),
      momoReference: ref,
      status: 'pending',
      timestamp: new Date().toLocaleString()
    };
    await supabase.from('unihub_topups').insert([req]);
    alert("Request logged.");
  };

  const requestRegistration = async (reg: Omit<RegistrationRequest, 'id' | 'status' | 'timestamp'>) => {
    const req: RegistrationRequest = {
      ...reg,
      id: `REG-${Date.now()}`,
      status: 'pending',
      timestamp: new Date().toLocaleString()
    };
    await supabase.from('unihub_registrations').insert([req]);
    alert("Application submitted!");
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
    alert("Approved!");
  };

  const registerDriver = async (d: Omit<Driver, 'id' | 'walletBalance' | 'rating' | 'status'>) => {
    const newDriver: Driver = {
      ...d,
      id: `DRV-${Date.now()}`,
      walletBalance: 0,
      rating: 5.0,
      status: 'online'
    };
    await supabase.from('unihub_drivers').insert([newDriver]);
  };

  const deleteDriver = useCallback(async (id: string) => {
    await supabase.from('unihub_drivers').delete().eq('id', id);
    if (activeDriverId === id) handleDriverLogout();
  }, [activeDriverId]);

  const updateGlobalSettings = async (newSettings: AppSettings) => {
    const { id, ...data } = newSettings;
    await supabase.from('unihub_settings').upsert({ id: 1, ...data });
    alert("Settings Updated!");
  };

  const hubRevenue = useMemo(() => transactions.reduce((a, b) => a + b.amount, 0), [transactions]);
  const activeNodeCount = useMemo(() => nodes.filter(n => n.status !== 'completed').length, [nodes]);
  const onlineDriverCount = useMemo(() => drivers.filter(d => d.status === 'online').length, [drivers]);
  const pendingRequestsCount = useMemo(() => 
    topupRequests.filter(r => r.status === 'pending').length + 
    registrationRequests.filter(r => r.status === 'pending').length, 
  [topupRequests, registrationRequests]);

  const handleAdminAuth = async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        setIsAdminAuthenticated(true);
      }
    } catch (err: any) {
      alert("Auth Fail: " + err.message);
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
      sessionStorage.setItem('unihub_driver_session_v12', driverId);
      setViewMode('driver');
    } else {
      alert("Invalid PIN");
    }
  };

  const handleDriverLogout = () => {
    setActiveDriverId(null);
    sessionStorage.removeItem('unihub_driver_session_v12');
    setViewMode('passenger');
  };

  const dismissWelcome = () => {
    setIsNewUser(false);
    localStorage.setItem('unihub_seen_welcome_v12', 'true');
  };

  const safeSetViewMode = (mode: PortalMode) => {
    if (activeDriverId && mode !== 'driver') {
      if (confirm("Logout from Driver Terminal?")) {
        handleDriverLogout();
      } else {
        return;
      }
    }
    setViewMode(mode);
  };

  if (!currentUser) {
    return <HubGateway onIdentify={handleGlobalUserAuth} />;
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
      {settings.appWallpaper && <div className="absolute inset-0 bg-[#020617]/70 pointer-events-none z-0"></div>}
      
      {isSyncing && (
        <div className="fixed top-4 right-4 z-[300] bg-amber-500/20 text-amber-500 px-4 py-2 rounded-full border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-2">
           <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
           Syncing...
        </div>
      )}

      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl">
              <i className="fas fa-route text-[#020617] text-xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white">UniHub</h1>
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Logistics Engine</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => setShowQrModal(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-amber-500"><i className="fas fa-qrcode text-xs"></i></button>
            <button onClick={() => setShowHelpModal(true)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-400"><i className="fas fa-circle-question text-xs"></i></button>
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Passenger Hub" onClick={() => {safeSetViewMode('passenger'); setGlobalSearch('');}} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Driver Terminal" onClick={() => {safeSetViewMode('driver'); setGlobalSearch('');}} />
          {(isVaultAccess || isAdminAuthenticated) && (
            <NavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin Command" onClick={() => {safeSetViewMode('admin'); setGlobalSearch('');}} badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined} />
          )}
          <NavItem active={false} icon="fa-share-nodes" label="Invite Friends" onClick={shareHub} />
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-500 hover:bg-white/5 transition-all mt-4">
             <i className="fas fa-power-off text-lg w-6"></i>
             <span className="text-sm font-bold">Logout Profile</span>
          </button>
        </div>

        <div className="pt-6 border-t border-white/5">
           {activeDriver ? (
             <div className="bg-indigo-500/10 p-6 rounded-[2.5rem] border border-indigo-500/20 mb-4">
                <div className="flex items-center gap-3">
                  {activeDriver.avatarUrl ? <img src={activeDriver.avatarUrl} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400"><i className="fas fa-user text-xs"></i></div>}
                  <div className="truncate">
                    <p className="text-[9px] font-black uppercase text-indigo-400">Driver</p>
                    <p className="text-sm font-black text-white truncate">{activeDriver.name}</p>
                  </div>
                </div>
                <button onClick={handleDriverLogout} className="mt-4 w-full py-2 bg-indigo-600 rounded-xl text-[8px] font-black uppercase">Logout</button>
             </div>
           ) : (
             <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 mb-4">
                <p className="text-[9px] font-black uppercase text-slate-500">Profile</p>
                <p className="text-sm font-black text-white truncate">{currentUser.username}</p>
             </div>
           )}
          <div className="bg-emerald-500/10 p-6 rounded-[2.5rem] border border-emerald-500/20">
            <p className="text-[9px] font-black uppercase text-emerald-400 mb-2">Live Hub Pulse</p>
            <div className="flex justify-between items-center"><p className="text-[10px] text-white/60">Units Online</p><p className="text-lg font-black text-white italic">{onlineDriverCount}</p></div>
            <div className="flex justify-between items-center"><p className="text-[10px] text-white/60">Active Nodes</p><p className="text-lg font-black text-white italic">{activeNodeCount}</p></div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around px-4">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Hub" onClick={() => safeSetViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Drive" onClick={() => safeSetViewMode('driver')} />
        {(isVaultAccess || isAdminAuthenticated) && (
          <MobileNavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin" onClick={() => safeSetViewMode('admin')} badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined} />
        )}
        <MobileNavItem active={false} icon="fa-sparkles" label="AI" onClick={() => setShowAiHelp(true)} />
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12 no-scrollbar z-10 relative">
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
          
          {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
            <div className="relative group">
               <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
               <input 
                  type="text" 
                  placeholder="Search routes..." 
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-4 lg:py-6 pl-14 pr-6 text-white font-bold outline-none focus:border-amber-500"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
               />
            </div>
          )}

          {viewMode === 'passenger' && (
            <PassengerPortal 
              currentUser={currentUser}
              nodes={nodes} 
              myRideIds={myRideIds}
              onAddNode={async (node: RideNode) => {
                await supabase.from('unihub_nodes').insert([node]);
                addRideToMyList(node.id);
              }} 
              onJoin={joinNode} 
              onCancel={cancelRide} 
              drivers={drivers} 
              search={globalSearch} 
              settings={settings} 
              onShowQr={() => setShowQrModal(true)} 
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
              search={globalSearch}
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
                onApproveRegistration={approveRegistration}
                onLock={handleAdminLogout}
                search={globalSearch}
                settings={settings}
                onUpdateSettings={updateGlobalSettings}
                hubRevenue={hubRevenue}
                adminEmail={session?.user?.email}
              />
            )
          )}
        </div>
      </main>

      {showAiHelp && <AiHelpDesk onClose={() => setShowAiHelp(false)} settings={settings} />}

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-sm:px-4 max-w-sm rounded-[3rem] p-10 text-center border border-white/10 space-y-6">
              <h3 className="text-2xl font-black italic uppercase text-white">Hub QR Code</h3>
              <div className="bg-white p-6 rounded-[2.5rem]"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}&bgcolor=ffffff&color=020617&format=svg`} className="w-full aspect-square" alt="QR" /></div>
              <button onClick={() => setShowQrModal(false)} className="w-full py-4 bg-white/5 rounded-2xl font-black text-xs uppercase text-slate-400">Close</button>
           </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-3xl rounded-[3rem] p-8 lg:p-12 space-y-10 border border-white/10 overflow-y-auto max-h-[90vh]">
             <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black italic uppercase text-white leading-none">Hub Help</h3>
                <button onClick={() => setShowHelpModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 transition-all"><i className="fas fa-times"></i></button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <HelpSection icon="fa-user-graduate" title="Passenger" color="text-amber-500" points={["Form Node: Group ride to split costs.", "Quick Drop: Private transport.", "Move Code: Share ONLY at destination."]} />
                <HelpSection icon="fa-id-card-clip" title="Driver" color="text-indigo-400" points={["Missions: Pay to station.", "Earnings: Verified after Move Code.", "Registration: Requires portrait and MoMo."]} />
                <HelpSection icon="fa-circle-info" title="Rules" color="text-emerald-400" points={["Pricing: Set by Admin.", "Security: Your PIN is private.", "Disputes: Contact support."]} />
             </div>
             <div className="pt-6 border-t border-white/5 flex justify-center"><button onClick={() => setShowHelpModal(false)} className="px-12 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest text-white">Understood</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- PASSENGER PORTAL ---

const PassengerPortal = ({ currentUser, nodes, myRideIds, onAddNode, onJoin, onCancel, drivers, search, settings, onShowQr }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [joinModalNodeId, setJoinModalNodeId] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [leader, setLeader] = useState(currentUser?.username || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [type, setType] = useState<VehicleType>('Pragia');
  const [isSolo, setIsSolo] = useState(false);
  const [isLongDistance, setIsLongDistance] = useState(false);
  
  const [aiInput, setAiInput] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);

  const myActiveNodes = useMemo(() => nodes.filter((n: any) => 
    myRideIds.includes(n.id) && n.status !== 'completed'
  ), [nodes, myRideIds]);

  const filteredNodes = nodes.filter((n: any) => 
    n.status !== 'completed' && 
    !myRideIds.includes(n.id) &&
    (n.destination.toLowerCase().includes(search.toLowerCase()) || n.origin.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAiFill = async () => {
    if (!aiInput.trim()) return;
    setAiProcessing(true);
    try {
      const prompt = `Parse this ride request into JSON: "${aiInput}". Schema: {"origin": string, "destination": string, "isSolo": boolean, "vehicleType": "Pragia"|"Taxi"}`;
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt, 
        config: { responseMimeType: "application/json" } 
      });
      const data = JSON.parse(response.text || '{}');
      if (data.origin) setOrigin(data.origin);
      if (data.destination) setDest(data.destination);
      if (data.isSolo !== undefined) setIsSolo(data.isSolo);
      if (data.vehicleType) setType(data.vehicleType);
      setAiInput('');
    } catch (err) { alert("AI couldn't parse that."); }
    finally { setAiProcessing(false); }
  };

  const createNode = async () => {
    if (!origin || !dest) return alert("Required fields missing.");
    const standardFare = type === 'Pragia' ? settings.farePerPragia : settings.farePerTaxi;
    const finalFare = isSolo ? Math.ceil(standardFare * settings.soloMultiplier) : standardFare;
    const node: RideNode = {
      id: `NODE-${Date.now()}`, origin, destination: dest,
      capacityNeeded: isSolo ? 1 : 4, passengers: [{ id: 'P-LEAD', name: leader, phone }],
      status: (isSolo || isLongDistance) ? 'qualified' : 'forming',
      leaderName: leader, leaderPhone: phone, farePerPerson: isLongDistance ? 0 : finalFare,
      createdAt: new Date().toISOString(), isSolo, isLongDistance
    };
    await onAddNode(node);
    setShowModal(false);
    setOrigin(''); setDest(''); setIsSolo(false); setIsLongDistance(false);
  };

  return (
    <div className="animate-in fade-in space-y-12 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Passenger Hub</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase mt-1">Request drops or form nodes</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={onShowQr} className="w-12 h-12 lg:hidden bg-white/5 rounded-2xl flex items-center justify-center text-amber-500 border border-white/10"><i className="fas fa-qrcode"></i></button>
          <button onClick={() => setShowModal(true)} className="flex-1 sm:flex-none px-8 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl">Form Ride</button>
        </div>
      </div>

      {myActiveNodes.length > 0 && (
        <section className="space-y-6">
           <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 italic">My Active Missions</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{myActiveNodes.map((node: any) => <RideCard key={node.id} node={node} drivers={drivers} onJoin={onJoin} onCancel={onCancel} setJoinModalNodeId={setJoinModalNodeId} isPriority />)}</div>
        </section>
      )}

      <section className="space-y-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Global Traffic</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNodes.length > 0 ? filteredNodes.map((node: any) => <RideCard key={node.id} node={node} drivers={drivers} onJoin={onJoin} onCancel={onCancel} setJoinModalNodeId={setJoinModalNodeId} />) : <div className="col-span-full py-12 text-center opacity-40 uppercase text-[10px] font-black">No traffic</div>}
        </div>
      </section>

      {/* Squeezed Form Ride Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-2 lg:p-4">
          <div className="glass-bright w-full max-w-lg rounded-[2.5rem] p-4 lg:p-6 flex flex-col max-h-[92vh] animate-in zoom-in text-slate-900 border border-white/10 overflow-hidden">
            <div className="text-center mb-2 shrink-0">
              <h3 className="text-lg font-black italic tracking-tighter uppercase text-white leading-none">Create Ride Request</h3>
              <p className="text-slate-400 text-[8px] font-black uppercase mt-0.5">Carpooling or Quick Drop</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar">
              <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-xl space-y-1">
                 <div className="flex items-center gap-1 text-indigo-400 font-black text-[7px] uppercase tracking-widest leading-none"><i className="fas fa-sparkles"></i> AI Quick Dispatch</div>
                 <div className="flex flex-col gap-1">
                    <textarea 
                      className="w-full bg-[#020617] text-white text-[10px] border border-white/10 rounded-lg p-1.5 outline-none h-9 resize-none"
                      placeholder="e.g. Solo taxi from Limann to CS"
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                    />
                    <button onClick={handleAiFill} disabled={aiProcessing} className="w-full py-1 bg-indigo-600 text-white rounded-lg font-black text-[7px] uppercase disabled:opacity-50">{aiProcessing ? <i className="fas fa-spinner fa-spin"></i> : '✨ Auto-Fill'}</button>
                 </div>
              </div>

              <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10 shrink-0">
                <button onClick={() => {setIsSolo(false); setIsLongDistance(false);}} className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase transition-all ${!isSolo && !isLongDistance ? 'bg-amber-500 text-[#020617]' : 'text-slate-400'}`}>Group</button>
                <button onClick={() => {setIsSolo(true); setIsLongDistance(false);}} className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase transition-all ${isSolo ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>Solo</button>
                <button onClick={() => {setIsSolo(false); setIsLongDistance(true);}} className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase transition-all ${isLongDistance ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Long Dist</button>
              </div>

              <div className="space-y-2">
                 <div className="grid grid-cols-2 gap-1.5">
                    <div className="space-y-0.5"><label className="text-[7px] font-black text-slate-500 uppercase ml-1">Departure</label><input className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none font-bold text-[10px]" placeholder="Start" value={origin} onChange={e => setOrigin(e.target.value)} /></div>
                    <div className="space-y-0.5"><label className="text-[7px] font-black text-slate-500 uppercase ml-1">Destination</label><input className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none font-bold text-[10px]" placeholder="End" value={dest} onChange={e => setDest(e.target.value)} /></div>
                 </div>
                 <div className="grid grid-cols-2 gap-1.5">
                    <div className="space-y-0.5"><label className="text-[7px] font-black text-slate-500 uppercase ml-1">Vehicle</label><select className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none font-bold text-[10px]" value={type} onChange={e => setType(e.target.value as VehicleType)}><option value="Pragia">Pragia</option><option value="Taxi">Taxi</option></select></div>
                    <div className="space-y-0.5 opacity-60"><label className="text-[7px] font-black text-slate-500 uppercase ml-1">Requester</label><input className="w-full bg-white/5 border border-slate-100 rounded-lg px-2 py-1.5 font-bold text-[10px]" value={leader} readOnly /></div>
                 </div>
                 <div className="space-y-0.5 opacity-60"><label className="text-[7px] font-black text-slate-500 uppercase ml-1">Contact</label><input className="w-full bg-white/5 border border-slate-100 rounded-lg px-2 py-1.5 font-bold text-[10px]" value={phone} readOnly /></div>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2 shrink-0 border-t border-white/5 mt-2">
               <button onClick={() => setShowModal(false)} className="flex-1 py-2 bg-white/10 rounded-xl font-black text-[9px] uppercase text-white">Back</button>
               <button onClick={createNode} className={`flex-1 py-2 ${isLongDistance ? 'bg-indigo-600' : (isSolo ? 'bg-emerald-500' : 'bg-amber-500')} text-white rounded-xl font-black text-[9px] uppercase shadow-xl`}>{isLongDistance ? 'Request Bid' : (isSolo ? 'Request Drop' : 'Launch Node')}</button>
            </div>
          </div>
        </div>
      )}

      {joinModalNodeId && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[160] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-w-sm rounded-[2rem] p-8 space-y-6 animate-in zoom-in text-slate-900">
              <h3 className="text-xl font-black italic uppercase text-center text-white">Join Ride</h3>
              <div className="space-y-4">
                 <input className="w-full bg-white/10 border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-white opacity-70" value={currentUser.username} readOnly />
                 <input className="w-full bg-white/10 border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-white opacity-70" value={currentUser.phone} readOnly />
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setJoinModalNodeId(null)} className="flex-1 py-4 bg-white/10 rounded-xl font-black text-[10px] uppercase text-white">Cancel</button>
                 <button onClick={() => { onJoin(joinModalNodeId, currentUser.username, currentUser.phone); setJoinModalNodeId(null); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Join Hub Node</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

// --- DRIVER TERMINAL ---

const DriverPortal = ({ drivers, activeDriver, onLogin, onLogout, qualifiedNodes, dispatchedNodes, missions, allNodes, onJoinMission, onAccept, onVerify, onCancel, onRequestTopup, onRequestRegistration, settings }: any) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [momoRef, setMomoRef] = useState('');
  const [regData, setRegData] = useState<Partial<RegistrationRequest>>({ vehicleType: 'Pragia' });
  
  // RESTORED ADVANCED FEATURES STATE
  const [isScanning, setIsScanning] = useState(false);
  const [activeMissionNodeId, setActiveMissionNodeId] = useState<string | null>(null);
  const [hubInsight, setHubInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [portraitScanning, setPortraitScanning] = useState(false);

  // Vision Scan Logic
  const handlePortraitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPortraitScanning(true);
      try {
        const compressed = await compressImage(file, 0.6, 400);
        setRegData(prev => ({ ...prev, avatarUrl: compressed }));
        
        const base64 = compressed.split(',')[1];
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { text: "Verify if this image is a portrait of a person. If it contains a vehicle, try to extract the license plate. Return JSON: { \"isPortrait\": boolean, \"licensePlate\": string | null }" },
              { inlineData: { mimeType: "image/jpeg", data: base64 } }
            ]
          },
          config: { responseMimeType: "application/json" }
        });

        const visionData = JSON.parse(response.text || '{}');
        if (visionData.licensePlate) setRegData(prev => ({ ...prev, licensePlate: visionData.licensePlate }));
        if (!visionData.isPortrait) {
          alert("Portrait check failed. Please upload a clear photo of yourself.");
          setRegData(prev => ({ ...prev, avatarUrl: undefined }));
        }
      } catch (err) {
        console.error("Vision scan failed", err);
      } finally {
        setPortraitScanning(false);
      }
    }
  };

  // AI Strategy Logic
  const generateHubInsight = async () => {
    setInsightLoading(true);
    try {
      const activeTraffic = allNodes.filter((n:any) => n.status !== 'completed').map((n:any) => `${n.origin} -> ${n.destination}`).join(', ');
      const missionLocs = missions.map((m:any) => m.location).join(', ');
      const prompt = `Act as a logistics analyst for UniHub Dispatch. Traffic: ${activeTraffic}. Missions: ${missionLocs}. Suggest best station. Max 2 sentences. Start with 'UniHub Strategy:'.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setHubInsight(response.text || "No insights found.");
    } catch (err) {
      setHubInsight("Strategy service offline.");
    } finally {
      setInsightLoading(false);
    }
  };

  // QR Scanning Effect
  useEffect(() => {
    let html5QrCode: any = null;
    if (isScanning && activeMissionNodeId) {
      const timeout = setTimeout(async () => {
        try {
          html5QrCode = new (window as any).Html5Qrcode("qr-reader");
          await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 15, qrbox: { width: 250, height: 250 } }, 
            (decodedText: string) => {
              setVerifyCode(decodedText);
              onVerify(activeMissionNodeId, decodedText);
              setIsScanning(false);
              html5QrCode.stop().catch(console.error);
            }
          );
        } catch (err) {
          setIsScanning(false);
        }
      }, 300);
      return () => {
        clearTimeout(timeout);
        if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(console.error);
      };
    }
  }, [isScanning, activeMissionNodeId]);

  if (!activeDriver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-10 px-4 animate-in fade-in">
        <div className="text-center">
            <div className="w-24 h-24 bg-indigo-600/10 rounded-[2.5rem] flex items-center justify-center text-indigo-500 mx-auto mb-6 border border-indigo-500/20 shadow-2xl">
              <i className="fas fa-id-card-clip text-4xl"></i>
            </div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Driver Terminal</h2>
        </div>
        {selectedDriverId ? (
            <div className="w-full max-w-sm glass p-10 rounded-[3rem] border border-white/10 space-y-8 animate-in zoom-in text-center">
                <input 
                  type="password" 
                  maxLength={4}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-4xl tracking-[1em] font-black outline-none focus:border-amber-500 text-center text-white" 
                  placeholder="0000"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                />
                <div className="flex gap-4">
                    <button onClick={() => {setSelectedDriverId(null); setPin('');}} className="flex-1 py-4 bg-white/5 rounded-xl font-black text-[10px] uppercase text-slate-400">Back</button>
                    <button onClick={() => onLogin(selectedDriverId, pin)} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase">Login</button>
                </div>
            </div>
        ) : (
            <div className="flex flex-col items-center gap-8 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
                {drivers.map((d: any) => (
                  <button key={d.id} onClick={() => setSelectedDriverId(d.id)} className="glass p-8 rounded-[2rem] border border-white/5 text-left hover:border-amber-500/50 flex items-center gap-6">
                    {d.avatarUrl ? <img src={d.avatarUrl} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500"><i className="fas fa-user"></i></div>}
                    <div>
                      <p className="font-black uppercase italic text-xl text-white">{d.name}</p>
                      <p className="text-[9px] font-black text-slate-500 uppercase">WALLET: ₵{d.walletBalance.toFixed(1)}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowRegModal(true)} className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-2xl">Join Fleet</button>
            </div>
        )}

        {/* Squeezed Join Fleet Modal with Vision Scan */}
        {showRegModal && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-2">
            <div className="glass-bright w-full max-md rounded-[2.5rem] p-4 lg:p-6 flex flex-col max-h-[92vh] animate-in zoom-in text-slate-900 border border-white/10 overflow-hidden">
               <div className="text-center mb-2 shrink-0">
                  <h3 className="text-lg font-black italic tracking-tighter uppercase text-white leading-none">Fleet Onboarding</h3>
                  <p className="text-indigo-400 text-[8px] font-black uppercase mt-0.5">Fee: ₵{settings.registrationFee}</p>
               </div>
               
               <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar">
                  <div className="flex justify-center flex-col items-center gap-0.5 shrink-0">
                     <input type="file" id="port-up" className="hidden" accept="image/*" onChange={handlePortraitUpload} />
                     <label htmlFor="port-up" className={`w-12 h-12 rounded-full bg-white/5 border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden ${portraitScanning ? 'border-amber-500' : 'border-white/10'}`}>
                       {regData.avatarUrl ? <img src={regData.avatarUrl} className="w-full h-full object-cover" /> : <div className="text-center"><i className="fas fa-camera text-slate-600 text-[8px]"></i></div>}
                       {portraitScanning && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><i className="fas fa-spinner fa-spin text-white"></i></div>}
                     </label>
                  </div>

                  <div className="bg-white/5 p-1.5 rounded-xl border border-white/10 flex items-center justify-between gap-2 shrink-0">
                     <div className="flex-1">
                        <p className="text-[7px] font-black text-slate-500 uppercase leading-none mb-0.5">Hub MoMo</p>
                        <p className="text-xs font-black text-white italic leading-none">{settings.adminMomo}</p>
                     </div>
                     <p className="text-[7px] font-black text-slate-400 uppercase leading-tight text-right">{settings.adminMomoName}</p>
                  </div>

                  <div className="space-y-1.5">
                     <div className="space-y-0.5"><label className="text-[7px] font-black text-slate-500 uppercase ml-1.5">Full Name</label><input className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none font-bold text-[10px]" value={regData.name || ''} onChange={e => setRegData({...regData, name: e.target.value})} /></div>
                     <div className="grid grid-cols-2 gap-1.5">
                        <div className="space-y-0.5"><label className="text-[7px] font-black text-slate-500 uppercase ml-1.5">Vehicle</label><select className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none font-bold text-[10px]" value={regData.vehicleType || 'Pragia'} onChange={e => setRegData({...regData, vehicleType: e.target.value as VehicleType})}><option value="Pragia">Pragia</option><option value="Taxi">Taxi</option></select></div>
                        <div className="space-y-0.5"><label className="text-[7px] font-black text-slate-500 uppercase ml-1.5">Plate</label><input className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none font-bold text-[10px]" value={regData.licensePlate || ''} onChange={e => setRegData({...regData, licensePlate: e.target.value})} /></div>
                     </div>
                     <div className="grid grid-cols-2 gap-1.5">
                        <div className="space-y-0.5"><label className="text-[7px] font-black text-slate-500 uppercase ml-1.5">WhatsApp</label><input className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none font-bold text-[10px]" value={regData.contact || ''} onChange={e => setRegData({...regData, contact: e.target.value})} /></div>
                        <div className="space-y-0.5"><label className="text-[7px] font-black text-indigo-400 uppercase ml-1.5">PIN</label><input className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1.5 outline-none font-black text-center text-[10px]" maxLength={4} value={regData.pin || ''} onChange={e => setRegData({...regData, pin: e.target.value})} /></div>
                     </div>
                     <div className="space-y-0.5"><label className="text-[7px] font-black text-emerald-500 uppercase ml-1.5">MoMo Ref</label><input className="w-full bg-white border border-emerald-500/30 rounded-lg px-3 py-1.5 outline-none font-black text-center text-[10px]" value={regData.momoReference || ''} onChange={e => setRegData({...regData, momoReference: e.target.value})} /></div>
                  </div>
               </div>

               <div className="flex gap-2 pt-2 shrink-0 border-t border-white/5 mt-2">
                  <button onClick={() => setShowRegModal(false)} className="flex-1 py-2 bg-white/10 rounded-xl font-black text-[9px] uppercase text-white">Back</button>
                  <button onClick={() => { if(!regData.name || !regData.momoReference || !regData.pin) return alert("Fields missing."); onRequestRegistration({ ...regData as RegistrationRequest, amount: settings.registrationFee }); setShowRegModal(false); }} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase shadow-xl">Submit</button>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-12 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 bg-indigo-500/5 p-6 rounded-[2rem] border border-indigo-500/10">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-[#020617] shadow-xl">
             {activeDriver.avatarUrl ? <img src={activeDriver.avatarUrl} className="w-full h-full object-cover rounded-2xl" /> : <i className={`fas ${activeDriver.vehicleType === 'Pragia' ? 'fa-motorcycle' : 'fa-taxi'} text-2xl`}></i>}
          </div>
          <div>
            <h2 className="text-2xl font-black italic text-white leading-none">{activeDriver.name}</h2>
            <p className="text-[10px] font-black text-amber-500 uppercase mt-2">₵ {activeDriver.walletBalance.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button onClick={() => setShowTopupModal(true)} className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase">Top-Up</button>
          <button onClick={onLogout} className="flex-1 sm:flex-none px-6 py-3 bg-rose-600/10 text-rose-500 rounded-xl text-[10px] font-black uppercase">End Shift</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-12">
           <section>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Missions</h3>
                <button onClick={generateHubInsight} className="flex items-center gap-2 text-indigo-400 font-black text-[9px] uppercase hover:scale-105 transition-transform bg-indigo-500/10 px-4 py-2 rounded-xl">
                  <i className={`fas fa-sparkles ${insightLoading ? 'animate-spin' : ''}`}></i> Hub Insights
                </button>
              </div>

              {hubInsight && (
                <div className="mb-6 p-4 bg-indigo-600 rounded-[1.5rem] border border-white/20 animate-in zoom-in text-white text-[11px] font-medium italic relative overflow-hidden">
                  <i className="fas fa-lightbulb absolute right-4 top-1/2 -translate-y-1/2 text-4xl opacity-10"></i>
                  <p className="relative z-10">{hubInsight}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {missions.filter((m:any) => m.status === 'open').map((m:any) => (
                   <div key={m.id} className="glass p-6 rounded-3xl border border-white/5 space-y-4">
                      <div className="flex justify-between items-start"><h4 className="font-black text-white uppercase italic text-sm">{m.location}</h4><p className="text-emerald-400 font-black text-xs">₵{m.entryFee}</p></div>
                      <p className="text-[10px] text-slate-400 italic">{m.description}</p>
                      {m.driversJoined.includes(activeDriver.id) ? <div className="w-full py-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-[8px] font-black uppercase text-center">Active Station</div> : <button onClick={() => onJoinMission(m.id, activeDriver.id)} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[8px] font-black uppercase">Enter Station</button>}
                   </div>
                 ))}
              </div>
           </section>

           <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic mb-6">Ready for Dispatch</h3>
              <div className="space-y-4">
                {qualifiedNodes.map((node: any) => (
                  <div key={node.id} className="glass rounded-[2rem] p-6 border flex flex-col md:flex-row items-center gap-6 border-white/5">
                      <div className="flex-1">
                        <p className="font-black text-sm uppercase italic text-white">{node.origin} → {node.destination}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Requested by {node.leaderName}</p>
                      </div>
                      <button onClick={() => onAccept(node.id, activeDriver.id)} className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase">Accept Job</button>
                  </div>
                ))}
              </div>
           </section>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Active Mission</h3>
           {dispatchedNodes.filter((n: any) => n.assignedDriverId === activeDriver.id).map((node: any) => (
              <div key={node.id} className="glass rounded-[2rem] p-8 border space-y-6 border-amber-500/20">
                 <h4 className="text-xl font-black text-white italic truncate text-center">{node.origin} to {node.destination}</h4>
                 <div className="space-y-4 pt-4 border-t border-white/5 text-center">
                    <p className="text-[9px] font-black text-slate-500 uppercase">Verify Move Code</p>
                    <div className="relative">
                       <input className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-5 text-center text-4xl font-black text-white outline-none focus:border-emerald-500" placeholder="0000" maxLength={4} value={verifyCode} onChange={e => setVerifyCode(e.target.value)} />
                       <button onClick={() => { setActiveMissionNodeId(node.id); setIsScanning(true); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500 transition-all">
                          <i className="fas fa-qrcode"></i>
                       </button>
                    </div>
                    <button onClick={() => onVerify(node.id, verifyCode)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Finish Ride</button>
                    <button onClick={() => onCancel(node.id)} className="w-full py-2 text-rose-500 text-[10px] font-black uppercase opacity-60">Abort Ride</button>
                 </div>
              </div>
           ))}
        </div>
      </div>

      {isScanning && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[200] flex items-center justify-center p-4">
           <div className="w-full max-w-md space-y-8 animate-in zoom-in">
              <div className="flex justify-between items-center text-white px-2">
                 <h3 className="text-xl font-black uppercase italic tracking-tighter">Scanning Move Code</h3>
                 <button onClick={() => setIsScanning(false)} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-rose-500"><i className="fas fa-times"></i></button>
              </div>
              <div id="qr-reader" className="w-full aspect-square bg-black/40 rounded-[2rem] overflow-hidden relative border border-white/10">
                  <div className="scanner-line"></div>
              </div>
           </div>
        </div>
      )}

      {showTopupModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-md rounded-[2.5rem] p-8 space-y-8 animate-in zoom-in text-slate-900">
            <h3 className="text-2xl font-black italic uppercase text-center text-white">Credit Request</h3>
            <div className="space-y-4">
               <div className="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-center">
                  <p className="text-[9px] font-black text-amber-500 uppercase mb-1">Hub MoMo</p>
                  <p className="text-3xl font-black text-white italic leading-none">{settings.adminMomo}</p>
               </div>
               <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-black text-emerald-600 text-center text-xl" placeholder="Amount (₵)" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-center" placeholder="MoMo Ref" value={momoRef} onChange={e => setMomoRef(e.target.value)} />
            </div>
            <div className="flex gap-4">
               <button onClick={() => setShowTopupModal(false)} className="flex-1 py-4 bg-white/10 rounded-xl font-black text-[10px] uppercase text-white">Cancel</button>
               <button onClick={() => { if(!topupAmount || !momoRef) return; onRequestTopup(activeDriver.id, Number(topupAmount), momoRef); setShowTopupModal(false); }} className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Send Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- ADMIN PORTAL ---

const AdminPortal = ({ activeTab, setActiveTab, nodes, drivers, onAddDriver, onDeleteDriver, onCancelRide, onSettleRide, missions, onCreateMission, onDeleteMission, transactions, topupRequests, registrationRequests, onApproveTopup, onApproveRegistration, onLock, settings, onUpdateSettings, hubRevenue, adminEmail }: any) => {
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [newDriver, setNewDriver] = useState<Partial<Driver>>({ vehicleType: 'Pragia', pin: '0000' });
  const [newMission, setNewMission] = useState<Partial<HubMission>>({ location: '', description: '', entryFee: 5, status: 'open' });
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  useEffect(() => { setLocalSettings(settings); }, [settings]);

  return (
    <div className="animate-in slide-in-from-bottom-8 space-y-8 pb-10">
      <div className="flex items-center justify-between mb-4 overflow-x-auto no-scrollbar">
         <div className="flex bg-white/5 p-1 rounded-[1.5rem] border border-white/10 whitespace-nowrap">
            <TabBtn active={activeTab === 'monitor'} label="Stats" onClick={() => setActiveTab('monitor')} />
            <TabBtn active={activeTab === 'fleet'} label="Fleet" onClick={() => setActiveTab('fleet')} />
            <TabBtn active={activeTab === 'onboarding'} label="Apps" onClick={() => setActiveTab('onboarding')} count={registrationRequests.filter((r:any)=>r.status==='pending').length} />
            <TabBtn active={activeTab === 'missions'} label="Hub Jobs" onClick={() => setActiveTab('missions')} />
            <TabBtn active={activeTab === 'requests'} label="Credit" onClick={() => setActiveTab('requests')} count={topupRequests.filter((r:any)=>r.status==='pending').length} />
            <TabBtn active={activeTab === 'settings'} label="Setup" onClick={() => setActiveTab('settings')} />
         </div>
         <div className="flex items-center gap-4 bg-rose-600/10 px-4 py-2 rounded-xl border border-rose-500/20 shrink-0 ml-4">
            <div className="hidden sm:block text-right">
               <p className="text-[7px] font-black text-rose-500 uppercase leading-none">Admin Active</p>
               <p className="text-[9px] font-bold text-white truncate max-w-[120px]">{adminEmail}</p>
            </div>
            <button onClick={onLock} className="text-rose-500 hover:text-rose-400 transition-colors"><i className="fas fa-power-off text-sm"></i></button>
         </div>
      </div>

      {activeTab === 'monitor' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Forming" value={nodes.filter((n:any) => n.status === 'forming').length} icon="fa-users" color="text-amber-400" />
            <StatCard label="Units" value={drivers.length} icon="fa-taxi" color="text-indigo-400" />
            <StatCard label="Qualified" value={nodes.filter((n:any) => n.status === 'qualified').length} icon="fa-bolt" color="text-emerald-400" />
            <StatCard label="Profit" value={hubRevenue.toFixed(0)} icon="fa-money-bill" color="text-slate-400" isCurrency />
          </div>
          <div className="glass rounded-[2rem] p-8 border border-white/5">
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Traffic Hub</h4>
             <div className="space-y-3">{nodes.slice(0, 10).map((n: RideNode) => (
                 <div key={n.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                    <div className="flex-1"><p className="text-[11px] font-black text-white uppercase italic">{n.origin} to {n.destination}</p><p className="text-[9px] text-slate-500 uppercase">{n.status}</p></div>
                    <div className="flex gap-2">
                       {n.status !== 'completed' && <button onClick={() => onSettleRide(n.id)} className="px-3 py-1.5 bg-emerald-600/10 text-emerald-500 rounded-lg text-[8px] font-black uppercase">Settle</button>}
                       <button onClick={() => onCancelRide(n.id)} className="px-3 py-1.5 bg-rose-600/10 text-rose-500 rounded-lg text-[8px] font-black uppercase">Kill</button>
                    </div>
                 </div>
               ))}</div>
          </div>
        </div>
      )}

      {activeTab === 'fleet' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center px-2"><h3 className="text-xl font-black uppercase italic text-white leading-none">Fleet</h3><button onClick={() => setShowDriverModal(true)} className="px-6 py-3 bg-amber-500 text-[#020617] rounded-xl text-[9px] font-black uppercase">Register Unit</button></div>
           <div className="glass rounded-[2rem] overflow-x-auto border border-white/5">
              <table className="w-full text-left text-[11px] min-w-[600px]">
                 <thead className="bg-white/5 text-slate-500 font-black tracking-widest border-b border-white/5"><tr><th className="px-8 py-5">Portrait</th><th className="px-8 py-5">Details</th><th className="px-8 py-5 text-center">Wallet</th><th className="px-8 py-5 text-right">Action</th></tr></thead>
                 <tbody className="divide-y divide-white/5">{drivers.map((d: any) => (
                       <tr key={d.id} className="text-slate-300 font-bold">
                          <td className="px-8 py-5">{d.avatarUrl ? <img src={d.avatarUrl} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-slate-800" />}</td>
                          <td className="px-8 py-5"><div>{d.name}</div><div className="text-[8px] text-slate-500 uppercase">{d.contact} | {d.licensePlate}</div></td>
                          <td className="px-8 py-5 text-center text-emerald-400 italic font-black">₵{d.walletBalance.toFixed(1)}</td>
                          <td className="px-8 py-5 text-right"><button onClick={() => onDeleteDriver(d.id)} className="px-4 py-2 text-rose-500 text-[8px] font-black uppercase">Unreg</button></td>
                       </tr>
                    ))}</tbody>
              </table>
           </div>
        </div>
      )}

      {activeTab === 'onboarding' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {registrationRequests.filter((r:any)=>r.status==='pending').map((reg: any) => (
             <div key={reg.id} className="glass p-8 rounded-3xl border border-indigo-500/20 space-y-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4"><div className="flex items-center gap-4">{reg.avatarUrl ? <img src={reg.avatarUrl} className="w-16 h-16 rounded-2xl object-cover" /> : <div className="w-16 h-16 bg-white/5 rounded-2xl" />}<div><h4 className="text-white font-black uppercase text-sm">{reg.name}</h4><span className="text-[8px] font-black text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-md">{reg.vehicleType}</span></div></div></div>
                  <div className="bg-white/5 p-4 rounded-xl space-y-2"><p className="text-[8px] font-black text-slate-500">Plate</p><p className="text-xs font-black text-white">{reg.licensePlate}</p><p className="text-[8px] font-black text-slate-500 mt-2">Ref</p><p className="text-sm font-black text-emerald-400 italic">{reg.momoReference}</p></div>
                </div>
                <button onClick={() => onApproveRegistration(reg.id)} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Approve</button>
             </div>
           ))}
        </div>
      )}

      {activeTab === 'missions' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center px-2"><h3 className="text-xl font-black uppercase italic text-white leading-none">Hub Jobs</h3><button onClick={() => setShowMissionModal(true)} className="px-6 py-3 bg-amber-500 text-[#020617] rounded-xl text-[9px] font-black uppercase">New Station</button></div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {missions.map((m: any) => (
                <div key={m.id} className="glass p-8 rounded-3xl border border-white/5 space-y-4 relative group">
                   <div className="flex justify-between items-start">
                      <div><h4 className="text-white font-black uppercase italic text-lg leading-none mb-2">{m.location}</h4><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">₵{m.entryFee} ENTRY</p></div>
                      <button onClick={() => onDeleteMission(m.id)} className="w-8 h-8 rounded-full bg-rose-600/10 text-rose-500 hover:bg-rose-600 transition-all"><i className="fas fa-trash text-[10px]"></i></button>
                   </div>
                   <p className="text-[11px] text-slate-400 italic">{m.description}</p>
                   <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[8px] font-black text-slate-500 uppercase">{m.driversJoined.length} Units Active</span>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           {topupRequests.filter((r:any)=>r.status==='pending').map((req: any) => (
             <div key={req.id} className="glass p-8 rounded-3xl border border-emerald-500/20 space-y-6">
                <div>
                  <h4 className="text-white font-black uppercase italic text-sm">{drivers.find((d:any)=>d.id===req.driverId)?.name}</h4>
                  <p className="text-3xl font-black text-white italic mt-4">₵ {req.amount}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-2">Ref: {req.momoReference}</p>
                </div>
                <button onClick={() => onApproveTopup(req.id)} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-xl">Approve Credit</button>
             </div>
           ))}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="glass rounded-[2rem] p-8 border border-white/5 space-y-10 animate-in fade-in">
           <h3 className="text-xl font-black uppercase text-white leading-none">Hub Setup</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="space-y-6">
                 <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Fares</h4>
                 <div className="space-y-4">
                    <AdminInput label="Comm (₵)" value={localSettings.commissionPerSeat} onChange={v => setLocalSettings({...localSettings, commissionPerSeat: Number(v)})} />
                    <AdminInput label="Reg Fee (₵)" value={localSettings.registrationFee} onChange={v => setLocalSettings({...localSettings, registrationFee: Number(v)})} />
                    <AdminInput label="Pragia (₵)" value={localSettings.farePerPragia} onChange={v => setLocalSettings({...localSettings, farePerPragia: Number(v)})} />
                    <AdminInput label="Taxi (₵)" value={localSettings.farePerTaxi} onChange={v => setLocalSettings({...localSettings, farePerTaxi: Number(v)})} />
                 </div>
              </section>
              <section className="space-y-6">
                 <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Payment</h4>
                 <div className="space-y-4">
                    <AdminInput label="MoMo" value={localSettings.adminMomo} onChange={v => setLocalSettings({...localSettings, adminMomo: v})} />
                    <AdminInput label="WhatsApp" value={localSettings.whatsappNumber} onChange={v => setLocalSettings({...localSettings, whatsappNumber: v})} />
                 </div>
              </section>
           </div>
           <div className="pt-8 border-t border-white/5 flex justify-end"><button onClick={() => onUpdateSettings(localSettings)} className="px-12 py-4 bg-amber-500 text-[#020617] rounded-2xl font-black text-xs uppercase shadow-xl">Push Updates</button></div>
        </div>
      )}

      {showMissionModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-lg rounded-[2.5rem] p-8 space-y-6 animate-in zoom-in text-slate-900">
            <h3 className="text-2xl font-black italic uppercase text-center text-white">New Hub Station</h3>
            <div className="space-y-4">
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Location" value={newMission.location} onChange={e => setNewMission({...newMission, location: e.target.value})} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Fee" type="number" value={newMission.entryFee} onChange={e => setNewMission({...newMission, entryFee: Number(e.target.value)})} />
               <textarea className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-medium h-32" placeholder="Rules" value={newMission.description} onChange={e => setNewMission({...newMission, description: e.target.value})} />
            </div>
            <div className="flex gap-4">
               <button onClick={() => setShowMissionModal(false)} className="flex-1 py-4 bg-white/10 rounded-xl font-black text-[10px] uppercase text-white">Cancel</button>
               <button onClick={() => { onCreateMission({ id: `MSN-${Date.now()}`, driversJoined: [], ...newMission, status: 'open', createdAt: new Date().toISOString() } as HubMission); setShowMissionModal(false); }} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase">Launch</button>
            </div>
          </div>
        </div>
      )}

      {showDriverModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="glass-bright w-full max-w-lg rounded-[2.5rem] p-8 lg:p-10 space-y-8 animate-in zoom-in text-slate-900">
            <h3 className="text-2xl font-black italic uppercase text-center text-white">Manual Unit Setup</h3>
            <form onSubmit={(e) => { e.preventDefault(); onAddDriver(newDriver as Driver); setShowDriverModal(false); }} className="space-y-4">
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Name" onChange={e => setNewDriver({...newDriver, name: e.target.value})} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Plate" onChange={e => setNewDriver({...newDriver, licensePlate: e.target.value})} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="WhatsApp" onChange={e => setNewDriver({...newDriver, contact: e.target.value})} />
               <input className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 outline-none font-black text-center" placeholder="PIN" maxLength={4} onChange={e => setNewDriver({...newDriver, pin: e.target.value})} />
               <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowDriverModal(false)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-[10px] uppercase text-slate-400">Abort</button><button type="submit" className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase">Submit</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- RENDER ---

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
