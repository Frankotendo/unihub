
import React, { useState, useEffect } from 'react';
import { Product, Order } from '../types';
import { 
  predictMarketTrends, 
  draftCustomerReply, 
  optimizePricing, 
  generateAdText, 
  getBusinessIdeas,
  runDeepDiagnostic,
  AIModelType,
  DiagnosticReport
} from '../services/geminiService';

interface AIAssistantProps {
  products: Product[];
  orders: Order[];
}

type AITool = 'market' | 'ads' | 'ideas' | 'pricing' | 'replies' | 'optimizer';

export default function AIAssistant({ products, orders }: AIAssistantProps) {
  const [activeTool, setActiveTool] = useState<AITool>('market');
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [result, setResult] = useState<string | null>(null);
  
  // Diagnostic State
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModelType>('gemini-3-flash-preview');

  useEffect(() => {
    triggerAutoFix();
  }, []);

  const triggerAutoFix = async () => {
    setIsFixing(true);
    try {
      const data = await runDeepDiagnostic();
      setReport(data);
      setSelectedModel(data.recommendedModel);
      // Automatically switch tool to optimizer if there's a problem
      if (data.status === 'failed') setActiveTool('optimizer');
    } catch (e) {
      console.error(e);
    } finally {
      setIsFixing(false);
    }
  };

  const runBot = async () => {
    setLoading(true);
    setResult(null);
    try {
      let res = "";
      switch (activeTool) {
        case 'market':
          res = await predictMarketTrends(products, orders, selectedModel);
          break;
        case 'ads':
          const adProd = products.find(p => p.id === selectedProductId);
          if (!adProd) { alert("Please pick an item first."); setLoading(false); return; }
          res = await generateAdText(adProd, selectedModel);
          break;
        case 'ideas':
          res = await getBusinessIdeas(products, selectedModel);
          break;
        case 'pricing':
          const priceProd = products.find(p => p.id === selectedProductId);
          if (!priceProd) { alert("Please pick an item first."); setLoading(false); return; }
          res = await optimizePricing(priceProd, selectedModel);
          break;
        case 'replies':
          if (!customerQuery.trim()) { alert("Enter the customer's message."); setLoading(false); return; }
          res = await draftCustomerReply(customerQuery, selectedModel);
          break;
      }
      setResult(res);
    } catch (e: any) {
      console.error(e);
      setResult(`[DEPLOYMENT GUARD]: ${e.message || "An unexpected error occurred."}\n\nRecommendation: Go to the 'Engine' tab and run Auto-Fix to recalibrate your deployment bridge.`);
    } finally {
      setLoading(false);
    }
  };

  const toolCategories = [
    { id: 'market', label: 'Trends', icon: 'fa-chess-king' },
    { id: 'ads', label: 'Ad Maker', icon: 'fa-bullhorn' },
    { id: 'ideas', label: 'Hustles', icon: 'fa-lightbulb' },
    { id: 'replies', label: 'Chat Help', icon: 'fa-comments' },
    { id: 'optimizer', label: 'Engine', icon: 'fa-microchip' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Engine Status Bar */}
      <div className="flex items-center justify-between bg-white px-8 py-4 rounded-[2rem] shadow-sm border border-slate-100">
         <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${report?.status === 'passed' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
               Mode: {selectedModel === 'gemini-3-flash-preview' ? 'Vercel Fast-Path' : 'Deep Analysis'}
            </span>
         </div>
         {report && (
            <div className="flex items-center gap-4">
               <span className="text-[10px] font-bold text-slate-300 uppercase">Latency: {report.latency}ms</span>
               <div className="bg-slate-50 px-3 py-1 rounded-full text-[8px] font-black text-slate-400 border border-slate-100 uppercase">{report.envDetected}</div>
            </div>
         )}
      </div>

      <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 relative overflow-hidden">
        <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-indigo-50 rounded-full blur-[80px]"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 relative z-10">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-[#0f172a] rounded-2xl flex items-center justify-center text-indigo-400">
                <i className="fas fa-robot text-lg"></i>
              </div>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">UniHub AI</h2>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-16">Intelligence Command Center</p>
          </div>
          
          <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-[2rem] gap-1 shadow-inner">
            {toolCategories.map((tool) => (
              <button 
                key={tool.id} 
                onClick={() => {setActiveTool(tool.id as AITool); setResult(null)}} 
                className={`px-5 py-3 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  activeTool === tool.id ? 'bg-white text-slate-900 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <i className={`fas ${tool.icon} text-[10px]`}></i>
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8 relative z-10">
          <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100">
            {activeTool === 'optimizer' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4">
                   <div className="bg-[#0f172a] text-emerald-400 p-6 rounded-3xl font-mono text-[10px] leading-relaxed border-l-4 border-emerald-500">
                      <p className="mb-2 text-white/50">// DEPLOYMENT DIAGNOSTICS</p>
                      {isFixing ? (
                         <p className="animate-pulse">SCANNING BRIDGE... ANALYZING LATENCY... APPLYING HOTFIXES...</p>
                      ) : report ? (
                         <div className="space-y-1">
                            {report.fixesApplied.map((fix, i) => (
                               <p key={i}>[FIX_{i}] {fix} ... OK</p>
                            ))}
                            <p className="mt-4 text-emerald-300 font-bold uppercase tracking-widest">>>> DEPLOYMENT OPTIMIZED FOR VERCEL</p>
                         </div>
                      ) : (
                         <p>WAITING FOR SCAN COMMAND...</p>
                      )}
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button 
                        onClick={() => setSelectedModel('gemini-3-flash-preview')}
                        className={`p-6 rounded-3xl border-2 text-left transition-all ${selectedModel === 'gemini-3-flash-preview' ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 bg-white'}`}
                      >
                        <p className="text-sm font-black text-slate-800">Flash Engine</p>
                        <p className="text-[10px] text-slate-500 mt-1">Vercel Mode: Instant & Stable</p>
                      </button>
                      <button 
                        onClick={() => setSelectedModel('gemini-3-pro-preview')}
                        className={`p-6 rounded-3xl border-2 text-left transition-all ${selectedModel === 'gemini-3-pro-preview' ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 bg-white'}`}
                      >
                        <p className="text-sm font-black text-slate-800">Pro Engine</p>
                        <p className="text-[10px] text-slate-500 mt-1">Deep Intelligence (Risk of Timeout)</p>
                      </button>
                   </div>
                </div>
                
                <button 
                  onClick={triggerAutoFix}
                  disabled={isFixing}
                  className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-4"
                >
                  <i className={`fas ${isFixing ? 'fa-sync fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                  {isFixing ? 'Applying Protocol...' : 'Run Powerful Auto-Fix'}
                </button>
              </div>
            )}

            {activeTool !== 'optimizer' && (
              <div className="space-y-6">
                {activeTool === 'market' && <p className="text-xs font-bold text-slate-500 uppercase tracking-tight leading-relaxed">"Scanning local Ghana trends using {selectedModel.split('-')[2].toUpperCase()}."</p>}
                
                {(activeTool === 'ads' || activeTool === 'pricing') && (
                  <select className="w-full px-8 py-5 rounded-2xl bg-white border border-slate-100 font-bold text-slate-800 outline-none shadow-sm" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                    <option value="">-- Choose Stock Item --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}

                {activeTool === 'replies' && (
                  <textarea className="w-full px-8 py-6 rounded-3xl bg-white border border-slate-100 font-bold text-slate-800 outline-none h-32 shadow-sm resize-none" placeholder="Paste customer message..." value={customerQuery} onChange={e => setCustomerQuery(e.target.value)}></textarea>
                )}

                {activeTool === 'ideas' && <p className="text-xs font-bold text-slate-500 uppercase tracking-tight leading-relaxed">"Brainstorming high-margin university hustles."</p>}
              </div>
            )}
          </div>

          {activeTool !== 'optimizer' && (
            <button 
              onClick={runBot}
              disabled={loading}
              className="w-full bg-[#0f172a] text-white py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] shadow-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 group disabled:opacity-50"
            >
              {loading ? <i className="fas fa-sync fa-spin"></i> : <i className="fas fa-bolt-lightning group-hover:scale-125 transition-transform"></i>}
              {loading ? 'Consulting Neural Hub...' : 'Generate Insight'}
            </button>
          )}
        </div>
      </div>

      {result && (
        <div className="bg-[#0f172a] p-10 md:p-14 rounded-[4rem] text-white shadow-2xl animate-in slide-in-from-bottom-10 duration-700 border-t-8 border-indigo-600 relative overflow-hidden">
           <div className="relative z-10">
              <div className="flex items-center gap-4 mb-10">
                 <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-400 border border-white/10">
                    <i className="fas fa-sparkles text-xl"></i>
                 </div>
                 <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] block text-indigo-400">Intelligence Report</span>
                    <span className="text-[8px] font-bold uppercase opacity-30">Vercel Optimized Engine Output</span>
                 </div>
              </div>
              
              <div className="text-slate-200 font-medium leading-[2] whitespace-pre-wrap text-[15px] bg-white/5 p-8 md:p-10 rounded-[2.5rem] border border-white/5 shadow-inner backdrop-blur-md">
                {result}
              </div>
              
              <div className="flex flex-wrap gap-4 mt-12">
                <button onClick={() => {navigator.clipboard.writeText(result); alert('Report copied! 📋')}} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 active:scale-95">
                  <i className="fas fa-copy"></i>
                  Copy Report
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
