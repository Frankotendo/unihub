
import React from 'react';

export enum AppView {
  INSIGHTS = 'Insights',
  INVENTORY = 'Inventory',
  DORMAA_LOCAL = 'Dormaa Local',
  KUMASI_HUB = 'Kumasi Hub',
  ORDERS_CREDIT = 'Orders & Credit',
  MARKETING_AI = 'Marketing AI',
  SETTINGS = 'Settings'
}

export interface Metric {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export enum Location {
  DORMAA = 'Dormaa (Local Hub)',
  KUMASI = 'Kumasi Central',
  ACCRA = 'Accra Terminal',
  SUNYANI = 'Sunyani Node',
  TECHIMAN = 'Techiman Supply',
  OTHER = 'International/Other'
}

export type Category = 'Hostel Essentials' | 'School Items' | 'Tech & Gadgets' | 'Fashion' | 'Food & Snacks' | 'Cosmetics' | 'General';

export interface DeliveryOption {
  location: string;
  cost: number;
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  sourcePrice: number;
  sellingPrice: number;
  location: Location | string;
  deliveryCost: number;
  deliveryOptions?: DeliveryOption[];
  stock: number;
  imageUrl?: string;
  imageSource?: 'uploaded' | 'ai' | 'url';
  description: string;
  isApproved?: boolean;
  vendorName?: string;
  createdAt: string;
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
