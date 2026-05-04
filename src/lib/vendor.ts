import { db } from './firebase';
import { logger } from './logger';
import {
    collection,
    doc,
    query,
    orderBy,
    onSnapshot,
    updateDoc,
    getDoc,
    addDoc,
    writeBatch,
} from 'firebase/firestore';
import { Order, OrderStatus, Product, GSTSettings } from '@/types';

function getTimelineKeyForStatus(status: OrderStatus): 'placed' | 'accepted' | 'preparing' | 'dispatched' | 'completed' | 'cancelled' | null {
    switch (status) {
        case 'Placed':
            return 'placed';
        case 'Pending':
            return 'accepted';
        case 'Preparing':
            return 'preparing';
        case 'Dispatched':
            return 'dispatched';
        case 'Completed':
        case 'Delivered':
            return 'completed';
        case 'Cancelled':
            return 'cancelled';
        default:
            return null;
    }
}

async function buildStatusUpdates(orderRef: ReturnType<typeof doc>, status: OrderStatus) {
    const updates: Record<string, unknown> = { status };
    const tKey = getTimelineKeyForStatus(status);

    if (tKey) {
        updates[`timeline.${tKey}`] = new Date();
    }

    if (status === 'Completed' || status === 'Dispatched' || status === 'Delivered') {
        try {
            const snap = await getDoc(orderRef);
            if (snap.exists()) {
                const data = snap.data();
                const start = data.timeline?.preparing?.toDate?.() || data.orderDate?.toDate?.();
                if (start) {
                    updates.prep_time = Math.max(1, Math.floor((Date.now() - start.getTime()) / 60_000));
                }
            }
        } catch (e) {
            logger.error('Failed to calc prep_time:', e);
        }
    }

    return updates;
}

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

const DEFAULT_GST: GSTSettings = { gstEnabled: false, gstType: 'included', gstPercentage: 5 };

export function listenToGSTSettings(callback: (settings: GSTSettings) => void) {
    const docRef = doc(db, 'settings', 'storeSettings');
    return onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            const d = snap.data();
            callback({
                gstEnabled: d.gstEnabled === true,
                gstType: d.gstType === 'excluded' ? 'excluded' : 'included',
                gstPercentage: typeof d.gstPercentage === 'number' ? d.gstPercentage : 5,
            });
        } else {
            callback(DEFAULT_GST);
        }
    });
}

export async function updateGSTSettings(settings: GSTSettings, idToken: string, phone: string): Promise<void> {
    const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
            'x-vendor-phone': phone,
        },
        body: JSON.stringify(settings),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Failed to update GST settings');
    }
}

export async function toggleStoreStatus(isOpen: boolean, idToken: string, phone: string): Promise<void> {
    const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
            'x-vendor-phone': phone,
        },
        body: JSON.stringify({ isOpen }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Failed to toggle store');
    }
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
        }).filter(o =>
            // Show if it's a successful payment, a POS order, or an old legacy order
            o.payment_status === 'success' ||
            o.orderType === 'pos' ||
            (!o.payment_status && o.status !== 'pending_payment' && o.status !== 'failed')
        );
        callback(orders);
    });
}

/**
 * Update the status of an order (e.g., Placed -> Preparing -> Completed)
 * Automatically tracks timeline transitions and calculates prep_time.
 */
export async function updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    cancelReason?: string,
    cancelledBy?: string
): Promise<void> {
    const orderRef = doc(db, 'orders', orderId);
    const updates = await buildStatusUpdates(orderRef, status);

    if (status === 'Cancelled' && cancelReason) {
        updates['cancel_reason'] = cancelReason;
        if (cancelledBy) updates['cancelled_by'] = cancelledBy;
    }

    await updateDoc(orderRef, updates);
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
    const now = new Date();
    const newOrder: Omit<Order, 'id'> = {
        userId: 'pos-user',
        orderType: 'pos',
        items,
        itemTotal,
        dukanFee: 0,
        deliveryFee: 0,
        grandTotal,
        orderDate: now,
        status: 'Preparing', // Bypasses 'Placed' / 'Pending'
        timeline: {
            placed: now,
            accepted: now,
            preparing: now
        },
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
 * Reads are still allowed by Firestore security rules — no token needed.
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

// ─── Internal helper ────────────────────────────────────────────────────────
//
// All write operations go through /api/products (Admin SDK) because the
// Firestore security rules intentionally block direct client writes:
//   match /products/{id} { allow write: if false; }
//
// The auth flow uses anonymous Firebase sessions — the token has no
// phone_number claim, so we send the phone in a separate header.

async function callProductsApi(
    method: 'POST' | 'PUT' | 'DELETE',
    idToken: string,
    phone: string,
    body: Record<string, unknown>
): Promise<Response> {
    const res = await fetch('/api/products', {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
            'x-vendor-phone': phone,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: res.statusText }));
        logger.error(`[vendor API] ${method} /api/products → HTTP ${res.status}`, errData);
        throw new Error(errData.error ?? `API error ${res.status}`);
    }
    return res;
}

/**
 * Toggle product availability (Out of Stock / In Stock)
 */
export async function toggleProductAvailability(
    productId: string,
    isAvailable: boolean,
    idToken: string,
    phone: string
): Promise<void> {
    await callProductsApi('PUT', idToken, phone, { id: productId, isAvailable });
}

/**
 * Add a new product to the catalog.
 * Returns the new Firestore document ID.
 */
export async function addProduct(
    data: Omit<Product, 'id'>,
    idToken: string,
    phone: string
): Promise<string> {
    const res = await callProductsApi('POST', idToken, phone, data);
    const json = await res.json();
    return json.id as string;
}

/**
 * Update an existing product (partial update).
 */
export async function updateProduct(
    productId: string,
    data: Partial<Omit<Product, 'id'>>,
    idToken: string,
    phone: string
): Promise<void> {
    await callProductsApi('PUT', idToken, phone, { id: productId, ...data });
}

/**
 * Delete a product from the catalog.
 */
export async function deleteProduct(productId: string, idToken: string, phone: string): Promise<void> {
    await callProductsApi('DELETE', idToken, phone, { id: productId });
}

/**
 * ─── BATCH DISPATCH ─────────────────────────────────────────────────────────
 */

/**
 * Atomically updates a batch of orders with a shared status/timeline transition.
 */
export async function batchUpdateOrderStatus(orderIds: string[], status: Extract<OrderStatus, 'Dispatched' | 'Delivered' | 'Preparing'>): Promise<void> {
    const updatesById = await Promise.all(orderIds.map(async (id) => {
        const ref = doc(db, 'orders', id);
        const updates = await buildStatusUpdates(ref, status);
        return { ref, updates };
    }));

    const batch = writeBatch(db);
    updatesById.forEach(({ ref, updates }) => {
        batch.update(ref, updates);
    });
    await batch.commit();
}

export async function batchDispatchOrders(orderIds: string[]): Promise<void> {
    await batchUpdateOrderStatus(orderIds, 'Dispatched');
}
