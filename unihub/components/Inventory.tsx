
import React, { useState, useRef } from 'react';
import { Product, Category, BusinessSettings, DeliveryOption } from '../types';

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
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [newOption, setNewOption] = useState({ location: '', cost: '' });
  
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    location: 'Local Market',
    category: 'General',
    stock: 1,
    isApproved: true
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pending = products.filter(p => p.isApproved === false);
  const active = products.filter(p => p.isApproved !== false);

  const addDeliveryOption = () => {
    if (!newOption.location || !newOption.cost) return;
    setDeliveryOptions([...deliveryOptions, { location: newOption.location, cost: Number(newOption.cost) }]);
    setNewOption({ location: '', cost: '' });
  };

  const removeDeliveryOption = (index: number) => {
    setDeliveryOptions(deliveryOptions.filter((_, i) => i !== index));
  };

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
      deliveryCost: deliveryOptions.length > 0 ? deliveryOptions[0].cost : 0,
      deliveryOptions: deliveryOptions,
      stock: Number(newProduct.stock || 1),
      description: newProduct.description || '',
      imageUrl: newProduct.imageUrl,
      isApproved: true,
      createdAt: new Date().toISOString()
    });
    setNewProduct({ location: 'Local Market', category: 'General', stock: 1, isApproved: true });
    setDeliveryOptions([]);
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
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
         <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
            <button onClick={() => setActiveTab('active')} className={`flex-1 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>My Store ({active.length})</button>
            <button onClick={() => setActiveTab('pending')} className={`flex-1 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400'}`}>Pending ({pending.length})</button>
         </div>
         <button onClick={() => setShowForm(!showForm)} className="w-full md:w-auto px-8 py-4 bg-[#0f172a] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
            <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'}`}></i>
            {showForm ? 'Cancel' : 'Register New Item'}
         </button>
      </div>

      {showForm && (
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-indigo-50 animate-in slide-in-from-top-6">
           <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-6">
                 <div onClick={() => fileInputRef.current?.click()} className="aspect-square bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:bg-indigo-50 transition-all group">
                    {newProduct.imageUrl ? <img src={newProduct.imageUrl} className="w-full h-full object-cover" alt="Preview" /> : (
                      <>
                        <i className="fas fa-camera-retro text-4xl text-slate-200 mb-4 group-hover:scale-110 transition-transform"></i>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Upload Product Photo</span>
                      </>
                    )}
                 </div>
                 <input type="file" ref={fileInputRef} onChange={handleImage} className="hidden" accept="image/*" />
                 
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Delivery Rates (Options)</label>
                    <div className="flex gap-2">
                       <input type="text" className="flex-1 px-5 py-3 rounded-xl bg-slate-50 border-none font-bold text-xs" placeholder="Location (e.g. Campus)" value={newOption.location} onChange={e => setNewOption({...newOption, location: e.target.value})} />
                       <input type="number" className="w-24 px-5 py-3 rounded-xl bg-slate-50 border-none font-bold text-xs" placeholder="GHS" value={newOption.cost} onChange={e => setNewOption({...newOption, cost: e.target.value})} />
                       <button type="button" onClick={addDeliveryOption} className="bg-indigo-600 text-white px-4 rounded-xl"><i className="fas fa-plus"></i></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {deliveryOptions.map((opt, i) => (
                         <span key={i} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                            {opt.location}: GHS {opt.cost}
                            <button onClick={() => removeDeliveryOption(i)} className="hover:text-rose-500"><i className="fas fa-times-circle"></i></button>
                         </span>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="space-y-8">
                 <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Item Name</label>
                       <input type="text" required className="w-full px-8 py-5 bg-slate-50 rounded-2xl border-none font-bold text-slate-800 outline-none" value={newProduct.name || ''} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="e.g. Smart Watch Series 8" />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Buying Cost</label>
                          <input type="number" required className="w-full px-8 py-5 bg-slate-50 rounded-2xl border-none font-bold" value={newProduct.sourcePrice || ''} onChange={e => {
                             const cost = Number(e.target.value);
                             setNewProduct({...newProduct, sourcePrice: cost, sellingPrice: Math.ceil(cost * (1 + settings.defaultMarkupPercent/100))});
                          }} placeholder="GHS" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-4">Selling Price</label>
                          <input type="number" required className="w-full px-8 py-5 bg-indigo-50 rounded-2xl border-none font-black text-indigo-600" value={newProduct.sellingPrice || ''} onChange={e => setNewProduct({...newProduct, sellingPrice: Number(e.target.value)})} />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Category</label>
                       <select className="w-full px-8 py-5 bg-slate-50 rounded-2xl border-none font-bold outline-none appearance-none" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value as Category})}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-[#0f172a] text-white py-6 rounded-3xl font-black text-xs uppercase tracking-[0.5em] shadow-2xl hover:bg-indigo-600 transition-all active:scale-95">Save To Hub Stock</button>
              </div>
           </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
         {(activeTab === 'active' ? active : pending).map(p => (
           <div key={p.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 hover:shadow-2xl transition-all group">
              <div className="h-52 bg-slate-50 relative">
                 {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={p.name} /> : (
                   <div className="w-full h-full flex items-center justify-center">
                     <i className="fas fa-box-archive text-slate-200 text-3xl"></i>
                   </div>
                 )}
                 <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={() => {if(confirm('Permanently delete item?')) onDelete(p.id)}} className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl flex items-center justify-center text-rose-500 shadow-sm hover:bg-rose-500 hover:text-white transition-all">
                      <i className="fas fa-trash-can text-xs"></i>
                    </button>
                 </div>
              </div>
              <div className="p-8">
                 <div className="flex justify-between items-start mb-4">
                    <h4 className="font-black text-slate-800 uppercase text-xs truncate max-w-[70%]">{p.name}</h4>
                    <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg uppercase tracking-tighter">STOCK: {p.stock}</span>
                 </div>
                 <div className="flex justify-between items-end mb-4">
                    <div className="flex flex-col">
                       <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Sale Price</span>
                       <span className="text-xl font-black text-slate-900 tracking-tighter">GHS {p.sellingPrice}</span>
                    </div>
                    <div className="text-right">
                       <span className="text-[8px] font-bold text-emerald-300 uppercase tracking-widest">Profit</span>
                       <span className="text-sm font-black text-emerald-600 block leading-none">GHS {p.sellingPrice - p.sourcePrice}</span>
                    </div>
                 </div>

                 {p.deliveryOptions && p.deliveryOptions.length > 0 && (
                   <div className="border-t border-slate-50 pt-4 mt-2">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Delivery Options</p>
                      <div className="flex flex-wrap gap-1.5">
                         {p.deliveryOptions.map((opt, i) => (
                           <span key={i} className="text-[7px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{opt.location}: GHS {opt.cost}</span>
                         ))}
                      </div>
                   </div>
                 )}

                 {activeTab === 'pending' && (
                    <button onClick={() => onApprove(p.id)} className="w-full mt-6 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-500 transition-all">Approve & Publish</button>
                 )}
              </div>
           </div>
         ))}
         {(activeTab === 'active' ? active : pending).length === 0 && (
           <div className="col-span-full py-32 text-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100">
              <i className="fas fa-radar text-slate-100 text-6xl mb-6"></i>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Hub Inventory Is Empty</p>
           </div>
         )}
      </div>
    </div>
  );
};

export default Inventory;
