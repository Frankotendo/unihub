
import React, { useState } from 'react';
import { Sparkles, Send, Loader2, Copy, Check } from 'lucide-react';
import { generateMarketingCopy } from '../geminiService';

const MarketingAI: React.FC = () => {
  const [product, setProduct] = useState('');
  const [tone, setTone] = useState('Professional');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{description: string, captions: string[]} | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setLoading(true);
    try {
      const data = await generateMarketingCopy(product, tone);
      setResult(data);
    } catch (err) {
      alert("Failed to generate content. Check your API key or connection.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-2">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <Sparkles className="text-indigo-500" size={32} />
          MARKETING AI
        </h2>
        <p className="text-slate-500 font-medium">Generate professional marketing copy and social captions for your inventory items.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleGenerate} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Inventory Product</label>
              <input 
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="e.g. Mini Desk Fan (USB)"
                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Tone of Voice</label>
              <select 
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20"
              >
                <option>Professional</option>
                <option>Playful</option>
                <option>Luxurious</option>
                <option>Hype</option>
              </select>
            </div>
            <button 
              disabled={loading || !product}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white py-4 rounded-2xl font-bold text-sm tracking-widest transition-all shadow-lg shadow-indigo-600/20"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              GENERATE COPY
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {!result && !loading && (
            <div className="h-full bg-slate-100/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-12 text-center">
              <Sparkles className="text-slate-300 mb-4" size={48} />
              <p className="text-slate-400 font-medium">Results will appear here. Enter product details to get started.</p>
            </div>
          )}

          {loading && (
            <div className="h-full bg-white rounded-[2.5rem] border border-slate-100 flex flex-col items-center justify-center p-12 text-center space-y-4 shadow-sm">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
              <p className="text-slate-600 font-bold">Unidrop AI is thinking...</p>
            </div>
          )}

          {result && !loading && (
            <>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative group">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">AI-Generated Description</label>
                <p className="text-slate-700 font-medium leading-relaxed">{result.description}</p>
                <button 
                  onClick={() => copyToClipboard(result.description, 'desc')}
                  className="absolute top-8 right-8 p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all opacity-0 group-hover:opacity-100"
                >
                  {copied === 'desc' ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Social Media Captions</label>
                <div className="space-y-4">
                  {result.captions.map((cap, idx) => (
                    <div key={idx} className="bg-slate-50 p-5 rounded-2xl flex items-start justify-between gap-4 group/item">
                      <p className="text-sm font-semibold text-slate-600 italic">"{cap}"</p>
                      <button 
                        onClick={() => copyToClipboard(cap, `cap-${idx}`)}
                        className="p-2 rounded-xl text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all opacity-0 group-hover/item:opacity-100 shrink-0"
                      >
                        {copied === `cap-${idx}` ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketingAI;
