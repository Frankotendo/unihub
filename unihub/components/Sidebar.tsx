
import React from 'react';
import { 
  LayoutDashboard, 
  Box, 
  ShoppingCart, 
  MapPin, 
  Bot, 
  Settings, 
  Truck,
  ExternalLink 
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'products', label: 'My Products', icon: <Box size={20} /> },
    { id: 'sales', label: 'Sales & Orders', icon: <ShoppingCart size={20} /> },
    { id: 'hubs', label: 'Delivery Hubs', icon: <MapPin size={20} /> },
    { id: 'bot', label: 'Business AI Bot', icon: <Bot size={20} /> },
    { id: 'settings', label: 'App Settings', icon: <Settings size={20} /> },
  ];

  return (
    <aside className="w-64 bg-[#101928] text-white flex flex-col h-screen sticky top-0">
      {/* Logo Section */}
      <div className="p-8 flex items-center space-x-3">
        <div className="bg-[#4F46E5] p-2 rounded-xl">
          <Truck size={24} className="text-white" />
        </div>
        <div>
          <h1 className="font-extrabold text-xl tracking-wider leading-none">UNIHUB</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Hostel Logistics</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-4 rounded-2xl transition-all duration-200 ${
                isActive 
                  ? 'bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/30' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-slate-500'}>
                {item.icon}
              </span>
              <span className="font-semibold text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Button */}
      <div className="p-4 border-t border-white/5">
        <button className="w-full flex items-center justify-center space-x-2 py-4 bg-white/5 rounded-2xl text-slate-300 font-bold text-sm uppercase tracking-wide hover:bg-white/10 transition-colors border border-white/10">
          <ExternalLink size={16} />
          <span>Open Store</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
