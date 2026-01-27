
import React from 'react';
import { Page } from '../types';

interface NavbarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  cartCount: number;
}

const Navbar: React.FC<NavbarProps> = ({ currentPage, setCurrentPage, cartCount }) => {
  return (
    <nav className="sticky top-0 z-50 glass-effect border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <h1 
              onClick={() => setCurrentPage(Page.HOME)}
              className="text-xl font-bold tracking-tighter cursor-pointer hover:text-indigo-600 transition-colors"
            >
              LUMINA LUXE
            </h1>
            <div className="hidden md:flex space-x-6">
              <button 
                onClick={() => setCurrentPage(Page.SHOP)}
                className={`text-sm font-medium ${currentPage === Page.SHOP ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Shop All
              </button>
              <button className="text-sm font-medium text-gray-500 hover:text-gray-900">Collections</button>
              <button className="text-sm font-medium text-gray-500 hover:text-gray-900">About</button>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setCurrentPage(Page.CART)}
              className="relative p-2 text-gray-600 hover:text-indigo-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
