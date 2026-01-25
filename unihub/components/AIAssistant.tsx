
import React, { useState } from 'react';
import { Product } from '../types.ts';
import { 
  generateAdParagraph, 
  generateFlyerImage, 
  optimizeProfitMargins, 
  searchMarketTrends 
} from '../services/geminiService.ts';

interface AIAssistantProps {
  products: Product[];
  onAddSchedule: (post: any) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ products }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'creative' | 'intelligence'>('creative');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Response states
  const [adText, setAdText] = useState<string | null>(null);
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [marketTrends, setMarketTrends] = useState<{ text: string, sources: any[] } | null>(null);
  const [strategyResult, setStrategyResult] = useState<string | null>(null);

  const handleGenerateAd = async () => {
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;
    setLoading(true);
    try {
      const text = await generateAdParagraph(prod);
      setAdText(text);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleGenerateFlyer = async () => {
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;
    setLoading(true);
    setFlyerUrl(null);
    try {
      const url = await generateFlyerImage(prod);
      setFlyerUrl(url);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleResearchTrends = async () => {
    setLoading(true);
    try {
      const result = await searchMarketTrends();
      setMarketTrends(result);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleOptimizePrice = async () => {
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;
    setLoading(true);
    try {
      const result = await optimizeProfitMargins(prod);
      setStrategyResult(result);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Navigation Tabs */}
      <div className="flex bg-white p-2 rounded-3xl shadow-sm border border-slate-100 max-w-md mx-auto">
        <button 
          onClick={() => setActiveTab('creative')}
          className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'creative' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <i className="fas fa-wand-sparkles mr-2"></i> Creative Studio
        </button>
        <button 
          onClick={() => setActiveTab('intelligence')}
          className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'intelligence' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <i className="fas fa-brain mr-2"></i> Intelligence
        </button>
      </div>

      {activeTab === 'creative' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Creative Controls */}
          <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-10">
              <div className="flex-1">
                <h3 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic mb-2">Creative Assets</h3>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em]">Generate high-conversion ads in seconds</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <select 
                  className="px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none font-black text-slate-800 text-sm min-w-[200px]"
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                >
                  <option value="">Select Item...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <button 
                    onClick={handleGenerateAd}
                    disabled={loading || !selectedProductId}
                    className="flex-1 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-200 hover:scale-105 transition-all disabled:opacity-50"
                  >
                    Text Ad
                  </button>
                  <button 
                    onClick={handleGenerateFlyer}
                    disabled={loading || !selectedProductId}
                    className="flex-1 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-200 hover:scale-105 transition-all disabled:opacity-50"
                  >
                    Image Flyer
                  </button>
                </div>
              </div>
            </div>

            {/* Display Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Text Ad Display */}
              <div className={`p-8 rounded-[2.5rem] border-2 border-dashed flex flex-col ${adText ? 'bg-indigo-50/30 border-indigo-200' : 'bg-slate-50 border-slate-200 items-center justify-center'}`}>
                {adText ? (
                  <div className="animate-in fade-in duration-700 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">WhatsApp Copy</span>
                      <button onClick={() => {navigator.clipboard.writeText(adText); alert("Copied!")}} className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600">
                        <i className="fas fa-copy text-xs"></i>
                      </button>
                    </div>
                    <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap text-sm flex-1">{adText}</p>
                  </div>
                ) : (
                  <div className="text-center opacity-20">
                    <i className="fas fa-quote-left text-4xl mb-2"></i>
                    <p className="text-[9px] font-black uppercase tracking-widest">No Text Ad Generated</p>
                  </div>
                )}
              </div>

              {/* Flyer Image Display */}
              <div className={`p-8 rounded-[2.5rem] border-2 border-dashed flex flex-col ${flyerUrl ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50 border-slate-200 items-center justify-center'}`}>
                {loading && !flyerUrl ? (
                  <div className="text-center">
                    <i className="fas fa-circle-notch fa-spin text-3xl text-emerald-500 mb-4"></i>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Painting Flyer...</p>
                  </div>
                ) : flyerUrl ? (
                  <div className="animate-in zoom-in duration-700 flex flex-col items-center">
                    <img src={flyerUrl} alt="Flyer" className="w-full aspect-square rounded-2xl shadow-2xl border-4 border-white mb-6 object-cover" />
                    <a href={flyerUrl} download={`${selectedProductId}-flyer.png`} className="w-full py-4 bg-white border-2 border-emerald-500 text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-widest text-center hover:bg-emerald-500 hover:text-white transition-all">
                      Download Flyer
                    </a>
                  </div>
                ) : (
                  <div className="text-center opacity-20">
                    <i className="fas fa-image text-4xl mb-2"></i>
                    <p className="text-[9px] font-black uppercase tracking-widest">No Flyer Generated</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Market Research */}
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h4 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Campus Trends</h4>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Real-time Market Search</p>
                </div>
                <button 
                  onClick={handleResearchTrends}
                  disabled={loading}
                  className="w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center hover:scale-110 transition-all disabled:opacity-50"
                >
                  <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-search'}`}></i>
                </button>
              </div>

              <div className="flex-1 min-h-[300px] bg-slate-50 rounded-[2rem] p-8 border border-slate-100 overflow-y-auto custom-scrollbar">
                {marketTrends ? (
                  <div className="space-y-6">
                    <div className="prose prose-slate max-w-none text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {marketTrends.text}
                    </div>
                    {marketTrends.sources.length > 0 && (
                      <div className="pt-6 border-t border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Grounding Sources</p>
                        <div className="flex flex-wrap gap-2">
                          {marketTrends.sources.map((src, i) => (
                            <a 
                              key={i} 
                              href={src.web?.uri || '#'} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[10px] bg-white border border-slate-100 px-3 py-1.5 rounded-lg text-indigo-600 font-bold hover:border-indigo-300 transition-all truncate max-w-[150px]"
                            >
                              {src.web?.title || 'Source'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-6">
                    <i className="fas fa-globe-africa text-5xl mb-4"></i>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Research the latest campus demands in Ghana</p>
                  </div>
                )}
              </div>
            </div>

            {/* Strategy Hub */}
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h4 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Profit Scout</h4>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Strategy & Pricing</p>
                </div>
                <button 
                  onClick={handleOptimizePrice}
                  disabled={loading || !selectedProductId}
                  className="w-14 h-14 bg-amber-500 text-white rounded-2xl shadow-xl shadow-amber-100 flex items-center justify-center hover:scale-110 transition-all disabled:opacity-50"
                >
                  <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-calculator'}`}></i>
                </button>
              </div>

              <div className="flex-1 min-h-[300px] bg-slate-50 rounded-[2rem] p-8 border border-slate-100 overflow-y-auto custom-scrollbar">
                {strategyResult ? (
                  <div className="prose prose-slate max-w-none text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {strategyResult}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center">
                    <div className="p-4 rounded-2xl bg-slate-100 mb-4">
                      <select 
                        className="bg-transparent border-none outline-none font-black text-xs uppercase tracking-widest text-slate-500"
                        value={selectedProductId}
                        onChange={e => setSelectedProductId(e.target.value)}
                      >
                        <option value="">Choose Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="opacity-20 text-center px-6">
                      <i className="fas fa-chart-line text-5xl mb-4"></i>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">Select an item to optimize pricing</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
