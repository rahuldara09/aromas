import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Setup Firebase Admin
const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount),
    });
}

const db = getFirestore();

// ==========================================
// PRODUCTS TO ADD (if not already existing)
// ==========================================
// Rules: Only ADD if the product name does NOT already exist in Firestore.
// Do NOT edit, delete, or change any existing products.

const PRODUCTS_TO_ADD = [
    // ── FRANKIE ──────────────────────────────────────────────────────────────
    { categoryId: 'frankie', name: 'Veg Frankie', price: 22 },
    { categoryId: 'frankie', name: 'Egg Frankie', price: 30 },
    { categoryId: 'frankie', name: 'Paneer Frankie', price: 31 },
    { categoryId: 'frankie', name: 'Veg Cheese Frankie', price: 33 },
    { categoryId: 'frankie', name: 'Chicken Frankie', price: 33 },
    { categoryId: 'frankie', name: 'Veg Tadka Frankie', price: 39 },
    { categoryId: 'frankie', name: 'Egg Cheese Frankie', price: 41 },
    { categoryId: 'frankie', name: 'Paneer Cheese Frankie', price: 42 },
    { categoryId: 'frankie', name: 'Egg Tadka Frankie', price: 44 },
    { categoryId: 'frankie', name: 'Chicken Cheese Frankie', price: 44 },
    { categoryId: 'frankie', name: 'Paneer Tagda Frankie', price: 45 },
    { categoryId: 'frankie', name: 'Chicken Tadka Frankie', price: 50 },

    // ── CHINESE DRY ITEMS ─────────────────────────────────────────────────────
    { categoryId: 'chinese-dry', name: 'Mushroom Chilli', price: 75 },
    { categoryId: 'chinese-dry', name: 'Paneer Chilly Dry', price: 75 },
    { categoryId: 'chinese-dry', name: 'Chicken Manchurian Dry', price: 80 },
    { categoryId: 'chinese-dry', name: 'Chicken Crispy', price: 88 },

    // ── NOODLES ───────────────────────────────────────────────────────────────
    { categoryId: 'noodles', name: 'Veg Noodles', price: 50 },
    { categoryId: 'noodles', name: 'Veg Schezwan Noodles', price: 55 },
    { categoryId: 'noodles', name: 'Paneer Hakka Noodles', price: 55 },
    { categoryId: 'noodles', name: 'Egg Hakka Noodles', price: 55 },
    { categoryId: 'noodles', name: 'Paneer Schezwan Noodles', price: 58 },
    { categoryId: 'noodles', name: 'Egg Schezwan Noodles', price: 58 },
    { categoryId: 'noodles', name: 'Chicken Noodles', price: 57 },
    { categoryId: 'noodles', name: 'Chicken Hakka Noodles', price: 60 },
    { categoryId: 'noodles', name: 'Chicken Schezwan Noodles', price: 63 },

    // ── RICE MENU: Indian-style items → indian-rice ───────────────────────────
    { categoryId: 'indian-rice', name: 'Sezwan Chatni', price: 10 },
    { categoryId: 'indian-rice', name: 'Plain Rice', price: 38 },
    { categoryId: 'indian-rice', name: 'Jeera Rice', price: 47 },
    { categoryId: 'indian-rice', name: 'Bhedi Rice', price: 49 },
    { categoryId: 'indian-rice', name: 'Veg Pulav', price: 55 },
    { categoryId: 'indian-rice', name: 'Egg Bhurji Rice', price: 55 },
    { categoryId: 'indian-rice', name: 'Paneer Pulav', price: 59 },
    { categoryId: 'indian-rice', name: 'Chicken Bhurji Rice', price: 60 },
    { categoryId: 'indian-rice', name: 'Chicken Pulav', price: 64 },
    { categoryId: 'indian-rice', name: 'Veg Triple Rice', price: 76 },
    { categoryId: 'indian-rice', name: 'Paneer Manchurian Rice', price: 82 },
    { categoryId: 'indian-rice', name: 'Paneer Triple Rice', price: 82 },
    { categoryId: 'indian-rice', name: 'Chicken Manchurian Rice', price: 87 },
    { categoryId: 'indian-rice', name: 'Chicken Triple Rice', price: 87 },

    // ── RICE MENU: Chinese-style items → chinese-rice ─────────────────────────
    { categoryId: 'chinese-rice', name: 'Sezwan Chatni', price: 10 },
    { categoryId: 'chinese-rice', name: 'Plain Rice', price: 38 },
    { categoryId: 'chinese-rice', name: 'Jeera Rice', price: 47 },
    { categoryId: 'chinese-rice', name: 'Bhedi Rice', price: 49 },
    { categoryId: 'chinese-rice', name: 'Veg Fried Rice', price: 54 },
    { categoryId: 'chinese-rice', name: 'Veg Pulav', price: 55 },
    { categoryId: 'chinese-rice', name: 'Egg Fried Rice', price: 55 },
    { categoryId: 'chinese-rice', name: 'Egg Bhurji Rice', price: 55 },
    { categoryId: 'chinese-rice', name: 'Egg Sezwan Rice', price: 58 },
    { categoryId: 'chinese-rice', name: 'Paneer Pulav', price: 59 },
    { categoryId: 'chinese-rice', name: 'Paneer Fried Rice', price: 60 },
    { categoryId: 'chinese-rice', name: 'Chicken Bhurji Rice', price: 60 },
    { categoryId: 'chinese-rice', name: 'Chicken Fried Rice', price: 63 },
    { categoryId: 'chinese-rice', name: 'Veg Schezwan Rice', price: 63 },
    { categoryId: 'chinese-rice', name: 'Paneer Schezwan Rice', price: 63 },
    { categoryId: 'chinese-rice', name: 'Chicken Pulav', price: 64 },
    { categoryId: 'chinese-rice', name: 'Chicken Schezwan Rice', price: 67 },
    { categoryId: 'chinese-rice', name: 'Veg Manchurian Rice', price: 76 },
    { categoryId: 'chinese-rice', name: 'Veg Triple Rice', price: 76 },
    { categoryId: 'chinese-rice', name: 'Paneer Manchurian Rice', price: 82 },
    { categoryId: 'chinese-rice', name: 'Paneer Triple Rice', price: 82 },
    { categoryId: 'chinese-rice', name: 'Chicken Manchurian Rice', price: 87 },
    { categoryId: 'chinese-rice', name: 'Chicken Triple Rice', price: 87 },

    // ── BIRYANI ───────────────────────────────────────────────────────────────
    { categoryId: 'biryani', name: 'Veg Biryani', price: 63 },
    { categoryId: 'biryani', name: 'Paneer Biryani', price: 63 },
    { categoryId: 'biryani', name: 'Egg Biryani', price: 65 },
    { categoryId: 'biryani', name: 'Chicken Biryani', price: 71 },
    { categoryId: 'biryani', name: 'Paneer Tikka Biryani', price: 71 },
    { categoryId: 'biryani', name: 'Chicken Tikka Biryani', price: 75 },
    { categoryId: 'biryani', name: 'Chicken Biryani', price: 88 }, // Extra item (different price variant)

    // ── VEG GRAVY ─────────────────────────────────────────────────────────────
    { categoryId: 'veg-gravy', name: 'Dal Fry', price: 40 },
    { categoryId: 'veg-gravy', name: 'Dal Tadka', price: 45 },
    { categoryId: 'veg-gravy', name: 'Dal Makhani', price: 55 },
    { categoryId: 'veg-gravy', name: 'Chana Masala', price: 50 },
    { categoryId: 'veg-gravy', name: 'Rajma Masala', price: 55 },
    { categoryId: 'veg-gravy', name: 'Mix Veg', price: 55 },
    { categoryId: 'veg-gravy', name: 'Veg Kolhapuri', price: 60 },
    { categoryId: 'veg-gravy', name: 'Veg Handi', price: 60 },
    { categoryId: 'veg-gravy', name: 'Aloo Jeera', price: 45 },
    { categoryId: 'veg-gravy', name: 'Aloo Gobi', price: 50 },
    { categoryId: 'veg-gravy', name: 'Aloo Matar', price: 50 },
    { categoryId: 'veg-gravy', name: 'Matar Paneer', price: 65 },
    { categoryId: 'veg-gravy', name: 'Paneer Butter Masala', price: 70 },
    { categoryId: 'veg-gravy', name: 'Paneer Masala', price: 65 },
    { categoryId: 'veg-gravy', name: 'Kadai Paneer', price: 70 },
    { categoryId: 'veg-gravy', name: 'Paneer Bhurji', price: 65 },
    { categoryId: 'veg-gravy', name: 'Shahi Paneer', price: 72 },
    { categoryId: 'veg-gravy', name: 'Palak Paneer', price: 70 },
    { categoryId: 'veg-gravy', name: 'Paneer Kolhapuri', price: 72 },
    { categoryId: 'veg-gravy', name: 'Paneer Handi', price: 72 },

    // ── NON-VEG GRAVY ─────────────────────────────────────────────────────────
    { categoryId: 'non-veg-gravy', name: 'Egg Bhurji', price: 42 },
    { categoryId: 'non-veg-gravy', name: 'Egg Masala', price: 47 },
    { categoryId: 'non-veg-gravy', name: 'Chicken Masala', price: 67 },
    { categoryId: 'non-veg-gravy', name: 'Chicken Tikka Masala', price: 67 },
    { categoryId: 'non-veg-gravy', name: 'Chicken Handi', price: 71 },
    { categoryId: 'non-veg-gravy', name: 'Chicken Sukha', price: 71 },
    { categoryId: 'non-veg-gravy', name: 'Chicken Kadai', price: 71 },
    { categoryId: 'non-veg-gravy', name: 'Chicken Manchurian', price: 80 },
    { categoryId: 'non-veg-gravy', name: 'Chicken Kolhapuri', price: 91 },
    { categoryId: 'non-veg-gravy', name: 'Butter Chicken', price: 104 },

    // ── PARATHA ───────────────────────────────────────────────────────────────
    { categoryId: 'paratha-roti', name: 'Plain Paratha', price: 10 },
    { categoryId: 'paratha-roti', name: 'Aloo Paratha', price: 21 },
    { categoryId: 'paratha-roti', name: 'Onion Paratha', price: 21 },
    { categoryId: 'paratha-roti', name: 'Paneer Paratha', price: 29 },
    { categoryId: 'paratha-roti', name: 'Methi Paratha', price: 30 },
    { categoryId: 'paratha-roti', name: 'Onion Cheese Paratha', price: 32 },
    { categoryId: 'paratha-roti', name: 'Aloo Cheese Paratha', price: 32 },
    { categoryId: 'paratha-roti', name: 'Paneer Cheese Paratha', price: 40 },
    { categoryId: 'paratha-roti', name: 'Guddu Paratha', price: 50 },

    // ── SHAWARMA ──────────────────────────────────────────────────────────────
    { categoryId: 'shawrma', name: 'Full Fry', price: 25 },
    { categoryId: 'shawrma', name: 'Chicken Shorma', price: 55 },
    { categoryId: 'shawrma', name: 'Open Sorama', price: 115 },

    // ── SANDWICH ──────────────────────────────────────────────────────────────
    { categoryId: 'sandwich', name: 'Veg Cheese Sandwich', price: 55 },
    { categoryId: 'sandwich', name: 'Egg Cheese Sandwich', price: 60 },
    { categoryId: 'sandwich', name: 'Chicken Cheese Sandwich', price: 66 },
    { categoryId: 'sandwich', name: 'Paneer Cheese Sandwich', price: 66 },

    // ── COLD DRINKS ───────────────────────────────────────────────────────────
    { categoryId: 'cold-drinks', name: 'Charg Campa', price: 20 },
    { categoryId: 'cold-drinks', name: 'Malai Lassi', price: 30 },
    { categoryId: 'cold-drinks', name: 'Mango Lassi', price: 30 },
    { categoryId: 'cold-drinks', name: 'Dahi', price: 32 },
    { categoryId: 'cold-drinks', name: 'Calvin Milkshake', price: 40 },
    { categoryId: 'cold-drinks', name: 'Ocean Fruit Drink', price: 40 },
    { categoryId: 'cold-drinks', name: 'Sprite', price: 40 },
    { categoryId: 'cold-drinks', name: 'Thums Up', price: 40 },
    { categoryId: 'cold-drinks', name: 'Diet Coke', price: 40 },
    { categoryId: 'cold-drinks', name: 'Nescafe Cafe', price: 45 },
    { categoryId: 'cold-drinks', name: 'Pepsi', price: 45 },
    { categoryId: 'cold-drinks', name: 'Predator Energy', price: 60 },
    { categoryId: 'cold-drinks', name: 'One Up', price: 105 },
    { categoryId: 'cold-drinks', name: 'Monster', price: 125 },
];

// ==========================================
// CATEGORY IMAGES (for new product imageURL fallback)
// ==========================================
const CATEGORY_IMAGE_URLS: Record<string, string> = {
    'frankie': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400',
    'chinese-dry': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400',
    'noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400',
    'indian-rice': 'https://images.unsplash.com/photo-1512621820108-769dbac16bc5?w=400',
    'chinese-rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400',
    'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400',
    'veg-gravy': 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=400',
    'non-veg-gravy': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400',
    'paratha-roti': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',
    'shawrma': 'https://images.unsplash.com/photo-1561043433-aaf687c4cf04?w=400',
    'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400',
    'cold-drinks': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400',
};

const CATEGORY_NAMES: Record<string, string> = {
    'frankie': 'Frankie',
    'chinese-dry': 'Chinese Dry Item',
    'noodles': 'Noodles',
    'indian-rice': 'Indian Rice',
    'chinese-rice': 'Chinese Rice',
    'biryani': 'Biryani',
    'veg-gravy': 'Veg Gravy',
    'non-veg-gravy': 'Non Veg Gravy',
    'paratha-roti': 'Paratha / Roti',
    'shawrma': 'Shawrma',
    'sandwich': 'Sandwich',
    'cold-drinks': 'Cold Drinks',
};

// ==========================================
// MAIN SCRIPT
// ==========================================

async function addMissingProducts() {
    console.log('🔍 Fetching existing products from Firestore...');

    const existingSnap = await db.collection('products').get();

    // Build a set of existing product keys: "categoryId::name(lowercase)"
    // Also build a set of just name(lowercase) for cross-category name dedup check
    const existingKeys = new Set<string>();
    const existingByName = new Map<string, { name: string; price: number; categoryId: string }>();

    existingSnap.forEach(doc => {
        const data = doc.data();
        const key = `${data.categoryId}::${(data.name as string).toLowerCase().trim()}`;
        existingKeys.add(key);
        existingByName.set((data.name as string).toLowerCase().trim(), {
            name: data.name,
            price: data.price,
            categoryId: data.categoryId,
        });
    });

    console.log(`📦 Found ${existingSnap.size} existing products.`);

    // Filter to only the products that are truly missing
    // A product is "missing" if it doesn't exist in the same category with the same name
    // For "Chicken Biryani" at ₹88 (extra item) — add if price differs
    const toAdd: typeof PRODUCTS_TO_ADD = [];
    const skipped: string[] = [];

    for (const prod of PRODUCTS_TO_ADD) {
        const key = `${prod.categoryId}::${prod.name.toLowerCase().trim()}`;

        if (existingKeys.has(key)) {
            // Already exists in same category with same name — skip
            skipped.push(`[SKIP] ${prod.categoryId} / "${prod.name}" (already exists)`);
        } else {
            toAdd.push(prod);
        }
    }

    console.log(`\n⏭  Skipping ${skipped.length} already-existing products.`);
    skipped.forEach(s => console.log('  ' + s));

    if (toAdd.length === 0) {
        console.log('\n✅ All products already exist! Nothing to add.');
        return;
    }

    console.log(`\n➕ Adding ${toAdd.length} new products...`);

    // Batch write new products
    let batch = db.batch();
    let count = 0;
    const batchPromises: Promise<FirebaseFirestore.WriteResult[]>[] = [];
    const addedProducts: { name: string; categoryId: string; price: number; id: string }[] = [];

    for (const prod of toAdd) {
        const prodRef = db.collection('products').doc();
        batch.set(prodRef, {
            name: prod.name,
            price: prod.price,
            categoryId: prod.categoryId,
            category: CATEGORY_NAMES[prod.categoryId] ?? prod.categoryId,
            imageURL: CATEGORY_IMAGE_URLS[prod.categoryId] ?? '',
            isAvailable: true,
            createdAt: new Date(),
        });

        addedProducts.push({ name: prod.name, categoryId: prod.categoryId, price: prod.price, id: prodRef.id });
        count++;

        if (count === 400) {
            batchPromises.push(batch.commit());
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) {
        batchPromises.push(batch.commit());
    }

    await Promise.all(batchPromises);

    console.log('\n✅ Successfully added new products!\n');
    console.log('── ADDED PRODUCTS ──────────────────────────────────────────────────────────');
    addedProducts.forEach(p => {
        const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        console.log(`  ${p.name} (₹${p.price}) → https://aromadhaba.com/product/${slug}`);
    });
    console.log('────────────────────────────────────────────────────────────────────────────');
    console.log(`\nTotal added: ${addedProducts.length}`);

    process.exit(0);
}

addMissingProducts().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
