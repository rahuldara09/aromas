import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * /api/pos-products — Vendor-only POS product CRUD
 *
 * Writes to the dedicated `posProducts` Firestore collection, separate from
 * the `products` collection used for the online menu.
 *
 * Auth: every request must include a valid Firebase ID token in the
 *       Authorization header: "Bearer <idToken>"
 *
 * Methods:
 *   POST   – add a new POS product
 *   PUT    – partial-update an existing POS product
 *   DELETE – permanently delete a POS product by id
 */

async function verifyVendor(req: NextRequest): Promise<{ uid: string; phone: string } | NextResponse> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized. Firebase ID token required.' }, { status: 401 });
    }

    const idToken = authHeader.slice(7);
    let uid: string;
    let tokenPhone: string | undefined;
    let tokenEmail: string | undefined;

    try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
        tokenPhone = decoded.phone_number;
        tokenEmail = decoded.email ?? (decoded['vendorEmail'] as string | undefined);
    } catch (err) {
        console.error('[pos-products API] token verification failed:', err);
        return NextResponse.json({ error: 'Invalid or expired authentication token.' }, { status: 401 });
    }

    const clientPhone = req.headers.get('x-vendor-phone') ?? undefined;
    const phone = tokenPhone ?? clientPhone;

    function isVendorDoc(data: FirebaseFirestore.DocumentData | undefined): boolean {
        if (!data) return false;
        return data.isVendor === true || data.role === 'vendor' || data.isActive === true;
    }

    const keysToTry: string[] = [uid];
    if (phone) {
        const raw = phone.trim();
        keysToTry.push(raw);
        if (raw.startsWith('+91') && raw.length === 13) {
            keysToTry.push(raw.slice(3));
        } else if (/^\d{10}$/.test(raw)) {
            keysToTry.push(`+91${raw}`);
        }
        if (raw.startsWith('+') && !keysToTry.includes(raw.slice(1))) {
            keysToTry.push(raw.slice(1));
        }
    }

    if (tokenEmail) {
        const normalizedEmail = tokenEmail.toLowerCase().trim();
        keysToTry.push(normalizedEmail);
        keysToTry.push(`email_${normalizedEmail}`);
    }

    for (const key of keysToTry) {
        const snap = await adminDb.collection('vendors').doc(key).get();
        if (snap.exists && isVendorDoc(snap.data())) {
            return { uid, phone: phone ?? uid };
        }
    }

    if (tokenEmail) {
        const vendorSnap = await adminDb.collection('vendors')
            .where('email', '==', tokenEmail.toLowerCase().trim())
            .where('isVendor', '==', true)
            .limit(1)
            .get();
        if (!vendorSnap.empty) {
            return { uid, phone: phone ?? uid };
        }
    }

    return NextResponse.json({ error: `Forbidden. Vendor role required.` }, { status: 403 });
}

// ─── POST — Add new POS product ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const auth = await verifyVendor(req);
    if (auth instanceof NextResponse) return auth;

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { name, price, categoryId, code, serialNumber, isAvailable, description } = body;

    if (!name || !price || !categoryId) {
        return NextResponse.json({ error: 'name, price and categoryId are required.' }, { status: 422 });
    }

    try {
        const docData: Record<string, unknown> = {
            name,
            price: Number(price),
            categoryId,
            imageURL: '',
            isAvailable: isAvailable !== false,
            createdAt: FieldValue.serverTimestamp(),
        };
        if (code !== undefined) docData.code = code;
        if (serialNumber !== undefined) docData.serialNumber = Number(serialNumber);
        if (description !== undefined) docData.description = description;

        const docRef = await adminDb.collection('posProducts').add(docData);
        return NextResponse.json({ id: docRef.id }, { status: 201 });
    } catch (err) {
        console.error('[API/pos-products POST] Firestore write failed:', err);
        return NextResponse.json({ error: 'Failed to add POS product.' }, { status: 500 });
    }
}

// ─── PUT — Update existing POS product (partial) ─────────────────────────────

export async function PUT(req: NextRequest) {
    const auth = await verifyVendor(req);
    if (auth instanceof NextResponse) return auth;

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { id, ...updates } = body;

    if (!id || typeof id !== 'string') {
        return NextResponse.json({ error: 'Product id is required.' }, { status: 422 });
    }

    const allowed: Record<string, unknown> = {};
    const numericFields = new Set(['price', 'serialNumber']);
    const boolFields = new Set(['isAvailable']);
    const allowedFields = ['name', 'price', 'categoryId', 'isAvailable', 'description', 'code', 'serialNumber'];

    for (const field of allowedFields) {
        if (field in updates) {
            if (numericFields.has(field)) allowed[field] = Number(updates[field]);
            else if (boolFields.has(field)) allowed[field] = Boolean(updates[field]);
            else allowed[field] = updates[field];
        }
    }

    if (Object.keys(allowed).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update.' }, { status: 422 });
    }

    try {
        await adminDb.collection('posProducts').doc(id).update({
            ...allowed,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[API/pos-products PUT] Firestore write failed:', err);
        return NextResponse.json({ error: 'Failed to update POS product.' }, { status: 500 });
    }
}

// ─── DELETE — Remove a POS product ───────────────────────────────────────────

export async function DELETE(req: NextRequest) {
    const auth = await verifyVendor(req);
    if (auth instanceof NextResponse) return auth;

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { id } = body;

    if (!id || typeof id !== 'string') {
        return NextResponse.json({ error: 'Product id is required.' }, { status: 422 });
    }

    try {
        await adminDb.collection('posProducts').doc(id).delete();
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[API/pos-products DELETE] Firestore write failed:', err);
        return NextResponse.json({ error: 'Failed to delete POS product.' }, { status: 500 });
    }
}
