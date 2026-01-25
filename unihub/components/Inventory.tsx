
import React, { useState, useRef } from 'react';
import { Product, Location, Category } from '../types';

interface InventoryProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
}

const CATEGORIES: Category[] = ['Hostel Essentials', 'School Items', 'Tech & Gadgets', 'Fashion', 'Food & Snacks', 'Cosmetics', 'General'];

const TEMPLATES = [
  { name: 'AirPods Pro (2nd Gen)', cat: 'Tech & Gadgets', sp: 150, price: 95, loc: Location.ACCRA, img: 'https://images.unsplash.com/photo-1588423770674-f2855ee82639?q=80&w=300&auto=format&fit=crop' },
  { name: 'Magnetic Desk Lamp', cat: 'Hostel Essentials', sp: 85, price: 55, loc: Location.KUMASI, img: 'https://images.unsplash.com/photo-1534073828943-f801091bb18c?q=80&w=300&auto=format&fit=crop' },
  { name: '20,000mAh Powerbank', cat: 'Tech & Gadgets', sp: 180, price: 130, loc: Location.ACCRA, img: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?q=80&w=300&auto=format&fit=crop' },
  { name: 'Mesh Laundry Hamper', cat: 'Hostel Essentials', sp: 45, price: 30, loc: Location.DORMAA, img: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=300&auto=format&fit=crop' },
  { name: 'A4 Printing Paper (Box)', cat: 'School Items', sp: 140, price: 115, loc: Location.KUMASI, img: 'https://images.unsplash.com/photo-1583523432317-17ade5312384?q=80&w=300&auto=format&fit=crop' },
  { name: 'Electric Kettle (1.8L)', cat: 'Hostel Essentials', sp: 110, price: 80, loc: Location.DORMAA, img: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=300&auto=format&fit=crop' },
];

const Inventory: React.FC<InventoryProps> = ({ products, onAddProduct }) => {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('All');
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    location: Location.DORMAA,
    deliveryCost: 0,
    category: 'General',
    imageSource: 'template'
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = filter === 'All' 
    ? products 
    : products.filter(p => p.category === filter);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct({ ...newProduct, imageUrl: reader.result as string, imageSource: 'uploaded' });
      };
      reader.readAsDataURL(file);
    }
  };

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
      imageUrl: newProduct.imageUrl,
      imageSource: newProduct.imageSource as any || 'template'
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
      imageUrl: tpl.img,
      imageSource: 'template',
      description: `Premium ${tpl.cat} for campus life.`
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {['All', ...CATEGORIES].map(cat => (
            <button 
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-xl text-[9px] font-black tracking-widest transition-all ${filter === cat ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl flex items-center space-x-3 text-sm font-black tracking-widest"
        >
          <i className={`fas ${showForm ? 'fa-times' : 'fa-plus-circle'}`}></i>
          <span>{showForm ? 'CANCEL' : 'ADD PRODUCT'}</span>
        </button>
      </div>

      {showForm ? (
        <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-indigo-50 space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="flex items-center justify-between border-b border-slate-50 pb-6">
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Product Sourcing</h3>
            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase">Inventory Entry</span>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {/* Image Section */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Visual</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all overflow-hidden"
                >
                  {newProduct.imageUrl ? (
                    <img src={newProduct.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-6">
                      <i className="fas fa-camera text-3xl text-slate-200 mb-2"></i>
                      <p className="text-[9px] font-black uppercase text-slate-400">Tap to Upload Photo</p>
                    </div>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                <p className="text-[9px] text-slate-400 text-center italic">Or use AI generation in the Marketing tab later.</p>
              </div>

              {/* Form Section */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</label>
                  <input type="text" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold" value={newProduct.name || ''} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                  <select className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value as Category})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Market Cost (GHS)</label>
                  <input type="number" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold" value={newProduct.sourcePrice || ''} onChange={e => setNewProduct({...newProduct, sourcePrice: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Store Price (GHS)</label>
                  <input type="number" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold" value={newProduct.sellingPrice || ''} onChange={e => setNewProduct({...newProduct, sellingPrice: Number(e.target.value)})} />
                </div>
              </div>
            </div>
            
            <button type="submit" className="w-full bg-[#0a192f] text-white font-black py-6 rounded-[2.5rem] hover:bg-indigo-900 transition-all shadow-2xl tracking-[0.3em] uppercase text-xs">
              Commit to Warehouse
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex items-center space-x-2 px-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Quick Source Templates</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {TEMPLATES.map((tpl, i) => (
              <button 
                key={i} 
                onClick={() => applyTemplate(tpl)}
                className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-500 hover:shadow-xl transition-all text-left group"
              >
                <img src={tpl.img} alt={tpl.name} className="w-full aspect-square rounded-2xl object-cover mb-4 group-hover:scale-105 transition-transform" />
                <div className="text-[8px] font-black text-indigo-400 mb-1 uppercase tracking-widest">{tpl.loc.split(' ')[0]}</div>
                <div className="text-[11px] font-black text-slate-800 line-clamp-1 group-hover:text-indigo-600 uppercase">{tpl.name}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-50 overflow-hidden hover:shadow-2xl transition-all group">
                <div className="h-56 relative bg-slate-50">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-200">
                      <i className="fas fa-box-open text-5xl"></i>
                    </div>
                  )}
                  <div className="absolute top-5 left-5 flex flex-col gap-2">
                    <span className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[8px] font-black text-slate-800 shadow-sm uppercase tracking-widest border border-slate-100">
                      {product.category}
                    </span>
                  </div>
                </div>
                <div className="p-8">
                  <h4 className="font-black text-slate-800 mb-2 uppercase tracking-tighter text-lg line-clamp-1">{product.name}</h4>
                  <div className="flex items-baseline space-x-2 mb-6">
                    <span className="text-2xl font-black text-slate-900">GHS {product.sellingPrice}</span>
                    <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                      {product.location === Location.DORMAA ? 'FREE DELV' : `+GHS ${product.deliveryCost}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Stock</span>
                      <span className="text-sm font-black text-slate-700">{product.stock} units</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Margin</span>
                      <span className="text-sm font-black text-emerald-600">GHS {product.sellingPrice - product.sourcePrice}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
