
import React, { useState, useEffect } from 'react';
import { Product, AISuggestion } from '../types';
import { getAIRecommendations } from '../services/geminiService';
import ProductCard from './ProductCard';

interface AIStylistProps {
  cartItems: string[];
  allProducts: Product[];
  onAddToCart: (product: Product) => void;
}

const AIStylist: React.FC<AIStylistProps> = ({ cartItems, allProducts, onAddToCart }) => {
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = async () => {
    if (cartItems.length === 0) return;
    setLoading(true);
    const result = await getAIRecommendations(cartItems, allProducts);
    setSuggestion(result);
    setLoading(false);
  };

  useEffect(() => {
    if (cartItems.length > 0) {
      const timer = setTimeout(() => {
        fetchSuggestions();
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setSuggestion(null);
    }
  }, [cartItems]);

  if (cartItems.length === 0) return null;

  return (
    <div className="my-12 p-8 rounded-3xl bg-indigo-50 border border-indigo-100 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.3 1.047a1 1 0 01.897.447l6 10A1 1 0 0117.303 13H15v3.5a2.5 2.5 0 01-5 0V13H7.697a1 1 0 01-.897-1.506l6-10zM13 10.414l3.351 5.586H11v-5.586h2z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-indigo-900">Personalized AI Suggestions</h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-indigo-600 font-medium animate-pulse">Lumina AI is analyzing your style...</p>
          </div>
        ) : suggestion ? (
          <div className="space-y-6">
            <p className="text-indigo-800 italic bg-white/50 p-4 rounded-xl border border-indigo-200/50">
              "{suggestion.reason}"
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {suggestion.productIds.map(id => {
                const product = allProducts.find(p => p.id === id);
                if (!product) return null;
                return (
                  <div key={id} className="transform scale-95 origin-left">
                    <ProductCard product={product} onAddToCart={onAddToCart} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-indigo-400">Add more items to see AI recommendations.</p>
        )}
      </div>
    </div>
  );
};

export default AIStylist;
