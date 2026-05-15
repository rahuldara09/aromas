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
 * POST /api/orders/settle
 * Marks an order's per-order platform fee (₹2) as paid.
 * Body: { orderId: string; transaction_id: string }
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

    const { orderId, transaction_id } = body;
    if (!orderId || typeof orderId !== 'string') {
        return NextResponse.json({ error: 'orderId is required.' }, { status: 422 });
    }
    if (!transaction_id || typeof transaction_id !== 'string' || transaction_id.trim().length < 4) {
        return NextResponse.json({ error: 'Transaction ID / UTR is required (min 4 chars).' }, { status: 422 });
    }

    const utr = transaction_id.trim().toUpperCase();
    const orderRef = adminDb.collection('orders').doc(orderId);
    const snap = await orderRef.get();

    if (!snap.exists) {
        return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const data = snap.data()!;
    if (data.settlement_status === 'paid') {
        return NextResponse.json({ success: true, message: 'Already settled.' });
    }

    await orderRef.update({
        settlement_status: 'paid',
        settlement_utr: utr,
        settlement_paid_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
}
