
import { Product, Location } from './types';

export const products: Product[] = [
  {
    id: '1',
    name: 'Luminaire Smart Desk Lamp',
    sourcePrice: 80,
    sellingPrice: 129.99,
    description: 'Minimalist smart lamp with adaptive color temperature and gesture control.',
    category: 'Tech & Gadgets',
    imageUrl: 'https://images.unsplash.com/photo-1534073828943-f801091bb18c?auto=format&fit=crop&q=80&w=800',
    rating: 4.8,
    location: Location.ACCRA,
    deliveryCost: 10,
    stock: 15,
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Aura Noise Cancelling Pods',
    sourcePrice: 140,
    sellingPrice: 199.99,
    description: 'Experience pure sound with industry-leading active noise cancellation.',
    category: 'Tech & Gadgets',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800',
    rating: 4.9,
    location: Location.ACCRA,
    deliveryCost: 10,
    stock: 8,
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Vertex Mechanical Keyboard',
    sourcePrice: 110,
    sellingPrice: 159.00,
    description: 'Precision-engineered mechanical switches for the ultimate typing experience.',
    category: 'Tech & Gadgets',
    imageUrl: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&q=80&w=800',
    rating: 4.7,
    location: Location.KUMASI,
    deliveryCost: 15,
    stock: 12,
    createdAt: new Date().toISOString()
  },
  {
    id: '4',
    name: 'Zenith Ergonomic Chair',
    sourcePrice: 350,
    sellingPrice: 449.99,
    description: 'Designed for comfort and posture, making those long work hours feel shorter.',
    category: 'Hostel Essentials',
    imageUrl: 'https://images.unsplash.com/photo-1505843490701-515a00718600?auto=format&fit=crop&q=80&w=800',
    rating: 4.6,
    location: Location.ACCRA,
    deliveryCost: 25,
    stock: 5,
    createdAt: new Date().toISOString()
  },
  {
    id: '5',
    name: 'Flow Minimalist Watch',
    sourcePrice: 150,
    sellingPrice: 210.00,
    description: 'A timeless timepiece that blends classic design with modern materials.',
    category: 'Fashion',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800',
    rating: 4.5,
    location: Location.ACCRA,
    deliveryCost: 10,
    stock: 10,
    createdAt: new Date().toISOString()
  },
  {
    id: '6',
    name: 'Stellar Glass Water Bottle',
    sourcePrice: 30,
    sellingPrice: 45.00,
    description: 'BPA-free high borosilicate glass wrapped in a premium silicone sleeve.',
    category: 'Hostel Essentials',
    imageUrl: 'https://images.unsplash.com/photo-1602143399827-72183a0391f9?auto=format&fit=crop&q=80&w=800',
    rating: 4.3,
    location: Location.DORMAA,
    deliveryCost: 5,
    stock: 30,
    createdAt: new Date().toISOString()
  }
];
