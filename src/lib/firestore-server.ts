/**
 * Server-side Firestore helpers — use Firebase Admin SDK.
 * Import these only in server components / API routes (no "use client").
 * Never import firebase/firestore (client SDK) here.
 */

import { adminDb } from './firebaseAdmin';
import { Category } from '@/types';

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

export async function getCategories(): Promise<Category[]> {
    try {
        const snap = await adminDb.collection('categories').get();
        const results = snap.docs.map((d) => {
            const data = d.data();
            const imageURL = LOCAL_CATEGORY_IMAGES[d.id] ||
                (typeof data.imageURL === 'string' && data.imageURL.startsWith('http') ? data.imageURL : '');
            return { id: d.id, ...data, imageURL } as Category;
        });
        return results.length > 0 ? results : [];
    } catch (err) {
        console.error('[getCategories server]', err);
        return [];
    }
}
