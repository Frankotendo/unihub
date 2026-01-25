
import React, { useState, useRef } from 'react';
import { Product, Location, Category, BusinessSettings } from '../types';

interface InventoryProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  settings: BusinessSettings;
}

const CATEGORIES: Category[] = ['Hostel Essentials', 'School Items', 'Tech & Gadgets', 'Fashion', 'Food & Snacks', 'Cosmetics', 'General'];

const Inventory: React.FC<InventoryProps> = ({ products, onAddProduct, onApprove, onDelete, settings }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'pending'>('active');
  const [showForm, setShowForm] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    location: 'Local Market',
    category: 'General',
    stock: 1,
    isApproved: true
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pending = products.filter(p => p.isApproved === false);
  const active = products.filter(p => p.isApproved !== false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.sellingPrice) return;

    onAddProduct({
      id: `ITEM-${Date.now()}`,
      name: newProduct.name!,
      category: (newProduct.category as Category) || 'General',
      sourcePrice: Number(newProduct.sourcePrice || 0),
      sellingPrice: Number(newProduct.sellingPrice),
      location: newProduct.location || 'Local Market',
      deliveryCost: 0,
      stock: Number(newProduct.stock || 1),
      description: newProduct.description || '',
      imageUrl: newProduct.imageUrl,
      isApproved: true,
      createdAt: new Date().toISOString()
    });
    setNewProduct({ location: 'Local Market', category: 'General', stock: 1, isApproved: true });
    setShowForm(false);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setNewProduct({...newProduct, imageUrl: reader.result as string});
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
         <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
            <button onClick={() => setActiveTab('active')} className={`flex-1 px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'active' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>My Store ({active.length})</button>
            <button onClick={() => setActiveTab('pending')} className={`flex-1 px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'pending' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>New Submissions ({pending.length})</button>
         </div>
         <button onClick={() => setShowForm(!showForm)} className="w-full md:w-auto px-8 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3">
            <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'}`}></i>
            {showForm ? 'Close' : 'Add New Item'}
         </button>
      </div>

      {showForm && (
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-indigo-50 animate-in slide-in-from-top-4">
           <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                 <div onClick={() => fileInputRef.current?.click()} className="aspect-square bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:bg-indigo-50 transition-all">
                    {newProduct.imageUrl ? <img src={newProduct.imageUrl} className="w-full h-full object-cover" alt="Preview" /> : <i className="fas fa-camera text-2xl text-slate-300"></i>}
                 </div>
                 <input type="file" ref={fileInputRef} onChange={handleImage} className="hidden" accept="image/*" />
              </div>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase px-2">Item Name</label>
                    <input type="text" required className="w-full px-6 py-3 bg-slate-50 rounded-xl border-none font-bold" value={newProduct.name || ''} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="e.g. Rice Cooker" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase px-2">What you paid</label>
                       <input type="number" required className="w-full px-6 py-3 bg-slate-50 rounded-xl border-none font-bold" value={newProduct.sourcePrice || ''} onChange={e => {
                          const cost = Number(e.target.value);
                          setNewProduct({...newProduct, sourcePrice: cost, sellingPrice: Math.ceil(cost * (1 + settings.defaultMarkupPercent/100))});
                       }} placeholder="Cost GHS" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-indigo-600 uppercase px-2">Sale Price</label>
                       <input type="number" required className="w-full px-6 py-3 bg-indigo-50 rounded-xl border-none font-black text-indigo-600" value={newProduct.sellingPrice || ''} onChange={e => setNewProduct({...newProduct, sellingPrice: Number(e.target.value)})} placeholder="Price GHS" />
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-indigo-700 transition-all">Save To Store</button>
              </div>
           </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
         {(activeTab === 'active' ? active : pending).map(p => (
           <div key={p.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-all">
              <div className="h-40 bg-slate-50 relative">
                 {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} /> : <div className="w-full h-full flex items-center justify-center"><i className="fas fa-box text-slate-200 text-2xl"></i></div>}
                 <button onClick={() => {if(confirm('Delete?')) onDelete(p.id)}} className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-rose-500 shadow-sm"><i className="fas fa-trash text-[10px]"></i></button>
              </div>
              <div className="p-5">
                 <h4 className="font-black text-slate-800 uppercase text-xs truncate mb-4">{p.name}</h4>
                 <div className="flex justify-between items-center">
                    <span className="text-lg font-black text-slate-900">GHS {p.sellingPrice}</span>
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">+{p.sellingPrice - p.sourcePrice}</span>
                 </div>
                 {activeTab === 'pending' && (
                    <button onClick={() => onApprove(p.id)} className="w-full mt-4 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase">Approve & Sell</button>
                 )}
              </div>
           </div>
         ))}
      </div>
    </div>
  );
};

export default Inventory;
