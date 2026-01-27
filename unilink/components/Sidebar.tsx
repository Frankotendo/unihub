
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Zap, 
  Settings, 
  Link as LinkIcon,
  Sparkles,
  X,
  Radio
} from 'lucide-react';
import { AppView } from '../types';

interface SidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  storeName: string;
  isMobileOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, storeName, isMobileOpen, onClose }) => {
  const menuItems = [
    { id: AppView.TERMINAL_INSIGHTS, icon: LayoutDashboard, label: 'INSIGHTS' },
    { id: AppView.FLEET_REGISTRY, icon: Users, label: 'FLEET REGISTRY' },
    { id: AppView.ADS_MANAGER, icon: Radio, label: 'ADS & PROMOS' },
    { id: AppView.MARKETING_STUDIO, icon: Sparkles, label: 'MARKETING AI' },
    { id: AppView.SETTINGS, icon: Settings, label: 'SETTINGS' },
  ];

  return (
    <aside className={`
      w-72 bg-[#0f172a] text-white flex flex-col shrink-0 transition-transform duration-300 z-50
      lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-white/5
      fixed top-0 bottom-0 left-0 h-full
      ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="p-8 lg:p-10 mb-2 relative">
        <button 
          onClick={onClose}
          className="lg:hidden absolute top-8 right-8 p-2 text-slate-500 hover:text-white"
        >
          <X size={20} />
        </button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Zap size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter leading-none italic uppercase">
              {storeName.toUpperCase()}
            </h1>
            <p className="text-[9px] font-bold text-sky-400 uppercase tracking-widest mt-1">Command Terminal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${
              activeView === item.id 
                ? 'bg-sky-500 text-white shadow-xl shadow-sky-900/30 lg:translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <item.icon size={20} className={activeView === item.id ? 'text-white' : 'group-hover:text-sky-400'} />
            <span className="font-black text-[11px] tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-8 mt-auto">
        <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
           <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center">System Integrity</p>
           <div className="flex justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
           </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
