import { db } from './firebase';
import {
    collection,
    doc,
    query,
    orderBy,
    onSnapshot,
    updateDoc,
    setDoc,
    getDoc,
    addDoc,
    deleteDoc,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import { Order, OrderStatus, Product } from '@/types';

/**
 * ─── STORE STATUS (Master Switch) ─────────────────────────────────────────────
 */

export interface StoreSettings {
    isOpen: boolean;
    updatedAt?: Date;
}

export function listenToStoreStatus(callback: (isOpen: boolean) => void) {
    const docRef = doc(db, 'settings', 'storeSettings');
    return onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            callback(snap.data().isOpen === true);
        } else {
            // Default to closed if doc doesn't exist
            callback(false);
        }
    });
}

export async function toggleStoreStatus(isOpen: boolean): Promise<void> {
    const docRef = doc(db, 'settings', 'storeSettings');
    await setDoc(docRef, { isOpen, updatedAt: Timestamp.now() }, { merge: true });
}

/**
 * ─── REAL-TIME ORDERS ─────────────────────────────────────────────────────────
 */

/**
 * Listens to all orders in real-time, ordered by date descending.
 * Returns an unsubscribe function to clean up the listener.
 */
export function listenToLiveOrders(callback: (orders: Order[]) => void) {
    const q = query(collection(db, 'orders'), orderBy('orderDate', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                orderDate: data.orderDate?.toDate?.() ?? new Date(),
            } as Order;
        });
        callback(orders);
    });
}

/**
 * Update the status of an order (e.g., Placed -> Preparing -> Completed)
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, { status });
}

/**
 * Creates a new POS (Walk-in) Order that bypasses the Placed queue and goes straight to Preparing.
 */
export async function createPOSOrder(
    items: Order['items'],
    itemTotal: number,
    grandTotal: number,
    paymentMethod: 'Cash' | 'UPI'
): Promise<string> {
    const newOrder: Omit<Order, 'id'> = {
        userId: 'pos-user',
        orderType: 'pos',
        items,
        itemTotal,
        dukanFee: 0,
        deliveryFee: 0,
        grandTotal,
        orderDate: new Date(),
        status: 'Preparing', // Bypasses 'Placed' / 'Pending'
        deliveryAddress: {
            name: `Walk-in (${paymentMethod})`,
            mobile: '',
            hostelNumber: 'POS',
            roomNumber: '-',
            deliveryType: 'Takeaway',
        },
    };

    const docRef = await addDoc(collection(db, 'orders'), newOrder);
    return docRef.id;
}

/**
 * ─── MENU / CATALOG MANAGEMENT ──────────────────────────────────────────────
 */

/**
 * Listen to all products in real-time (bypasses mock-data fallback).
 */
export function listenToProducts(callback: (products: import('@/types').Product[]) => void) {
    return onSnapshot(collection(db, 'products'), (snapshot) => {
        const products = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        } as import('@/types').Product));
        callback(products);
    });
}

/**
 * Quickly toggle product availability (Out of Stock / In Stock)
 */
export async function toggleProductAvailability(productId: string, isAvailable: boolean): Promise<void> {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, { isAvailable });
}

/**
 * Add a new product to the catalog
 */
export async function addProduct(data: Omit<Product, 'id'>): Promise<string> {
    const newProductData = {
        ...data,
        isAvailable: data.isAvailable ?? true,
    };
    const docRef = await addDoc(collection(db, 'products'), newProductData);
    return docRef.id;
}

/**
 * Delete a product from the catalog
 */
export async function deleteProduct(productId: string): Promise<void> {
    const productRef = doc(db, 'products', productId);
    await deleteDoc(productRef);
}

/**
 * ─── BATCH DISPATCH ─────────────────────────────────────────────────────────
 */

/**
 * Atomically dispatches a batch of orders (e.g., all orders for a hostel group).
 */
export async function batchDispatchOrders(orderIds: string[]): Promise<void> {
    const batch = writeBatch(db);
    orderIds.forEach((id) => {
        const ref = doc(db, 'orders', id);
        batch.update(ref, { status: 'Dispatched' as const });
    });
    await batch.commit();
}
