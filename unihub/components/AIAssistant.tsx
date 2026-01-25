
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
  const [adLoading, setAdLoading] = useState(false);
  const [flyerLoading, setFlyerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<WorkflowPhase>('research');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Results states
  const [adText, setAdText] = useState<string | null>(null);
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [marketTrends, setMarketTrends] = useState<{ text: string, sources: any[] } | null>(null);
  const [strategyResult, setStrategyResult] = useState<string | null>(null);

  const handleResearchAction = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchMarketTrends();
      setMarketTrends(result);
    } catch (e) {
      setError("Market research encountered an error.");
    } finally {
      setLoading(false);
    }
  };

  const handleStrategyAction = async () => {
    if (!selectedProductId) {
      setError("Select a target item to analyze profit strategy.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const prod = products.find(p => p.id === selectedProductId);
      if (prod) {
        const res = await optimizeProfitMargins(prod);
        setStrategyResult(res);
      }
    } catch (e) {
      setError("Strategy engine is currently offline.");
    } finally {
      setLoading(false);
    }
  };

  const handleTextGen = async () => {
    if (!selectedProductId) {
      setError("Choose a product for ad copy generation.");
      return;
    }
    setAdLoading(true);
    setError(null);
    try {
      const prod = products.find(p => p.id === selectedProductId);
      if (prod) {
        const text = await generateAdParagraph(prod);
        setAdText(text);
      }
    } catch (e) {
      setError("Copywriting engine failed.");
    } finally {
      setAdLoading(false);
    }
  };

  const handleImageGen = async () => {
    if (!selectedProductId) {
      setError("Choose a product to render a visual for.");
      return;
    }
    setFlyerLoading(true);
    setError(null);
    try {
      const prod = products.find(p => p.id === selectedProductId);
      if (prod) {
        const img = await generateFlyerImage(prod);
        if (img) {
          setFlyerUrl(img);
        } else {
          // SAFE FALLBACK: Use a high-quality abstract SVG pattern
          setFlyerUrl(`https://api.dicebear.com/7.x/shapes/svg?seed=${prod.name}&backgroundColor=0f172a&shape1Color=4f46e5`);
          setError("Direct photo rendering restricted. Generated a brand-consistent abstract visual instead.");
        }
      }
    } catch (e) {
      setFlyerUrl(`https://api.dicebear.com/7.x/shapes/svg?seed=fallback&backgroundColor=cbd5e1`);
      setError("Visual engine failure. Using fallback pattern.");
    } finally {
      setFlyerLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-700">
      {/* CONTROL UNIT */}
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-14 rounded-[3rem] md:rounded-[4rem] shadow-2xl border border-indigo-50">
        <div className="flex flex-col gap-10">
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter flex items-center gap-4">
              <i className="fas fa-microchip text-indigo-600 animate-pulse"></i>
              Intelligence Hub
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Proprietary Dropshipping Analytics & Creative Studio</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-2">Operation Pipeline</label>
              <select 
                value={phase} 
                onChange={(e) => setPhase(e.target.value as WorkflowPhase)}
                className="w-full px-8 py-5 rounded-[2rem] bg-indigo-50/50 border-2 border-transparent focus:border-indigo-300 outline-none font-black text-slate-800 uppercase tracking-tight transition-all shadow-inner appearance-none cursor-pointer"
              >
                <option value="research">1. Global Trends Research</option>
                <option value="strategy">2. Profit Strategy Analysis</option>
                <option value="creative">3. AI Marketing Creative</option>
              </select>
            </div>

            {phase !== 'research' && (
              <div className="space-y-3 animate-in slide-in-from-top-4 duration-500">
                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-2">Target Product</label>
                <select 
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-8 py-5 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:border-slate-300 outline-none font-black text-slate-800 transition-all shadow-inner appearance-none cursor-pointer"
                >
                  <option value="">Select an item...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {phase === 'research' && (
            <button onClick={handleResearchAction} disabled={loading} className="w-full py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] bg-[#0a192f] text-white hover:bg-indigo-600 transition-all shadow-xl hover:scale-[1.02] active:scale-95">
              {loading ? <i className="fas fa-circle-notch fa-spin mr-3"></i> : <i className="fas fa-globe-africa mr-3"></i>}
              Initiate Market Scan
            </button>
          )}

          {phase === 'strategy' && (
            <button onClick={handleStrategyAction} disabled={loading} className="w-full py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-xl hover:scale-[1.02] active:scale-95">
              {loading ? <i className="fas fa-circle-notch fa-spin mr-3"></i> : <i className="fas fa-chess-knight mr-3"></i>}
              Calculate Margins
            </button>
          )}

          {phase === 'creative' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
              <button onClick={handleTextGen} disabled={adLoading} className="py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-widest bg-slate-800 text-white hover:bg-slate-900 transition-all shadow-xl flex items-center justify-center gap-3">
                {adLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-pen-nib"></i>}
                Draft Ad Copy
              </button>
              <button onClick={handleImageGen} disabled={flyerLoading} className="py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center gap-3">
                {flyerLoading ? <i className="fas fa-palette fa-spin"></i> : <i className="fas fa-image"></i>}
                Render Visual Asset
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto bg-amber-50 border border-amber-100 p-8 rounded-[2.5rem] flex items-center gap-6 shadow-xl shadow-amber-50 animate-in bounce-in">
          <div className="w-14 h-14 bg-amber-500 text-white rounded-[1.5rem] flex items-center justify-center text-xl shadow-lg">
            <i className="fas fa-shield-halved"></i>
          </div>
          <p className="text-[11px] font-black uppercase text-amber-700 tracking-widest flex-1">{error}</p>
        </div>
      )}

      {/* RESULT SECTIONS */}
      <div className="max-w-6xl mx-auto px-4 lg:px-0">
        {phase === 'research' && marketTrends && (
          <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-50 animate-in slide-in-from-bottom">
            <h3 className="text-2xl font-black text-slate-800 uppercase italic mb-8 border-l-8 border-indigo-600 pl-6">Market Intelligence</h3>
            <div className="prose prose-slate max-w-none text-slate-600 font-medium text-lg leading-relaxed whitespace-pre-wrap">{marketTrends.text}</div>
            {marketTrends.sources.length > 0 && (
              <div className="mt-12 pt-10 border-t border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Verified Grounding Sources</p>
                <div className="flex flex-wrap gap-3">
                  {marketTrends.sources.map((src: any, i: number) => (
                    src.web && <a key={i} href={src.web.uri} target="_blank" className="bg-slate-50 px-4 py-2 rounded-xl text-[9px] font-bold text-slate-400 border border-slate-100 hover:text-indigo-600 hover:bg-indigo-50 transition-all uppercase">{src.web.title}</a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'strategy' && strategyResult && (
          <div className="bg-[#0a192f] p-12 rounded-[3.5rem] shadow-2xl text-white border-l-[16px] border-indigo-500 animate-in zoom-in">
             <h3 className="text-2xl font-black uppercase italic mb-8 tracking-tighter">Strategic Insights</h3>
             <div className="prose prose-invert max-w-none text-slate-300 font-medium text-lg leading-relaxed whitespace-pre-wrap">{strategyResult}</div>
          </div>
        )}

        {phase === 'creative' && (adText || flyerUrl || adLoading || flyerLoading) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Copy Output */}
            <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-50 flex flex-col min-h-[450px]">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl">
                  <i className="fas fa-paragraph"></i>
                </div>
                <div>
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Output 01</span>
                  <h4 className="text-sm font-black text-slate-800 uppercase italic">Marketing Text</h4>
                </div>
              </div>
              
              {adLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-200">
                  <i className="fas fa-keyboard text-5xl mb-6 animate-pulse"></i>
                  <p className="text-[9px] font-black uppercase tracking-[0.4em]">Drafting Content...</p>
                </div>
              ) : adText && (
                <div className="flex-1 bg-slate-50/50 p-10 rounded-[2.5rem] border border-slate-100 relative group">
                  <p className="text-slate-700 font-bold whitespace-pre-wrap text-md italic leading-relaxed">"{adText}"</p>
                  <button onClick={() => {navigator.clipboard.writeText(adText); alert('Ad text copied!')}} className="absolute bottom-6 right-6 w-14 h-14 bg-white rounded-2xl shadow-xl flex items-center justify-center text-indigo-600 hover:scale-110 active:scale-95 transition-all">
                    <i className="fas fa-copy"></i>
                  </button>
                </div>
              )}
            </div>

            {/* Visual Output */}
            <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-50 flex flex-col min-h-[450px]">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-xl">
                  <i className="fas fa-camera-retro"></i>
                </div>
                <div>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Output 02</span>
                  <h4 className="text-sm font-black text-slate-800 uppercase italic">Visual Asset</h4>
                </div>
              </div>

              {flyerLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-200">
                  <i className="fas fa-palette text-5xl mb-6 animate-bounce"></i>
                  <p className="text-[9px] font-black uppercase tracking-[0.4em]">Rendering Visual...</p>
                </div>
              ) : flyerUrl && (
                <div className="w-full space-y-8 animate-in zoom-in duration-700">
                  <div className="relative group overflow-hidden rounded-[2.5rem] shadow-2xl border-4 border-white">
                    <img src={flyerUrl} alt="Flyer" className="w-full aspect-square object-cover transition-transform duration-1000 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <a href={flyerUrl} target="_blank" className="bg-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-2xl">View High Res</a>
                    </div>
                  </div>
                  <a href={flyerUrl} download="marketing-visual.png" className="block w-full bg-emerald-600 text-white py-6 rounded-[2.5rem] font-black text-[10px] uppercase tracking-[0.5em] text-center shadow-2xl hover:bg-emerald-700 transition-all">
                    Export Visual
                  </a>
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
