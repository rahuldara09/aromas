// Core domain types for the Aromas application

export interface Category {
  id: string;
  name: string;
  imageURL: string;
  productCount?: number;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  imageURL: string;
  description?: string;
  isAvailable?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Address {
  id: string;
  userId: string;
  name: string;
  mobile: string;
  hostelDetails: string;
  city: string;
  pincode: string;
  createdAt?: Date;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageURL: string;
}

export type OrderStatus = 'Placed' | 'Pending' | 'Preparing' | 'Completed' | 'Paid' | 'Delivered' | 'Dispatched' | 'Cancelled';

export interface Order {
  id: string;
  userId: string;
  orderType?: 'online' | 'pos';
  customerPhone?: string;
  items: OrderItem[];
  itemTotal: number;
  dukanFee: number;
  deliveryFee: number;
  grandTotal: number;
  orderDate: Date;
  status: OrderStatus;
  /** Sequential display token e.g. "006" */
  orderToken?: string;
  /** Estimated time of arrival in minutes (base + queue penalty) */
  etaMinutes?: number;
  /** Absolute timestamp when the order should be ready */
  expectedReadyTime?: Date;
  deliveryAddress: {
    name: string;
    mobile: string;
    hostelNumber: string;
    roomNumber: string;
    deliveryType: 'Delivery' | 'Takeaway';
  };
}

export interface User {
  uid: string;
  phoneNumber: string;
  createdAt: Date;
}
