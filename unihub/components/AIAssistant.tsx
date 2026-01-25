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
      let res = "";
      switch (activeTool) {
        case 'market':
          res = await predictMarketTrends(products, orders);
          break;
        case 'ads':
          const adProd = products.find(p => p.id === selectedProductId);
          if (!adProd) { alert("Please pick an item first."); setLoading(false); return; }
          res = await generateAdText(adProd);
          break;
        case 'ideas':
          res = await getBusinessIdeas(products);
          break;
        case 'pricing':
          const priceProd = products.find(p => p.id === selectedProductId);
          if (!priceProd) { alert("Please pick an item first."); setLoading(false); return; }
          res = await optimizePricing(priceProd);
          break;
        case 'replies':
          if (!customerQuery.trim()) { alert("Enter the customer's message."); setLoading(false); return; }
          res = await draftCustomerReply(customerQuery);
          break;
      }
      setResult(res);
    } catch (e) {
      console.error(e);
      setResult("Hub Connection Error. The Vercel bridge is currently being optimized. Please try again in a few seconds.");
    } finally {
      setLoading(false);
    }
  };

  const toolCategories = [
    { id: 'market', label: 'Trends', icon: 'fa-chess-king' },
    { id: 'ads', label: 'Ad Maker', icon: 'fa-bullhorn' },
    { id: 'ideas', label: 'Hustles', icon: 'fa-lightbulb' },
    { id: 'pricing', label: 'Price Audit', icon: 'fa-tags' },
    { id: 'replies', label: 'Chat Help', icon: 'fa-comments' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
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
            {activeTool === 'market' && (
              <p className="text-xs font-bold text-slate-500 uppercase tracking-tight leading-relaxed">
                "Ready to scan market trends. I'll identify what's moving in Ghana hostels today."
              </p>
            )}

            {(activeTool === 'ads' || activeTool === 'pricing') && (
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Target Hub Item</label>
                 <select className="w-full px-8 py-5 rounded-2xl bg-white border border-slate-100 font-bold text-slate-800 outline-none shadow-sm" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                    <option value="">-- Choose Stock --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
              </div>
            )}

            {activeTool === 'replies' && (
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Paste Customer Query</label>
                 <textarea className="w-full px-8 py-6 rounded-3xl bg-white border border-slate-100 font-bold text-slate-800 outline-none h-32 shadow-sm resize-none" placeholder="e.g. 'Can I get a discount for bulk orders?'" value={customerQuery} onChange={e => setCustomerQuery(e.target.value)}></textarea>
              </div>
            )}

            {activeTool === 'ideas' && (
              <p className="text-xs font-bold text-slate-500 uppercase tracking-tight leading-relaxed">
                "Side-hustle mode. Let's find some campus arbitrage opportunities."
              </p>
            )}
          </div>

          <button 
            onClick={runBot}
            disabled={loading}
            className="w-full bg-[#0f172a] text-white py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] shadow-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 group disabled:opacity-50"
          >
            {loading ? <i className="fas fa-sync fa-spin"></i> : <i className="fas fa-bolt-lightning group-hover:scale-125 transition-transform"></i>}
            {loading ? 'Consulting Neural Hub...' : 'Run Business Analysis'}
          </button>
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
                    <span className="text-[8px] font-bold uppercase opacity-30">Gemini 3 Flash Final Output</span>
                 </div>
              </div>
              
              <div className="text-slate-200 font-medium leading-[2] whitespace-pre-wrap text-[15px] bg-white/5 p-8 md:p-10 rounded-[2.5rem] border border-white/5 shadow-inner backdrop-blur-md">
                {result}
              </div>
              
              <div className="flex flex-wrap gap-4 mt-12">
                <button onClick={() => {navigator.clipboard.writeText(result); alert('Report copied to clipboard! 📋')}} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 active:scale-95">
                  <i className="fas fa-copy"></i>
                  Copy Report
                </button>
                {activeTool === 'ads' && (
                  <button onClick={() => {
                    const text = encodeURIComponent(result);
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }} className="bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 active:scale-95">
                    <i className="fab fa-whatsapp text-lg"></i>
                    Post to WhatsApp
                  </button>
                )}
              </div>
           </div>
           <i className="fas fa-truck-fast absolute right-[-50px] bottom-[-50px] text-[250px] opacity-[0.03] rotate-12 pointer-events-none delivery-move"></i>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;