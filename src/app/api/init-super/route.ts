import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

/**
 * /api/init-super — One-time script to initialize the Vendor Super Admin.
 * 
 * Phone: 9001565305
 * Password: dara@123
 * Pseudo-Email: 9001565305@super.aromadhaba.com
 */

export async function GET(req: NextRequest) {
    const SUPER_PHONE = '9001565305';
    const SUPER_PASS = 'dara@123';
    const SUPER_EMAIL = `${SUPER_PHONE}@super.aromadhaba.com`;

    try {
        // 1. Create or update user in Firebase Auth
        let uid;
        try {
            const userRecord = await adminAuth.getUserByEmail(SUPER_EMAIL);
            uid = userRecord.uid;
            // Update password just in case
            await adminAuth.updateUser(uid, {
                password: SUPER_PASS,
                displayName: 'Super Admin',
            });
            console.log('[init-super] Updated existing super user in Auth:', uid);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                const userRecord = await adminAuth.createUser({
                    email: SUPER_EMAIL,
                    password: SUPER_PASS,
                    displayName: 'Super Admin',
                    emailVerified: true,
                });
                uid = userRecord.uid;
                console.log('[init-super] Created new super user in Auth:', uid);
            } else {
                throw error;
            }
        }

        // 2. Create vendor document in Firestore
        // We use the full phone number as the document ID for the vendor check
        const formattedPhone = `+91${SUPER_PHONE}`;
        await adminDb.collection('vendors').doc(formattedPhone).set({
            isVendor: true,
            role: 'superadmin',
            createdAt: new Date(),
            uid: uid
        }, { merge: true });

        console.log('[init-super] Updated Firestore vendor doc:', formattedPhone);

        return NextResponse.json({
            success: true,
            message: 'Super admin initialized successfully.',
            email: SUPER_EMAIL,
            firestoreDoc: formattedPhone
        });
    } catch (err: any) {
        console.error('[init-super] Failed:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
