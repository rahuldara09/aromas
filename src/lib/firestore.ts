import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    query,
    where,
    orderBy,
    Timestamp,
    setDoc,
    serverTimestamp,
    onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { Category, Product, Address, Order, OrderItem } from '@/types';

// Detect if real Firebase credentials have been provided
function isFirebaseConfigured(): boolean {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return !!projectId && !projectId.includes('your_project_id');
}

/**
 * Normalize an image URL from Firestore:
 * – Returns the url as-is if it starts with http(s).
 * – Returns '' for blank, undefined, null, or non-URL values.
 * This ensures the UI never receives malformed URLs that cause broken-image icons.
 */
function sanitizeImageURL(url: unknown): string {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed.startsWith('http')) return '';
    return trimmed;
}

const LOCAL_CATEGORY_IMAGES: Record<string, string> = {
    'biryani': '/categories/biryani.jpeg',
    'chaat': '/categories/chaat.jpeg',
    'chinese-dry': '/categories/chinese-dry.jpeg',
    'chinese-rice': '/categories/chinese-rice.jpeg',
    'cold-drinks': '/categories/cold-drinks.jpeg',
    'frankie': '/categories/frankie.jpeg',
    'indian-rice': '/categories/indian-rice.jpg',
    'non-veg-gravy': '/categories/non-veg-gravy.jpeg',
    'noodles': '/categories/noodles.jpeg',
    'paratha-roti': '/categories/paratha-roti.jpeg',
    'sandwich': '/categories/sandwich.jpeg',
    'shawrma': '/categories/shawrma.jpeg',
    'veg-gravy': '/categories/veg-gravy.jpeg',
};

// ─── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
    if (!isFirebaseConfigured()) return MOCK_CATEGORIES;
    try {
        const snap = await getDocs(collection(db, 'categories'));
        const results = snap.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                imageURL: LOCAL_CATEGORY_IMAGES[d.id] || sanitizeImageURL(data.imageURL),
            } as Category;
        });
        return results.length > 0 ? results : MOCK_CATEGORIES;
    } catch {
        return MOCK_CATEGORIES;
    }
}

// ─── Products ──────────────────────────────────────────────────────────────────

export async function getAllProducts(): Promise<Product[]> {
    if (!isFirebaseConfigured()) return MOCK_PRODUCTS;
    try {
        const snap = await getDocs(collection(db, 'products'));
        const results = snap.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                imageURL: sanitizeImageURL(data.imageURL),
            } as Product;
        });
        return results.length > 0 ? results : MOCK_PRODUCTS;
    } catch {
        return MOCK_PRODUCTS;
    }
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
    if (!isFirebaseConfigured()) return MOCK_PRODUCTS.filter((p) => p.categoryId === categoryId);
    try {
        const q = query(collection(db, 'products'), where('categoryId', '==', categoryId));
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                imageURL: sanitizeImageURL(data.imageURL),
            } as Product;
        });
    } catch {
        return MOCK_PRODUCTS.filter((p) => p.categoryId === categoryId);
    }
}

// ─── Addresses ─────────────────────────────────────────────────────────────────

// Functions moved to Users section below

// ─── Orders ────────────────────────────────────────────────────────────────────

export async function getUserOrders(customerPhone: string): Promise<Order[]> {
    if (!isFirebaseConfigured()) return [];
    try {
        const formattedPhone = customerPhone.startsWith('+91') ? customerPhone : `+91${customerPhone}`;
        // First try with orderBy (requires composite index in Firestore Console)
        const q = query(
            collection(db, 'orders'),
            where('customerPhone', '==', formattedPhone),
            orderBy('orderDate', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                orderDate: data.orderDate?.toDate?.() ?? new Date(),
            } as Order;
        });
    } catch (err: unknown) {
        const msg = (err as { message?: string }).message ?? '';
        console.warn('[Firestore] getUserOrders: index not ready, using fallback without orderBy.');

        // If the error is a missing index, fall back to a simple query (no orderBy)
        // This ensures orders display even before the composite index is created.
        if (msg.includes('index') || msg.includes('requires an index')) {
            console.warn('[Firestore] Composite index missing — falling back to unordered query.');
            try {
                const formattedPhone = customerPhone.startsWith('+91') ? customerPhone : `+91${customerPhone}`;
                const fallbackQ = query(
                    collection(db, 'orders'),
                    where('customerPhone', '==', formattedPhone)
                );
                const fallbackSnap = await getDocs(fallbackQ);
                const results = fallbackSnap.docs.map((d) => {
                    const data = d.data();
                    return {
                        id: d.id,
                        ...data,
                        orderDate: data.orderDate?.toDate?.() ?? new Date(),
                    } as Order;
                });
                // Sort client-side as a temporary measure
                return results.sort((a, b) =>
                    new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
                );
            } catch (fallbackErr) {
                console.error('[Firestore] Fallback query also failed:', fallbackErr);
            }
        }
        return [];
    }
}

/**
 * Calculate a dynamic ETA for a new order based on active queue length.
 * Base time = 10 minutes (or max item prep time if available).
 * Queue penalty = activeOrders * 4 minutes.
 */
async function calculateDynamicETA(items: OrderItem[]): Promise<{
    etaMinutes: number;
    orderToken: string;
}> {
    const BASE_PREP_MINUTES = 10;
    const QUEUE_PENALTY_PER_ORDER = 4;

    try {
        // Query active orders in 'Placed', 'Pending', or 'Preparing' status
        const activeQ = query(
            collection(db, 'orders'),
            where('status', 'in', ['Placed', 'Pending', 'Preparing'])
        );
        const activeSnap = await getDocs(activeQ);
        const activeCount = activeSnap.size;

        // Queue penalty
        const queuePenalty = activeCount * QUEUE_PENALTY_PER_ORDER;

        // Base time — use max item prep time if items have a prepTime field, else default
        const basePrepTime = items.reduce((max, item) => {
            const itemPrep = (item as typeof item & { prepTime?: number }).prepTime ?? BASE_PREP_MINUTES;
            return Math.max(max, itemPrep);
        }, BASE_PREP_MINUTES);

        const etaMinutes = basePrepTime + queuePenalty;

        // Build sequential order token from today's orders
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayQ = query(
            collection(db, 'orders'),
            where('orderDate', '>=', Timestamp.fromDate(startOfDay))
        );
        const todaySnap = await getDocs(todayQ);
        const tokenNumber = todaySnap.size + 1;
        const orderToken = String(tokenNumber).padStart(3, '0');

        return { etaMinutes, orderToken };
    } catch {
        // Fallback values
        return { etaMinutes: BASE_PREP_MINUTES, orderToken: '001' };
    }
}

/**
 * Create an order document directly in Firestore.
 * No payment integration — status is set to 'Placed' immediately.
 * Calculates dynamic ETA based on active queue.
 * Returns the Firestore document ID.
 */
export async function createOrder(
    customerPhone: string,
    items: OrderItem[],
    itemTotal: number,
    dukanFee: number,
    deliveryFee: number,
    grandTotal: number,
    deliveryAddress: Order['deliveryAddress']
): Promise<string> {
    const formattedPhone = customerPhone.startsWith('+91') ? customerPhone : `+91${customerPhone}`;

    // Calculate ETA before saving
    const { etaMinutes, orderToken } = await calculateDynamicETA(items);
    const expectedReadyTime = new Date(Date.now() + etaMinutes * 60 * 1000);

    const docRef = await addDoc(collection(db, 'orders'), {
        customerPhone: formattedPhone,
        items,
        itemTotal,
        dukanFee,
        deliveryFee,
        grandTotal,
        timestamp: serverTimestamp(),
        orderDate: serverTimestamp(),
        status: 'Placed',
        deliveryAddress,
        // ETA fields
        orderToken,
        etaMinutes,
        expectedReadyTime: Timestamp.fromDate(expectedReadyTime),
    });

    return docRef.id;
}

/**
 * Fetch a single order by its Firestore document ID.
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
    try {
        const snap = await getDoc(doc(db, 'orders', orderId));
        if (!snap.exists()) return null;
        const data = snap.data();
        return {
            id: snap.id,
            ...data,
            orderDate: data.orderDate?.toDate?.() ?? new Date(),
            expectedReadyTime: data.expectedReadyTime?.toDate?.() ?? undefined,
        } as Order;
    } catch {
        return null;
    }
}

/**
 * Listen to a single order in real-time by its Firestore document ID.
 * Returns an unsubscribe function.
 */
export function listenToOrder(orderId: string, callback: (order: Order | null) => void): () => void {
    const ref = doc(db, 'orders', orderId);
    return onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
            callback(null);
            return;
        }
        const data = snap.data();
        callback({
            id: snap.id,
            ...data,
            orderDate: data.orderDate?.toDate?.() ?? new Date(),
            expectedReadyTime: data.expectedReadyTime?.toDate?.() ?? undefined,
        } as Order);
    });
}

// ─── Users (Phone-based) ──────────────────────────────────────────────────────

export interface UserProfile {
    phone: string;
    name: string;
    lastHostel: string;
    lastRoom: string;
    totalOrders: number;
    createdAt?: Date;
}

/**
 * Fetch a user document directly by Phone Number (fast — no query needed).
 * Since we migrated from UID to Phone Number as primary key.
 */
export async function getUserByPhone(phone: string): Promise<UserProfile | null> {
    if (!isFirebaseConfigured()) return null;
    try {
        const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
        const snap = await getDoc(doc(db, 'users', formatted));
        if (!snap.exists()) return null;
        const data = snap.data();

        return {
            phone: data.phone ?? formatted,
            name: data.name ?? '',
            lastHostel: data.lastHostel ?? '',
            lastRoom: data.lastRoom ?? '',
            totalOrders: data.totalOrders ?? 0,
            createdAt: data.createdAt?.toDate?.(),
        };
    } catch {
        return null;
    }
}

/**
 * Get the saved delivery address for a user from their profile document.
 * Data is stored in users/{phone} — NOT in a separate 'addresses' collection.
 */
export async function getUserAddresses(phone: string): Promise<Address[]> {
    if (!isFirebaseConfigured()) return [];
    try {
        const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
        const snap = await getDoc(doc(db, 'users', formatted));
        if (!snap.exists()) return [];
        const data = snap.data();
        if (!data.lastHostel && !data.lastRoom) return [];
        return [{
            id: formatted,
            userId: formatted, // Using phone as userId now
            name: data.name ?? '',
            mobile: data.phone ?? '',
            hostelDetails: `${data.lastHostel ?? ''}, Room ${data.lastRoom ?? ''}`,
            city: 'IIT Bombay, Powai',
            pincode: '400076',
            // Extra fields for display & edit form:
            hostel: data.lastHostel ?? '',
            room: data.lastRoom ?? '',
        } as Address & { hostel: string; room: string }];
    } catch {
        return [];
    }
}

/**
 * Update name, hostel, and room in the user profile document.
 */
export async function updateUserAddress(
    phone: string,
    name: string,
    hostel: string,
    room: string
): Promise<void> {
    if (!isFirebaseConfigured()) return;
    const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
    const userRef = doc(db, 'users', formatted);
    await setDoc(userRef, {
        name,
        lastHostel: hostel,
        lastRoom: room,
        updatedAt: Timestamp.now(),
    }, { merge: true });

}


/**
 * Create or update a user document keyed by Phone Number.
 * Merges name, hostel, room, and increments totalOrders.
 */
export async function upsertUserProfile(
    phone: string,
    name: string,
    lastHostel: string,
    lastRoom: string,
    isFirstOrder: boolean
): Promise<void> {
    if (!isFirebaseConfigured()) return;
    try {
        const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
        const userRef = doc(db, 'users', formatted);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const current = snap.data();
            await setDoc(userRef, {
                phone: formatted,
                name,
                lastHostel,
                lastRoom,
                totalOrders: isFirstOrder ? (current.totalOrders ?? 0) : (current.totalOrders ?? 0) + 1,
                updatedAt: Timestamp.now(),
            }, { merge: true });
        } else {
            await setDoc(userRef, {
                phone: formatted,
                name,
                lastHostel,
                lastRoom,
                totalOrders: isFirstOrder ? 0 : 1,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
        }
    } catch {
        // Silently fail
    }
}


// ─── Mock Data (used when Firebase is not configured) ──────────────────────────

export const MOCK_CATEGORIES: Category[] = [
    { id: 'sandwich', name: 'Sandwich', imageURL: LOCAL_CATEGORY_IMAGES['sandwich'] || '', productCount: 4 },
    { id: 'cold-drinks', name: 'Cold Drinks', imageURL: LOCAL_CATEGORY_IMAGES['cold-drinks'] || '', productCount: 14 },
    { id: 'chaat', name: 'Chaat', imageURL: LOCAL_CATEGORY_IMAGES['chaat'] || '', productCount: 2 },
    { id: 'shawrma', name: 'Shawrma', imageURL: LOCAL_CATEGORY_IMAGES['shawrma'] || '', productCount: 3 },
    { id: 'non-veg-gravy', name: 'Non Veg Gravy', imageURL: LOCAL_CATEGORY_IMAGES['non-veg-gravy'] || '', productCount: 10 },
    { id: 'veg-gravy', name: 'Veg Gravy', imageURL: LOCAL_CATEGORY_IMAGES['veg-gravy'] || '', productCount: 18 },
    { id: 'biryani', name: 'Biryani', imageURL: LOCAL_CATEGORY_IMAGES['biryani'] || '', productCount: 6 },
    { id: 'chinese-rice', name: 'Chinese Rice', imageURL: LOCAL_CATEGORY_IMAGES['chinese-rice'] || '', productCount: 15 },
    { id: 'noodles', name: 'Noodles', imageURL: LOCAL_CATEGORY_IMAGES['noodles'] || '', productCount: 9 },
    { id: 'paratha-roti', name: 'Paratha / Roti', imageURL: LOCAL_CATEGORY_IMAGES['paratha-roti'] || '', productCount: 8 },
    { id: 'chinese-dry', name: 'Chinese Dry Item', imageURL: LOCAL_CATEGORY_IMAGES['chinese-dry'] || '', productCount: 8 },
    { id: 'frankie', name: 'Frankie', imageURL: LOCAL_CATEGORY_IMAGES['frankie'] || '', productCount: 12 },
];

export const MOCK_PRODUCTS: Product[] = [
    // Biryani
    { id: 'p1', categoryId: 'biryani', name: 'Boildk burji', price: 45, imageURL: 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=300' },
    { id: 'p2', categoryId: 'biryani', name: 'Paneer Biyani', price: 63, imageURL: '' },
    { id: 'p3', categoryId: 'biryani', name: 'Dal khichadi tadka', price: 55, imageURL: 'https://images.unsplash.com/photo-1574653853027-5382a3d23a15?w=300' },
    { id: 'p4', categoryId: 'biryani', name: 'Chicken Biryani', price: 88, imageURL: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300' },
    { id: 'p5', categoryId: 'biryani', name: 'Veg Biryani', price: 75, imageURL: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=300' },
    { id: 'p6', categoryId: 'biryani', name: 'Egg Biryani', price: 80, imageURL: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300' },
    // Sandwich
    { id: 'p7', categoryId: 'sandwich', name: 'Veg Sandwich', price: 40, imageURL: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300' },
    { id: 'p8', categoryId: 'sandwich', name: 'Paneer Sandwich', price: 50, imageURL: 'https://images.unsplash.com/photo-1619096252214-ef06c45683e3?w=300' },
    { id: 'p9', categoryId: 'sandwich', name: 'Chicken Sandwich', price: 60, imageURL: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=300' },
    { id: 'p10', categoryId: 'sandwich', name: 'Club Sandwich', price: 70, imageURL: 'https://images.unsplash.com/photo-1528736235302-52922df5c122?w=300' },
    // Cold Drinks
    { id: 'p11', categoryId: 'cold-drinks', name: 'Coca Cola (250ml)', price: 20, imageURL: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300' },
    { id: 'p12', categoryId: 'cold-drinks', name: 'Pepsi (250ml)', price: 20, imageURL: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300' },
    { id: 'p13', categoryId: 'cold-drinks', name: 'Sprite (250ml)', price: 20, imageURL: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=300' },
    { id: 'p14', categoryId: 'cold-drinks', name: 'Mango Shake', price: 45, imageURL: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=300' },
    // Chaat
    { id: 'p15', categoryId: 'chaat', name: 'Pani Puri', price: 30, imageURL: 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=300' },
    { id: 'p16', categoryId: 'chaat', name: 'Bhel Puri', price: 35, imageURL: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=300' },
    // Noodles
    { id: 'p17', categoryId: 'noodles', name: 'Veg Noodles', price: 55, imageURL: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=300' },
    { id: 'p18', categoryId: 'noodles', name: 'Chicken Noodles', price: 70, imageURL: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300' },
    { id: 'p19', categoryId: 'noodles', name: 'Schezwan Noodles', price: 65, imageURL: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300' },
    // Frankie
    { id: 'p20', categoryId: 'frankie', name: 'Veg Frankie', price: 40, imageURL: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=300' },
    { id: 'p21', categoryId: 'frankie', name: 'Paneer Frankie', price: 50, imageURL: 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=300' },
    { id: 'p22', categoryId: 'frankie', name: 'Chicken Frankie', price: 60, imageURL: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300' },
];
