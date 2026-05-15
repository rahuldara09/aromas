/**
 * cleanup-test-products.ts
 *
 * Lists all online products and deletes any that look like test items
 * (names containing "test", "demo", "sample", or price ≤ 5).
 *
 * Run (dry-run first):   npx tsx scripts/cleanup-test-products.ts
 * Run (actually delete): npx tsx scripts/cleanup-test-products.ts --delete
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

const shouldDelete = process.argv.includes('--delete');

async function main() {
    const snap = await db.collection('products').where('isOnlineItem', '==', true).get();
    console.log(`Total online products: ${snap.size}`);

    const testDocs = snap.docs.filter(d => {
        const name: string = (d.data().name ?? '').toLowerCase().trim();
        const price: number = d.data().price ?? 0;
        return (
            name.includes('test') ||
            name.includes('demo') ||
            name.includes('sample') ||
            name.startsWith('test_') ||
            price <= 5
        );
    });

    if (testDocs.length === 0) {
        console.log('No test products found.');
        return;
    }

    console.log(`\nTest products found (${testDocs.length}):`);
    testDocs.forEach(d => {
        const data = d.data();
        console.log(`  [${d.id}] "${data.name}" — ₹${data.price} — category: ${data.category ?? data.categoryId}`);
    });

    if (!shouldDelete) {
        console.log('\nDry-run. Pass --delete to actually remove them.');
        return;
    }

    const batch = db.batch();
    testDocs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`\n✓ Deleted ${testDocs.length} test products.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
