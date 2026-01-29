
import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, onViewDetails }) => {
  return (
    <div className="group relative flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 transition-all hover:shadow-xl hover:-translate-y-1">
      <div className="aspect-square overflow-hidden bg-gray-100">
        <img 
          src={product.imageUrl} 
          alt={product.name} 
          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-110"
        />
      </div>
      <div className="flex flex-col flex-grow p-5">
        <div className="flex justify-between items-start mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{product.category}</p>
          <div className="flex items-center bg-gray-50 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-yellow-400 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {product.rating}
          </div>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">
          {product.name}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2 mb-4">
          {product.description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-50">
          <span className="text-xl font-bold text-gray-900">${product.sellingPrice.toFixed(2)}</span>
          <button 
            onClick={() => onAddToCart(product)}
            className="flex items-center justify-center p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
