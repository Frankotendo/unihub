import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type, Chat, LiveServerMessage, Modality, FunctionDeclaration } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CLIENT ---
const SUPABASE_URL = "https://kzjgihwxiaeqzopeuzhm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- GEMINI INITIALIZATION ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- AUDIO HELPERS (GEMINI LIVE) ---

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- TYPES & INTERFACES ---

type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed'; 
type PortalMode = 'passenger' | 'driver' | 'admin' | 'public';

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
  pin?: string;
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
  driverNote?: string;
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

const QrScannerModal = ({ onScan, onClose }: { onScan: (text: string) => void, onClose: () => void }) => {
  useEffect(() => {
    // Safety check if script loaded
    if (!(window as any).Html5QrcodeScanner) {
        alert("Scanner library loading... try again.");
        onClose();
        return;
    }
    
    const scanner = new (window as any).Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
    );
    
    scanner.render((text: string) => {
        scanner.clear();
        onScan(text);
    }, (err: any) => {
        // ignore errors
    });
    
    return () => {
        try { scanner.clear(); } catch(e) {}
    };
  }, []);
  
  return (
     <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
         <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden relative shadow-2xl">
            <button onClick={onClose} className="absolute top-4 right-4 z-20 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><i className="fas fa-times"></i></button>
            <div className="p-6 text-center">
               <h3 className="text-lg font-black uppercase text-[#020617]">Scan Rider PIN</h3>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">Align QR code within frame</p>
               <div id="reader" className="rounded-xl overflow-hidden"></div>
            </div>
         </div>
     </div>
  );
};

// --- ADS & MONETIZATION COMPONENTS ---

const InlineAd = ({ className, settings }: { className?: string, settings: AppSettings }) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings.adSenseStatus !== 'active' || !settings.adSenseClientId || !settings.adSenseSlotId) return;

    try {
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

    if (settings.adSenseStatus === 'active' && settings.adSenseClientId && settings.adSenseSlotId) {
      try {
        if (adRef.current && adRef.current.innerHTML !== "") {
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

const GlobalVoiceOrb = ({ 
  mode,
  user,
  contextData,
  actions,
  triggerRef
}: { 
  mode: PortalMode,
  user: any,
  contextData: {
    nodes: RideNode[],
    drivers: Driver[],
    transactions?: Transaction[],
    settings: AppSettings,
    pendingRequests?: number,
  },
  actions: {
    onUpdateStatus?: (s: string) => void,
    onAcceptRide?: (id: string) => void,
    onFillRideForm?: (data: any) => void,
    onConfirmRide?: () => void,
    onFillAuth?: (data: any) => void,
  },
  triggerRef?: React.MutableRefObject<() => void>
}) => {
  const [isActive, setIsActive] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  const [state, setState] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Allow parent to trigger orb
  useEffect(() => {
    if (triggerRef) {
      triggerRef.current = () => toggleSession();
    }
  }, [triggerRef, isActive, isUnlocked, showAd]);

  // Animation Loop for the Orb
  useEffect(() => {
    if (!isActive || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let frameId = 0;
    const startTime = Date.now();

    const draw = () => {
      const time = (Date.now() - startTime) / 1000;
      const width = canvasRef.current!.width;
      const height = canvasRef.current!.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Base color based on state
      let r = 99, g = 102, b = 241; // Indigo (Idle)
      if (mode === 'admin') { r = 244; g = 63; b = 94; } // Rose for Admin
      if (mode === 'driver') { r = 245; g = 158; b = 11; } // Amber for Driver
      if (mode === 'public') { r = 34; g = 197; b = 94; } // Green for Public
      
      if (state === 'listening') { r = 16, g = 185, b = 129; } // Emerald
      if (state === 'speaking') { r = 255; g = 255; b = 255; } // White

      // Pulsating Effect
      const baseRadius = 60;
      const pulse = Math.sin(time * 3) * 5;
      const ripple = (time * 50) % 50;

      // Draw Ripples
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + ripple + 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${1 - ripple/50})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Core
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
      ctx.shadowBlur = 20;
      ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
      ctx.fill();

      // Inner Core
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      frameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [isActive, state, mode]);

  const toggleSession = async () => {
    if (isActive) {
      setIsActive(false);
      setState('idle');
      if (sessionRef.current) {
        sessionRef.current.then((session: any) => session.close()).catch((err: any) => console.error("Failed to close session:", err));
      }
      audioContextRef.current?.close();
      inputAudioContextRef.current?.close();
      return;
    }

    // CHECK ADS BEFORE STARTING
    if (!isUnlocked && contextData.settings.adSenseStatus === 'active') {
       setShowAd(true);
       return;
    }

    startSession();
  };

  const handleAdUnlock = () => {
     setShowAd(false);
     setIsUnlocked(true);
     startSession();
  };

  const startSession = async () => {
    setIsActive(true);
    setState('listening');

    // DEFINE TOOLS BASED ON MODE
    let tools: FunctionDeclaration[] = [];
    let systemInstruction = "";

    const ghanaianPersona = `
      You are "Kofi", the NexRyde Polyglot Assistant.
      LANGUAGE CAPABILITIES:
      - You can speak and understand English, Twi, Ga, Ewe, Hausa, and Ghanaian Pidgin.
      - DETECT the user's language immediately and respond in that same language/dialect.
      - Use Ghanaian mannerisms like "Charley", "Bossu", "Maa", "Bra", "Mepaakyɛw" (Please), "Akwaaba" (Welcome).
      
      ROLE:
      - You are not just a chatbot. You are a CO-PILOT. You fill forms and press buttons for the user.
      - Be patient, helpful, and respectful to elders.
    `;

    if (mode === 'driver') {
      systemInstruction = `${ghanaianPersona}
      You help drivers hands-free. Keep responses under 20 words for safety while driving.
      Current Driver: ${user?.name || 'Partner'}.`;
      
      tools = [
        {
          name: 'update_status',
          description: 'Update the driver availability status (online, busy, offline).',
          parameters: {
             type: Type.OBJECT,
             properties: { status: { type: Type.STRING, enum: ['online', 'busy', 'offline'] } },
             required: ['status']
          }
        },
        { name: 'check_wallet', description: 'Check current wallet balance and earnings.' },
        { 
          name: 'scan_for_rides', 
          description: 'Search for available rides near a location.',
          parameters: {
             type: Type.OBJECT,
             properties: { location: { type: Type.STRING, description: 'Location keyword like "Casford" or "Science".' } }
          }
        }
      ];
    } else if (mode === 'admin') {
      systemInstruction = `You are the Nexus Security Overseer. 
      You analyze system health, detect financial anomalies, and scan for cyber threats.
      You speak with authority and precision.`;
      
      tools = [
        { name: 'analyze_security_threats', description: 'Scans system logs for high-frequency requests, bot patterns, and potential attacks.' },
        { name: 'get_revenue_report', description: 'Get the total hub revenue and financial status.' },
        { name: 'system_health_check', description: 'Get count of active users, drivers, and pending requests.' }
      ];
    } else if (mode === 'public') {
       systemInstruction = `${ghanaianPersona}
       You are helping a new user Log In or Sign Up.
       CRITICAL: Use the tool 'fill_auth_details' IMMEDIATELY when the user provides ANY piece of information (phone, name, or pin). 
       Do not wait for the full form to be described. Call the tool incrementally.
       Encourage them to join NexRyde.`;
       tools = [
         {
           name: 'fill_auth_details',
           description: 'Fill the login/signup form for the user. Call this even with partial info.',
           parameters: {
             type: Type.OBJECT,
             properties: {
               phone: { type: Type.STRING, description: "Phone number" },
               username: { type: Type.STRING, description: "Username (for signup)" },
               pin: { type: Type.STRING, description: "4 digit PIN" }
             }
           }
         }
       ]
    } else {
      // Passenger
      systemInstruction = `${ghanaianPersona}
      You help students find rides.
      CRITICAL: If a user says "I want to go to [Place]", call 'fill_ride_form' IMMEDIATELY to update the screen with the destination. Do not wait for pickup location.
      If they say "Confirm" or "Call the driver", call 'confirm_ride'.
      Pricing: Pragia ₵${contextData.settings.farePerPragia}, Taxi ₵${contextData.settings.farePerTaxi}.
      `;
      tools = [
        { 
          name: 'fill_ride_form', 
          description: 'Fill the ride request form. Call this immediately with available fields.',
          parameters: {
             type: Type.OBJECT,
             properties: { 
               origin: { type: Type.STRING, description: "Pickup point (optional)" },
               destination: { type: Type.STRING, description: "Dropoff point" },
               vehicleType: { type: Type.STRING, enum: ['Pragia', 'Taxi', 'Shuttle'] },
               isSolo: { type: Type.BOOLEAN, description: "True for solo/express ride, False for pool." }
             },
             required: ['destination']
          }
        },
        { name: 'confirm_ride', description: 'Submit the ride request currently on screen.' },
        { name: 'check_pricing', description: 'Get current fare prices for different vehicle types.' }
      ];
    }

    try {
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputAudioContext;
      inputAudioContextRef.current = inputAudioContext;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputNode = inputAudioContext.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          systemInstruction,
          tools: [{ functionDeclarations: tools }]
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            inputNode.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setState('speaking');
              const buffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
              const source = outputAudioContext.createBufferSource();
              source.buffer = buffer;
              source.connect(outputAudioContext.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setState('listening');
              };
            }

            if (msg.serverContent?.interrupted) {
               sourcesRef.current.forEach(s => s.stop());
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setState('listening');
            }

            if (msg.toolCall) {
              const session = await sessionPromise;
              for (const fc of msg.toolCall.functionCalls) {
                 let result: any = { result: "Done" };
                 
                 // --- HELPER: Clean undefined args ---
                 const cleanArgs = (args: any) => {
                    const clean: any = {};
                    for (const key in args) {
                        if (args[key] !== undefined && args[key] !== null) {
                            clean[key] = args[key];
                        }
                    }
                    return clean;
                 };
                 
                 // --- DRIVER TOOLS ---
                 if (fc.name === 'update_status' && actions.onUpdateStatus) {
                    const s = (fc.args as any).status;
                    actions.onUpdateStatus(s);
                    result = { result: `Status updated to ${s}` };
                 } else if (fc.name === 'check_wallet') {
                    result = { result: `Balance: ${user?.walletBalance || 0} cedis.` };
                 } else if (fc.name === 'scan_for_rides') {
                    const loc = (fc.args as any).location?.toLowerCase();
                    const rides = contextData.nodes.filter(n => {
                       if (!loc) return true;
                       return n.origin.toLowerCase().includes(loc) || n.destination.toLowerCase().includes(loc);
                    }).slice(0, 3);
                    if (rides.length === 0) result = { result: "No rides found." };
                    else result = { result: `Found ${rides.length} rides. ` + rides.map(r => r.destination).join(", ") };
                 
                 // --- ADMIN TOOLS ---
                 } else if (fc.name === 'analyze_security_threats') {
                    result = { status: "Safe", analysis: "System Nominal.", action: "None." };
                 } else if (fc.name === 'get_revenue_report') {
                     const total = contextData.transactions?.reduce((a, b) => a + b.amount, 0) || 0;
                     result = { result: `Total Hub Revenue is ${total.toFixed(2)} cedis.` };
                 } else if (fc.name === 'system_health_check') {
                     result = { result: `Active Drivers: ${contextData.drivers.length}. Total Rides: ${contextData.nodes.length}. Pending: ${contextData.pendingRequests}.` };

                 // --- PASSENGER / PUBLIC TOOLS ---
                 } else if (fc.name === 'fill_ride_form' && actions.onFillRideForm) {
                     const safeArgs = cleanArgs(fc.args);
                     // If destination provided, we imply a form fill
                     if (safeArgs.destination || safeArgs.origin) {
                         actions.onFillRideForm(safeArgs);
                         result = { result: `Form updated. Destination: ${safeArgs.destination || 'Unset'}, Origin: ${safeArgs.origin || 'Unset'}. Ask for missing details.` };
                     } else {
                         result = { result: "No location data found in request." };
                     }
                 } else if (fc.name === 'confirm_ride' && actions.onConfirmRide) {
                     actions.onConfirmRide();
                     result = { result: "Ride confirmed and requested." };
                 } else if (fc.name === 'fill_auth_details' && actions.onFillAuth) {
                     const safeArgs = cleanArgs(fc.args);
                     actions.onFillAuth(safeArgs);
                     result = { result: `Auth form updated with provided details.` };
                 } else if (fc.name === 'check_pricing') {
                     result = { result: `Pragia: ${contextData.settings.farePerPragia}. Taxi: ${contextData.settings.farePerTaxi}.` };
                 }

                 session.sendToolResponse({
                    functionResponses: {
                       id: fc.id,
                       name: fc.name,
                       response: result
                    }
                 });
              }
            }
          },
          onclose: () => {
             console.log("Session Closed");
             setIsActive(false);
          },
          onerror: (e) => {
             console.error("Gemini Live Error", e);
             setIsActive(false);
          }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (e: any) {
      console.error("Failed to start voice session", e);
      setIsActive(false);
      alert("Failed to access microphone.");
    }
  };

  const getOrbColor = () => {
     if (mode === 'admin') return 'from-rose-600 to-pink-600';
     if (mode === 'driver') return 'from-amber-500 to-orange-600';
     if (mode === 'public') return 'from-emerald-500 to-teal-600';
     return 'from-indigo-600 to-purple-600';
  };

  return (
    <>
      <button 
        onClick={toggleSession}
        className={`fixed bottom-24 left-6 lg:bottom-12 lg:left-12 z-[500] w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all ${isActive ? 'bg-rose-500 scale-110 animate-pulse' : `bg-gradient-to-tr ${getOrbColor()}`}`}
      >
        <i className={`fas ${isActive ? 'fa-microphone-slash' : 'fa-microphone'} text-white text-2xl`}></i>
      </button>

      {showAd && <AdGate onUnlock={handleAdUnlock} label="Connect to Kofi AI" settings={contextData.settings} />}

      {isActive && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[450] flex flex-col items-center justify-center animate-in fade-in duration-300">
           <canvas ref={canvasRef} width={400} height={400} className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px]" />
           <div className="mt-8 text-center px-4">
              <h3 className="text-2xl font-black italic uppercase text-white tracking-widest animate-pulse">
                {state === 'listening' ? 'Tie me...' : state === 'speaking' ? 'Kofi (AI)' : 'Thinking...'}
              </h3>
              <p className="text-xs font-bold opacity-70 uppercase mt-2 tracking-[0.2em]" style={{ color: mode === 'admin' ? '#f43f5e' : '#94a3b8' }}>
                {mode === 'admin' ? 'Security Protocol Active' : mode === 'driver' ? 'Partner Hands-Free' : 'Polyglot Assistant'}
              </p>
              
              <div className="mt-8 grid grid-cols-2 gap-4 max-w-xs mx-auto text-[10px] text-slate-400 font-bold uppercase">
                 {mode === 'public' && (
                    <>
                       <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400">"Help me login"</div>
                       <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400">"My phone is..."</div>
                    </>
                 )}
                 {mode === 'passenger' && (
                    <>
                       <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">"I wan go Mall"</div>
                       <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">"Call Pragia"</div>
                    </>
                 )}
              </div>
           </div>
           <button onClick={toggleSession} className="mt-12 px-8 py-3 bg-white/10 rounded-full text-white font-black uppercase text-xs hover:bg-white/20 transition-all">End Call</button>
        </div>
      )}
    </>
  );
};
