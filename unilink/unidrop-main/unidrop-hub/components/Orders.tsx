import React, { useState } from 'react';
import { Order, Product } from '../types.ts';

interface OrdersProps {
  orders: Order[];
  products: Product[];
  onAddOrder: (order: Order) => void;
  onUpdateOrder: (order: Order) => void;
}

const Orders: React.FC<OrdersProps> = ({ orders, products, onAddOrder, onUpdateOrder }) => {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [newOrder, setNewOrder] = useState<Partial<Order>>({ paymentStatus: 'paid' });

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.productId || !newOrder.customerName) return;

    const product = products.find(p => p.id === newOrder.productId);
    if (!product) return;

    onAddOrder({
      id: `ORD-${Date.now()}`,
      productId: product.id,
      customerName: newOrder.customerName!,
      whatsappNumber: newOrder.whatsappNumber || '',
      status: 'pending',
      paymentStatus: newOrder.paymentStatus as 'paid' | 'partial' | 'credit',
      amountPaid: newOrder.paymentStatus === 'paid' ? product.sellingPrice : (Number(newOrder.amountPaid) || 0),
      orderDate: new Date().toLocaleDateString(),
      profit: product.sellingPrice - product.sourcePrice
    });

    setNewOrder({ paymentStatus: 'paid' });
    setShowOrderModal(false);
  };

  const toggleStatus = (order: Order) => {
    const statusMap: Record<string, string> = { 'pending': 'shipped', 'shipped': 'delivered', 'delivered': 'pending' };
    onUpdateOrder({ ...order, status: statusMap[order.status] as any });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowOrderModal(true)}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
        >
          + Record Sale
        </button>
      </div>

      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
              <tr>
                <th className="px-10 py-6">Customer Info</th>
                <th className="px-10 py-6">Product</th>
                <th className="px-10 py-6">Payment</th>
                <th className="px-10 py-6">Status</th>
                <th className="px-10 py-6 text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length > 0 ? orders.map(order => {
                const product = products.find(p => p.id === order.productId);
                return (
                  <tr key={order.id} className="text-sm hover:bg-slate-50/50 transition-colors">
                    <td className="px-10 py-6">
                      <div className="font-black text-slate-800 uppercase tracking-tight">{order.customerName}</div>
                      <div className="text-xs text-indigo-500 font-bold">{order.orderDate}</div>
                    </td>
                    <td className="px-10 py-6 font-bold text-slate-700">{product?.name || 'Item'}</td>
                    <td className="px-10 py-6">
                      <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                        order.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-10 py-6">
                      <button 
                        onClick={() => toggleStatus(order)}
                        className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                        order.status === 'delivered' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {order.status}
                      </button>
                    </td>
                    <td className="px-10 py-6 text-right font-black text-emerald-600">GHS {order.profit}</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={5} className="px-10 py-24 text-center text-slate-300 font-black uppercase text-xs tracking-widest">No sales recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showOrderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-8 italic">New Sale Record</h3>
            <form onSubmit={handleCreateOrder} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Item</label>
                <select 
                  required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold outline-none"
                  onChange={e => setNewOrder({...newOrder, productId: e.target.value})}
                  value={newOrder.productId || ''}
                >
                  <option value="">Choose product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (GHS {p.sellingPrice})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Name</label>
                <input 
                  type="text" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-bold outline-none"
                  value={newOrder.customerName || ''}
                  onChange={e => setNewOrder({...newOrder, customerName: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment</label>
                   <select 
                     className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none font-bold outline-none"
                     value={newOrder.paymentStatus}
                     onChange={e => setNewOrder({...newOrder, paymentStatus: e.target.value as any})}
                   >
                     <option value="paid">Fully Paid</option>
                     <option value="partial">Partial</option>
                     <option value="credit">Debt</option>
                   </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Paid</label>
                    <input 
                      type="number" className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none font-bold outline-none"
                      disabled={newOrder.paymentStatus === 'paid'}
                      value={newOrder.amountPaid || ''}
                      onChange={e => setNewOrder({...newOrder, amountPaid: Number(e.target.value)})}
                      placeholder="GHS"
                    />
                 </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 py-5 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Close</button>
                <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;