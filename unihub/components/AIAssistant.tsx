
import React, { useState } from 'react';
import { Product } from '../types';
import { 
  generateAdParagraph, 
  optimizeProfitMargins, 
  searchMarketTrends 
} from '../services/geminiService';
import { generateFlyerImage } from '../services/marketingService';

type WorkflowPhase = 'research' | 'strategy' | 'creative';

interface AIAssistantProps {
  products: Product[];
  onAddSchedule: (post: any) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ products }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<WorkflowPhase>('research');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Results states
  const [adText, setAdText] = useState<string | null>(null);
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [marketTrends, setMarketTrends] = useState<{ text: string, sources: any[] } | null>(null);
  const [strategyResult, setStrategyResult] = useState<string | null>(null);

  const handleAction = async () => {
    if ((phase === 'strategy' || phase === 'creative') && !selectedProductId) {
      setError("Please select a target product first.");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      if (phase === 'research') {
        const result = await searchMarketTrends();
        setMarketTrends(result);
      } else if (phase === 'strategy') {
        const prod = products.find(p => p.id === selectedProductId);
        if (prod) {
          const res = await optimizeProfitMargins(prod);
          setStrategyResult(res);
        }
      } else if (phase === 'creative') {
        const prod = products.find(p => p.id === selectedProductId);
        if (prod) {
          setAdText(null);
          setFlyerUrl(null);
          
          // Generate Ads Text Generation (Gemini)
          const text = await generateAdParagraph(prod);
          setAdText(text);

          // Generate Flyer Generation with embedded text (Pollinations)
          const imgUrl = await generateFlyerImage(prod);
          setFlyerUrl(imgUrl);
        }
      }
    } catch (e) {
      console.error(e);
      setError("AI Services encountered an issue. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-700">
      {/* COMMAND CENTER */}
      <div className="max-w-4xl mx-auto bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl border border-indigo-50">
        <div className="flex flex-col gap-8">
          <div className="space-y-3">
            <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter flex items-center gap-3">
              <i className="fas fa-brain text-indigo-600"></i>
              Marketing Intelligence Node
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Phase-Based Business Expansion</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-1">Select Operation</label>
              <div className="relative">
                <select 
                  value={phase} 
                  onChange={(e) => setPhase(e.target.value as WorkflowPhase)}
                  className="w-full px-8 py-5 rounded-[2rem] bg-indigo-50/30 border-2 border-transparent focus:border-indigo-200 outline-none font-black text-slate-800 uppercase tracking-tight transition-all shadow-inner appearance-none"
                >
                  <option value="research">1. Global Market Trends</option>
                  <option value="strategy">2. Profit Margin Strategy</option>
                  <option value="creative">3. Flyer & Ads Generation</option>
                </select>
                <i className="fas fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none"></i>
              </div>
            </div>

            {phase !== 'research' && (
              <div className="space-y-3 animate-in slide-in-from-top-4">
                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-1">Target Inventory Item</label>
                <div className="relative">
                  <select 
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:border-slate-200 outline-none font-black text-slate-800 transition-all shadow-inner appearance-none"
                  >
                    <option value="">Select an Item...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <i className="fas fa-box absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"></i>
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={handleAction}
            disabled={loading}
            className={`w-full py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] transition-all shadow-2xl flex items-center justify-center gap-4 ${
              loading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#0a192f] text-white hover:bg-indigo-600 hover:-translate-y-1 active:scale-95'
            }`}
          >
            {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-bolt"></i>}
            {loading ? 'Processing Intelligence...' : 'Execute Operation'}
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-center gap-5 shadow-lg shadow-rose-100">
          <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-xl flex-shrink-0">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <p className="text-[11px] font-black uppercase text-rose-600 tracking-widest leading-relaxed flex-1">{error}</p>
        </div>
      )}

      {/* RESULTS DISPLAY */}
      <div className="max-w-6xl mx-auto px-4 md:px-0 pb-20">
        {phase === 'research' && marketTrends && (
          <div className="bg-white p-10 md:p-16 rounded-[3rem] md:rounded-[5rem] shadow-xl animate-in slide-in-from-bottom-8 duration-1000 border border-slate-50">
             <div className="flex items-center gap-6 mb-12">
               <div className="w-16 h-16 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center text-3xl shadow-2xl shadow-indigo-100">
                 <i className="fas fa-globe-africa"></i>
               </div>
               <h3 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">Market Intelligence</h3>
             </div>
             <div className="prose prose-slate max-w-none text-slate-600 font-medium whitespace-pre-wrap leading-[2.2] text-sm md:text-lg">
                {marketTrends.text}
             </div>
          </div>
        )}

        {phase === 'strategy' && strategyResult && (
          <div className="bg-[#0a192f] p-10 md:p-16 rounded-[3rem] md:rounded-[5rem] shadow-2xl text-white border-l-[16px] border-indigo-500 animate-in zoom-in duration-500">
             <div className="flex items-center gap-6 mb-12">
               <div className="w-16 h-16 bg-indigo-500 text-white rounded-[1.5rem] flex items-center justify-center text-3xl shadow-2xl shadow-indigo-500/20">
                 <i className="fas fa-chess-knight"></i>
               </div>
               <h3 className="text-3xl font-black uppercase italic tracking-tighter">Strategic Insights</h3>
             </div>
             <div className="prose prose-invert max-w-none text-slate-300 font-medium whitespace-pre-wrap leading-[2.2] text-sm md:text-lg">
                {strategyResult}
             </div>
          </div>
        )}

        {phase === 'creative' && (adText || flyerUrl || loading) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
             {/* 1. ADS TXT GENERATION */}
             <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-50 flex flex-col animate-in slide-in-from-left duration-700">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                      <i className="fas fa-quote-left text-sm"></i>
                    </div>
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Ads Txt Generation</span>
                  </div>
                  <button 
                    onClick={() => {navigator.clipboard.writeText(adText || ''); alert('Copy Successful!')}} 
                    className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white transition-all shadow-sm"
                  >
                    <i className="fas fa-copy"></i>
                  </button>
                </div>
                
                {adText ? (
                  <div className="flex-1 bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 relative">
                    <p className="text-slate-700 font-bold whitespace-pre-wrap text-sm leading-relaxed italic">"{adText}"</p>
                    <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-white rounded-2xl shadow-lg border border-slate-50 flex items-center justify-center text-emerald-500">
                      <i className="fab fa-whatsapp text-xl"></i>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
                    <i className="fas fa-keyboard text-4xl mb-4 animate-pulse"></i>
                    <p className="text-[9px] font-black uppercase tracking-widest">{loading ? 'Synthesizing Ad Copy...' : 'Awaiting Input'}</p>
                  </div>
                )}
             </div>

             {/* 2. FLYER GENERATION (Now with embedded Text) */}
             <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-50 flex flex-col items-center animate-in slide-in-from-right duration-700">
                <div className="flex items-center gap-4 self-start mb-10">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-image text-sm"></i>
                  </div>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Flyer Generation (Inc. Text)</span>
                </div>

                {flyerUrl ? (
                  <div className="w-full space-y-10">
                    <div className="relative group overflow-hidden rounded-[2.5rem] shadow-2xl border-4 border-white">
                      <img 
                        src={flyerUrl} 
                        alt="Creative Studio Flyer" 
                        className="w-full aspect-square object-cover transition-transform duration-700 group-hover:scale-110" 
                      />
                      <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <span className="bg-white/90 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-xl">High-Res Design</span>
                      </div>
                    </div>
                    <a 
                      href={flyerUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="block w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.5em] text-center shadow-xl shadow-emerald-100 hover:bg-emerald-700 hover:-translate-y-1 transition-all"
                    >
                      Export HD Flyer
                    </a>
                  </div>
                ) : (
                  <div className="w-full aspect-square bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300 p-12 text-center">
                    {loading ? (
                      <>
                        <i className="fas fa-palette text-5xl mb-6 animate-bounce text-indigo-200"></i>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rendering Flyer & Typography...</p>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-mountain-sun text-5xl mb-6"></i>
                        <p className="text-[9px] font-black uppercase tracking-widest">Creative Workspace Ready</p>
                      </>
                    )}
                  </div>
                )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;
