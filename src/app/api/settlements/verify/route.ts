import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

async function verifyVendor(req: NextRequest): Promise<{ uid: string } | NextResponse> {
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
        tokenEmail = decoded.email ?? (decoded['vendorEmail'] as string | undefined);
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
        const ne = tokenEmail.toLowerCase().trim();
        keysToTry.push(ne, `email_${ne}`);
    }
    for (const key of keysToTry) {
        const snap = await adminDb.collection('vendors').doc(key).get();
        if (snap.exists && isVendorDoc(snap.data())) return { uid };
    }
    if (tokenEmail) {
        const vs = await adminDb.collection('vendors')
            .where('email', '==', tokenEmail.toLowerCase().trim())
            .where('isVendor', '==', true).limit(1).get();
        if (!vs.empty) return { uid };
    }
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
}

/**
 * POST /api/settlements/verify
 * Admin approves or rejects a settlement payment.
 * Body: { settlementDate: 'YYYY-MM-DD', action: 'approve' | 'reject', reason?: string }
 */
export async function POST(req: NextRequest) {
    const auth = await verifyVendor(req);
    if (auth instanceof NextResponse) return auth;

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    const { settlementDate, action, reason } = body;
    if (!settlementDate || typeof settlementDate !== 'string') {
        return NextResponse.json({ error: 'settlementDate is required.' }, { status: 422 });
    }
    if (action !== 'approve' && action !== 'reject') {
        return NextResponse.json({ error: 'action must be "approve" or "reject".' }, { status: 422 });
    }

    const settlementRef = adminDb.collection('vendor_daily_settlements').doc(settlementDate as string);
    const snap = await settlementRef.get();
    if (!snap.exists) {
        return NextResponse.json({ error: 'Settlement not found.' }, { status: 404 });
    }

    const data = snap.data()!;
    if (data.status === 'paid') {
        return NextResponse.json({ error: 'Settlement already verified.' }, { status: 409 });
    }

    const settingsRef = adminDb.collection('settings').doc('storeSettings');

    if (action === 'approve') {
        await settlementRef.update({
            status: 'paid',
            verified_at: FieldValue.serverTimestamp(),
            verified_by: auth.uid,
            updated_at: FieldValue.serverTimestamp(),
        });
        // Unlock online ordering
        await settingsRef.set({ settlementLocked: false }, { merge: true });
        return NextResponse.json({ success: true, message: 'Settlement approved. Online orders unlocked.' });
    }

    // reject
    await settlementRef.update({
        status: 'rejected',
        rejection_reason: typeof reason === 'string' ? reason.trim() : 'Payment rejected by admin.',
        verified_at: FieldValue.serverTimestamp(),
        verified_by: auth.uid,
        updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, message: 'Settlement rejected.' });
}
