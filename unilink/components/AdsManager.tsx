
import React, { useState } from 'react';
import { Ad } from '../types';
import { Radio, Plus, X, Sparkles, Loader2, Save, Trash2, Power } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface AdsManagerProps {
  ads: Ad[];
  onUpdateAds: (ads: Ad[]) => void;
}

const AdsManager: React.FC<AdsManagerProps> = ({ ads, onUpdateAds }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newAd, setNewAd] = useState<Partial<Ad>>({
    title: 'Limited Offer',
    description: 'Special route promo for students',
    isActive: true,
    priority: 1
  });

  const generateAIAd = async () => {
    setLoading(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a professional 2-word title and a 1-sentence catchy description for a student transport ad. Theme: ${newAd.title}. Focus on speed and safety.`,
      });
      const text = response.text || "";
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      setNewAd({
        ...newAd,
        title: lines[0]?.replace(/^Title: /, '') || newAd.title,
        description: lines[1]?.replace(/^Description: /, '') || newAd.description
      });
      
      const imgResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `A vibrant abstract transport background with streaks of blue and yellow lights, professional travel aesthetic.` }] },
        config: { imageConfig: { aspectRatio: "16:9" } }
      });
      
      for (const part of imgResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          setNewAd(prev => ({ ...prev, imageUrl: `data:image/png;base64,${part.inlineData.data}` }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveAd = () => {
    const ad: Ad = {
      id: `AD-${Date.now()}`,
      title: newAd.title!,
      description: newAd.description!,
      imageUrl: newAd.imageUrl,
      isActive: true,
      priority: 1
    };
    onUpdateAds([ad, ...ads]);
    setShowAdd(false);
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900">Promotions Hub</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Manage Passenger-Facing Broadcasts</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-[#0f172a] hover:bg-sky-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 shadow-xl transition-all"
        >
          <Plus size={16} /> New Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {ads.map(ad => (
          <div key={ad.id} className="bg-white rounded-[3rem] overflow-hidden border border-slate-100 shadow-sm group hover:shadow-2xl transition-all">
             <div className="h-40 bg-slate-900 relative">
                {ad.imageUrl && <img src={ad.imageUrl} className="w-full h-full object-cover opacity-60" alt="" />}
                <div className="absolute top-4 right-4 flex gap-2">
                   <button 
                    onClick={() => onUpdateAds(ads.filter(a => a.id !== ad.id))}
                    className="w-10 h-10 bg-white/10 hover:bg-rose-500 rounded-xl flex items-center justify-center text-white transition-all backdrop-blur-md"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
             </div>
             <div className="p-8 space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-black uppercase text-slate-900 line-clamp-1">{ad.title}</h3>
                  <button 
                    onClick={() => onUpdateAds(ads.map(a => a.id === ad.id ? {...a, isActive: !a.isActive} : a))}
                    className={`p-2 rounded-lg transition-all ${ad.isActive ? 'text-emerald-500 bg-emerald-50' : 'text-slate-300 bg-slate-100'}`}
                  >
                    <Power size={14} />
                  </button>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed line-clamp-2">{ad.description}</p>
             </div>
          </div>
        ))}
        {ads.length === 0 && (
          <div className="col-span-full py-20 border-4 border-dashed border-slate-100 rounded-[3rem] text-center opacity-30">
            <Radio size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="font-black text-[10px] uppercase tracking-widest">No active promo campaigns</p>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[4rem] w-full max-w-xl shadow-2xl relative animate-in zoom-in duration-300">
            <button onClick={() => setShowAdd(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900"><X size={24} /></button>
            <h3 className="text-3xl font-black italic uppercase mb-8 text-slate-900">Create Promo</h3>
            
            <div className="space-y-6">
              <div className="aspect-video bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100 flex items-center justify-center overflow-hidden">
                {loading ? <Loader2 className="animate-spin text-sky-500" size={32} /> : (
                  newAd.imageUrl ? <img src={newAd.imageUrl} className="w-full h-full object-cover" alt="" /> : <p className="text-[10px] font-black uppercase text-slate-300">Awaiting AI Visuals</p>
                )}
              </div>

              <div className="space-y-4">
                <input 
                  placeholder="Campaign Focus (e.g. Night Shuttle)" 
                  className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-sky-500 transition-all" 
                  value={newAd.title}
                  onChange={e => setNewAd({...newAd, title: e.target.value})}
                />
                <textarea 
                  placeholder="Promo text..." 
                  className="w-full p-5 bg-slate-50 rounded-2xl font-bold h-24 border-2 border-transparent focus:border-sky-500 transition-all" 
                  value={newAd.description}
                  onChange={e => setNewAd({...newAd, description: e.target.value})}
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={generateAIAd} 
                  disabled={loading}
                  className="flex-1 bg-sky-50 text-sky-600 py-5 rounded-2xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 border border-sky-100 hover:bg-sky-100 transition-all"
                >
                  <Sparkles size={16} /> Enhance with AI
                </button>
                <button 
                  onClick={saveAd}
                  className="flex-[2] bg-[#0f172a] text-white py-5 rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-sky-500 transition-all"
                >
                  <Save size={16} /> Deploy Campaign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsManager;
