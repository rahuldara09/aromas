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
    let tokenEmail: string | undefined;
    try {
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
        uid = decoded.uid;
        tokenPhone = decoded.phone_number;
        tokenEmail = decoded.email;
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

    if (tokenEmail) {
        const normalizedEmail = tokenEmail.toLowerCase().trim();
        keysToTry.push(normalizedEmail);
        keysToTry.push(`email_${normalizedEmail}`);
    }

    for (const key of keysToTry) {
        const snap = await adminDb.collection('vendors').doc(key).get();
        if (snap.exists && isVendorDoc(snap.data())) return uid;
    }

    if (tokenEmail) {
        const vendorSnap = await adminDb.collection('vendors')
            .where('email', '==', tokenEmail.toLowerCase().trim())
            .where('isVendor', '==', true)
            .limit(1)
            .get();
        if (!vendorSnap.empty) return uid;
    }

    return NextResponse.json({ error: `Forbidden. Vendor role required. Tried keys: ${keysToTry.join(', ')}` }, { status: 403 });
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

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    if ('isOpen' in body) {
        if (typeof body.isOpen !== 'boolean') {
            return NextResponse.json({ error: 'isOpen must be boolean.' }, { status: 422 });
        }
        updates.isOpen = body.isOpen;
    }

    if ('gstEnabled' in body) {
        if (typeof body.gstEnabled !== 'boolean') {
            return NextResponse.json({ error: 'gstEnabled must be boolean.' }, { status: 422 });
        }
        updates.gstEnabled = body.gstEnabled;
    }

    if ('gstType' in body) {
        if (body.gstType !== 'included' && body.gstType !== 'excluded') {
            return NextResponse.json({ error: 'gstType must be "included" or "excluded".' }, { status: 422 });
        }
        updates.gstType = body.gstType;
    }

    if ('gstPercentage' in body) {
        const pct = Number(body.gstPercentage);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            return NextResponse.json({ error: 'gstPercentage must be 0–100.' }, { status: 422 });
        }
        updates.gstPercentage = pct;
    }

    if (Object.keys(updates).length === 1) {
        return NextResponse.json({ error: 'No valid fields provided.' }, { status: 422 });
    }

    try {
        await adminDb.collection('settings').doc('storeSettings').set(updates, { merge: true });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[API/settings PUT] Firestore write failed:', err);
        return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 });
    }
}
