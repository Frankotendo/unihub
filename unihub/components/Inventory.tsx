
import React, { useState } from 'react';
import { Product, Location, Category } from '../types';

interface InventoryProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
}

const CATEGORIES: Category[] = ['Hostel Essentials', 'School Items', 'Tech & Gadgets', 'Fashion', 'Food & Snacks', 'Cosmetics', 'General'];

const TEMPLATES = [
  { name: 'Laundry Basket (Mesh)', cat: 'Hostel Essentials', sp: 45, price: 30, loc: Location.DORMAA },
  { name: 'Kumasi Leather Belt', cat: 'Fashion', sp: 65, price: 40, loc: Location.KUMASI },
  { name: 'Note 3 Notebook (Pack)', cat: 'School Items', sp: 50, price: 38, loc: Location.DORMAA },
  { name: 'A4 Ream (Kumasi Hub)', cat: 'School Items', sp: 110, price: 85, loc: Location.KUMASI },
  { name: 'Mini Desk Fan (USB)', cat: 'Tech & Gadgets', sp: 120, price: 85, loc: Location.KUMASI },
  { name: 'Indomie Pack (Big)', cat: 'Food & Snacks', sp: 190, price: 170, loc: Location.DORMAA },
];

const Inventory: React.FC<InventoryProps> = ({ products, onAddProduct }) => {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('All');
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    location: Location.DORMAA,
    deliveryCost: 0,
    category: 'General'
  });

  const filteredProducts = filter === 'All' 
    ? products 
    : products.filter(p => p.category === filter);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.sellingPrice || !newProduct.sourcePrice) return;

    onAddProduct({
      id: Date.now().toString(),
      name: newProduct.name!,
      category: (newProduct.category as Category) || 'General',
      sourcePrice: Number(newProduct.sourcePrice),
      sellingPrice: Number(newProduct.sellingPrice),
      location: newProduct.location as Location,
      deliveryCost: newProduct.location === Location.DORMAA ? 0 : (newProduct.location === Location.KUMASI ? 20 : 30),
      stock: Number(newProduct.stock || 0),
      description: newProduct.description || '',
    });
    setNewProduct({ location: Location.DORMAA, deliveryCost: 0, category: 'General' });
    setShowForm(false);
  };

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setNewProduct({
      name: tpl.name,
      category: tpl.cat as Category,
      sellingPrice: tpl.sp,
      sourcePrice: tpl.price,
      location: tpl.loc,
      stock: 5,
      description: `Essential ${tpl.cat} for students, sourced from ${tpl.loc}.`
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-10">
      {/* Category Filter & Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setFilter('All')}
              className={`px-4 py-2 rounded-xl text-xs font-black tracking-widest transition-all ${filter === 'All' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}
            >
              ALL
            </button>
            {CATEGORIES.map(cat => (
                <button 
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-black tracking-widest transition-all ${filter === cat ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}
                >
                    {cat.toUpperCase()}
                </button>
            ))}
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center space-x-3 text-sm font-black tracking-widest"
        >
          <i className={`fas ${showForm ? 'fa-times' : 'fa-plus-circle'}`}></i>
          <span>{showForm ? 'CANCEL' : 'IMPORT PRODUCT'}</span>
        </button>
      </div>

      {/* Product Templates Panel */}
      {!showForm && (
        <div className="space-y-4">
            <div className="flex items-center space-x-2 px-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
              <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Sourcing Templates</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {TEMPLATES.map((tpl, i) => (
                    <button 
                        key={i} 
                        onClick={() => applyTemplate(tpl)}
                        className="bg-white border-2 border-slate-50 p-4 rounded-3xl shadow-sm hover:border-indigo-500 hover:shadow-indigo-50 transition-all text-left group"
                    >
                        <div className="text-[9px] font-black text-indigo-400 mb-1 uppercase tracking-tighter">{tpl.loc.split(' ')[0]} Hub</div>
                        <div className="text-sm font-black text-slate-800 line-clamp-1 mb-2 group-hover:text-indigo-600">{tpl.name}</div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400">GHS {tpl.sp}</span>
                          <i className="fas fa-plus text-[10px] text-slate-300 group-hover:text-indigo-500"></i>
                        </div>
                    </button>
                ))}
            </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-indigo-50 space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="flex items-center justify-between border-b border-slate-50 pb-6">
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Product Details</h3>
            <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase">Step 1: Configuration</span>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Label</label>
                <input 
                  type="text" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-slate-800"
                  placeholder="e.g. Rechargeable Lantern" value={newProduct.name || ''} onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Market Category</label>
                <select className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-slate-800" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value as Category})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source Point</label>
                <select className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-slate-800" value={newProduct.location} onChange={e => setNewProduct({...newProduct, location: e.target.value as Location})}>
                  <option value={Location.DORMAA}>Dormaa (Campus - Free Delivery)</option>
                  <option value={Location.KUMASI}>Kumasi (Hub - GHS 20 Delivery)</option>
                  <option value={Location.ACCRA}>Accra (Hub - GHS 30 Delivery)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wholesale Cost (GHS)</label>
                <input type="number" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-slate-800" value={newProduct.sourcePrice || ''} onChange={e => setNewProduct({...newProduct, sourcePrice: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selling Rate (GHS)</label>
                <input type="number" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-slate-800" value={newProduct.sellingPrice || ''} onChange={e => setNewProduct({...newProduct, sellingPrice: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initial Stock</label>
                <input type="number" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-slate-800" value={newProduct.stock || ''} onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})} />
              </div>
            </div>
            <button type="submit" className="w-full bg-[#0a192f] text-white font-black py-5 rounded-[2rem] hover:bg-indigo-900 transition-all shadow-2xl tracking-[0.2em] uppercase text-sm">
              Confirm Inventory Addition
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredProducts.map(product => (
          <div key={product.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-50 overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all group">
            <div className="h-52 bg-[#fdfdfd] relative">
              <img src={`https://api.dicebear.com/7.x/shapes/svg?seed=${product.name}&backgroundColor=f0f4f8`} alt={product.name} className="w-full h-full object-cover p-10 opacity-80 group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute top-6 left-6 flex flex-col gap-2">
                <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-sm tracking-widest border border-white/20 ${
                    product.location === Location.DORMAA ? 'bg-emerald-500 text-white' : 
                    product.location === Location.KUMASI ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-white'
                }`}>
                    {product.location.split(' ')[0]}
                </span>
                <span className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-[9px] font-black text-slate-500 shadow-sm border border-slate-100 uppercase tracking-tighter">
                    {product.category}
                </span>
              </div>
            </div>
            <div className="p-8">
              <h4 className="font-black text-slate-800 mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors uppercase tracking-tighter text-lg">{product.name}</h4>
              <div className="flex flex-col mb-6">
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-slate-900">GHS {product.sellingPrice}</span>
                  {product.location === Location.DORMAA ? (
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-lg">Free Delivery</span>
                  ) : (
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded-lg">+ GHS {product.location === Location.KUMASI ? '20' : '30'} Delv</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock</span>
                    <span className="text-base font-black text-slate-700">{product.stock} Units</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Profit</span>
                    <span className="text-base font-black text-emerald-600">GHS {product.sellingPrice - product.sourcePrice}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Inventory;
