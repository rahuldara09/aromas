/**
 * seed-pos-products.ts
 *
 * Seeds the `posProducts` Firestore collection with all 109 items
 * from the AROMA's Delight Catering Services, IIM Mumbai menu.
 *
 * Run:  npx tsx scripts/seed-pos-products.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
        console.error('Missing Firebase Admin env vars in .env.local');
        process.exit(1);
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();

// ─── Category helpers ─────────────────────────────────────────────────────────

function getCategory(name: string): string {
    const n = name.toLowerCase().trim();
    if (n === 'tea' || n === 'coffee') return 'Beverages';
    if (['poha', 'idali (2 piece)', 'plain dosa', 'masala dosa', 'breakfast'].includes(n)) return 'Breakfast';
    if (n === 'lunch' || n === 'dinner') return 'Meals';
    if (n.includes('sandwich')) return 'Sandwiches';
    if (n.includes('shawarma')) return 'Shawarma';
    if (n === 'lays chat' || n === 'kurkure chat' || n === 'samosa (2 piece)') return 'Snacks';
    if (n.includes('franky')) return 'Franky';
    if (n.includes('paratha')) return 'Paratha';
    if (n.includes('noodle')) return 'Noodles';
    if (n.includes('biryani') || n.includes('pulav') || n.endsWith('rice') || n === 'bhedi rice' || n === 'jeera rice' || n === 'plain rice') return 'Biryani & Rice';
    if (['omelette', 'half fry', 'full fry'].includes(n) || n.startsWith('egg')) return 'Egg Items';
    if (['paneer chilly', 'chicken chilly', 'chicken 65', 'veg manchurian dry', 'chicken crispy'].includes(n)) return 'Starters';
    if (n === 'chicken manchurian') return 'Starters';
    if (n.includes('chicken') || n === 'butter chicken') return 'Chicken';
    if (n.includes('paneer')) return 'Paneer';
    return 'Veg Curries';
}

function genCode(name: string, explicit?: string): string {
    if (explicit) return explicit;
    return name.trim().split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z]/g, '')[0] ?? '')
        .filter(c => c !== '')
        .join('').toLowerCase();
}

// ─── Menu data (all 109 items) ────────────────────────────────────────────────

const MENU: { sn: number; name: string; price: number; code?: string }[] = [
    { sn: 1,   name: 'Tea',                      price: 10,  code: 't' },
    { sn: 2,   name: 'Coffee',                   price: 15,  code: 'c' },
    { sn: 3,   name: 'Veg Sandwich',             price: 45,  code: 'vs' },
    { sn: 4,   name: 'Veg Cheese Sandwich',      price: 55,  code: 'vcs' },
    { sn: 5,   name: 'Paneer Sandwich',          price: 55,  code: 'ps' },
    { sn: 6,   name: 'Paneer Cheese Sandwich',   price: 66,  code: 'pcs' },
    { sn: 7,   name: 'Chicken Sandwich',         price: 55,  code: 'cs' },
    { sn: 8,   name: 'Chicken Cheese Sandwich',  price: 66 },
    { sn: 9,   name: 'Lays Chat',                price: 30 },
    { sn: 10,  name: 'Kurkure Chat',             price: 30 },
    { sn: 11,  name: 'Paneer Shawarma',          price: 55 },
    { sn: 12,  name: 'Chicken Shawarma',         price: 55 },
    { sn: 13,  name: 'Brown Bread Shawarma',     price: 60 },
    { sn: 14,  name: 'Chicken Manchurian',       price: 75 },
    { sn: 15,  name: 'Butter Chicken',           price: 99 },
    { sn: 16,  name: 'Chicken Kolhapuri',        price: 91 },
    { sn: 17,  name: 'Chicken Masala',           price: 62 },
    { sn: 18,  name: 'Chicken Handi',            price: 66 },
    { sn: 19,  name: 'Chicken Tikka Masala',     price: 62 },
    { sn: 20,  name: 'Chicken Sukha',            price: 66 },
    { sn: 21,  name: 'Chicken Kadai',            price: 66 },
    { sn: 22,  name: 'Egg Bhurji',              price: 37 },
    { sn: 23,  name: 'Egg Curry',               price: 45 },
    { sn: 24,  name: 'Aloo Jeera',              price: 40 },
    { sn: 25,  name: 'Aloo Bhindi',             price: 45 },
    { sn: 26,  name: 'Bhindi Masala',           price: 45 },
    { sn: 27,  name: 'Bhindi Fry',              price: 40 },
    { sn: 28,  name: 'Sev Tamatar',             price: 45 },
    { sn: 29,  name: 'Sev Masala',              price: 45 },
    { sn: 30,  name: 'Dal Khichdi',             price: 50 },
    { sn: 31,  name: 'Paneer Kolhapuri',        price: 66 },
    { sn: 32,  name: 'Paneer Butter Masala',    price: 66 },
    { sn: 33,  name: 'Dal Khichdi Tadka',       price: 50 },
    { sn: 34,  name: 'Paneer Mutter',           price: 58 },
    { sn: 35,  name: 'Paneer Kadai',            price: 58 },
    { sn: 36,  name: 'Aloo Gobi',              price: 40 },
    { sn: 37,  name: 'Aloo Mutter',            price: 40 },
    { sn: 38,  name: 'Veg Kolhapuri',          price: 40 },
    { sn: 39,  name: 'Veg Kadai',              price: 40 },
    { sn: 40,  name: 'Dal Fry',               price: 35 },
    { sn: 41,  name: 'Dal Tadka',             price: 45 },
    { sn: 42,  name: 'Paneer Tikka Masala',   price: 75 },
    { sn: 43,  name: 'Veg Biryani',           price: 60 },
    { sn: 44,  name: 'Paneer Biryani',        price: 75 },
    { sn: 45,  name: 'Egg Biryani',           price: 65 },
    { sn: 46,  name: 'Chicken Biryani',       price: 83 },
    { sn: 47,  name: 'Jeera Rice',            price: 42 },
    { sn: 48,  name: 'Plain Rice',            price: 31 },
    { sn: 49,  name: 'Paneer Pulav',          price: 53 },
    { sn: 50,  name: 'Veg Pulav',             price: 50 },
    { sn: 51,  name: 'Bhedi Rice',            price: 44 },
    { sn: 52,  name: 'Chicken Bhurji Rice',   price: 55 },
    { sn: 53,  name: 'Egg Bhurji Rice',       price: 50 },
    { sn: 54,  name: 'Veg Manchurian Rice',   price: 72 },
    { sn: 55,  name: 'Egg Schezwan Rice',     price: 53 },
    { sn: 56,  name: 'Egg Fried Rice',        price: 50 },
    { sn: 57,  name: 'Veg Triple Rice',       price: 66 },
    { sn: 58,  name: 'Veg Schezwan Rice',     price: 58 },
    { sn: 59,  name: 'Veg Fried Rice',        price: 50 },
    { sn: 60,  name: 'Paneer Manchurian Rice', price: 72 },
    { sn: 61,  name: 'Paneer Triple Rice',    price: 72 },
    { sn: 62,  name: 'Paneer Schezwan Rice',  price: 58 },
    { sn: 63,  name: 'Paneer Fried Rice',     price: 55 },
    { sn: 64,  name: 'Chicken Triple Rice',   price: 77 },
    { sn: 65,  name: 'Chicken Manchurian Rice', price: 77 },
    { sn: 66,  name: 'Chicken Schezwan Rice', price: 65 },
    { sn: 67,  name: 'Chicken Fried Rice',    price: 60 },
    { sn: 68,  name: 'Paneer Schezwan Noodles', price: 60 },
    { sn: 69,  name: 'Paneer Hakka Noodles',  price: 53 },
    { sn: 70,  name: 'Egg Sezwan Noodles',   price: 53 },
    { sn: 71,  name: 'Chicken Noodles',       price: 52 },
    { sn: 72,  name: 'Veg Noodles',           price: 45 },
    { sn: 73,  name: 'Veg Sezwan Noodles',   price: 50 },
    { sn: 74,  name: 'Aloo Paratha',          price: 25 },
    { sn: 75,  name: 'Aloo Cheese Paratha',   price: 35 },
    { sn: 76,  name: 'Onion Paratha',         price: 25 },
    { sn: 77,  name: 'Onion Cheese Paratha',  price: 35 },
    { sn: 78,  name: 'Paneer Paratha',        price: 35 },
    { sn: 79,  name: 'Paneer Cheese Paratha', price: 45 },
    { sn: 80,  name: 'Plain Paratha',         price: 10 },
    { sn: 81,  name: 'Butter Paratha',        price: 13 },
    { sn: 82,  name: 'Paneer Chilly',         price: 70 },
    { sn: 83,  name: 'Chicken Chilly',        price: 66 },
    { sn: 84,  name: 'Chicken 65',            price: 66 },
    { sn: 85,  name: 'Veg Manchurian Dry',    price: 58 },
    { sn: 86,  name: 'Chicken Crispy',        price: 90 },
    { sn: 87,  name: 'Paneer Franky',         price: 30 },
    { sn: 88,  name: 'Paneer Cheese Franky',  price: 40 },
    { sn: 89,  name: 'Paneer Tagada Franky',  price: 45 },
    { sn: 90,  name: 'Veg Franky',            price: 25 },
    { sn: 91,  name: 'Veg Cheese Franky',     price: 35 },
    { sn: 92,  name: 'Veg Tagada Franky',     price: 40 },
    { sn: 93,  name: 'Egg Franky',            price: 30 },
    { sn: 94,  name: 'Egg Cheese Franky',     price: 40 },
    { sn: 95,  name: 'Egg Tagada Franky',     price: 45 },
    { sn: 96,  name: 'Chicken Franky',        price: 35 },
    { sn: 97,  name: 'Chicken Cheese Franky', price: 45 },
    { sn: 98,  name: 'Chicken Tagada Franky', price: 50 },
    { sn: 99,  name: 'Poha',                  price: 25 },
    { sn: 100, name: 'Idali (2 Piece)',        price: 25 },
    { sn: 101, name: 'Plain Dosa',             price: 35 },
    { sn: 102, name: 'Masala Dosa',            price: 40 },
    { sn: 103, name: 'Samosa (2 Piece)',       price: 30 },
    { sn: 104, name: 'Omelette',              price: 25 },
    { sn: 105, name: 'Half Fry',              price: 25 },
    { sn: 106, name: 'Full Fry',              price: 30 },
    { sn: 107, name: 'Breakfast',             price: 25 },
    { sn: 108, name: 'Lunch',                 price: 50 },
    { sn: 109, name: 'Dinner',                price: 50 },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    // Check if collection already has data to avoid double-seeding
    const existing = await db.collection('posProducts').limit(1).get();
    if (!existing.empty) {
        console.log('posProducts collection already has data. Skipping seed.');
        console.log('To re-seed, clear the collection first.');
        process.exit(0);
    }

    const colRef = db.collection('posProducts');
    const batch = db.batch();

    for (const item of MENU) {
        const cat = getCategory(item.name);
        const code = genCode(item.name, item.code);
        const doc = {
            name: item.name,
            price: item.price,
            categoryId: cat.toLowerCase().replace(/[\s&]+/g, '-'),
            code,
            serialNumber: item.sn,
            isAvailable: true,
            imageURL: '',
            createdAt: FieldValue.serverTimestamp(),
        };
        batch.set(colRef.doc(), doc);
    }

    await batch.commit();
    console.log(`✓ Seeded ${MENU.length} items into posProducts`);
}

main().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
