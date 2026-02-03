
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

/**
 * Downsamples audio buffer to 16kHz for Gemini compatibility.
 * Simple averaging is used to prevent aliasing.
 */
function downsampleTo16k(buffer: Float32Array, sampleRate: number): Float32Array {
  if (sampleRate === 16000) return buffer;
  const ratio = sampleRate / 16000;
  const newLength = Math.ceil(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function createBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = Math.max(-1, Math.min(1, data[i])) * 32768; // Clamp values
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
  type: 'commission' | 'topup' | 'registration' | 'refund'; 
  timestamp: string;
}

interface AppSettings {
  id?: number;
  adminMomo: string;
  adminMomoName: string;
  whatsappNumber: string;
  commissionPerSeat: number;
  shuttleCommission: number; 
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
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  adSenseClientId?: string;
  adSenseSlotId?: string;
  adSenseLayoutKey?: string;
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
  const [state, setState] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    if (triggerRef) {
      triggerRef.current = () => toggleSession();
    }
  }, [triggerRef, isActive]);

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

      let r = 99, g = 102, b = 241; 
      if (mode === 'admin') { r = 244; g = 63; b = 94; } 
      if (mode === 'driver') { r = 245; g = 158; b = 11; } 
      if (mode === 'public') { r = 34; g = 197; b = 94; } 
      
      if (state === 'listening') { r = 16, g = 185, b = 129; } 
      if (state === 'speaking') { r = 255; g = 255; b = 255; } 

      const baseRadius = 60;
      const pulse = Math.sin(time * 3) * 5;
      const ripple = (time * 50) % 50;

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + ripple + 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${1 - ripple/50})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
      ctx.shadowBlur = 20;
      ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
      ctx.fill();

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

    setIsActive(true);
    setState('listening');

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
      systemInstruction = `${ghanaianPersona}
      You help students find rides.
      CRITICAL: If a user says "I want to go to [Place]" or asks to find a location like "Best Waakye spot", use the 'find_destination' tool to get the real address, then call 'fill_ride_form'.
      If they say "Confirm" or "Call the driver", call 'confirm_ride'.
      Pricing: Pragia ₵${contextData.settings.farePerPragia}, Taxi ₵${contextData.settings.farePerTaxi}.
      `;
      tools = [
        { 
          name: 'fill_ride_form', 
          description: 'Fill the ride request form.',
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
        {
          name: 'find_destination',
          description: 'Use Google Maps to find a place or business name when the user is unsure of the address or asks for a recommendation (e.g., "Find food", "Take me to Casford").',
          parameters: {
             type: Type.OBJECT,
             properties: { query: { type: Type.STRING, description: "The search query for the place." } },
             required: ['query']
          }
        },
        { name: 'confirm_ride', description: 'Submit the ride request currently on screen.' },
        { name: 'check_pricing', description: 'Get current fare prices for different vehicle types.' }
      ];
    }

    try {
      // Use device native sample rate to prevent audio glitching on mobile
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Explicit resume for mobile browsers
      await inputAudioContext.resume();
      await outputAudioContext.resume();

      audioContextRef.current = outputAudioContext;
      inputAudioContextRef.current = inputAudioContext;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputNode = inputAudioContext.createMediaStreamSource(stream);
      // Use larger buffer size for better stability on lower-end devices
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
              // Downsample to 16k before sending to Gemini
              const downsampledData = downsampleTo16k(inputData, inputAudioContext.sampleRate);
              const pcmBlob = createBlob(downsampledData);
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
                 
                 const cleanArgs = (args: any) => {
                    const clean: any = {};
                    for (const key in args) {
                        if (args[key] !== undefined && args[key] !== null) {
                            clean[key] = args[key];
                        }
                    }
                    return clean;
                 };
                 
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
                 
                 } else if (fc.name === 'find_destination' && actions.onFillRideForm) {
                    const query = (fc.args as any).query;
                    // Use standard GenerateContent with Maps tool for retrieval
                    try {
                        const searchAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
                        const mapsResp = await searchAi.models.generateContent({
                            model: "gemini-2.5-flash",
                            contents: `Find the best match for: ${query}. Return the name and address.`,
                            config: {
                                tools: [{ googleMaps: {} }]
                            }
                        });
                        
                        // Heuristic to extract grounding
                        const chunks = mapsResp.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                        const mapChunk = chunks.find((c: any) => c.web?.title || c.web?.uri); // Maps grounding structure fallback
                        
                        let placeName = query;
                        if (mapChunk && mapChunk.web) {
                            placeName = mapChunk.web.title;
                        } else {
                            // Fallback to text
                            placeName = mapsResp.text?.split('\n')[0] || query;
                        }
                        
                        // Clean up text response if it's chatty
                        placeName = placeName.replace("The best match is ", "").replace(".", "");

                        actions.onFillRideForm({ destination: placeName });
                        result = { result: `Found ${placeName}. Ride form updated.` };
                    } catch (err) {
                        console.error("Maps grounding failed", err);
                        result = { result: "Could not find location data. Please try again." };
                    }

                 } else if (fc.name === 'analyze_security_threats') {
                    result = { status: "Safe", analysis: "System Nominal.", action: "None." };
                 } else if (fc.name === 'get_revenue_report') {
                     const total = contextData.transactions?.reduce((a, b) => a + b.amount, 0) || 0;
                     result = { result: `Total Hub Revenue is ${total.toFixed(2)} cedis.` };
                 } else if (fc.name === 'system_health_check') {
                     result = { result: `Active Drivers: ${contextData.drivers.length}. Total Rides: ${contextData.nodes.length}. Pending: ${contextData.pendingRequests}.` };

                 } else if (fc.name === 'fill_ride_form' && actions.onFillRideForm) {
                     const safeArgs = cleanArgs(fc.args);
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
                       <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">"I want Waakye"</div>
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

const HubGateway = ({ 
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
      <div className="glass-bright w-full max-md:mt-12 max-w-md p-8 rounded-[3rem] border border-white/10 relative z-10 animate-in zoom-in duration-500">
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

        <button 
          onClick={onTriggerVoice}
          className="w-full mb-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform shadow-xl shadow-emerald-900/20 group"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <i className="fas fa-microphone"></i>
          </div>
          <div className="text-left">
             <span className="block text-[10px] font-black uppercase tracking-widest opacity-80">Local Language Support</span>
             <span className="block text-sm font-black italic">Kasa (Speak to Login)</span>
          </div>
        </button>

        <div className="space-y-4">
           {formState.mode === 'signup' && (
             <input 
               value={formState.username} 
               onChange={e => setFormState({...formState, username: e.target.value})}
               className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
               placeholder="Choose Username"
             />
           )}
           <input 
             value={formState.phone} 
             onChange={e => setFormState({...formState, phone: e.target.value})}
             className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
             placeholder="Phone Number"
           />
           <input 
             value={formState.pin}
             type="password"
             maxLength={4} 
             onChange={e => setFormState({...formState, pin: e.target.value.replace(/\D/g, '').slice(0, 4)})}
             className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600 tracking-widest text-center"
             placeholder="4-Digit Security PIN"
           />
           <button 
             onClick={() => onIdentify(formState.username, formState.phone, formState.pin, formState.mode)}
             className="w-full bg-amber-500 text-[#020617] py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl"
           >
             {formState.mode === 'login' ? 'Enter Hub' : 'Create Identity'}
           </button>
        </div>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setFormState({...formState, mode: formState.mode === 'login' ? 'signup' : 'login'})}
            className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            {formState.mode === 'login' ? 'New here? Create Account' : 'Have an account? Login'}
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

const PassengerPortal = ({ 
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
            
            <div className="relative">
              <input value={newNode.origin} onChange={e => setNewNode({...newNode, origin: e.target.value})} placeholder="Pickup Location" className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white font-bold outline-none text-sm focus:border-indigo-500" />
              <button onClick={onTriggerVoice} className="absolute right-2 top-2 w-8 h-8 flex items-center justify-center text-indigo-400 hover:text-white"><i className="fas fa-microphone"></i></button>
            </div>
            <div className="relative">
              <input value={newNode.destination} onChange={e => setNewNode({...newNode, destination: e.target.value})} placeholder="Dropoff Location" className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white font-bold outline-none text-sm focus:border-indigo-500" />
              <button onClick={onTriggerVoice} className="absolute right-2 top-2 w-8 h-8 flex items-center justify-center text-indigo-400 hover:text-white"><i className="fas fa-microphone"></i></button>
            </div>
            
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
               {['Pragia', 'Taxi', 'Shuttle'].map(v => (
                 <button key={v} onClick={() => setNewNode({...newNode, vehicleType: v as any})} className={`px-4 py-2 rounded-lg border border-white/10 font-black text-[10px] uppercase ${newNode.vehicleType === v ? 'bg-amber-500 text-[#020617]' : 'bg-white/5 text-slate-400'}`}>
                    {v}
                 </button>
               ))}
            </div>

            <div className="p-6 bg-indigo-900/30 rounded-2xl border border-indigo-500/20 space-y-3">
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
                      <button onClick={() => adjustOffer(-0.5)} className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all">
                          <i className="fas fa-minus"></i>
                      </button>
                      <input 
                          type="number" 
                          step="0.5"
                          value={offerInput}
                          onChange={handleOfferChange}
                          onBlur={handleOfferBlur}
                          className="flex-1 bg-[#020617]/50 border border-white/10 rounded-xl px-4 py-3 text-white font-black text-lg text-center outline-none focus:border-emerald-500 transition-colors"
                      />
                      <button onClick={() => adjustOffer(0.5)} className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all">
                          <i className="fas fa-plus"></i>
                      </button>
                   </div>
               </div>
            </div>

            <button onClick={handleSubmit} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Confirm Request</button>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
       {myRides.length > 0 && (
         <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">My Active Trips</h3>
            {myRides.map((node: RideNode) => {
              const myPassengerInfo = node.passengers.find(p => p.phone === currentUser.phone);
              const myPin = myPassengerInfo?.verificationCode;
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

       <div onClick={() => setCreateMode(true)} className="glass p-8 rounded-[2.5rem] border-2 border-dashed border-white/10 hover:border-amber-500/50 cursor-pointer group transition-all text-center space-y-2">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-500 group-hover:bg-amber-500 group-hover:text-[#020617] transition-all">
             <i className="fas fa-plus"></i>
          </div>
          <h3 className="text-lg font-black uppercase italic text-white group-hover:text-amber-500 transition-colors">Start New Trip</h3>
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
                <div className={`glass p-6 rounded-[2rem] border transition-all ${isPartnerOffer ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'border-white/5 hover:border-white/10'}`}>
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

// ... (rest of components like DriverPortal, AdminPortal same as before until App)
const DriverPortal = ({ 
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
  isLoading
}: any) => {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [isScanning, setIsScanning] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isPlayingBriefing, setIsPlayingBriefing] = useState(false);
  
  const [regMode, setRegMode] = useState(false);
  const [regData, setRegData] = useState<any>({ name: '', vehicleType: 'Pragia', licensePlate: '', contact: '', pin: '', amount: 20, momoReference: '', avatarUrl: '' });

  const [activeTab, setActiveTab] = useState<'market' | 'active' | 'wallet' | 'broadcast'>('market');
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
              <div className="glass p-8 rounded-[2.5rem] border border-white/10 max-w-lg mx-auto animate-in zoom-in relative">
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
          <div className="glass p-8 rounded-[2.5rem] border border-white/10 max-w-sm mx-auto text-center space-y-6 animate-in zoom-in">
             <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
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
                }} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition-all">
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
                   <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 min-w-[80px] px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                      {tab}
                      {tab === 'active' && myActiveRides.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>}
                   </button>
               ))}
            </div>
            <button onClick={playMorningBriefing} disabled={isPlayingBriefing} className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-[#020617] shadow-lg hover:scale-105 transition-transform disabled:opacity-50">
               {isPlayingBriefing ? <i className="fas fa-volume-high animate-pulse"></i> : <i className="fas fa-play"></i>}
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
                                 <div key={node.id} className={`glass p-6 rounded-[2rem] border transition-all group relative ${isHighFare ? 'border-amber-500/40 shadow-lg shadow-amber-500/10' : 'border-white/5 hover:border-indigo-500/30'}`}>
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
                      <div key={node.id} className="glass p-8 rounded-[2.5rem] border border-indigo-500/30 bg-indigo-900/10 relative overflow-hidden">
                          <div className="relative z-10">
                              <div className="flex justify-between items-start mb-6">
                                  <div>
                                     <span className="px-3 py-1 bg-emerald-500 text-[#020617] rounded-lg text-[9px] font-black uppercase mb-2 inline-block animate-pulse">In Progress</span>
                                     <h3 className="text-2xl font-black text-white">{node.destination}</h3>
                                     <p className="text-xs text-slate-300">Pickup: {node.origin}</p>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-3xl font-black text-white">₵ {node.negotiatedTotalFare || (node.farePerPerson * node.passengers.length)}</p>
                                     <p className="text-[10px] font-bold text-indigo-300 uppercase">Total Fare</p>
                                  </div>
                              </div>
                              
                              <div className="bg-black/30 p-6 rounded-2xl mb-6 border border-white/5">
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

                              <button onClick={() => setIsScanning(node.id)} className="w-full py-8 bg-gradient-to-tr from-white to-slate-200 text-indigo-900 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center mb-6 animate-pulse hover:scale-[1.02] transition-transform">
                                  <i className="fas fa-qrcode text-4xl mb-2"></i>
                                  <span className="text-xl font-black uppercase tracking-tight">Scan Rider Code</span>
                                  <span className="text-[10px] font-bold uppercase opacity-60">Tap to Verify</span>
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
                                  <button onClick={() => onCancel(node.id)} className="w-12 h-12 mx-auto flex items-center justify-center bg-rose-500/20 text-rose-500 rounded-full hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-ban"></i></button>
                                  <p className="text-[9px] text-rose-500 font-bold uppercase mt-2">Cancel Trip</p>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}

          {activeTab === 'broadcast' && (
              <div className="space-y-8">
                  <div className="glass p-6 md:p-8 rounded-[2.5rem] border border-white/10">
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
                            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all ${!canAffordBroadcast && isShuttle ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
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
              <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
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
                          }} className="w-full py-3 bg-emerald-500 text-[#020617] rounded-xl font-black text-[9px] uppercase shadow-lg">Request Credit</button>
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

// ... (rest of AdminPortal etc)
const AdminPortal = ({ 
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
      // Vercel / Production fix: Use environment variable only
      if (!process.env.API_KEY) {
          alert("API Key not found in environment variables. Please check deployment settings.");
          return;
      }

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
              // For demo purposes, we will just open it or alert. 
              // In production, we'd save to storage.
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
             model: 'gemini-3-pro-preview',
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
       <div className="glass p-6 rounded-[2.5rem] border border-white/10 flex justify-between items-center">
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
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[80px] px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                 {tab}
              </button>
          ))}
       </div>

       {activeTab === 'monitor' && (
          <div className="space-y-6">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Total Revenue</p>
                    <p className="text-2xl font-black text-white">₵ {hubRevenue.toFixed(2)}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Active Drivers</p>
                    <p className="text-2xl font-black text-emerald-400">{drivers.filter((d:any) => d.status === 'online').length} / {drivers.length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Active Rides</p>
                    <p className="text-2xl font-black text-amber-500">{nodes.filter((n:any) => n.status !== 'completed').length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Pending Regs</p>
                    <p className="text-2xl font-black text-indigo-400">{registrationRequests.filter((r:any) => r.status === 'pending').length}</p>
                </div>
             </div>
             
             <div className="glass p-8 rounded-[2rem] border border-white/10">
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
           <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
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
                       <p className="text-[9px] text-slate-400">Requires a paid billing project. You will be asked to select an API Key if not already selected.</p>
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
           <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
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

// ... (Rest of App and rootElement code remains the same)
// --- APP COMPONENT ---

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState('monitor'); 
  
  const [session, setSession] = useState<any>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UniUser | null>(() => {
    const saved = localStorage.getItem('nexryde_user_v1');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => {
    return sessionStorage.getItem('nexryde_driver_session_v1');
  });

  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    query: '',
    vehicleType: 'All',
    status: 'All',
    sortBy: 'newest',
    isSolo: null
  });

  const [authFormState, setAuthFormState] = useState({ username: '', phone: '', pin: '', mode: 'login' as 'login' | 'signup' });
  const [createMode, setCreateMode] = useState(false);
  const [newNode, setNewNode] = useState<Partial<RideNode>>({ origin: '', destination: '', vehicleType: 'Pragia', isSolo: false });
  const triggerVoiceRef = useRef<() => void>(() => {});

  const [myRideIds, setMyRideIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nexryde_my_rides_v1');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [isNewUser, setIsNewUser] = useState(() => !localStorage.getItem('nexryde_seen_welcome_v1'));
  const [isSyncing, setIsSyncing] = useState(true);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState(() => localStorage.getItem('nexryde_dismissed_announcement'));
  
  const [showAiAd, setShowAiAd] = useState(false);
  const [isAiUnlocked, setIsAiUnlocked] = useState(false);

  const [settings, setSettings] = useState<AppSettings>({
    adminMomo: "024-123-4567",
    adminMomoName: "NexRyde Admin",
    whatsappNumber: "233241234567",
    commissionPerSeat: 2.00,
    shuttleCommission: 0.5,
    farePerPragia: 5.00,
    farePerTaxi: 8.00,
    soloMultiplier: 2.5,
    aboutMeText: "Welcome to NexRyde Logistics.",
    aboutMeImages: [],
    appWallpaper: "",
    appLogo: "",
    registrationFee: 20.00,
    hub_announcement: "",
    facebookUrl: "",
    instagramUrl: "",
    tiktokUrl: "",
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
        // Map snake_case from DB to camelCase for state
        const mappedSettings: AppSettings = {
            ...settings, 
            ...sData, 
            adminMomo: sData.admin_momo || sData.adminMomo || settings.adminMomo,
            adminMomoName: sData.admin_momo_name || sData.adminMomoName || settings.adminMomoName,
            whatsappNumber: sData.whatsapp_number || sData.whatsappNumber || settings.whatsappNumber,
            commissionPerSeat: sData.commission_per_seat || sData.commissionPerSeat || settings.commissionPerSeat,
            shuttleCommission: sData.shuttle_commission || sData.shuttleCommission || settings.shuttleCommission,
            farePerPragia: sData.fare_per_pragia || sData.farePerPragia || settings.farePerPragia,
            farePerTaxi: sData.fare_per_taxi || sData.farePerTaxi || settings.farePerTaxi,
            soloMultiplier: sData.solo_multiplier || sData.soloMultiplier || settings.soloMultiplier,
            aboutMeText: sData.about_me_text || sData.aboutMeText || settings.aboutMeText,
            aboutMeImages: sData.about_me_images || sData.aboutMeImages || settings.aboutMeImages,
            appWallpaper: sData.app_wallpaper || sData.appWallpaper || settings.appWallpaper,
            appLogo: sData.app_logo || sData.appLogo || settings.appLogo,
            registrationFee: sData.registration_fee || sData.registrationFee || settings.registrationFee,
            facebookUrl: sData.facebook_url || sData.facebookUrl || settings.facebookUrl,
            instagramUrl: sData.instagram_url || sData.instagramUrl || settings.instagramUrl,
            tiktokUrl: sData.tiktok_url || sData.tiktokUrl || settings.tiktokUrl,
            adSenseClientId: sData.adsense_client_id || sData.adSenseClientId || settings.adSenseClientId,
            adSenseSlotId: sData.adsense_slot_id || sData.adSenseSlotId || settings.adSenseSlotId,
            adSenseLayoutKey: sData.adsense_layout_key || sData.adSenseLayoutKey || settings.adSenseLayoutKey,
            adSenseStatus: sData.adsense_status || sData.adSenseStatus || settings.adSenseStatus,
            hub_announcement: sData.hub_announcement || settings.hub_announcement, 
            id: sData.id
        };
        setSettings(mappedSettings);

        const currentMsg = mappedSettings.hub_announcement || '';
        if (currentMsg !== localStorage.getItem('nexryde_last_announcement')) {
          setDismissedAnnouncement(null);
          localStorage.removeItem('nexryde_dismissed_announcement');
          localStorage.setItem('nexryde_last_announcement', currentMsg);
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
  const isDriverLoading = !!(activeDriverId && !activeDriver && isSyncing);
  const onlineDriverCount = useMemo(() => drivers.filter(d => d.status === 'online').length, [drivers]);
  const activeNodeCount = useMemo(() => nodes.filter(n => n.status !== 'completed').length, [nodes]);
  const hubRevenue = useMemo(() => transactions.reduce((a, b) => a + b.amount, 0), [transactions]);
  const pendingRequestsCount = useMemo(() => 
    topupRequests.filter(r => r.status === 'pending').length + 
    registrationRequests.filter(r => r.status === 'pending').length, 
  [topupRequests, registrationRequests]);

  const getLatestDriver = async (id: string) => {
    const { data, error } = await supabase.from('unihub_drivers').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Driver;
  };

  const handleGlobalUserAuth = async (username: string, phone: string, pin: string, mode: 'login' | 'signup') => {
    if (!phone || !pin) {
      alert("Phone number and 4-digit PIN are required.");
      return;
    }
    if (pin.length !== 4) {
       alert("PIN must be exactly 4 digits.");
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

        if (user.pin) {
            if (user.pin !== pin) {
                alert("Access Denied: Incorrect PIN.");
                setIsSyncing(false);
                return;
            }
        } else {
            await supabase.from('unihub_users').update({ pin }).eq('id', user.id);
            user.pin = pin; 
            alert("Security Update: This PIN has been linked to your account.");
        }

        setCurrentUser(user);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(user));
      } else {
        if (data) {
          alert("An account with this phone already exists! Please Sign In.");
          setIsSyncing(false);
          return;
        }
        if (!username) { alert("Please enter a username for your profile."); setIsSyncing(false); return; }
        
        const newUser: UniUser = { id: `USER-${Date.now()}`, username, phone, pin };
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
    if (!mission) return;
    
    const latestDriver = await getLatestDriver(driverId);
    if (!latestDriver) return;

    if (mission.driversJoined.includes(driverId)) {
      alert("You are already stationed at this hotspot.");
      return;
    }
    if (latestDriver.walletBalance < mission.entryFee) {
      alert("Insufficient Balance for Hotspot Entry Fee.");
      return;
    }

    const newJoined = [...mission.driversJoined, driverId];
    
    await Promise.all([
      supabase.from('unihub_missions').update({ driversJoined: newJoined }).eq('id', missionId),
      supabase.from('unihub_drivers').update({ walletBalance: latestDriver.walletBalance - mission.entryFee }).eq('id', driverId),
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
      let updatedStatus: NodeStatus = node.status;
      if (isQualified && node.status === 'forming') {
          updatedStatus = 'qualified';
      }
      
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
    const latestDriver = await getLatestDriver(driverId);
    const node = nodes.find(n => n.id === nodeId);
    if (!latestDriver || !node) return;

    const activeRide = nodes.find(n => n.assignedDriverId === driverId && n.status !== 'completed');
    if (activeRide) {
        alert("Please complete your current active ride or broadcast before accepting a new one.");
        return;
    }

    const totalCommission = settings.commissionPerSeat * node.passengers.length;

    if (latestDriver.walletBalance < totalCommission) {
      alert(`Insufficient Credits! You need at least ₵${totalCommission.toFixed(2)} to accept this ride.`);
      return;
    }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const updatedPassengers = node.passengers.map(p => ({
        ...p,
        verificationCode: Math.floor(1000 + Math.random() * 9000).toString()
    }));

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
                walletBalance: latestDriver.walletBalance - totalCommission 
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

    if (node.status === 'completed') {
        alert("Trip already completed.");
        return;
    }

    const isMasterCode = node.verificationCode === code;
    const passengerMatch = node.passengers.find(p => p.verificationCode === code);

    if (isMasterCode || passengerMatch) {
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
      if (node.assignedDriverId) {
        // Fetch latest driver data for absolute arithmetic precision
        const latestDriver = await getLatestDriver(node.assignedDriverId);
        if (!latestDriver) throw new Error("Driver sync error.");
        
        const isShuttle = node.vehicleType === 'Shuttle';
        const isBroadcast = node.leaderPhone === latestDriver.contact;

        if (node.status === 'dispatched') {
             let refundAmount = 0;
             if (isShuttle && isBroadcast) {
                 const cap = node.capacityNeeded;
                 const rate = settings.shuttleCommission || settings.commissionPerSeat;
                 refundAmount = cap * rate;
             } else {
                 refundAmount = settings.commissionPerSeat * node.passengers.length;
             }

             await Promise.all([
                 supabase.from('unihub_drivers').update({ 
                     walletBalance: latestDriver.walletBalance + refundAmount 
                 }).eq('id', latestDriver.id),
                 supabase.from('unihub_transactions').insert([{
                    id: `TX-REFUND-${Date.now()}`,
                    driverId: latestDriver.id,
                    amount: refundAmount,
                    type: 'refund',
                    timestamp: new Date().toLocaleString()
                 }])
             ]);
        }

        if (isBroadcast || (node.status === 'forming' && node.passengers.length === 0)) {
            if (node.status !== 'dispatched') {
                if (isShuttle && isBroadcast) {
                     const cap = node.capacityNeeded;
                     const rate = settings.shuttleCommission || settings.commissionPerSeat;
                     const refundAmount = cap * rate;
                     await Promise.all([
                        supabase.from('unihub_drivers').update({ walletBalance: latestDriver.walletBalance + refundAmount }).eq('id', latestDriver.id),
                        supabase.from('unihub_transactions').insert([{
                            id: `TX-REFUND-PRE-${Date.now()}`,
                            driverId: latestDriver.id,
                            amount: refundAmount,
                            type: 'refund',
                            timestamp: new Date().toLocaleString()
                        }])
                    ]);
                }
            }

            await supabase.from('unihub_nodes').delete().eq('id', nodeId);
            alert("Trip cancelled" + (isShuttle && isBroadcast ? " and commission refunded." : "."));
            return;
        }

        const resetStatus = (node.isSolo || node.isLongDistance) ? 'qualified' : (node.passengers.length >= 4 ? 'qualified' : 'forming');
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
        alert("Trip assignment reset. Commission refunded.");

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

  const handleBroadcast = async (data: any) => {
      if (!activeDriverId) return;
      const latestDriver = await getLatestDriver(activeDriverId);
      if (!latestDriver) return;
      
      const activeRide = nodes.find(n => n.assignedDriverId === activeDriverId && n.status !== 'completed');
      if (activeRide) { alert("You already have an active/broadcasting trip."); return; }

      const isShuttle = latestDriver.vehicleType === 'Shuttle';
      const rawSeats = parseInt(data.seats);
      const capacity = (!rawSeats || rawSeats < 1) ? (isShuttle ? 10 : 3) : rawSeats;
      const rate = isShuttle ? (settings.shuttleCommission || settings.commissionPerSeat) : settings.commissionPerSeat;
      const commissionAmount = isShuttle ? (capacity * rate) : 0;
      
      if (isShuttle && latestDriver.walletBalance < commissionAmount) {
         alert(`Insufficient Wallet Balance. Shuttle broadcasts require prepaid commission of ₵${commissionAmount.toFixed(2)}.`);
         return;
      }

      const node: RideNode = {
          id: `NODE-DRV-${Date.now()}`,
          origin: data.origin,
          destination: data.destination,
          capacityNeeded: capacity,
          passengers: [],
          status: 'forming',
          leaderName: latestDriver.name,
          leaderPhone: latestDriver.contact,
          farePerPerson: data.fare,
          createdAt: new Date().toISOString(),
          assignedDriverId: activeDriverId,
          vehicleType: latestDriver.vehicleType,
          driverNote: data.note
      };
      
      try {
          if (isShuttle) {
             const { error: updError } = await supabase.from('unihub_drivers').update({ walletBalance: latestDriver.walletBalance - commissionAmount }).eq('id', latestDriver.id);
             if (updError) throw updError;
             
             await supabase.from('unihub_transactions').insert([{
                id: `TX-COMM-PRE-${Date.now()}`,
                driverId: latestDriver.id,
                amount: commissionAmount,
                type: 'commission',
                timestamp: new Date().toLocaleString()
             }]);
          }

          const { error: insError } = await supabase.from('unihub_nodes').insert([node]);
          if(insError) {
             // Rollback using relative addition based on LATEST database balance
             if (isShuttle) {
                console.warn("Node creation failed. Initiating relative commission rollback...");
                const reLatest = await getLatestDriver(activeDriverId);
                await supabase.from('unihub_drivers').update({ walletBalance: reLatest.walletBalance + commissionAmount }).eq('id', latestDriver.id);
                await supabase.from('unihub_transactions').insert([{
                    id: `TX-ROLLBACK-${Date.now()}`,
                    driverId: latestDriver.id,
                    amount: commissionAmount,
                    type: 'refund',
                    timestamp: new Date().toLocaleString()
                }]);
             }
             throw insError;
          }
          
          alert(isShuttle ? `Route broadcasted! ₵${commissionAmount.toFixed(2)} commission prepaid.` : "Route broadcasted to passengers!"); 
      } catch(e: any) {
          console.error("Broadcast Logic Failure:", e);
          alert("Broadcast failed: " + e.message + ". Funds protected.");
      }
  };

  const handleStartBroadcast = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !activeDriverId) return;
    const latestDriver = await getLatestDriver(activeDriverId);
    if (!latestDriver) return;
    
    if (node.passengers.length === 0) {
        alert("Cannot start trip with 0 passengers.");
        return;
    }

    const isShuttle = node.vehicleType === 'Shuttle';
    const totalCommission = settings.commissionPerSeat * node.passengers.length;
    
    if (!isShuttle) {
        if (latestDriver.walletBalance < totalCommission) {
            alert(`Insufficient funds. Need ₵${totalCommission} for ${node.passengers.length} passengers.`);
            return;
        }
    }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const updatedPassengers = node.passengers.map(p => ({
        ...p,
        verificationCode: Math.floor(1000 + Math.random() * 9000).toString()
    }));

    const updates: any[] = [
        supabase.from('unihub_nodes').update({
            status: 'dispatched',
            verificationCode,
            passengers: updatedPassengers,
        }).eq('id', nodeId)
    ];

    if (!isShuttle) {
        updates.push(
            supabase.from('unihub_drivers').update({
                walletBalance: latestDriver.walletBalance - totalCommission
            }).eq('id', activeDriverId)
        );
        updates.push(
            supabase.from('unihub_transactions').insert([{
                 id: `TX-COMM-${Date.now()}`,
                 driverId: activeDriverId,
                 amount: totalCommission,
                 type: 'commission',
                 timestamp: new Date().toLocaleString()
            }])
        );
    }

    await Promise.all(updates);
    alert("Trip started! Passengers notified with codes.");
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

    const latestDriver = await getLatestDriver(req.driverId);
    if (!latestDriver) return;

    await Promise.all([
      supabase.from('unihub_drivers').update({ walletBalance: latestDriver.walletBalance + req.amount }).eq('id', req.driverId),
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
    const targetId = id || 1;
    
    // Map state to DB columns. 
    // FIXED: Using camelCase to match the provided SQL schema dump, except for hub_announcement.
    const dbPayload = {
        adminMomo: data.adminMomo,
        adminMomoName: data.adminMomoName,
        whatsappNumber: data.whatsappNumber,
        commissionPerSeat: data.commissionPerSeat,
        shuttleCommission: data.shuttleCommission,
        farePerPragia: data.farePerPragia,
        farePerTaxi: data.farePerTaxi,
        soloMultiplier: data.soloMultiplier,
        aboutMeText: data.aboutMeText,
        aboutMeImages: data.aboutMeImages,
        appWallpaper: data.appWallpaper,
        appLogo: data.appLogo,
        registrationFee: data.registrationFee,
        hub_announcement: data.hub_announcement,
        facebookUrl: data.facebookUrl,
        instagramUrl: data.instagramUrl,
        tiktokUrl: data.tiktokUrl,
        adSenseClientId: data.adSenseClientId,
        adSenseSlotId: data.adSenseSlotId,
        adSenseLayoutKey: data.adSenseLayoutKey,
        adSenseStatus: data.adSenseStatus
    };

    const { error } = await supabase.from('unihub_settings').upsert({ id: targetId, ...dbPayload });
    
    if (error) {
         console.error("Save Error", error);
         alert("Error saving settings: " + error.message);
    } else {
         alert("Settings Updated Successfully!");
    }
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
    localStorage.setItem('nexryde_dismissed_announcement', 'true');
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

  const aiActions = {
     onUpdateStatus: async (status: string) => {
        if (activeDriverId) await supabase.from('unihub_drivers').update({ status }).eq('id', activeDriverId);
     },
     onFillAuth: (data: any) => {
        setAuthFormState(prev => ({...prev, ...data}));
     },
     onFillRideForm: (data: any) => {
        setCreateMode(true);
        setNewNode(prev => ({...prev, ...data}));
     },
     onConfirmRide: () => {
       if (newNode.destination) {
         setCreateMode(true);
         setTimeout(() => {
            const baseFare = newNode.vehicleType === 'Taxi' ? settings.farePerTaxi : settings.farePerPragia;
            const finalFare = newNode.isSolo ? baseFare * settings.soloMultiplier : baseFare;
            
            if(!currentUser) return;
            
            const node: RideNode = {
                id: `NODE-${Date.now()}`,
                origin: newNode.origin || "Current Location",
                destination: newNode.destination!,
                vehicleType: newNode.vehicleType || 'Pragia',
                isSolo: newNode.isSolo,
                capacityNeeded: newNode.isSolo ? 1 : (newNode.vehicleType === 'Taxi' ? 4 : 3),
                passengers: [{ id: currentUser.id, name: currentUser.username, phone: currentUser.phone }],
                status: newNode.isSolo ? 'qualified' : 'forming',
                leaderName: currentUser.username,
                leaderPhone: currentUser.phone,
                farePerPerson: finalFare,
                createdAt: new Date().toISOString()
            };
            
            supabase.from('unihub_nodes').insert([node]).then(({error}) => {
                if(!error) {
                    addRideToMyList(node.id);
                    setCreateMode(false);
                    setNewNode({ origin: '', destination: '', vehicleType: 'Pragia', isSolo: false });
                }
            });
         }, 500);
       }
     }
  };

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

      <GlobalVoiceOrb 
        mode={currentUser ? viewMode : 'public'}
        user={viewMode === 'driver' ? activeDriver : currentUser}
        contextData={{
            nodes,
            drivers,
            transactions,
            settings,
            pendingRequests: pendingRequestsCount
        }}
        actions={aiActions}
        triggerRef={triggerVoiceRef}
      />

      {!currentUser ? (
         <HubGateway 
            onIdentify={handleGlobalUserAuth} 
            settings={settings} 
            formState={authFormState}
            setFormState={setAuthFormState}
            onTriggerVoice={() => triggerVoiceRef.current?.()}
         />
      ) : (
        <>
      {settings.hub_announcement && !dismissedAnnouncement && (
        <div className="fixed top-0 left-0 right-0 z-[2000] bg-gradient-to-r from-amber-600 to-rose-600 px-4 py-3 flex items-start sm:items-center justify-between shadow-2xl animate-in slide-in-from-top duration-500 border-b border-white/10">
           <div className="flex items-start sm:items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse shrink-0 mt-0.5 sm:mt-0">
                <i className="fas fa-bullhorn text-white text-xs"></i>
              </div>
              <p className="text-[10px] sm:text-xs font-black uppercase italic text-white tracking-tight leading-relaxed break-words">{settings.hub_announcement}</p>
           </div>
           <button onClick={handleDismissAnnouncement} className="ml-4 w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-white text-[10px] hover:bg-white/30 transition-all shrink-0 mt-0.5 sm:mt-0">
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
        <MobileNavItem active={showMenuModal} icon="fa-bars" label="Menu" onClick={() => setShowMenuModal(true)} />
      </nav>

      <main className={`flex-1 overflow-y-auto p-4 lg:p-12 pb-36 lg:pb-12 no-scrollbar z-10 relative transition-all duration-500 ${settings.hub_announcement && !dismissedAnnouncement ? 'pt-24 lg:pt-28' : 'pt-4 lg:pt-12'}`}>
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
              createMode={createMode}
              setCreateMode={setCreateMode}
              newNode={newNode}
              setNewNode={setNewNode}
              onTriggerVoice={() => triggerVoiceRef.current?.()}
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
              onBroadcast={handleBroadcast}
              onStartBroadcast={handleStartBroadcast}
              onVerify={verifyRide}
              onCancel={cancelRide}
              onRequestTopup={requestTopup}
              onRequestRegistration={requestRegistration}
              searchConfig={searchConfig}
              settings={settings}
              onUpdateStatus={async (status: 'online' | 'busy' | 'offline') => {
                 if(!activeDriverId) return;
                 await supabase.from('unihub_drivers').update({ status }).eq('id', activeDriverId);
              }}
              isLoading={isDriverLoading}
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

      {viewMode === 'passenger' && (
        <button 
          onClick={handleAiAccess}
          className="fixed bottom-24 right-6 lg:bottom-12 lg:right-12 w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl z-[100] hover:scale-110 transition-transform animate-bounce-slow"
        >
          <i className="fas fa-sparkles"></i>
        </button>
      )}

      {showAiAd && <AdGate onUnlock={handleAiUnlock} label="Launch AI Assistant" settings={settings} />}
      {showAiHelp && <AiHelpDesk onClose={() => setShowAiHelp(false)} settings={settings} />}

      {showMenuModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-end sm:items-center justify-center p-4 animate-in slide-in-from-bottom-10 fade-in">
           <div className="glass-bright w-full max-w-sm rounded-[2.5rem] p-6 space-y-6 border border-white/10 relative">
              <button onClick={() => setShowMenuModal(false)} className="absolute top-6 right-6 w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
              
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <i className="fas fa-user-circle text-2xl"></i>
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white italic uppercase">{currentUser?.username || 'Guest'}</h3>
                    <p className="text-xs text-slate-400">{currentUser?.phone}</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => { setShowMenuModal(false); setShowQrModal(true); }} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center gap-2 hover:bg-white/10">
                    <i className="fas fa-qrcode text-xl text-indigo-400"></i>
                    <span className="text-[10px] font-black uppercase text-slate-300">My Code</span>
                 </button>
                 <button onClick={() => { setShowMenuModal(false); setShowAboutModal(true); }} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center gap-2 hover:bg-white/10">
                    <i className="fas fa-info-circle text-xl text-emerald-400"></i>
                    <span className="text-[10px] font-black uppercase text-slate-300">About App</span>
                 </button>
              </div>

              <button onClick={() => { setShowMenuModal(false); handleLogout(); }} className="w-full py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2">
                 <i className="fas fa-power-off"></i> Sign Out
              </button>
           </div>
        </div>
      )}

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

      {showHelpModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
            <div className="glass-bright w-full max-w-4xl rounded-[3rem] p-8 lg:p-12 space-y-8 animate-in zoom-in border border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar">
               <div className="flex justify-between items-center">
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">NexRyde Guide</h3>
                 <button onClick={() => setShowHelpModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                    <i className="fas fa-times"></i>
                 </button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <HelpSection 
                     icon="fa-user-graduate" 
                     title="For Passengers" 
                     color="text-indigo-400"
                     points={[
                         "Select 'Pool' to share rides and save money.",
                         "Select 'Solo' for express, direct trips (higher fare).",
                         "Join existing rides from the Community Rides list.",
                         "Use the AI voice assistant for hands-free booking.",
                         "Always verify the Ride PIN with your driver."
                     ]}
                  />
                  <HelpSection 
                     icon="fa-id-card-clip" 
                     title="For Partners" 
                     color="text-amber-500"
                     points={[
                         "Register as a partner to start earning.",
                         "Top up your wallet via MoMo to accept rides.",
                         "Station at Hotspots to get priority assignments.",
                         "Broadcast your own routes (Shuttles/Taxis).",
                         "Keep your rating high for bonuses."
                     ]}
                  />
                  <HelpSection 
                     icon="fa-shield-halved" 
                     title="Safety First" 
                     color="text-emerald-400"
                     points={[
                         "Share trip details with friends via the Share button.",
                         "Verify driver photo and license plate before boarding.",
                         "Report any issues immediately to Support.",
                         "Emergency contacts are available in the About section."
                     ]}
                  />
                   <HelpSection 
                     icon="fa-robot" 
                     title="AI Features" 
                     color="text-rose-400"
                     points={[
                         "Tap the Orb to speak in local languages (Twi, Ga, etc).",
                         "Drivers can use voice commands to find hotspots.",
                         "Passengers can book rides just by speaking.",
                         "Use the 'Guide' chat for instant answers."
                     ]}
                  />
               </div>
               
               <div className="pt-6 border-t border-white/5 text-center">
                  <button onClick={() => setShowHelpModal(false)} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Got it</button>
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
                    <a href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`} target="_blank" className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-emerald-600/10 hover:border-emerald-500/30 transition-all group">
                       <i className="fab fa-whatsapp text-emerald-500 text-2xl group-hover:scale-110 transition-transform"></i>
                       <span className="text-[9px] font-black uppercase text-slate-500">Partner Support</span>
                    </a>
                    <button onClick={shareHub} className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-amber-600/10 hover:border-amber-500/30 transition-all group">
                       <i className="fas fa-share-nodes text-amber-500 text-2xl group-hover:scale-110 transition-transform"></i>
                       <span className="text-[9px] font-black uppercase text-slate-500">Share Platform</span>
                    </button>
                    {settings.facebookUrl && (
                        <a href={settings.facebookUrl} target="_blank" className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-blue-600/10 hover:border-blue-500/30 transition-all group">
                            <i className="fab fa-facebook text-blue-500 text-2xl group-hover:scale-110 transition-transform"></i>
                            <span className="text-[9px] font-black uppercase text-slate-500">Facebook</span>
                        </a>
                    )}
                    {settings.instagramUrl && (
                        <a href={settings.instagramUrl} target="_blank" className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-pink-600/10 hover:border-pink-500/30 transition-all group">
                            <i className="fab fa-instagram text-pink-500 text-2xl group-hover:scale-110 transition-transform"></i>
                            <span className="text-[9px] font-black uppercase text-slate-500">Instagram</span>
                        </a>
                    )}
                    {settings.tiktokUrl && (
                        <a href={settings.tiktokUrl} target="_blank" className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-gray-600/10 hover:border-gray-500/30 transition-all group">
                            <i className="fab fa-tiktok text-white text-2xl group-hover:scale-110 transition-transform"></i>
                            <span className="text-[9px] font-black uppercase text-slate-500">TikTok</span>
                        </a>
                    )}
                 </div>
              </div>
              <div className="pt-6 border-t border-white/5 text-center">
                 <button onClick={() => setShowAboutModal(false)} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Close Portfolio</button>
              </div>
           </div>
        </div>
      )}
    </>
    )}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
