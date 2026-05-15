/**
 * sync-menu.ts
 *
 * Syncs every Firestore product with the authoritative menu data from both PDFs:
 *   - aroma_menu_IIMM.xlsx  → POS price, serialNumber, code
 *   - Online Prices_IIM Mumbai.xlsx → onlinePrice (base + packaging, before GST)
 *
 * Run:  npx tsx scripts/sync-menu.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ─── Firebase Admin Init ──────────────────────────────────────────────────────
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

// ─── Shortcode Generator ──────────────────────────────────────────────────────
function genCode(name: string): string {
    return name.trim().split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z]/g, '')[0] ?? '')
        .filter(c => c !== '')
        .join('').toLowerCase();
}

// ─── Canonical POS Menu (from aroma_menu_IIMM.xlsx.pdf) ──────────────────────
// Fields: serialNumber, name, price (POS base, no GST/packaging), code (explicit or auto)
interface PosEntry { serialNumber: number; name: string; price: number; code?: string }

const POS_MENU: PosEntry[] = [
    { serialNumber: 1,   name: 'Tea',                     price: 10,  code: 't' },
    { serialNumber: 2,   name: 'Coffee',                  price: 15,  code: 'c' },
    { serialNumber: 3,   name: 'Veg Sandwich',            price: 45,  code: 'vs' },
    { serialNumber: 4,   name: 'Veg Cheese Sandwich',     price: 55,  code: 'vcs' },
    { serialNumber: 5,   name: 'Paneer Sandwich',         price: 55,  code: 'ps' },
    { serialNumber: 6,   name: 'Paneer Cheese Sandwich',  price: 66,  code: 'pcs' },
    { serialNumber: 7,   name: 'Chicken Sandwich',        price: 55,  code: 'cs' },
    { serialNumber: 8,   name: 'Chicken Cheese Sandwich', price: 66 },
    { serialNumber: 9,   name: 'Lays Chat',               price: 30 },
    { serialNumber: 10,  name: 'Kurkure Chat',            price: 30 },
    { serialNumber: 11,  name: 'Paneer Shawarma',         price: 55 },
    { serialNumber: 12,  name: 'Chicken Shawarma',        price: 55 },
    { serialNumber: 13,  name: 'Brown Bread Shawarma',    price: 60 },
    { serialNumber: 14,  name: 'Chicken Manchurian',      price: 75 },
    { serialNumber: 15,  name: 'Butter Chicken',          price: 99 },
    { serialNumber: 16,  name: 'Chicken Kolhapuri',       price: 91 },
    { serialNumber: 17,  name: 'Chicken Masala',          price: 62 },
    { serialNumber: 18,  name: 'Chicken Handi',           price: 66 },
    { serialNumber: 19,  name: 'Chicken Tikka Masala',    price: 62 },
    { serialNumber: 20,  name: 'Chicken Sukha',           price: 66 },
    { serialNumber: 21,  name: 'Chicken Kadai',           price: 66 },
    { serialNumber: 22,  name: 'Egg Bhurji',              price: 37 },
    { serialNumber: 23,  name: 'Egg Curry',               price: 45 },
    { serialNumber: 24,  name: 'Aloo Jeera',              price: 40 },
    { serialNumber: 25,  name: 'Aloo Bhindi',             price: 45 },
    { serialNumber: 26,  name: 'Bhindi Masala',           price: 45 },
    { serialNumber: 27,  name: 'Bhindi Fry',              price: 40 },
    { serialNumber: 28,  name: 'Sev Tamatar',             price: 45 },
    { serialNumber: 29,  name: 'Sev Masala',              price: 45 },
    { serialNumber: 30,  name: 'Dal Khichdi',             price: 50 },
    { serialNumber: 31,  name: 'Paneer Kolhapuri',        price: 66 },
    { serialNumber: 32,  name: 'Paneer Butter Masala',    price: 66 },
    { serialNumber: 33,  name: 'Dal Khichdi Tadka',       price: 50 },
    { serialNumber: 34,  name: 'Paneer Mutter',           price: 58 },
    { serialNumber: 35,  name: 'Paneer Kadai',            price: 58 },
    { serialNumber: 36,  name: 'Aloo Gobi',               price: 40 },
    { serialNumber: 37,  name: 'Aloo Mutter',             price: 40 },
    { serialNumber: 38,  name: 'Veg Kolhapuri',           price: 40 },
    { serialNumber: 39,  name: 'Veg Kadai',               price: 40 },
    { serialNumber: 40,  name: 'Dal Fry',                 price: 35 },
    { serialNumber: 41,  name: 'Dal Tadka',               price: 45 },
    { serialNumber: 42,  name: 'Paneer Tikka Masala',     price: 75 },
    { serialNumber: 43,  name: 'Veg Biryani',             price: 60 },
    { serialNumber: 44,  name: 'Paneer Biryani',          price: 75 },
    { serialNumber: 45,  name: 'Egg Biryani',             price: 65 },
    { serialNumber: 46,  name: 'Chicken Biryani',         price: 83 },
    { serialNumber: 47,  name: 'Jeera Rice',              price: 42 },
    { serialNumber: 48,  name: 'Plain Rice',              price: 31 },
    { serialNumber: 49,  name: 'Paneer Pulav',            price: 53 },
    { serialNumber: 50,  name: 'Veg Pulav',               price: 50 },
    { serialNumber: 51,  name: 'Bhedi Rice',              price: 44 },
    { serialNumber: 52,  name: 'Chicken Bhurji Rice',     price: 55 },
    { serialNumber: 53,  name: 'Egg Bhurji Rice',         price: 50 },
    { serialNumber: 54,  name: 'Veg Manchurian Rice',     price: 72 },
    { serialNumber: 55,  name: 'Egg Schezwan Rice',       price: 53 },
    { serialNumber: 56,  name: 'Egg Fried Rice',          price: 50 },
    { serialNumber: 57,  name: 'Veg Triple Rice',         price: 66 },
    { serialNumber: 58,  name: 'Veg Schezwan Rice',       price: 58 },
    { serialNumber: 59,  name: 'Veg Fried Rice',          price: 50 },
    { serialNumber: 60,  name: 'Paneer Manchurian Rice',  price: 72 },
    { serialNumber: 61,  name: 'Paneer Triple Rice',      price: 72 },
    { serialNumber: 62,  name: 'Paneer Schezwan Rice',    price: 58 },
    { serialNumber: 63,  name: 'Paneer Fried Rice',       price: 55 },
    { serialNumber: 64,  name: 'Chicken Triple Rice',     price: 77 },
    { serialNumber: 65,  name: 'Chicken Manchurian Rice', price: 77 },
    { serialNumber: 66,  name: 'Chicken Schezwan Rice',   price: 65 },
    { serialNumber: 67,  name: 'Chicken Fried Rice',      price: 60 },
    { serialNumber: 68,  name: 'Paneer Schezwan Noodles', price: 60 },
    { serialNumber: 69,  name: 'Paneer Hakka Noodles',    price: 53 },
    { serialNumber: 70,  name: 'Egg Sezwan Noodles',      price: 53 },
    { serialNumber: 71,  name: 'Chicken Noodles',         price: 52 },
    { serialNumber: 72,  name: 'Veg Noodles',             price: 45 },
    { serialNumber: 73,  name: 'Veg Sezwan Noodles',      price: 50 },
    { serialNumber: 74,  name: 'Aloo Paratha',            price: 25 },
    { serialNumber: 75,  name: 'Aloo Cheese Paratha',     price: 35 },
    { serialNumber: 76,  name: 'Onion Paratha',           price: 25 },
    { serialNumber: 77,  name: 'Onion Cheese Paratha',    price: 35 },
    { serialNumber: 78,  name: 'Paneer Paratha',          price: 35 },
    { serialNumber: 79,  name: 'Paneer Cheese Paratha',   price: 45 },
    { serialNumber: 80,  name: 'Plain Paratha',           price: 10 },
    { serialNumber: 81,  name: 'Butter Paratha',          price: 13 },
    { serialNumber: 82,  name: 'Paneer Chilly',           price: 70 },
    { serialNumber: 83,  name: 'Chicken Chilly',          price: 66 },
    { serialNumber: 84,  name: 'Chicken 65',              price: 66 },
    { serialNumber: 85,  name: 'Veg Manchurian Dry',      price: 58 },
    { serialNumber: 86,  name: 'Chicken Crispy',          price: 90 },
    { serialNumber: 87,  name: 'Paneer Franky',           price: 30 },
    { serialNumber: 88,  name: 'Paneer Cheese Franky',    price: 40 },
    { serialNumber: 89,  name: 'Paneer Tagada Franky',    price: 45 },
    { serialNumber: 90,  name: 'Veg Franky',              price: 25 },
    { serialNumber: 91,  name: 'Veg Cheese Franky',       price: 35 },
    { serialNumber: 92,  name: 'Veg Tagada Franky',       price: 40 },
    { serialNumber: 93,  name: 'Egg Franky',              price: 30 },
    { serialNumber: 94,  name: 'Egg Cheese Franky',       price: 40 },
    { serialNumber: 95,  name: 'Egg Tagada Franky',       price: 45 },
    { serialNumber: 96,  name: 'Chicken Franky',          price: 35 },
    { serialNumber: 97,  name: 'Chicken Cheese Franky',   price: 45 },
    { serialNumber: 98,  name: 'Chicken Tagada Franky',   price: 50 },
    { serialNumber: 99,  name: 'Poha',                    price: 25 },
    { serialNumber: 100, name: 'Idali (2 Piece)',         price: 25 },
    { serialNumber: 101, name: 'Plain Dosa',              price: 35 },
    { serialNumber: 102, name: 'Masala Dosa',             price: 40 },
    { serialNumber: 103, name: 'Samosa (2 Piece)',        price: 30 },
    { serialNumber: 104, name: 'Omelette',                price: 25 },
    { serialNumber: 105, name: 'Half Fry',                price: 25 },
    { serialNumber: 106, name: 'Full Fry',                price: 30 },
    { serialNumber: 107, name: 'Breakfast',               price: 25 },
    { serialNumber: 108, name: 'Lunch',                   price: 50 },
    { serialNumber: 109, name: 'Dinner',                  price: 50 },
    // Online-only items (not in POS menu PDF, base price inferred)
    { serialNumber: 110, name: 'Paneer Bhurji',           price: 75 },
    { serialNumber: 111, name: 'Open Shawrama',           price: 110 },
    { serialNumber: 112, name: 'Chicken Schezwan Noodle', price: 60 },
];

// ─── Online Prices — exact values from "Online ItemPrice IIM Mumbai.pdf" ────────
// Tea, Coffee, Poha, Idali, Dosa, Samosa, Breakfast, Lunch, Dinner are POS-only
const ONLINE_PRICE: Record<string, number> = {
    'Veg Sandwich':             47,
    'Veg Cheese Sandwich':      58,
    'Paneer Sandwich':          58,
    'Paneer Cheese Sandwich':   69,
    'Chicken Sandwich':         58,
    'Chicken Cheese Sandwich':  69,
    'Lays Chat':                37,
    'Kurkure Chat':             37,
    'Paneer Shawarma':          58,
    'Chicken Shawarma':         58,
    'Brown Bread Shawarma':     63,
    'Chicken Manchurian':       84,
    'Butter Chicken':          109,
    'Chicken Kolhapuri':       101,
    'Chicken Masala':           70,
    'Chicken Handi':            75,
    'Chicken Tikka Masala':     70,
    'Chicken Sukha':            75,
    'Chicken Kadai':            75,
    'Egg Bhurji':               44,
    'Egg Curry':                53,
    'Aloo Jeera':               47,
    'Aloo Bhindi':              53,
    'Bhindi Masala':            53,
    'Bhindi Fry':               47,
    'Sev Tamatar':              53,
    'Sev Masala':               53,
    'Dal Khichdi':              58,
    'Paneer Kolhapuri':         75,
    'Paneer Butter Masala':     75,
    'Dal Khichdi Tadka':        58,
    'Paneer Mutter':            66,
    'Paneer Kadai':             66,
    'Aloo Gobi':                47,
    'Aloo Mutter':              47,
    'Veg Kolhapuri':            47,
    'Veg Kadai':                47,
    'Dal Fry':                  42,
    'Dal Tadka':                53,
    'Paneer Tikka Masala':      84,
    'Veg Biryani':              68,
    'Paneer Biryani':           84,
    'Egg Biryani':              74,
    'Chicken Biryani':          92,
    'Jeera Rice':               49,
    'Plain Rice':               38,
    'Paneer Pulav':             61,
    'Veg Pulav':                58,
    'Bhedi Rice':               51,
    'Chicken Bhurji Rice':      63,
    'Egg Bhurji Rice':          58,
    'Veg Manchurian Rice':      86,
    'Egg Schezwan Rice':        61,
    'Egg Fried Rice':           58,
    'Veg Triple Rice':          80,
    'Veg Schezwan Rice':        66,
    'Veg Fried Rice':           58,
    'Paneer Manchurian Rice':   86,
    'Paneer Triple Rice':       86,
    'Paneer Schezwan Rice':     66,
    'Paneer Fried Rice':        63,
    'Chicken Triple Rice':      91,
    'Chicken Manchurian Rice':  91,
    'Chicken Schezwan Rice':    74,
    'Chicken Fried Rice':       68,
    'Paneer Schezwan Noodles':  68,
    'Paneer Hakka Noodles':     61,
    'Egg Sezwan Noodles':       61,
    'Chicken Noodles':          60,
    'Veg Noodles':              53,
    'Veg Sezwan Noodles':       58,
    'Aloo Paratha':             26,
    'Aloo Cheese Paratha':      37,
    'Onion Paratha':            26,
    'Onion Cheese Paratha':     37,
    'Paneer Paratha':           37,
    'Paneer Cheese Paratha':    47,
    'Plain Paratha':            11,
    'Butter Paratha':           14,
    'Paneer Chilly':            79,
    'Chicken Chilly':           75,
    'Chicken 65':               75,
    'Veg Manchurian Dry':       66,
    'Chicken Crispy':          100,
    'Paneer Franky':            32,
    'Paneer Cheese Franky':     42,
    'Paneer Tagada Franky':     47,
    'Veg Franky':               26,
    'Veg Cheese Franky':        37,
    'Veg Tagada Franky':        42,
    'Egg Franky':               32,
    'Egg Cheese Franky':        42,
    'Egg Tagada Franky':        47,
    'Chicken Franky':           37,
    'Chicken Cheese Franky':    47,
    'Chicken Tagada Franky':    53,
    'Omelette':                 26,
    'Half Fry':                 32,
    'Full Fry':                 32,
    'Paneer Bhurji':            84,
    'Open Shawrama':           121,
    'Chicken Schezwan Noodle':  68,
};

// ─── Build fast lookup index (normalised name → PosEntry) ────────────────────
function norm(s: string) { return s.toLowerCase().trim().replace(/\s+/g, ' '); }

const POS_INDEX = new Map<string, PosEntry>();
for (const e of POS_MENU) POS_INDEX.set(norm(e.name), e);

// ─── Main Migration ────────────────────────────────────────────────────────────
async function main() {
    const snap = await db.collection('products').get();
    console.log(`\nFound ${snap.size} products in Firestore.\n`);

    // Build index of existing Firebase products by normalized name
    const existingMap = new Map<string, { ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData }>();
    for (const doc of snap.docs) {
        existingMap.set(norm(doc.data().name ?? ''), { ref: doc.ref, data: doc.data() });
    }

    // Build online serial mapping (sorted by POS serial → 1, 2, 3 … 102)
    const ONLINE_SERIAL = new Map<string, number>();
    let onlineSerial = 1;
    for (const e of POS_MENU) {
        const oP = ONLINE_PRICE[e.name] ?? ONLINE_PRICE[Object.keys(ONLINE_PRICE).find(k => norm(k) === norm(e.name)) ?? ''];
        if (oP !== undefined) ONLINE_SERIAL.set(norm(e.name), onlineSerial++);
    }

    const batch = db.batch();
    let updated = 0, added = 0, skipped = 0;
    const matchedKeys = new Set<string>();

    // ── Pass 1: iterate POS_MENU — update existing docs, add missing ones ──────
    for (const posEntry of POS_MENU) {
        const key      = norm(posEntry.name);
        const code     = posEntry.code ?? genCode(posEntry.name);
        const onlineP  = ONLINE_PRICE[posEntry.name] ?? ONLINE_PRICE[Object.keys(ONLINE_PRICE).find(k => norm(k) === key) ?? ''];
        const existing = existingMap.get(key);

        const isPOS    = posEntry.serialNumber <= 109;
        const isOnline = onlineP !== undefined;

        if (existing) {
            matchedKeys.add(key);
            const updates: Record<string, unknown> = {
                price:        posEntry.price,
                serialNumber: posEntry.serialNumber,
                code,
                isPOSItem:    isPOS,
                isOnlineItem: isOnline,
            };
            if (isOnline) {
                updates.onlinePrice = onlineP;
                updates.onlineSerialNumber = ONLINE_SERIAL.get(key) ?? null;
            }

            const prev = existing.data;
            batch.update(existing.ref, updates);
            updated++;

            const pChg = prev.price !== posEntry.price ? ` price ${prev.price}→${posEntry.price}` : '';
            const oChg = isOnline && prev.onlinePrice !== onlineP
                ? ` onlinePrice ${prev.onlinePrice ?? 'none'}→${onlineP}` : '';
            if (pChg || oChg) {
                console.log(`  ✓  ${String(posEntry.serialNumber).padStart(3)} "${posEntry.name}"${pChg}${oChg}  [${code}]`);
            } else {
                console.log(`  =  ${String(posEntry.serialNumber).padStart(3)} "${posEntry.name}"  [${code}]  (no change)`);
            }
        } else {
            // Item exists in POS PDF but not in Firebase — add it
            matchedKeys.add(key);
            const newRef = db.collection('products').doc();
            const newDoc: Record<string, unknown> = {
                name:         posEntry.name,
                price:        posEntry.price,
                categoryId:   posEntry.name.toLowerCase().trim().split(/\s+/).slice(0, 2).join('-'),
                serialNumber: posEntry.serialNumber,
                code,
                imageURL:     '',
                isAvailable:  true,
                isPOSItem:    isPOS,
                isOnlineItem: isOnline,
            };
            if (isOnline) {
                newDoc.onlinePrice = onlineP;
                newDoc.onlineSerialNumber = ONLINE_SERIAL.get(key) ?? null;
            }
            batch.set(newRef, newDoc);
            added++;
            console.log(`  + ${String(posEntry.serialNumber).padStart(3)} "${posEntry.name}" (NEW)  [${code}]  ₹${posEntry.price}`);
        }
    }

    // ── Pass 2: non-PDF items — mark as neither POS nor Online, strip stale serialNumber ──
    for (const [key, { ref, data }] of existingMap) {
        if (!matchedKeys.has(key)) {
            const fixups: Record<string, unknown> = {
                isPOSItem:    false,
                isOnlineItem: false,
            };
            if (!data.code) fixups.code = genCode(data.name ?? '');
            // Remove stale serialNumber that causes phantom POS/Online counts
            if (data.serialNumber !== undefined) {
                fixups.serialNumber = FieldValue.delete();
                console.log(`  ~  "${data.name}" — stale serialNumber removed`);
            }
            batch.update(ref, fixups);
            skipped++;
        }
    }

    await batch.commit();

    // ── Pass 3: delete Firebase docs not in either PDF that have no photo ───────
    const KEEP_NAMES = new Set<string>();
    for (const e of POS_MENU.slice(0, 109)) KEEP_NAMES.add(norm(e.name));
    for (const name of Object.keys(ONLINE_PRICE)) KEEP_NAMES.add(norm(name));

    let deleted = 0;
    const deleteBatch = db.batch();
    for (const [key, { ref, data }] of existingMap) {
        if (!KEEP_NAMES.has(key) && !data.imageURL) {
            deleteBatch.delete(ref);
            deleted++;
            console.log(`  ✗  "${data.name}" (redundant, no photo) — DELETED`);
        }
    }
    if (deleted > 0) await deleteBatch.commit();

    console.log(`\n─────────────────────────────────────────`);
    console.log(`Updated : ${updated} existing products`);
    console.log(`Added   : ${added} new POS-only items`);
    console.log(`Skipped : ${skipped} (online-only items, kept as-is)`);
    console.log(`Deleted : ${deleted} (redundant items with no photo)`);
    console.log(`\nDone. Refresh the app to see changes.\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
