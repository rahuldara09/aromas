import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * /api/settings — Vendor-only store settings mutations
 *
 * Bypasses Firestore `allow write: if false` on the `settings` collection
 * by using the Admin SDK. Token + phone verification matches /api/products.
 *
 * PUT { isOpen: boolean } — toggle store open/closed state
 */

async function verifyVendor(req: NextRequest): Promise<string | NextResponse> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let uid: string;
    let tokenPhone: string | undefined;
    try {
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
        uid = decoded.uid;
        tokenPhone = decoded.phone_number;
    } catch {
        return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    const clientPhone = req.headers.get('x-vendor-phone') ?? undefined;
    const phone = tokenPhone ?? clientPhone;

    function isVendorDoc(data: FirebaseFirestore.DocumentData | undefined) {
        if (!data) return false;
        return data.isVendor === true || data.role === 'vendor' || data.isActive === true;
    }

    const keysToTry: string[] = [uid];
    if (phone) {
        const raw = phone.trim();
        keysToTry.push(raw);
        if (raw.startsWith('+91') && raw.length === 13) keysToTry.push(raw.slice(3));
        else if (/^\d{10}$/.test(raw)) keysToTry.push(`+91${raw}`);
        if (raw.startsWith('+') && !keysToTry.includes(raw.slice(1))) keysToTry.push(raw.slice(1));
    }

    for (const key of keysToTry) {
        const snap = await adminDb.collection('vendors').doc(key).get();
        if (snap.exists && isVendorDoc(snap.data())) return uid;
    }

    return NextResponse.json({ error: 'Forbidden. Vendor role required.' }, { status: 403 });
}

export async function PUT(req: NextRequest) {
    const auth = await verifyVendor(req);
    if (auth instanceof NextResponse) return auth;

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    const { isOpen } = body;
    if (typeof isOpen !== 'boolean') {
        return NextResponse.json({ error: 'isOpen (boolean) is required.' }, { status: 422 });
    }

    try {
        await adminDb.collection('settings').doc('storeSettings').set(
            { isOpen, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
        );
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[API/settings PUT] Firestore write failed:', err);
        return NextResponse.json({ error: 'Failed to update store settings.' }, { status: 500 });
    }
}
