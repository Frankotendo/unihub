
import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight, Zap, AlertCircle, Loader2 } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (password: string) => boolean;
  storeName: string;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, storeName }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    // Simulate a brief "security check"
    setTimeout(() => {
      const success = onLogin(password);
      if (!success) {
        setError(true);
        setPassword('');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-sans selection:bg-indigo-500/30">
      {/* Abstract Background Decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10 space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-[2rem] shadow-2xl shadow-indigo-500/20 mb-4 animate-in zoom-in duration-700">
            <Zap size={32} className="text-white" fill="currentColor" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">
              {storeName} <span className="text-indigo-400">Vault</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Secure Admin Access Only</p>
          </div>
        </div>

        <div className={`bg-[#0b1224] p-10 md:p-12 rounded-[3.5rem] border border-white/5 shadow-2xl transition-all duration-300 ${error ? 'border-rose-500/50 shadow-rose-500/10 animate-shake' : ''}`}>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                <Lock size={12} className="text-indigo-400" />
                Access Key
              </label>
              <div className="relative group">
                <input 
                  type="password" 
                  required
                  autoFocus
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-white font-mono text-lg tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-700"
                />
                {error && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500 animate-in fade-in slide-in-from-right-2">
                    <AlertCircle size={20} />
                  </div>
                )}
              </div>
              {error && (
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest px-2 animate-pulse">
                  Invalid Access Key. Security Hub Alerted.
                </p>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading || !password}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  Enter Terminal
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-center gap-4 grayscale opacity-40">
             <ShieldCheck size={16} className="text-indigo-400" />
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">End-to-End Encrypted Node</span>
          </div>
        </div>

        <p className="text-center mt-8 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
          Forget key? Contact system architect.
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both; }
      `}} />
    </div>
  );
};

export default AdminLogin;
