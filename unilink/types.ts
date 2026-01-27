
import React from 'react';

export enum AppView {
  TERMINAL_INSIGHTS = 'Terminal Insights',
  FLEET_REGISTRY = 'Fleet Registry',
  POOLING_COMMAND = 'Pooling Command',
  ADS_MANAGER = 'Ads & Promos',
  MARKETING_STUDIO = 'Marketing AI',
  SETTINGS = 'Settings',
  DRIVER_PORTAL = 'Driver Portal'
}

export type VehicleType = 'Taxi' | 'Pragia' | 'Private Shuttle' | 'Motorbike';

export interface Transaction {
  id: string;
  type: 'credit' | 'deduction';
  amount: number;
  description: string;
  timestamp: string;
}

export interface Driver {
  id: string;
  name: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  contact: string;
  baseLocation: string;
  isAvailable: boolean;
  capacity: number;
  pricePerSeat: number;
  rating: number;
  walletBalance: number;
  transactions: Transaction[]; // New: Full audit trail
}

export interface Pool {
  id: string;
  driverId: string;
  routeFrom: string;
  routeTo: string;
  passengers: string[];
  capacity: number;
  status: 'pooling' | 'full' | 'departed' | 'completed';
  createdAt: string;
}

export interface Ad {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  ctaLink?: string;
  isActive: boolean;
  priority: number;
}

export enum Location {
  ACCRA = 'Accra',
  KUMASI = 'Kumasi',
  CAPE_COAST = 'Cape Coast',
  TAMALE = 'Tamale',
  SUNYANI = 'Sunyani',
  DORMAA = 'Dormaa',
  TARKWA = 'Tarkwa',
  HO = 'Ho'
}

export interface BusinessSettings {
  storeName: string;
  whatsappNumber: string;
  currency: string;
  adminPassword?: string;
  poolingThreshold: number; 
  commissionPerSeat: number; 
  adsEnabled: boolean;
  adsensePublisherId?: string;
  adsenseSlotId?: string;
  activeHubs: string[];
  defaultMarkupPercent: number;
  momoDetails?: string; // New: For driver top-ups
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
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
  location: string;
  deliveryCost: number;
  deliveryOptions: DeliveryOption[];
  stock: number;
  description: string;
  imageUrl?: string;
  isApproved: boolean;
  createdAt: string;
  vendorName?: string;
}

export interface Order {
  id: string;
  productId: string;
  customerName: string;
  whatsappNumber: string;
  status: 'pending' | 'shipped' | 'delivered';
  paymentStatus: 'paid' | 'pending';
  amountPaid: number;
  orderDate: string;
  profit: number;
}

export interface Metric {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
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
