
import React from 'react';

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
  deliveryCost: number; // Legacy field for basic cost
  deliveryOptions?: DeliveryOption[]; // New flexible delivery tiers
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

// Added StatCardProps to fix SummaryCard.tsx error
export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}
