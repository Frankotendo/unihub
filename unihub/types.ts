
export enum Location {
  DORMAA = 'Dormaa (Local)',
  KUMASI = 'Kumasi',
  ACCRA = 'Accra'
}

export type Category = 'Hostel Essentials' | 'School Items' | 'Tech & Gadgets' | 'Fashion' | 'Food & Snacks' | 'Cosmetics' | 'General';

export interface Product {
  id: string;
  name: string;
  category: Category;
  sourcePrice: number;
  sellingPrice: number;
  location: Location;
  deliveryCost: number;
  stock: number;
  imageUrl?: string;
  imageSource?: 'uploaded' | 'ai' | 'template';
  description: string;
  vendorName?: string;
  isHotDeal?: boolean;
}

export interface BusinessSettings {
  storeName: string;
  whatsappNumber: string;
  currency: string;
  deliveryNote: string;
}

export interface LogisticsPartner {
  id: string;
  name: string;
  contact: string;
  type: string;
  location: string;
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

export interface BusinessStats {
  totalSales: number;
  totalProfit: number;
  pendingDeliveries: number;
  outstandingCredit: number;
}

export interface LocalVendor {
  id: string;
  name: string;
  marketLocation: string;
  contact: string;
  specialty: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
}
