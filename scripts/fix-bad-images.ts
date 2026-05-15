import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

// ======================================================================
// CORRECTED IMAGE MAP
// These replace bad/portrait Unsplash IDs with verified food photos.
// Only products with wrong/broken images are listed here.
// ======================================================================
const CORRECTED_IMAGES: Record<string, string> = {
    // ── VEG GRAVY ──────────────────────────────────────────────────────────
    // Was: portrait photo (photo-1631452180519-c014fe946bc7)
    'shahi paneer': 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=80',
    'veg kolhapuri': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80',
    'matar paneer': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
    'paneer kolhapuri': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80',

    // Was: portrait photo (photo-1619895862022-09114b41f16f)
    'veg handi': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
    'paneer handi': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=80',

    // Was: broken image (photo-1512621820108-769dbac16bc5 / photo not loading)
    'mix veg': 'https://images.unsplash.com/photo-1574653853027-5382a3d23a15?w=800&q=80',
    'bhindi fry': 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=800&q=80',
    'bhindi masala': 'https://images.unsplash.com/photo-1605926637512-c8b131444a4b?w=800&q=80',
    'aloo jeera': 'https://images.unsplash.com/photo-1626200926740-b04213ef1892?w=800&q=80',
    'chana masala': 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=800&q=80',

    // ── NON-VEG GRAVY ──────────────────────────────────────────────────────
    // Was: portrait photo (photo-1619895862022-09114b41f16f)
    'chicken handi': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80',

    // ── PARATHA ────────────────────────────────────────────────────────────
    // Was: portrait photo (photo-1631452180519-c014fe946bc7)
    'paneer paratha': 'https://images.unsplash.com/photo-1574515944794-d6dedc7150de?w=800&q=80',
    'paneer cheese paratha': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=80',

    // ── RICE ───────────────────────────────────────────────────────────────
    // Was: portrait photo (photo-1631452180519-c014fe946bc7)
    'paneer fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
    'paneer schezwan rice': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    'paneer manchurian rice': 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=80',

    // ── CHINESE DRY ────────────────────────────────────────────────────────
    // Was: portrait photo (photo-1631452180519-c014fe946bc7)
    'paneer chilly dry': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800&q=80',
};

async function fixBadImages() {
    console.log('🔍 Scanning Firestore for products with bad images...\n');
    const snap = await db.collection('products').get();

    const toFix: { id: string; name: string; oldURL: string; newURL: string }[] = [];

    snap.forEach(docSnap => {
        const data = docSnap.data();
        const nameLower = (data.name as string).toLowerCase().trim();
        const newURL = CORRECTED_IMAGES[nameLower];

        // Only fix if we have a correction AND it's actually different
        if (newURL && newURL !== data.imageURL) {
            toFix.push({
                id: docSnap.id,
                name: data.name,
                oldURL: data.imageURL ?? '',
                newURL,
            });
        }
    });

    if (toFix.length === 0) {
        console.log('✅ No bad images found — nothing to fix!');
        process.exit(0);
    }

    console.log(`🔧 Fixing ${toFix.length} products:\n`);

    let batch = db.batch();
    let count = 0;
    const batchPromises: Promise<FirebaseFirestore.WriteResult[]>[] = [];

    for (const item of toFix) {
        const ref = db.collection('products').doc(item.id);
        batch.update(ref, { imageURL: item.newURL });
        count++;

        console.log(`  ✓ ${item.name}`);
        console.log(`    OLD: ${item.oldURL}`);
        console.log(`    NEW: ${item.newURL}\n`);

        if (count === 400) {
            batchPromises.push(batch.commit());
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) batchPromises.push(batch.commit());
    await Promise.all(batchPromises);

    console.log(`\n✅ Fixed ${toFix.length} products with corrected images!`);
    process.exit(0);
}

fixBadImages().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
