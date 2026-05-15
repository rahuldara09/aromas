import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
    initializeApp({ credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }) });
}
const db = getFirestore();
const shouldDelete = process.argv.includes('--delete');

async function main() {
    const snap = await db.collection('products').get();
    const testDocs = snap.docs.filter(d => {
        const n = (d.data().name ?? '').toLowerCase().trim();
        const price: number = d.data().price ?? 99;
        return n.includes('test') || n.includes('demo') || n.includes('sample') || n.startsWith('test_') || price < 5;
    });

    console.log(`Scanned ${snap.size} products. Found ${testDocs.length} test items:\n`);
    testDocs.forEach(d => {
        const data = d.data();
        console.log(`  [${d.id}] "${data.name}" price=₹${data.price} isOnlineItem=${data.isOnlineItem} categoryId=${data.categoryId}`);
    });

    if (shouldDelete && testDocs.length > 0) {
        const batch = db.batch();
        testDocs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        console.log(`\n✓ Deleted ${testDocs.length} test products.`);
    } else if (!shouldDelete) {
        console.log('\nDry-run. Pass --delete to remove.');
    }
}

main().catch(err => { console.error(err); process.exit(1); });
