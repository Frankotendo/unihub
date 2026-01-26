
import React from 'react';
import { Metric } from '../types';

const StatCard: React.FC<Metric> = ({ label, value, icon, color }) => {
  return (
    <div className="bg-white p-8 rounded-[40px] shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col items-center justify-center min-h-[240px]">
      <div className={`p-4 rounded-full mb-6 ${color}`}>
        {icon}
      </div>
      <div className="text-center">
        <p className="text-gray-400 text-xs font-extrabold uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-4xl font-black text-gray-900">{value}</h3>
      </div>
    </div>
  );
};

export default StatCard;
