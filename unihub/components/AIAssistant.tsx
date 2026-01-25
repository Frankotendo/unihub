import React, { useState } from 'react';
import { Product } from '../types';
import { 
  generateAdParagraph, 
  generateFlyerImage, 
  optimizeProfitMargins, 
  searchMarketTrends 
} from '../services/geminiService';

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
          // Reset previous outputs while generating
          setAdText(null);
          setFlyerUrl(null);
          
          // Parallel execution for speed
          const [text, img] = await Promise.all([
            generateAdParagraph(prod),
            generateFlyerImage(prod)
          ]);
          
          setAdText(text);
          setFlyerUrl(img);
          
          if (!img) {
            setError("Ad text generated, but the flyer image was blocked or failed. Try a simpler product name.");
          }
        }
      }
    } catch (e) {
      setError("Connection to AI services lost. Check your internet or API key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-700">
      {/* 1. PRIMARY WORKFLOW DROPDOWN */}
      <div className="max-w-3xl mx-auto bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl border border-indigo-50">
        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">AI Command Phase</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select your next business move</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] px-1">Phase Choice</label>
              <select 
                value={phase} 
                onChange={(e) => setPhase(e.target.value as WorkflowPhase)}
                className="w-full px-6 py-5 rounded-3xl bg-indigo-50/50 border-2 border-transparent focus:border-indigo-200 outline-none font-black text-slate-800 uppercase tracking-tight transition-all shadow-inner"
              >
                <option value="research">1. Market Intelligence (Trends)</option>
                <option value="strategy">2. Strategy & Pricing (Margins)</option>
                <option value="creative">3. Creative Studio (Flyers & Ads)</option>
              </select>
            </div>

            {phase !== 'research' && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <label className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] px-1">Product Target</label>
                <select 
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-6 py-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-slate-200 outline-none font-black text-slate-800 transition-all shadow-inner"
                >
                  <option value="">Select an Item...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <button 
            onClick={handleAction}
            disabled={loading}
            className={`w-full py-5 rounded-3xl font-black text-xs uppercase tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-3 ${
              loading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1 active:scale-95'
            }`}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Processing Command...
              </>
            ) : (
              <>
                <i className="fas fa-bolt"></i>
                Generate Insights
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-3xl mx-auto bg-rose-50 border border-rose-100 p-5 rounded-3xl flex items-center gap-4 animate-bounce">
          <div className="w-10 h-10 bg-rose-500 text-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-200">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <p className="text-[11px] font-black uppercase text-rose-600 tracking-widest leading-relaxed">{error}</p>
        </div>
      )}

      {/* DISPLAY RESULTS */}
      <div className="max-w-6xl mx-auto px-4 md:px-0">
        {phase === 'research' && marketTrends && (
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] shadow-xl animate-in fade-in slide-in-from-bottom-6 duration-700">
             <div className="flex items-center gap-4 mb-8">
               <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-xl shadow-indigo-100">
                 <i className="fas fa-earth-africa"></i>
               </div>
               <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">Market Intelligence Report</h3>
             </div>
             <div className="prose prose-slate max-w-none text-slate-600 font-medium whitespace-pre-wrap leading-loose text-sm md:text-md">
                {marketTrends.text}
             </div>
             {marketTrends.sources.length > 0 && (
               <div className="mt-10 pt-10 border-t border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Verified Grounding Sources</p>
                  <div className="flex flex-wrap gap-3">
                    {marketTrends.sources.map((src, i) => (
                      <a key={i} href={src.web?.uri} target="_blank" rel="noreferrer" className="bg-slate-50 border border-slate-100 px-6 py-3 rounded-2xl text-[10px] font-bold text-indigo-600 hover:bg-white hover:border-indigo-300 transition-all shadow-sm">
                        <i className="fas fa-link mr-2 opacity-50"></i> {src.web?.title || 'Market Report'}
                      </a>
                    ))}
                  </div>
               </div>
             )}
          </div>
        )}

        {phase === 'strategy' && strategyResult && (
          <div className="bg-[#0a192f] p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl animate-in zoom-in duration-500 text-white border-l-[12px] border-amber-500">
             <div className="flex items-center gap-4 mb-10">
               <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-xl shadow-xl shadow-amber-500/20">
                 <i className="fas fa-chart-line"></i>
               </div>
               <h3 className="text-2xl font-black uppercase tracking-tighter italic leading-none">Profit Mastery Plan</h3>
             </div>
             <div className="prose prose-invert max-w-none text-slate-300 font-medium whitespace-pre-wrap leading-relaxed md:leading-loose text-sm md:text-md opacity-90">
                {strategyResult}
             </div>
          </div>
        )}

        {phase === 'creative' && (adText || flyerUrl) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
             {/* Text Output */}
             <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-50 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-4 py-1.5 rounded-xl">Marketing Copy</span>
                  <button 
                    onClick={() => {navigator.clipboard.writeText(adText || ''); alert('Copy successful!')}}
                    className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all"
                  >
                    <i className="fas fa-copy text-sm"></i>
                  </button>
                </div>
                <div className="flex-1 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                  <p className="text-slate-700 font-medium whitespace-pre-wrap text-sm leading-relaxed">{adText}</p>
                </div>
             </div>

             {/* Visual Output */}
             <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-50 flex flex-col items-center">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-4 py-1.5 rounded-xl self-start mb-8">Visual Asset</span>
                {flyerUrl ? (
                  <div className="w-full space-y-8">
                    <img 
                      src={flyerUrl} 
                      alt="Market AI Flyer" 
                      className="w-full aspect-square rounded-[2rem] shadow-2xl border-8 border-white object-cover" 
                    />
                    <a 
                      href={flyerUrl} 
                      download={`${selectedProductId}-flyer.png`} 
                      className="block w-full bg-emerald-600 text-white py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.4em] text-center shadow-xl shadow-emerald-100 hover:bg-emerald-700 hover:-translate-y-1 transition-all"
                    >
                      Save Flyer Image
                    </a>
                  </div>
                ) : (
                  <div className="flex-1 w-full flex flex-col items-center justify-center text-slate-200 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100 p-10 text-center">
                    <i className="fas fa-image text-5xl mb-6"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest">Visual generation pending or restricted</p>
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