
import React, { useState } from 'react';
import { Sparkles, Send, Loader2, Copy, Check, Image as ImageIcon, Download, Palette } from 'lucide-react';
import { generateMarketingCopy, generateFlyerWithGemini } from '../geminiService';
import { Product } from '../types';

interface MarketingAIProps {
  products: Product[];
}

const MarketingAI: React.FC<MarketingAIProps> = ({ products }) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [tone, setTone] = useState('Professional');
  const [style, setStyle] = useState('Modern Minimalist');
  const [loading, setLoading] = useState(false);
  const [flyerLoading, setFlyerLoading] = useState(false);
  const [result, setResult] = useState<{description: string, captions: string[]} | null>(null);
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await generateMarketingCopy(selectedProduct.name, tone);
      setResult(data);
    } catch (err) {
      alert("Failed to generate content. Check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFlyer = async () => {
    if (!selectedProduct) return;
    setFlyerLoading(true);
    setFlyerUrl(null);
    
    const messages = [
      "Analyzing product aesthetics...",
      "Drafting visual composition...",
      "Rendering high-res lighting...",
      "Applying typography...",
      "Finalizing marketing flyer..."
    ];
    
    let msgIndex = 0;
    const interval = setInterval(() => {
      setProgressMsg(messages[msgIndex]);
      msgIndex = (msgIndex + 1) % messages.length;
    }, 2500);

    try {
      const url = await generateFlyerWithGemini(selectedProduct, style);
      setFlyerUrl(url);
    } catch (err) {
      alert("Flyer studio is busy. Try again.");
    } finally {
      clearInterval(interval);
      setFlyerLoading(false);
      setProgressMsg('');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div className="space-y-2">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4 italic uppercase">
          <Sparkles className="text-indigo-600" size={40} />
          Creative Studio
        </h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">AI-Powered Ad Generation & Visual Flyering</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Select Item to Market</label>
              <select 
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 text-sm font-black text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                onChange={(e) => {
                  const p = products.find(prod => prod.id === e.target.value);
                  setSelectedProduct(p || null);
                  setResult(null);
                  setFlyerUrl(null);
                }}
              >
                <option value="">-- Choose Product --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (GHS {p.sellingPrice})</option>)}
              </select>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Visual Style</label>
              <div className="grid grid-cols-2 gap-2">
                {['Modern Minimalist', 'Vibrant Pop', 'Luxury Gold', 'Cyber Campus'].map(s => (
                  <button 
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      style === s ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Copy Tone</label>
              <div className="grid grid-cols-2 gap-2">
                {['Professional', 'Hype', 'Playful', 'Luxurious'].map(t => (
                  <button 
                    key={t}
                    onClick={() => setTone(t)}
                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      tone === t ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <button 
                onClick={handleGenerate}
                disabled={loading || !selectedProduct}
                className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 text-white py-5 rounded-2xl font-black text-xs tracking-[0.2em] transition-all shadow-xl uppercase group"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} className="group-hover:translate-x-1 transition-transform" />}
                Generate Copy
              </button>
              
              <button 
                onClick={handleGenerateFlyer}
                disabled={flyerLoading || !selectedProduct}
                className="w-full flex items-center justify-center gap-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white disabled:bg-slate-50 disabled:text-slate-200 py-5 rounded-2xl font-black text-xs tracking-[0.2em] transition-all border border-indigo-100 uppercase group"
              >
                {flyerLoading ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />}
                Generate Flyer
              </button>
            </div>
          </div>
        </div>

        {/* Output Area */}
        <div className="lg:col-span-8 space-y-8">
          {/* Visual Flyer Output */}
          {flyerUrl || flyerLoading ? (
            <div className="bg-[#0f172a] rounded-[3.5rem] overflow-hidden shadow-2xl relative border-t-8 border-indigo-600">
               <div className="p-8 border-b border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><ImageIcon size={16} className="text-white" /></div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Flyer Studio // {style}</span>
                  </div>
                  {flyerUrl && !flyerLoading && (
                    <a href={flyerUrl} download={`${selectedProduct?.name}_flyer.png`} className="text-white/40 hover:text-white flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                       Save Assets <Download size={14} />
                    </a>
                  )}
               </div>
               <div className="aspect-square relative flex items-center justify-center bg-slate-900">
                 {flyerLoading ? (
                   <div className="flex flex-col items-center gap-6 text-white text-center px-10">
                     <div className="relative">
                        <div className="w-20 h-20 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                        <Palette className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={32} />
                     </div>
                     <div className="space-y-2">
                        <p className="font-black text-sm uppercase tracking-[0.3em] animate-pulse">{progressMsg}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Gemini Vision Engine is processing</p>
                     </div>
                   </div>
                 ) : (
                   <img src={flyerUrl!} className="w-full h-full object-cover animate-in fade-in zoom-in duration-1000" alt="Flyer" />
                 )}
               </div>
            </div>
          ) : null}

          {/* Text Content Output */}
          {(result || loading) && (
            <div className="space-y-6">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative group">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-2 flex items-center justify-between">
                  AI Ad Description
                  {result && (
                    <button onClick={() => copyToClipboard(result.description, 'desc')} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all">
                      {copied === 'desc' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  )}
                </label>
                {loading ? (
                  <div className="h-20 bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">Writing copy...</div>
                ) : (
                  <p className="text-slate-800 font-bold leading-relaxed text-lg italic pr-12">"{result?.description}"</p>
                )}
              </div>

              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 px-2">WhatsApp Status Captions</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {loading ? [1, 2, 3].map(i => (
                    <div key={i} className="h-24 bg-slate-50 rounded-3xl animate-pulse"></div>
                  )) : result?.captions.map((cap, idx) => (
                    <div key={idx} className="bg-slate-50 p-6 rounded-3xl flex items-start justify-between gap-4 group/item hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100">
                      <p className="text-xs font-bold text-slate-600 leading-relaxed italic pr-8">{cap}</p>
                      <button 
                        onClick={() => copyToClipboard(cap, `cap-${idx}`)}
                        className="p-3 bg-white rounded-xl text-slate-300 hover:text-indigo-600 shadow-sm transition-all"
                      >
                        {copied === `cap-${idx}` ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!result && !flyerUrl && !loading && !flyerLoading && (
            <div className="h-[500px] bg-slate-100/50 rounded-[4rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center p-20 text-center space-y-6">
              <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center text-slate-200 shadow-sm">
                <Sparkles size={48} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-400 uppercase italic tracking-tighter">Studio Idle</h3>
                <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">Select a product from the inventory to start generating marketing assets.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketingAI;
