
export enum Location {
  DORMAA = 'Dormaa (Local Hub)',
  KUMASI = 'Kumasi Central',
  ACCRA = 'Accra Terminal',
  SUNYANI = 'Sunyani Node',
  TECHIMAN = 'Techiman Supply',
  OTHER = 'International/Other'
}

export type Category = 'Hostel Essentials' | 'School Items' | 'Tech & Gadgets' | 'Fashion' | 'Food & Snacks' | 'Cosmetics' | 'General';

export enum Page {
  HOME = 'HOME',
  SHOP = 'SHOP',
  CART = 'CART',
  PRODUCT_DETAIL = 'PRODUCT_DETAIL',
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  ORDERS = 'ORDERS',
  HUBS = 'HUBS',
  AI = 'AI',
  SETTINGS = 'SETTINGS'
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  sourcePrice: number;
  sellingPrice: number;
  location: Location | string;
  deliveryCost: number;
  stock: number;
  imageUrl?: string;
  imageSource?: 'uploaded' | 'ai' | 'url';
  description: string;
  isApproved?: boolean;
  vendorName?: string;
  createdAt: string;
  rating?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface AISuggestion {
  reason: string;
  productIds: string[];
}

export interface BusinessSettings {
  storeName: string;
  whatsappNumber: string;
  currency: string;
  deliveryNote: string;
  defaultMarkupPercent: number;
  activeHubs: string[];
}

export interface Order {
  id: string;
  productId: string;
  customerName: string;
  whatsappNumber: string;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'paid' | 'partial' | 'credit';
  amountPaid: number;
  orderDate: string;
  profit: number;
}

export interface LocalVendor {
  id: string;
  name: string;
  marketLocation: string;
  contact: string;
  specialty: string;
}

export interface LogisticsPartner {
  id: string;
  name: string;
  contact: string;
  type: string;
  location: string;
}
