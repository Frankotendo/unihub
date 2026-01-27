
import React, { useState } from 'react';
import { Product, Order } from '../types';
import { predictMarketTrends, draftCustomerReply, optimizePricing, generateAdText, getBusinessIdeas } from '../services/geminiService';

interface AIAssistantProps {
  products: Product[];
  orders: Order[];
}

type AITool = 'market' | 'ads' | 'ideas' | 'pricing' | 'replies';

const AIAssistant: React.FC<AIAssistantProps> = ({ products, orders }) => {
  const [activeTool, setActiveTool] = useState<AITool>('market');
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const runBot = async () => {
    setLoading(true);
    setResult(null);
    try {
      if (activeTool === 'market') {
        const res = await predictMarketTrends(products, orders);
        setResult(res);
      } else if (activeTool === 'ads') {
        const prod = products.find(p => p.id === selectedProductId);
        if (!prod) { alert("Please pick an item."); setLoading(false); return; }
        const res = await generateAdText(prod);
        setResult(res);
      } else if (activeTool === 'ideas') {
        const res = await getBusinessIdeas();
        setResult(res);
      } else if (activeTool === 'pricing') {
        const prod = products.find(p => p.id === selectedProductId);
        if (!prod) { alert("Please pick an item."); setLoading(false); return; }
        const res = await optimizePricing(prod);
        setResult(res);
      } else {
        if (!customerQuery) { alert("Enter the customer's message."); setLoading(false); return; }
        const res = await draftCustomerReply(customerQuery);
        setResult(res);
      }
    } catch (e) {
      setResult("Bot error. Connection issue?");
    } finally {
      setLoading(false);
    }
  };

  const toolCategories = [
    { id: 'market', label: 'Strategy', icon: 'fa-chess', desc: 'Market analysis' },
    { id: 'ads', label: 'Ads Maker', icon: 'fa-bullhorn', desc: 'WhatsApp text' },
    { id: 'ideas', label: 'Side Hustles', icon: 'fa-lightbulb', desc: 'New ideas' },
    { id: 'pricing', label: 'Price Audit', icon: 'fa-tags', desc: 'Profit check' },
    { id: 'replies', label: 'Chat Bot', icon: 'fa-comments', desc: 'Reply drafts' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100 relative overflow-hidden">
        {/* Decorative background movement */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="mb-10 relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-[#0f172a] rounded-xl flex items-center justify-center text-indigo-400">
              <i className="fas fa-robot text-sm"></i>
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">Management Bot</h2>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-14">AI Powered Business Intelligence</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10 relative z-10">
          {toolCategories.map((tool) => (
            <button 
              key={tool.id} 
              onClick={() => {setActiveTool(tool.id as AITool); setResult(null)}} 
              className={`p-6 rounded-[2.5rem] border transition-all flex flex-col items-center text-center gap-3 group relative overflow-hidden ${
                activeTool === tool.id 
                  ? 'bg-[#0f172a] border-[#0f172a] text-white shadow-2xl scale-105' 
                  : 'bg-slate-50 border-transparent text-slate-400 hover:border-indigo-100 hover:bg-white'
              }`}
            >
              <i className={`fas ${tool.icon} text-lg transition-transform group-hover:scale-125 group-hover:-rotate-6`}></i>
              <div className="space-y-0.5">
                 <p className="text-[9px] font-black uppercase tracking-widest">{tool.label}</p>
                 <p className="text-[7px] font-bold uppercase opacity-30 hidden md:block">{tool.desc}</p>
              </div>
              {activeTool === tool.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500"></div>}
            </button>
          ))}
        </div>

        <div className="space-y-8 relative z-10">
          {activeTool === 'market' && (
            <div className="bg-indigo-50/30 p-8 rounded-[2.5rem] border border-indigo-100/50 flex items-start gap-6 backdrop-blur-sm">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                  <i className="fas fa-chart-line"></i>
               </div>
               <p className="text-xs font-bold text-indigo-900/60 leading-relaxed uppercase tracking-tight">
                "I'll analyze your hub's movement to identify trending items and market gaps you should exploit today."
               </p>
            </div>
          )}

          {(activeTool === 'ads' || activeTool === 'pricing') && (
            <div className="space-y-3">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-6">Asset Selection</label>
               <select className="w-full px-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:border-indigo-100 font-bold text-slate-800 outline-none transition-all appearance-none" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                  <option value="">Choose item from stock...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
            </div>
          )}

          {activeTool === 'ideas' && (
             <div className="bg-emerald-50/30 p-8 rounded-[2.5rem] border border-emerald-100/50 flex items-start gap-6 backdrop-blur-sm">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                  <i className="fas fa-seedling"></i>
                </div>
                <p className="text-xs font-bold text-emerald-900/60 leading-relaxed uppercase tracking-tight">
                  "Need a new route to profit? I'll suggest 3 low-cost campus hustles with high movement potential."
                </p>
             </div>
          )}

          {activeTool === 'replies' && (
            <div className="space-y-3">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-6">Customer Query</label>
               <textarea className="w-full px-8 py-6 rounded-[2.5rem] bg-slate-50 border-2 border-transparent focus:border-indigo-100 font-bold text-slate-800 outline-none h-32 transition-all resize-none" placeholder="Paste the WhatsApp text here..." value={customerQuery} onChange={e => setCustomerQuery(e.target.value)}></textarea>
            </div>
          )}

          <button 
            onClick={runBot}
            disabled={loading}
            className="w-full bg-[#0f172a] text-white py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] shadow-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 group disabled:opacity-50"
          >
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-bolt-lightning group-hover:scale-125 transition-transform"></i>}
            Execute Analysis
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-[#0f172a] p-12 rounded-[4rem] text-white shadow-2xl animate-in slide-in-from-bottom-10 duration-700 border-t-8 border-indigo-600 relative overflow-hidden">
           <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 rounded-[1.25rem] bg-white/10 flex items-center justify-center text-indigo-400 shadow-inner">
                    <i className="fas fa-wand-magic-sparkles"></i>
                 </div>
                 <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] block text-indigo-400">Hub Insight</span>
                    <span className="text-[8px] font-bold uppercase opacity-40">Processed via UniHub AI Engine</span>
                 </div>
              </div>
              <p className="text-slate-200 font-medium leading-[1.8] whitespace-pre-wrap text-[13px] italic">{result}</p>
              
              {(activeTool === 'replies' || activeTool === 'ads') && (
                <div className="flex gap-4 mt-10">
                  <button onClick={() => {navigator.clipboard.writeText(result); alert('Ready to paste!')}} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3">
                    <i className="fab fa-whatsapp"></i>
                    Copy to WhatsApp
                  </button>
                </div>
              )}
           </div>
           {/* Decorative background movement */}
           <i className="fas fa-truck-fast absolute right-[-60px] top-[-60px] text-[250px] opacity-[0.03] rotate-12 pointer-events-none delivery-move"></i>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;