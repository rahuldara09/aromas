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
    getDocs,
    where,
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
            callback(false);
        }
    }, (error) => {
        logger.error('[listenToStoreStatus] snapshot error:', error.code, error.message);
    });
}

/**
 * ─── SETTLEMENT LOCK ──────────────────────────────────────────────────────────
 * Listens to the `settlementLocked` field on storeSettings.
 * True when vendor has an unpaid settlement and online orders are blocked.
 */
export function listenToSettlementLock(callback: (locked: boolean) => void) {
    const docRef = doc(db, 'settings', 'storeSettings');
    return onSnapshot(docRef, (snap) => {
        callback(snap.exists() ? snap.data().settlementLocked === true : false);
    }, (error) => {
        logger.error('[listenToSettlementLock] snapshot error:', error.code, error.message);
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
    }, (error) => {
        logger.error('[listenToGSTSettings] snapshot error:', error.code, error.message);
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
    }, (error) => {
        logger.error('[listenToLiveOrders] snapshot error:', error.code, error.message);
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
    paymentMethod: 'Cash' | 'UPI',
    /** Pass pre-computed token from client to avoid an extra Firestore read */
    providedToken?: number
): Promise<{ orderId: string; posToken: number }> {
    const now = new Date();

    let token: number;
    if (providedToken !== undefined && providedToken > 0) {
        // Client already computed this from live orders — no Firestore read needed
        token = providedToken;
    } else {
        // Server-side / API-route path: derive from Firestore
        token = (now.getHours() * 60 + now.getMinutes()) % 100 + 1; // safe fallback
        try {
            const allPosSnap = await getDocs(query(collection(db, 'orders'), where('orderType', '==', 'pos')));
            const todayStr = now.toDateString();
            const todayCount = allPosSnap.docs.filter(d => {
                const data = d.data();
                const od = data.orderDate?.toDate?.() ?? new Date(data.orderDate);
                return od.toDateString() === todayStr;
            }).length;
            token = (todayCount % 100) + 1;
        } catch {
            // keep the time-based fallback
        }
    }

    const newOrder: Omit<Order, 'id'> & { posPaymentMethod: string } = {
        userId: 'pos-user',
        orderType: 'pos',
        items,
        itemTotal,
        dukanFee: 0,
        deliveryFee: 0,
        grandTotal,
        orderDate: now,
        status: 'Completed',
        orderToken: String(token),
        posToken: token,
        posPaymentMethod: paymentMethod,
        payment_status: 'success',
        timeline: {
            placed: now,
            accepted: now,
            preparing: now,
            completed: now,
        },
        deliveryAddress: {
            name: 'Offline Sale',
            mobile: '',
            hostelNumber: 'POS',
            roomNumber: '-',
            deliveryType: 'Takeaway',
        },
    };

    const docRef = await addDoc(collection(db, 'orders'), newOrder);
    return { orderId: docRef.id, posToken: token };
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
    }, (error) => {
        logger.error('[listenToProducts] snapshot error:', error.code, error.message);
    });
}

/**
 * Listen to all POS products in real-time from the dedicated `posProducts` collection.
 */
export function listenToPosProducts(callback: (products: import('@/types').Product[]) => void) {
    return onSnapshot(collection(db, 'posProducts'), (snapshot) => {
        const products = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        } as import('@/types').Product));
        callback(products);
    }, (error) => {
        logger.error('[listenToPosProducts] snapshot error:', error.code, error.message);
    });
}

// ─── Internal helpers ────────────────────────────────────────────────────────
//
// All write operations go through the respective API routes (Admin SDK) because
// Firestore security rules intentionally block direct client writes.

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

async function callPosProductsApi(
    method: 'POST' | 'PUT' | 'DELETE',
    idToken: string,
    phone: string,
    body: Record<string, unknown>
): Promise<Response> {
    const res = await fetch('/api/pos-products', {
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
        logger.error(`[vendor API] ${method} /api/pos-products → HTTP ${res.status}`, errData);
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
 * ─── POS PRODUCT CATALOG (posProducts collection) ────────────────────────────
 */

export async function togglePosProductAvailability(
    productId: string,
    isAvailable: boolean,
    idToken: string,
    phone: string
): Promise<void> {
    await callPosProductsApi('PUT', idToken, phone, { id: productId, isAvailable });
}

export async function addPosProduct(
    data: Omit<import('@/types').Product, 'id'>,
    idToken: string,
    phone: string
): Promise<string> {
    const res = await callPosProductsApi('POST', idToken, phone, data as unknown as Record<string, unknown>);
    const json = await res.json();
    return json.id as string;
}

export async function updatePosProduct(
    productId: string,
    data: Partial<Omit<import('@/types').Product, 'id'>>,
    idToken: string,
    phone: string
): Promise<void> {
    await callPosProductsApi('PUT', idToken, phone, { id: productId, ...data });
}

export async function deletePosProduct(productId: string, idToken: string, phone: string): Promise<void> {
    await callPosProductsApi('DELETE', idToken, phone, { id: productId });
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
