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
  /** Base POS price (no GST, no packaging). Used for POS orders. */
  price: number;
  /** Final online price (includes packaging + GST). If absent, falls back to price. */
  onlinePrice?: number;
  /** Short code for quick POS lookup (e.g. "vcs" for Veg Cheese Sandwich). */
  code?: string;
  /** 1-based serial number matching the printed menu. */
  serialNumber?: number;
  imageURL: string;
  description?: string;
  isAvailable?: boolean;
  /** True only for items in the POS menu PDF (serial 1–109). Set by sync script. */
  isPOSItem?: boolean;
  /** True only for items in the Online price PDF. Set by sync script. */
  isOnlineItem?: boolean;
  /** Sequential 1-based serial for the online menu (independent of POS serial). */
  onlineSerialNumber?: number;
  /** List of ingredient names for the product detail page. */
  ingredients?: string[];
  /** Display unit, e.g. "1 plate", "250ml", "2 pieces". */
  unit?: string;
  /** Net weight/volume string, e.g. "350g", "500ml". */
  weight?: string;
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
  | 'success'
  | 'failed'
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
  customerEmail?: string;
  items: OrderItem[];
  itemTotal: number;
  dukanFee: number;
  deliveryFee: number;
  grandTotal: number;
  orderDate: Date;
  status: OrderStatus;
  /** Sequential display token e.g. "006" */
  orderToken?: string;
  /** Sequential daily POS token (1–100, resets each day) */
  posToken?: number;
  /** Estimated time of arrival in minutes (base + queue penalty) */
  etaMinutes?: number;
  /** Absolute timestamp when the order should be ready */
  expectedReadyTime?: Date;
  deliveryAddress: {
    name: string;
    mobile: string;
    hostelNumber: string;
    roomNumber: string;
    fullAddress?: string;
    deliveryType: 'Delivery' | 'Takeaway';
  };
  payment_status?: 'pending' | 'processing' | 'success' | 'failed' | 'refunded';
  payment_provider?: string | 'cashfree' | 'payu';
  /** Per-order platform fee settlement (₹2). Absent/undefined = legacy, treat as paid. */
  settlement_status?: 'pending' | 'paid';
  settlement_utr?: string;
  payment_transaction_id?: string;
  payment_amount?: number;
  payment_verified_at?: Date;
  timeline?: {
    placed?: Date;
    accepted?: Date;
    preparing?: Date;
    dispatched?: Date;
    completed?: Date;
    cancelled?: Date;
  };
  payment_details?: {
    cf_payment_id?: string;
    payment_method?: any;
    bank_reference?: string;
    auth_id?: string;
    payment_group?: string;
    payment_time?: string;
    payment_message?: string;
    [key: string]: any;
  };
  prep_time?: number; // In minutes
  cancel_reason?: string;
  cancelled_by?: string;
}

export interface Payment {
  id: string;
  order_id: string;
  provider: string | 'cashfree' | 'payu'; // 'payu', 'cashfree', 'razorpay', etc.
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

export interface UserAddress {
  id: string;
  name: string;
  mobile: string;
  type: 'Home' | 'Hostel' | 'Other';
  hostelNumber?: string;
  roomNumber?: string;
  landmark?: string;
  instructions?: string;
  city: string;
  pincode: string;
  isDefault?: boolean;
}

export type SettlementStatus = 'pending' | 'verification_pending' | 'paid' | 'overdue' | 'rejected';

export interface Settlement {
  id: string;                  // 'YYYY-MM-DD' IST date
  vendor_id: string;
  settlement_date: string;     // 'YYYY-MM-DD' IST
  period_start: Date;          // 7AM IST prev day (in UTC)
  period_end: Date;            // 7AM IST current day (in UTC)
  total_online_orders: number;
  rate_per_order: number;      // ₹2
  payable_amount: number;
  status: SettlementStatus;
  transaction_id?: string;
  screenshot_url?: string;
  paid_at?: Date;
  verified_at?: Date;
  verified_by?: string;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface GSTSettings {
  gstEnabled: boolean;
  gstType: 'included' | 'excluded';
  gstPercentage: number;
}

export interface UserProfile {
  phone: string;
  name: string;
  email?: string;
  profileImageURL?: string;
  lastHostel: string;
  lastRoom: string;
  lastFullAddress?: string;
  totalOrders: number;
  foodPreference?: 'Veg' | 'Non-Veg' | 'Vegan';
  birthday?: string;
  landmark?: string;
  instructions?: string;
  pincode?: string;
  city?: string;
  state?: string;
  addresses?: UserAddress[];
  createdAt?: Date;
  updatedAt?: Date;
}
