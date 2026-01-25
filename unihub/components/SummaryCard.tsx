
import React from 'react';
import { StatCardProps } from '../types';

const SummaryCard: React.FC<StatCardProps> = ({ label, value, icon, iconBg, iconColor }) => {
  return (
    <div className="bg-white rounded-[40px] p-10 flex flex-col border border-slate-50 shadow-sm hover:shadow-md transition-shadow duration-300 group">
      <div className={`w-12 h-12 ${iconBg} ${iconColor} rounded-2xl flex items-center justify-center mb-10 transition-transform duration-300 group-hover:scale-110`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
        <p className="text-3xl font-black text-[#101928]">{value}</p>
      </div>
    </div>
  );
};

export default SummaryCard;
