import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

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
 * GET /api/admin/settlements
 * Returns the last 30 settlement documents, ordered by date descending.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyVendor(req);
    if (auth instanceof NextResponse) return auth;

    const snap = await adminDb.collection('vendor_daily_settlements')
        .orderBy('settlement_date', 'desc')
        .limit(30)
        .get();

    const settlements = snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            ...data,
            period_start: (data.period_start as Timestamp)?.toDate?.()?.toISOString(),
            period_end: (data.period_end as Timestamp)?.toDate?.()?.toISOString(),
            paid_at: (data.paid_at as Timestamp)?.toDate?.()?.toISOString(),
            verified_at: (data.verified_at as Timestamp)?.toDate?.()?.toISOString(),
            created_at: (data.created_at as Timestamp)?.toDate?.()?.toISOString(),
            updated_at: (data.updated_at as Timestamp)?.toDate?.()?.toISOString(),
        };
    });

    return NextResponse.json({ settlements });
}
