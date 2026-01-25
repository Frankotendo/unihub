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
          if (!customerQuery.trim()) { alert("Please enter what the customer said."); setLoading(false); return; }
          res = await draftCustomerReply(customerQuery);
          break;
        default:
          res = "Feature not recognized.";
      }
      setResult(res);
    } catch (e) {
      console.error(e);
      setResult("Oops! The Hub connection is shaky. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toolCategories = [
    { id: 'market', label: 'Strategy', icon: 'fa-chess-king', color: 'indigo' },
    { id: 'ads', label: 'Ad Maker', icon: 'fa-bullhorn', color: 'emerald' },
    { id: 'ideas', label: 'Biz Ideas', icon: 'fa-lightbulb', color: 'amber' },
    { id: 'pricing', label: 'Price Audit', icon: 'fa-tags', color: 'rose' },
    { id: 'replies', label: 'Chat Help', icon: 'fa-comments', color: 'sky' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Main Bot Hub */}
      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden">
        {/* Animated Background Element */}
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-indigo-50 rounded-full blur-[100px] opacity-50"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 relative z-10">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-[#0f172a] rounded-2xl flex items-center justify-center text-indigo-400 shadow-lg">
                <i className="fas fa-robot text-lg"></i>
              </div>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">UniHub AI</h2>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-16">Intelligence for Campus Dropshippers</p>
          </div>
          
          <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-[2rem] gap-1 shadow-inner">
            {toolCategories.map((tool) => (
              <button 
                key={tool.id} 
                onClick={() => {setActiveTool(tool.id as AITool); setResult(null)}} 
                className={`px-5 py-3 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  activeTool === tool.id 
                    ? 'bg-white text-slate-900 shadow-md' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <i className={`fas ${tool.icon} text-[10px]`}></i>
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8 relative z-10">
          {/* Tool-Specific Inputs */}
          <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 animate-in slide-in-from-top-4">
            {activeTool === 'market' && (
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-indigo-600 shadow-sm">
                  <i className="fas fa-chart-line text-2xl"></i>
                </div>
                <div>
                  <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">Market & Strategy</h4>
                  <p className="text-xs text-slate-400 font-medium">Analyzing current stock and local trends to give you the edge.</p>
                </div>
              </div>
            )}

            {(activeTool === 'ads' || activeTool === 'pricing') && (
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Select Target Item</label>
                 <div className="relative">
                    <select className="w-full px-8 py-5 rounded-2xl bg-white border border-slate-100 font-bold text-slate-800 outline-none appearance-none shadow-sm focus:ring-4 focus:ring-indigo-50 transition-all" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                        <option value="">-- Click to pick from stock --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} (GHS {p.sellingPrice})</option>)}
                    </select>
                    <i className="fas fa-chevron-down absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"></i>
                 </div>
              </div>
            )}

            {activeTool === 'ideas' && (
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-amber-500 shadow-sm">
                  <i className="fas fa-seedling text-2xl"></i>
                </div>
                <div>
                  <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">Biz Innovation Lab</h4>
                  <p className="text-xs text-slate-400 font-medium">Discovering new ways to make money on campus this week.</p>
                </div>
              </div>
            )}

            {activeTool === 'replies' && (
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">What did the customer say?</label>
                 <textarea 
                  className="w-full px-8 py-6 rounded-3xl bg-white border border-slate-100 font-bold text-slate-800 outline-none h-32 transition-all shadow-sm focus:ring-4 focus:ring-sky-50 resize-none" 
                  placeholder="e.g. 'How much for delivery to Sarbah Hall?'" 
                  value={customerQuery} 
                  onChange={e => setCustomerQuery(e.target.value)}
                 ></textarea>
              </div>
            )}
          </div>

          <button 
            onClick={runBot}
            disabled={loading}
            className="w-full bg-[#0f172a] text-white py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] shadow-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 group disabled:opacity-50"
          >
            {loading ? <i className="fas fa-sync fa-spin"></i> : <i className="fas fa-bolt-lightning group-hover:scale-125 transition-transform"></i>}
            {loading ? 'Crunching Data...' : 'Execute Analysis'}
          </button>
        </div>
      </div>

      {/* Results Display */}
      {result && (
        <div className="bg-[#0f172a] p-10 md:p-14 rounded-[4rem] text-white shadow-2xl animate-in slide-in-from-bottom-10 duration-700 border-t-8 border-indigo-600 relative overflow-hidden">
           <div className="relative z-10">
              <div className="flex items-center gap-4 mb-10">
                 <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-400 border border-white/10">
                    <i className="fas fa-sparkles text-xl"></i>
                 </div>
                 <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] block text-indigo-400">UniHub Intel</span>
                    <span className="text-[8px] font-bold uppercase opacity-30">V3.1 Neural Output</span>
                 </div>
              </div>
              
              <div className="text-slate-200 font-medium leading-[1.8] whitespace-pre-wrap text-[15px] bg-white/5 p-8 md:p-10 rounded-[2.5rem] border border-white/5 backdrop-blur-sm shadow-inner">
                {result}
              </div>
              
              <div className="flex flex-wrap gap-4 mt-12">
                <button onClick={() => {navigator.clipboard.writeText(result); alert('Insight copied!')}} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 active:scale-95">
                  <i className="fas fa-copy"></i>
                  Copy Insight
                </button>
                {(activeTool === 'ads' || activeTool === 'replies') && (
                  <button onClick={() => alert('Opening WhatsApp...')} className="bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 active:scale-95">
                    <i className="fab fa-whatsapp text-lg"></i>
                    Send to Phone
                  </button>
                )}
              </div>
           </div>
           {/* Decorative movement icon */}
           <i className="fas fa-truck-fast absolute right-[-50px] bottom-[-50px] text-[250px] opacity-[0.03] rotate-12 pointer-events-none delivery-move"></i>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;