
import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  MapPin, 
  Zap, 
  Settings, 
  ExternalLink, 
  Link as LinkIcon,
  Truck,
  ShoppingCart,
  Sparkles,
  X
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
    { id: AppView.INSIGHTS, icon: LayoutDashboard, label: 'INSIGHTS' },
    { id: AppView.INVENTORY, icon: Package, label: 'INVENTORY' },
    { id: AppView.DORMAA_LOCAL, icon: MapPin, label: 'DORMAA LOCAL' },
    { id: AppView.KUMASI_HUB, icon: Truck, label: 'KUMASI HUB' },
    { id: AppView.ORDERS_CREDIT, icon: ShoppingCart, label: 'ORDERS & CREDIT' },
    { id: AppView.MARKETING_AI, icon: Sparkles, label: 'MARKETING AI' },
    { id: AppView.SETTINGS, icon: Settings, label: 'SETTINGS' },
  ];

  return (
    <aside className={`
      w-72 bg-[#0b1224] text-white flex flex-col shrink-0 transition-transform duration-300 z-50
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
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter leading-none italic uppercase">
              {storeName.toUpperCase()}
            </h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Admin Console</p>
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
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-xl shadow-indigo-900/30 lg:translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <item.icon size={20} className={activeView === item.id ? 'text-white' : 'group-hover:text-indigo-400'} />
            <span className="font-black text-[11px] tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-6 space-y-3 mt-auto">
        <button 
          onClick={() => {
            window.location.hash = '#store';
            if (onClose) onClose();
          }}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-indigo-600/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all border border-indigo-600/20"
        >
          <ExternalLink size={16} />
          Preview Store
        </button>
        <button 
          onClick={() => {
            const url = `${window.location.origin}${window.location.pathname}#store`;
            navigator.clipboard.writeText(url);
            alert('Link copied!');
          }}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
        >
          <LinkIcon size={16} />
          Copy Customer Link
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
