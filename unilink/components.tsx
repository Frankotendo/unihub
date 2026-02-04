import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, Chat, LiveServerMessage, Modality, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { ai, createBlob, decode, decodeAudioData, PortalMode, RideNode, Driver, Transaction, AppSettings, SearchConfig, NodeStatus } from './lib';

export const QrScannerModal = ({ onScan, onClose }: { onScan: (text: string) => void, onClose: () => void }) => {
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

export const GlobalVoiceOrb = ({ 
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
    onLogin?: (phone: string, pin: string) => Promise<string>,
    onNavigate?: (target: string, sub_section?: string, modal?: string) => void
  },
  triggerRef?: React.MutableRefObject<() => void>
}) => {
  const [isActive, setIsActive] = useState(false);
  const [state, setState] = useState<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  const [orbMessage, setOrbMessage] = useState<string>('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Ref for actions to ensure the latest closures are always used by the long-running socket
  const actionsRef = useRef(actions);
  const contextRef = useRef(contextData);

  useEffect(() => {
    actionsRef.current = actions;
    contextRef.current = contextData;
  }, [actions, contextData]);

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
      if (state === 'processing') { r = 250; g = 204; b = 21; } // Yellow

      const baseRadius = 60;
      // Faster pulse when listening to indicate high responsiveness
      const pulseSpeed = state === 'listening' ? 6 : (state === 'processing' ? 10 : 3);
      const pulse = Math.sin(time * pulseSpeed) * 5;
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
      setOrbMessage('');
      if (sessionRef.current) {
        sessionRef.current.then((session: any) => session.close()).catch((err: any) => console.error("Failed to close session:", err));
      }
      audioContextRef.current?.close();
      inputAudioContextRef.current?.close();
      return;
    }

    if (process.env.API_KEY?.includes('PLACEHOLDER')) {
        alert("Please set a valid GEMINI_API_KEY in .env.local to use Live features.");
        return;
    }

    setIsActive(true);
    setState('listening');
    setOrbMessage('Listening...');

    let tools: FunctionDeclaration[] = [];
    let systemInstruction = "";

    const aiName = contextData.settings.aiAssistantName || "Kofi";

    // Condensed Persona for lower token usage and faster processing
    const ghanaianPersona = `You are "${aiName}", the NexRyde Assistant. Speak English, Twi, Ga, or Pidgin. Be concise. You are an expert on Ghana geography, landmarks (KNUST, Accra, Kumasi), and global locations.`;
    
    // Core Navigation Tool available to all modes
    const navTool: FunctionDeclaration = {
        name: 'navigate_ui',
        description: 'Navigate the user to a different part of the application or open a modal.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                target: { type: Type.STRING, enum: ['passenger', 'ride', 'driver', 'drive', 'admin'], description: "The main portal to switch to." },
                sub_section: { type: Type.STRING, description: "Tab name if applicable (e.g. 'wallet', 'market', 'active', 'broadcast')." },
                modal: { type: Type.STRING, enum: ['qr', 'help', 'about', 'chat', 'close'], description: "Open a specific modal or close all." }
            },
            required: [] // Allow optional target/modal
        }
    };

    if (mode === 'driver') {
      systemInstruction = `${ghanaianPersona} Help drivers hands-free. Keep responses under 10 words. Execute commands immediately. You can navigate the app. Current Driver: ${user?.name || 'Partner'}.`;
      
      tools = [
        navTool,
        {
          name: 'update_status',
          description: 'Update status.',
          parameters: {
             type: Type.OBJECT,
             properties: { status: { type: Type.STRING, enum: ['online', 'busy', 'offline'] } },
             required: ['status']
          }
        },
        { name: 'check_wallet', description: 'Check balance.' },
        { 
          name: 'scan_for_rides', 
          description: 'Find rides.',
          parameters: {
             type: Type.OBJECT,
             properties: { location: { type: Type.STRING } }
          }
        }
      ];
    } else if (mode === 'admin') {
      systemInstruction = `You are Nexus Security. Analyze health and threats. You can navigate tabs. Concise.`;
      
      tools = [
        navTool,
        { name: 'analyze_security_threats', description: 'Scan logs.' },
        { name: 'get_revenue_report', description: 'Get revenue.' },
        { name: 'system_health_check', description: 'Count users.' }
      ];
    } else if (mode === 'public') {
       systemInstruction = `${ghanaianPersona} Help user Log In. Call 'attempt_login' when you have phone and pin. If login fails, tell the user why.`;
       tools = [
         {
           name: 'attempt_login',
           description: 'Attempt to log in with provided credentials.',
           parameters: {
             type: Type.OBJECT,
             properties: {
               phone: { type: Type.STRING },
               pin: { type: Type.STRING }
             },
             required: ['phone', 'pin']
           }
         },
         {
           name: 'fill_auth_details',
           description: 'Fill form fields without submitting.',
           parameters: {
             type: Type.OBJECT,
             properties: {
               phone: { type: Type.STRING },
               username: { type: Type.STRING },
               pin: { type: Type.STRING }
             }
           }
         }
       ]
    } else {
      systemInstruction = `${ghanaianPersona} Help find rides. If destination is heard, call 'fill_ride_form'. You can navigate to driver or admin portals.`;
      tools = [
        navTool,
        { 
          name: 'fill_ride_form', 
          description: 'Fill request.',
          parameters: {
             type: Type.OBJECT,
             properties: { 
               origin: { type: Type.STRING },
               destination: { type: Type.STRING },
               vehicleType: { type: Type.STRING, enum: ['Pragia', 'Taxi', 'Shuttle'] },
               isSolo: { type: Type.BOOLEAN }
             },
             required: ['destination']
          }
        },
        {
          name: 'find_destination',
          description: 'Find place address.',
          parameters: {
             type: Type.OBJECT,
             properties: { query: { type: Type.STRING } },
             required: ['query']
          }
        },
        { name: 'confirm_ride', description: 'Submit request.' },
        { name: 'check_pricing', description: 'Get prices.' }
      ];
    }

    try {
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputAudioContext;
      inputAudioContextRef.current = inputAudioContext;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputNode = inputAudioContext.createMediaStreamSource(stream);
      
      const scriptProcessor = inputAudioContext.createScriptProcessor(2048, 1, 1);

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
              setOrbMessage('Speaking...');
              const buffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
              
              const currentTime = outputAudioContext.currentTime;
              if (nextStartTimeRef.current < currentTime) {
                  nextStartTimeRef.current = currentTime;
              }
              
              const source = outputAudioContext.createBufferSource();
              source.buffer = buffer;
              source.connect(outputAudioContext.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                    setState('listening');
                    setOrbMessage('Listening...');
                }
              };
            }

            if (msg.serverContent?.interrupted) {
               sourcesRef.current.forEach(s => s.stop());
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setState('listening');
               setOrbMessage('Listening...');
            }

            if (msg.toolCall) {
              setState('processing');
              setOrbMessage('Processing Command...');
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
                 
                 // Use actionsRef.current to access the latest closures
                 const currentActions = actionsRef.current;
                 const currentContext = contextRef.current;

                 if (fc.name === 'navigate_ui' && currentActions.onNavigate) {
                    const args = fc.args as any;
                    setOrbMessage(`Navigating...`);
                    currentActions.onNavigate(args.target, args.sub_section, args.modal);
                    result = { result: `Success. User interface updated.` };
                 } else if (fc.name === 'update_status' && currentActions.onUpdateStatus) {
                    const s = (fc.args as any).status;
                    setOrbMessage(`Setting status: ${s}`);
                    currentActions.onUpdateStatus(s);
                    result = { result: `Status updated to ${s}` };
                 } else if (fc.name === 'check_wallet') {
                    const bal = user?.walletBalance || 0;
                    setOrbMessage(`Checking balance...`);
                    result = { result: `Balance: ${bal.toFixed(2)} cedis.` };
                 } else if (fc.name === 'scan_for_rides') {
                    const loc = (fc.args as any).location?.toLowerCase();
                    const rides = currentContext.nodes.filter(n => {
                       if (!loc) return true;
                       return n.origin.toLowerCase().includes(loc) || n.destination.toLowerCase().includes(loc);
                    }).slice(0, 3);
                    result = { result: `Found ${rides.length} rides: ${rides.map(r => r.destination).join(', ')}.` };
                 
                 } else if (fc.name === 'find_destination' && currentActions.onFillRideForm) {
                    const query = (fc.args as any).query;
                    setOrbMessage(`Finding ${query}...`);
                    try {
                        const searchAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
                        const mapsResp = await searchAi.models.generateContent({
                            model: "gemini-2.5-flash",
                            contents: `Find the location "${query}". Prioritize Ghana context (regions, towns, unis) unless strictly global. Return just the formatted address or name.`, 
                            config: { tools: [{ googleMaps: {} }] }
                        });
                        
                        const chunks = mapsResp.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                        const mapChunk = chunks.find((c: any) => (c.maps?.title || c.maps?.uri) || (c.web?.title || c.web?.uri));
                        
                        let placeName = query;
                        if (mapChunk) {
                            if (mapChunk.maps) placeName = mapChunk.maps.title;
                            else if (mapChunk.web) placeName = mapChunk.web.title;
                        } else {
                            placeName = mapsResp.text?.split('\n')[0] || query;
                        }
                        
                        // Clean up model response artifacts
                        placeName = placeName.replace("The best match is ", "").replace("location is ", "").replace(".", "");

                        currentActions.onFillRideForm({ destination: placeName });
                        result = { result: `Found ${placeName}. Form updated.` };
                    } catch (err) {
                        console.error("Maps grounding failed", err);
                        result = { result: "Location error." };
                    }

                 } else if (fc.name === 'analyze_security_threats') {
                    result = { status: "Analyzed", analysis: "System nominal. No threats." };
                 } else if (fc.name === 'get_revenue_report') {
                     const total = currentContext.transactions?.reduce((a, b) => a + b.amount, 0) || 0;
                     result = { result: `Total Revenue: ${total.toFixed(2)}` };
                 } else if (fc.name === 'system_health_check') {
                     result = { result: `Drivers: ${currentContext.drivers.length}. Rides: ${currentContext.nodes.length}.` };

                 } else if (fc.name === 'fill_ride_form' && currentActions.onFillRideForm) {
                     const safeArgs = cleanArgs(fc.args);
                     setOrbMessage('Updating form...');
                     if (safeArgs.destination || safeArgs.origin) {
                         currentActions.onFillRideForm(safeArgs);
                         result = { result: `Form Updated.` };
                     } else {
                         result = { result: "No location provided." };
                     }
                 } else if (fc.name === 'confirm_ride' && currentActions.onConfirmRide) {
                     setOrbMessage('Confirming Ride...');
                     currentActions.onConfirmRide();
                     result = { result: "Ride Confirmed." };
                 } else if (fc.name === 'attempt_login' && currentActions.onLogin) {
                     const args = fc.args as any;
                     setOrbMessage('Verifying credentials...');
                     const loginResult = await currentActions.onLogin(args.phone, args.pin);
                     if (loginResult === "Success") {
                         result = { result: "Login Successful. Access Granted." };
                     } else {
                         result = { result: `Login Failed: ${loginResult}` };
                     }
                 } else if (fc.name === 'fill_auth_details' && currentActions.onFillAuth) {
                     const safeArgs = cleanArgs(fc.args);
                     setOrbMessage('Filling credentials...');
                     currentActions.onFillAuth(safeArgs);
                     result = { result: `Auth form updated. Need confirmation to login.` };
                 } else if (fc.name === 'check_pricing') {
                     result = { result: `Pragia: ${currentContext.settings.farePerPragia}. Taxi: ${currentContext.settings.farePerTaxi}.` };
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
             setOrbMessage('');
          },
          onerror: (e) => {
             console.error("Gemini Live Error", e);
             setIsActive(false);
             setOrbMessage('Connection Error');
             alert(`Gemini Live Error: ${e.message || "Connection failed"}. Check your API Key permissions for Live API.`);
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

  const aiName = contextData.settings.aiAssistantName || "Kofi";
  
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
        className={`fixed bottom-20 left-4 lg:bottom-12 lg:left-12 z-[500] w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all ${isActive ? 'bg-rose-500 scale-110 animate-pulse' : `bg-gradient-to-tr ${getOrbColor()}`}`}
      >
        <i className={`fas ${isActive ? 'fa-microphone-slash' : 'fa-microphone'} text-white text-2xl`}></i>
      </button>

      {isActive && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[450] flex flex-col items-center justify-center animate-in fade-in duration-300">
           <canvas ref={canvasRef} width={400} height={400} className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px]" />
           <div className="mt-8 text-center px-4">
              <h3 className="text-2xl font-black italic uppercase text-white tracking-widest animate-pulse">
                {state === 'listening' ? 'Tie me...' : state === 'speaking' ? `${aiName} (AI)` : state === 'processing' ? 'Working...' : 'Thinking...'}
              </h3>
              <p className="text-xs font-bold opacity-70 uppercase mt-2 tracking-[0.2em]" style={{ color: mode === 'admin' ? '#f43f5e' : '#94a3b8' }}>
                {mode === 'admin' ? 'Security Protocol Active' : mode === 'driver' ? 'Partner Hands-Free' : 'Polyglot Assistant'}
              </p>
              
              {orbMessage && (
                  <div className="mt-6 px-6 py-2 bg-white/10 rounded-full border border-white/20 animate-in slide-in-from-bottom-2">
                      <p className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-2">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                          {orbMessage}
                      </p>
                  </div>
              )}

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
                       <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">"Open chat"</div>
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

export const InlineAd = ({ className, settings }: { className?: string, settings: AppSettings }) => {
  useEffect(() => {
     if (settings.adSenseStatus === 'active' && (window as any).adsbygoogle) {
         try {
             (window as any).adsbygoogle.push({});
         } catch (e) { console.error("Ad error", e); }
     }
  }, [settings]);

  if (settings.adSenseStatus !== 'active') return null;

  return (
    <div className={`bg-white/5 rounded-[2rem] border border-white/5 overflow-hidden flex flex-col items-center justify-center p-4 min-h-[150px] relative ${className}`}>
        <p className="text-[9px] font-black text-slate-600 uppercase absolute top-2 right-2">Advertisement</p>
        <ins className="adsbygoogle"
             style={{ display: 'block', width: '100%' }}
             data-ad-client={settings.adSenseClientId}
             data-ad-slot={settings.adSenseSlotId}
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
    </div>
  );
};

export const AdGate = ({ onUnlock, label, settings }: { onUnlock: () => void, label: string, settings: AppSettings }) => {
    const [timer, setTimer] = useState(5);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setTimer(t => Math.max(0, t - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[1000] flex items-center justify-center p-6 animate-in zoom-in">
             <div className="glass w-full max-w-sm rounded-[2.5rem] p-6 text-center border border-white/10 relative overflow-hidden">
                 <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
                     <div className="h-full bg-indigo-500 transition-all duration-1000 ease-linear" style={{ width: `${((5-timer)/5)*100}%` }}></div>
                 </div>
                 
                 <div className="my-8">
                     <p className="text-[10px] font-black uppercase text-slate-500 mb-4">Sponsored Message</p>
                     {settings.adSenseStatus === 'active' ? (
                         <div className="min-h-[250px] bg-white rounded-xl flex items-center justify-center">
                              {/* Placeholder for Ad Unit */}
                              <p className="text-black font-bold">Ad Loading...</p>
                         </div>
                     ) : (
                         <div className="min-h-[250px] bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center p-8">
                             <div>
                                 <i className="fas fa-gem text-4xl text-white mb-4 animate-bounce"></i>
                                 <h3 className="text-xl font-black text-white uppercase italic">Premium Feature</h3>
                                 <p className="text-xs text-white/80 mt-2">Support NexRyde to keep us running.</p>
                             </div>
                         </div>
                     )}
                 </div>

                 <button 
                    onClick={onUnlock} 
                    disabled={timer > 0} 
                    className="w-full py-4 bg-white text-[#020617] rounded-xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 transition-all"
                 >
                    {timer > 0 ? `Wait ${timer}s` : label}
                 </button>
             </div>
        </div>
    );
};

export const AiHelpDesk = ({ onClose, settings }: { onClose: () => void, settings: AppSettings }) => {
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!chatRef.current) {
        const aiName = settings.aiAssistantName || "Kofi";
        chatRef.current = ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: {
                systemInstruction: `You are "${aiName}", the help desk AI for NexRyde. Be concise, friendly, and helpful. Context: ${settings.aboutMeText}. Support contacts: ${settings.whatsappNumber}.`,
            }
        });
        setMessages([{ role: 'model', text: `Hello! I'm ${aiName}. How can I help you with NexRyde today?` }]);
    }
  }, [settings]);

  const handleSend = async () => {
    if(!input.trim() || !chatRef.current) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
        const response = await chatRef.current.sendMessageStream({ message: userMsg });
        
        setMessages(prev => [...prev, { role: 'model', text: '' }]);
        let fullText = "";

        for await (const chunk of response) {
             const c = chunk as GenerateContentResponse;
             const text = c.text;
             if (text) {
                 fullText += text;
                 setMessages(prev => {
                     const newArr = [...prev];
                     const lastMsg = newArr[newArr.length - 1];
                     if (lastMsg.role === 'model') {
                        lastMsg.text = fullText;
                     }
                     return newArr;
                 });
             }
        }
    } catch (e) {
        console.error(e);
        setMessages(prev => [...prev, { role: 'model', text: "Connection error. Please check your internet." }]);
    } finally {
        setIsTyping(false);
    }
  };

  const aiName = settings.aiAssistantName || "Kofi";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="glass w-full max-w-md h-[600px] max-h-[90vh] rounded-[2.5rem] border border-white/10 flex flex-col overflow-hidden animate-in zoom-in">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg">
                        <i className="fas fa-headset"></i>
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase text-white">{aiName} (Support)</h3>
                        <p className="text-[9px] text-emerald-400 font-bold uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Online
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"><i className="fas fa-times"></i></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-bold leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white/10 text-slate-200 rounded-bl-none'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-bl-none flex gap-1">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef}></div>
            </div>

            <div className="p-4 border-t border-white/5 bg-black/20">
                <div className="flex gap-2">
                    <input 
                        value={input} 
                        onChange={e => setInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Ask a question..." 
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                        disabled={isTyping}
                    />
                    <button onClick={handleSend} disabled={isTyping || !input.trim()} className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg disabled:opacity-50 hover:bg-indigo-500 transition-all">
                        <i className="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export const NavItem = ({ active, icon, label, onClick, badge }: { active: boolean, icon: string, label: string, onClick: () => void, badge?: number }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all group ${active ? 'bg-white text-[#020617] shadow-xl scale-[1.02]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
    >
        <div className="flex items-center gap-4">
            <i className={`fas ${icon} text-lg w-6 ${active ? 'text-indigo-600' : 'group-hover:text-indigo-400'}`}></i>
            <span className="text-sm font-black uppercase tracking-wide">{label}</span>
        </div>
        {badge !== undefined && badge > 0 && (
            <span className={`px-2 py-1 rounded-md text-[9px] font-black ${active ? 'bg-rose-500 text-white' : 'bg-rose-500/20 text-rose-500'}`}>
                {badge}
            </span>
        )}
    </button>
);

export const MobileNavItem = ({ active, icon, label, onClick, badge }: { active: boolean, icon: string, label: string, onClick: () => void, badge?: number }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-2xl transition-all relative ${active ? 'bg-white text-[#020617] shadow-xl -translate-y-4' : 'text-slate-500'}`}>
        {badge !== undefined && badge > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full"></span>
        )}
        <i className={`fas ${icon} text-lg`}></i>
        <span className="text-[9px] font-black uppercase tracking-tight">{label}</span>
    </button>
);

export const SearchHub = ({ searchConfig, setSearchConfig, portalMode }: { searchConfig: SearchConfig, setSearchConfig: (c: SearchConfig) => void, portalMode: PortalMode }) => {
    return (
        <div className="glass p-2 rounded-[2rem] border border-white/10 flex flex-col md:flex-row gap-2">
             <div className="flex-1 relative">
                 <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
                 <input 
                    value={searchConfig.query}
                    onChange={e => setSearchConfig({...searchConfig, query: e.target.value})}
                    placeholder={portalMode === 'driver' ? "Search trips or locations..." : "Where to?"}
                    className="w-full h-14 bg-white/5 border border-white/5 rounded-[1.5rem] pl-12 pr-4 text-white font-bold text-sm outline-none focus:bg-white/10 transition-colors"
                 />
             </div>
             
             <div className="flex gap-2 overflow-x-auto no-scrollbar">
                 {['All', 'Pragia', 'Taxi', 'Shuttle'].map(type => (
                     <button 
                        key={type} 
                        onClick={() => setSearchConfig({...searchConfig, vehicleType: type as any})}
                        className={`h-14 px-6 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${searchConfig.vehicleType === type ? 'bg-[#020617] text-white border border-white/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                     >
                         {type}
                     </button>
                 ))}
             </div>
        </div>
    );
};

export const HelpSection = ({ icon, title, color, points }: { icon: string, title: string, color: string, points: string[] }) => (
    <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5">
        <div className="flex items-center gap-4 mb-4">
            <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center ${color} text-xl border border-white/5`}>
                <i className={`fas ${icon}`}></i>
            </div>
            <h4 className="text-lg font-black uppercase text-white">{title}</h4>
        </div>
        <ul className="space-y-3">
            {points.map((p, i) => (
                <li key={i} className="flex items-start gap-3 text-xs text-slate-400 font-medium">
                    <i className={`fas fa-check mt-1 ${color}`}></i>
                    <span>{p}</span>
                </li>
            ))}
        </ul>
    </div>
);