import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { getTodayIST, getSettlementPeriod, formatSettlementPeriod } from '@/lib/settlement';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import QRCode from 'qrcode';

// ─── Vendor auth (same pattern as /api/products) ─────────────────────────────

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
        keysToTry.push(ne);
        keysToTry.push(`email_${ne}`);
    }

    for (const key of keysToTry) {
        const snap = await adminDb.collection('vendors').doc(key).get();
        if (snap.exists && isVendorDoc(snap.data())) return { uid };
    }

    if (tokenEmail) {
        const vendorSnap = await adminDb.collection('vendors')
            .where('email', '==', tokenEmail.toLowerCase().trim())
            .where('isVendor', '==', true)
            .limit(1).get();
        if (!vendorSnap.empty) return { uid };
    }

    return NextResponse.json({ error: 'Forbidden. Vendor role required.' }, { status: 403 });
}

// ─── GET — Fetch today's settlement + generate UPI QR ────────────────────────

export async function GET(req: NextRequest) {
    const auth = await verifyVendor(req);
    if (auth instanceof NextResponse) return auth;

    const today = getTodayIST();
    const snap = await adminDb.collection('vendor_daily_settlements').doc(today).get();

    if (!snap.exists) {
        return NextResponse.json({ settlement: null });
    }

    const data = snap.data()!;
    const settlement = {
        id: snap.id,
        ...data,
        period_start: (data.period_start as Timestamp)?.toDate?.()?.toISOString(),
        period_end: (data.period_end as Timestamp)?.toDate?.()?.toISOString(),
        paid_at: (data.paid_at as Timestamp)?.toDate?.()?.toISOString(),
        verified_at: (data.verified_at as Timestamp)?.toDate?.()?.toISOString(),
        created_at: (data.created_at as Timestamp)?.toDate?.()?.toISOString(),
        updated_at: (data.updated_at as Timestamp)?.toDate?.()?.toISOString(),
    };

    // Generate UPI deeplink and QR code
    const upiId = process.env.VENDOR_UPI_ID ?? '';
    const payeeName = process.env.VENDOR_UPI_NAME ?? 'Aroma Dhaba';
    const amount = data.payable_amount ?? 0;
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Daily Settlement ${today}`)}`;

    let qrDataUrl = '';
    if (amount > 0 && upiId) {
        try {
            qrDataUrl = await QRCode.toDataURL(upiLink, {
                width: 240,
                margin: 2,
                color: { dark: '#111827', light: '#FFFFFF' },
            });
        } catch {
            // QR generation failure is non-fatal
        }
    }

    const { start, end } = getSettlementPeriod(today);
    const periodLabel = formatSettlementPeriod(start, end);

    return NextResponse.json({ settlement, upiLink, qrDataUrl, upiId, periodLabel });
}

// ─── POST — Submit payment proof → auto-unlock immediately ───────────────────

export async function POST(req: NextRequest) {
    const auth = await verifyVendor(req);
    if (auth instanceof NextResponse) return auth;

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    const { transaction_id, screenshot_url } = body;
    if (!transaction_id || typeof transaction_id !== 'string' || transaction_id.trim().length < 4) {
        return NextResponse.json({ error: 'Transaction ID / UTR is required (min 4 chars).' }, { status: 422 });
    }

    const utr = transaction_id.trim().toUpperCase();
    const today = getTodayIST();
    const settlementRef = adminDb.collection('vendor_daily_settlements').doc(today);

    const snap = await settlementRef.get();
    if (!snap.exists) {
        return NextResponse.json({ error: 'No settlement found for today.' }, { status: 404 });
    }

    const data = snap.data()!;
    if (data.status === 'paid') {
        return NextResponse.json({ error: 'Settlement already paid.' }, { status: 409 });
    }

    // Check for duplicate UTR across all settlements
    const dupSnap = await adminDb.collection('vendor_daily_settlements')
        .where('transaction_id', '==', utr)
        .limit(1).get();
    if (!dupSnap.empty && dupSnap.docs[0].id !== today) {
        return NextResponse.json({ error: 'This Transaction ID has already been used.' }, { status: 409 });
    }

    // Mark as paid immediately and unlock online orders
    await settlementRef.update({
        transaction_id: utr,
        screenshot_url: typeof screenshot_url === 'string' ? screenshot_url.trim() : null,
        status: 'paid',
        paid_at: FieldValue.serverTimestamp(),
        verified_at: FieldValue.serverTimestamp(),
        verified_by: 'self',
        updated_at: FieldValue.serverTimestamp(),
    });

    // Unlock online ordering right away
    await adminDb.collection('settings').doc('storeSettings').set(
        { settlementLocked: false },
        { merge: true }
    );

    return NextResponse.json({ success: true, message: 'Payment recorded. Online orders are now unlocked.' });
}
