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
// DATA DEFINITIONS
// ==========================================

const CATEGORIES = [
    { id: 'sandwich', name: 'Sandwich', imageURL: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400', productCount: 4 },
    { id: 'cold-drinks', name: 'Cold Drinks', imageURL: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400', productCount: 9 },
    { id: 'chaat', name: 'Chaat', imageURL: 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=400', productCount: 2 },
    { id: 'shawrma', name: 'Shawrma', imageURL: 'https://images.unsplash.com/photo-1561043433-aaf687c4cf04?w=400', productCount: 4 },
    { id: 'frankie', name: 'Frankie', imageURL: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400', productCount: 5 },
    { id: 'noodles', name: 'Noodles', imageURL: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400', productCount: 5 },
    { id: 'chinese-dry', name: 'Chinese Dry Item', imageURL: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400', productCount: 5 },
    { id: 'non-veg-gravy', name: 'Non Veg Gravy', imageURL: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400', productCount: 5 },
    { id: 'veg-gravy', name: 'Veg Gravy', imageURL: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=400', productCount: 8 },
    { id: 'biryani', name: 'Biryani', imageURL: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400', productCount: 5 },
    { id: 'indian-rice', name: 'Indian Rice', imageURL: 'https://images.unsplash.com/photo-1512621820108-769dbac16bc5?w=400', productCount: 5 },
    { id: 'chinese-rice', name: 'Chinese Rice', imageURL: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400', productCount: 5 },
    { id: 'paratha-roti', name: 'Paratha / Roti', imageURL: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400', productCount: 4 },
];

const PRODUCTS = [
    // 1. Sandwich
    { categoryId: 'sandwich', name: 'Veg Cheese Sandwich', price: 55 },
    { categoryId: 'sandwich', name: 'Egg Cheese Sandwich', price: 60 },
    { categoryId: 'sandwich', name: 'Paneer Cheese Sandwich', price: 66 },
    { categoryId: 'sandwich', name: 'Chicken Cheese Sandwich', price: 66 },

    // 2. Cold Drinks
    { categoryId: 'cold-drinks', name: 'Mango Lassi', price: 30 },
    { categoryId: 'cold-drinks', name: 'Malai Lassi', price: 30 },
    { categoryId: 'cold-drinks', name: 'Dahi', price: 32 },
    { categoryId: 'cold-drinks', name: 'Ocean Fruit Drink', price: 40 },
    { categoryId: 'cold-drinks', name: 'Calvin Milkshake', price: 40 },
    { categoryId: 'cold-drinks', name: 'Sprite', price: 40 },
    { categoryId: 'cold-drinks', name: 'Charg Campa', price: 20 },
    { categoryId: 'cold-drinks', name: 'Monster', price: 125 },
    { categoryId: 'cold-drinks', name: 'Predator Energy', price: 60 },

    // 3. Chaat
    { categoryId: 'chaat', name: 'Lays Chat', price: 32 },
    { categoryId: 'chaat', name: 'Kurkure Chat', price: 32 },

    // 4. Shawrma
    { categoryId: 'shawrma', name: 'Chicken Shawarma', price: 55 },
    { categoryId: 'shawrma', name: 'Brown Bread Shawarma Chicken', price: 60 },
    { categoryId: 'shawrma', name: 'Open Shawarma', price: 115 },
    { categoryId: 'shawrma', name: 'Full Fry', price: 25 },

    // 5. Frankie
    { categoryId: 'frankie', name: 'Veg Frankie', price: 30 },
    { categoryId: 'frankie', name: 'Paneer Frankie', price: 31 },
    { categoryId: 'frankie', name: 'Veg Cheese Frankie', price: 33 },
    { categoryId: 'frankie', name: 'Chicken Frankie', price: 33 },
    { categoryId: 'frankie', name: 'Veg Tadka Frankie', price: 33 },

    // 6. Noodles
    { categoryId: 'noodles', name: 'Veg Noodles', price: 50 },
    { categoryId: 'noodles', name: 'Egg Hakka Noodles', price: 55 },
    { categoryId: 'noodles', name: 'Veg Schezwan Noodles', price: 55 },
    { categoryId: 'noodles', name: 'Paneer Hakka Noodles', price: 55 },
    { categoryId: 'noodles', name: 'Chicken Noodles', price: 57 },

    // 7. Chinese Dry Item
    { categoryId: 'chinese-dry', name: 'Veg Fry Momos', price: 60 },
    { categoryId: 'chinese-dry', name: 'Veg Manchurian Dry', price: 63 },
    { categoryId: 'chinese-dry', name: 'Chicken Fry Momos', price: 70 },
    { categoryId: 'chinese-dry', name: 'Chicken Chilly', price: 71 },
    { categoryId: 'chinese-dry', name: 'Chicken 65 Dry', price: 71 },

    // 8. Non-Veg Gravy
    { categoryId: 'non-veg-gravy', name: 'Egg Bhurji', price: 42 },
    { categoryId: 'non-veg-gravy', name: 'Egg Masala', price: 47 },
    { categoryId: 'non-veg-gravy', name: 'Chicken Tikka Masala', price: 67 },
    { categoryId: 'non-veg-gravy', name: 'Chicken Masala', price: 67 },
    { categoryId: 'non-veg-gravy', name: 'Chicken Kadai', price: 71 },

    // 9. Veg Gravy
    { categoryId: 'veg-gravy', name: 'Aloo Mutter', price: 50 },
    { categoryId: 'veg-gravy', name: 'Veg Kadai', price: 55 },
    { categoryId: 'veg-gravy', name: 'Veg Kolhapuri', price: 55 },
    { categoryId: 'veg-gravy', name: 'Bhindi Fry', price: 45 },
    { categoryId: 'veg-gravy', name: 'Aloo Jeera', price: 45 },
    { categoryId: 'veg-gravy', name: 'Sev Tamatar', price: 50 },
    { categoryId: 'veg-gravy', name: 'Bhindi Masala', price: 50 },
    { categoryId: 'veg-gravy', name: 'Sev Masala', price: 55 },

    // 10. Biryani
    { categoryId: 'biryani', name: 'Boiled Bhurji', price: 45 },
    { categoryId: 'biryani', name: 'Dal Khichdi Tadka', price: 55 },
    { categoryId: 'biryani', name: 'Paneer Biryani', price: 63 },
    { categoryId: 'biryani', name: 'Veg Biryani', price: 63 },
    { categoryId: 'biryani', name: 'Egg Biryani', price: 65 },

    // 11. Indian Rice
    { categoryId: 'indian-rice', name: 'Plain Rice', price: 38 },
    { categoryId: 'indian-rice', name: 'Jeera Rice', price: 47 },
    { categoryId: 'indian-rice', name: 'Bhedi Rice', price: 49 },
    { categoryId: 'indian-rice', name: 'Veg Pulav', price: 55 },
    { categoryId: 'indian-rice', name: 'Egg Bhurji Rice', price: 55 },

    // 12. Chinese Rice
    { categoryId: 'chinese-rice', name: 'Schezwan Chutney', price: 10 },
    { categoryId: 'chinese-rice', name: 'Plain Rice', price: 38 },
    { categoryId: 'chinese-rice', name: 'Jeera Rice', price: 47 },
    { categoryId: 'chinese-rice', name: 'Bhedi Rice', price: 49 },
    { categoryId: 'chinese-rice', name: 'Veg Fried Rice', price: 54 },

    // 13. Paratha / Roti
    { categoryId: 'paratha-roti', name: 'Plain Paratha', price: 10 },
    { categoryId: 'paratha-roti', name: 'Aloo Paratha', price: 21 },
    { categoryId: 'paratha-roti', name: 'Onion Paratha', price: 21 },
    { categoryId: 'paratha-roti', name: 'Paneer Paratha', price: 29 }
];


async function clearCollection(collectionName: string) {
    const collRef = db.collection(collectionName);
    const snapshot = await collRef.get();

    if (snapshot.size === 0) {
        return;
    }

    console.log(`Clearing ${snapshot.size} documents from collection: ${collectionName}`);
    const batchList = [];
    let batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
        if (count === 400) {
            batchList.push(batch.commit());
            batch = db.batch();
            count = 0;
        }
    });

    if (count > 0) {
        batchList.push(batch.commit());
    }

    await Promise.all(batchList);
}

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...');

        // 1. Clear existing generic data
        console.log('Cleaning existing products and categories...');
        await clearCollection('products');
        await clearCollection('categories');

        // 2. Upload Categories
        console.log(`Uploading ${CATEGORIES.length} categories...`);
        let batch = db.batch();

        CATEGORIES.forEach(cat => {
            const catRef = db.collection('categories').doc(cat.id);
            batch.set(catRef, {
                name: cat.name,
                imageURL: cat.imageURL,
                productCount: cat.productCount,
                order: CATEGORIES.indexOf(cat) // Keep original order
            });
        });
        await batch.commit();

        // 3. Upload Products
        console.log(`Uploading ${PRODUCTS.length} products...`);
        let productBatch = db.batch();
        let pCount = 0;
        let batchPromises = [];

        PRODUCTS.forEach(prod => {
            // Find category image for fallback or mapping purposes
            const matchedCategory = CATEGORIES.find(c => c.id === prod.categoryId);

            const prodRef = db.collection('products').doc();
            productBatch.set(prodRef, {
                name: prod.name,
                price: prod.price,
                categoryId: prod.categoryId,
                category: matchedCategory ? matchedCategory.name : 'Unknown', // Stored for vendor UI ease
                imageURL: matchedCategory ? matchedCategory.imageURL : '',
                isAvailable: true,
                createdAt: new Date()
            });

            pCount++;
            if (pCount === 400) {
                batchPromises.push(productBatch.commit());
                productBatch = db.batch();
                pCount = 0;
            }
        });

        if (pCount > 0) {
            batchPromises.push(productBatch.commit());
        }

        await Promise.all(batchPromises);

        console.log('✅ Database seeded successfully!');
        console.log(`Inserted ${CATEGORIES.length} Categories and ${PRODUCTS.length} Products.`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
