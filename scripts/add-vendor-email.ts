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

async function addVendorEmail(email: string) {
    try {
        console.log(`Adding vendor email: ${email}`);

        // Check if vendor already exists
        const existingVendor = await db.collection('vendors')
            .where('email', '==', email)
            .where('isVendor', '==', true)
            .limit(1)
            .get();

        if (!existingVendor.empty) {
            console.log('❌ Vendor email already exists!');
            return;
        }

        // Add new vendor
        await db.collection('vendors').add({
            email: email,
            isVendor: true,
            isActive: true,
            createdAt: new Date(),
            role: 'vendor'
        });

        console.log('✅ Vendor email added successfully!');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Add the specific email
addVendorEmail('vshltheng@gmail.com');