
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

const productImages: Record<string, string> = {
    // Chinese
    'Veg Fried Rice':
        'https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=1200',

    'Chicken Fried Rice':
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?q=80&w=1200',

    'Chicken Schezwan Noodle':
        'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?q=80&w=1200',

    'Veg Noodles':
        'https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=1200',

    'Chicken Noodles':
        'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=1200',

    'Veg Manchurian':
        'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=1200',

    'Chicken Manchurian':
        'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=1200',

    // Indian Rice
    Biryani:
        'https://images.unsplash.com/photo-1563379091339-03246963d29c?q=80&w=1200',

    'Chicken Biryani':
        'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?q=80&w=1200',

    'Veg Biryani':
        'https://images.unsplash.com/photo-1642821373181-696a54913e93?q=80&w=1200',

    // North Indian
    'Butter Chicken':
        'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?q=80&w=1200',

    'Paneer Butter Masala':
        'https://images.unsplash.com/photo-1631452180539-96aca7d48617?q=80&w=1200',

    'Paneer Tikka':
        'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?q=80&w=1200',

    'Paneer Kadai':
        'https://images.unsplash.com/photo-1701579231305-d84d8af9a3fd?q=80&w=1200',

    // Paratha / Roti
    'Aloo Paratha':
        'https://images.unsplash.com/photo-1675242419542-5d2f6714a5f3?q=80&w=1200',

    'Butter Paratha':
        'https://images.unsplash.com/photo-1626074353765-517a681e40be?q=80&w=1200',

    // Shawarma / Rolls
    Shawarma:
        'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?q=80&w=1200',

    Frankie:
        'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200',

    // Sandwich
    Sandwich:
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=1200',

    // Snacks
    Chaat:
        'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=1200',

    // Drinks
    'Cold Drinks':
        'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?q=80&w=1200',

    // Pizza
    Pizza:
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1200',

    default:
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1200',
};

function getDescription(name: string, category: string) {
    const lower = name.toLowerCase();

    if (lower.includes('biryani')) {
        return `${name} cooked with aromatic rice, rich spices, and authentic Aroma Dhaba flavours.`;
    }

    if (lower.includes('noodle')) {
        return `${name} tossed in spicy sauces with fresh vegetables and house seasoning.`;
    }

    if (lower.includes('fried rice')) {
        return `${name} prepared fresh with flavourful rice, sauces, and signature spices.`;
    }

    if (lower.includes('shawarma')) {
        return `${name} loaded with juicy filling, sauces, and wrapped fresh to order.`;
    }

    if (lower.includes('paratha')) {
        return `${name} cooked fresh with buttery layers and traditional Indian flavours.`;
    }

    if (lower.includes('paneer')) {
        return `${name} made with soft paneer and rich North Indian spices.`;
    }

    if (lower.includes('sandwich')) {
        return `${name} grilled fresh with delicious stuffing and signature sauces.`;
    }

    return `${name} freshly prepared at Aroma Dhaba.`;
}

function getIngredients(name: string) {
    const lower = name.toLowerCase();

    if (lower.includes('fried rice')) {
        return ['Rice', 'Vegetables', 'Soy sauce', 'Indian spices'];
    }

    if (lower.includes('noodle')) {
        return ['Noodles', 'Vegetables', 'Sauces', 'Seasoning'];
    }

    if (lower.includes('shawarma')) {
        return ['Wrap', 'Chicken', 'Sauce', 'Vegetables'];
    }

    if (lower.includes('paneer')) {
        return ['Paneer', 'Butter', 'Tomato gravy', 'Indian spices'];
    }

    if (lower.includes('paratha')) {
        return ['Wheat flour', 'Butter', 'Stuffing', 'Indian spices'];
    }

    if (lower.includes('biryani')) {
        return ['Basmati rice', 'Spices', 'Herbs', 'Marinated ingredients'];
    }

    return ['Fresh ingredients', 'Indian spices', 'House special seasoning'];
}

function getImage(productName: string, categoryId: string) {
    if (productImages[productName]) {
        return productImages[productName];
    }

    const lowerCategory = categoryId?.toLowerCase() || '';

    if (lowerCategory.includes('chinese')) {
        return 'https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=1200';
    }

    if (lowerCategory.includes('biryani')) {
        return 'https://images.unsplash.com/photo-1563379091339-03246963d29c?q=80&w=1200';
    }

    if (lowerCategory.includes('shawarma')) {
        return 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?q=80&w=1200';
    }

    if (lowerCategory.includes('sandwich')) {
        return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=1200';
    }

    if (lowerCategory.includes('pizza')) {
        return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1200';
    }

    return productImages.default;
}

async function enrichProducts() {
    const snapshot = await db.collection('products').get();

    for (const doc of snapshot.docs) {
        const data = doc.data();

        const name = data.name || 'Unnamed Product';
        const categoryId = data.categoryId || 'others';

        const imageURL = getImage(name, categoryId);
        const description = getDescription(name, categoryId);
        const ingredients = getIngredients(name);

        await doc.ref.update({
            imageURL,
            description,
            ingredients,
        });

        console.log(`Updated: ${name} `);
    }

    console.log('All products enriched successfully.');
}

enrichProducts();
