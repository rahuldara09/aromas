import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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
const auth = getAuth();

async function makeLatestUserVendor() {
    try {
        const listUsersResult = await auth.listUsers(1, undefined);
        const latestUser = listUsersResult.users[0];

        if (!latestUser) {
            console.log('No users found in Firebase Auth.');
            return;
        }

        console.log(`Setting up vendor access for user: ${latestUser.phoneNumber || latestUser.uid}`);

        await db.collection('vendors').doc(latestUser.uid).set({
            isActive: true,
            createdAt: new Date(),
            phoneNumber: latestUser.phoneNumber || 'unknown',
            role: 'vendor'
        });

        console.log('✅ Vendor document created successfully!');
    } catch (error) {
        console.error('Error:', error);
    }
}

makeLatestUserVendor();
