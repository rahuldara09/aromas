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

export type OrderStatus =
  | 'pending_payment'
  | 'payment_processing'
  | 'payment_success'
  | 'payment_failed'
  | 'Placed'
  | 'Pending'
  | 'Preparing'
  | 'Completed'
  | 'Paid'
  | 'Delivered'
  | 'Dispatched'
  | 'Cancelled'
  | 'refunded';

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
  payment_status?: 'pending' | 'processing' | 'success' | 'failed' | 'refunded';
  payment_provider?: string;
  payment_transaction_id?: string;
  payment_amount?: number;
  payment_verified_at?: Date;
}

export interface Payment {
  id: string;
  order_id: string;
  provider: string; // 'payu', 'razorpay', etc.
  transaction_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  created_at: Date;
  updated_at: Date;
}

export interface User {
  uid: string;
  phoneNumber: string;
  createdAt: Date;
}
