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

const CATEGORY_RULES = [
    { id: 'chinese', keywords: ['fried rice', 'noodle', 'manchurian', 'schezwan', 'triple'] },
    { id: 'biryani', keywords: ['biryani'] },
    { id: 'chaat', keywords: ['chaat'] },
    { id: 'frankie', keywords: ['franky', 'frankie', 'wrap'] },
    { id: 'shawarma', keywords: ['shawarma'] },
    { id: 'cold-drinks', keywords: ['coke', 'sprite', 'thumbs up', 'drink'] },
    { id: 'paratha-roti', keywords: ['paratha', 'roti', 'naan'] },
    { id: 'south-indian', keywords: ['dosa', 'idli'] },
    { id: 'sandwich', keywords: ['sandwich', 'burger'] },
    { id: 'non-veg-gravy', keywords: ['chicken', 'mutton', 'egg'] },
    { id: 'indian-rice', keywords: ['rice', 'pulao'] },
];

function getCategory(name: string) {
    const lower = name.toLowerCase();

    for (const category of CATEGORY_RULES) {
        if (category.keywords.some((k) => lower.includes(k))) {
            return category.id;
        }
    }

    return 'others';
}

async function generateCategories() {
    const productsSnapshot = await db.collection('products').get();

    const usedCategories = new Set<string>();

    for (const doc of productsSnapshot.docs) {
        const data = doc.data();

        const categoryId = getCategory(data.name || '');

        usedCategories.add(categoryId);

        await doc.ref.update({
            categoryId,
        });
    }

    for (const categoryId of usedCategories) {
        await db.collection('categories').doc(categoryId).set({
            name: categoryId
                .split('-')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' '),

            imageURL:
                'https://images.unsplash.com/photo-1504674900247-0877df9cc836',
        });

        console.log(`Created category: ${categoryId}`);
    }

    console.log('Done.');
}

generateCategories();