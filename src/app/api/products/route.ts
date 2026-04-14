import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * /api/products — Vendor-only product CRUD
 *
 * All writes go through the Firebase Admin SDK (bypasses Firestore security
 * rules which intentionally block direct client writes to `products`).
 *
 * Auth: every request must include a valid Firebase ID token in the
 *       Authorization header: "Bearer <idToken>"
 *
 * The route verifies that the authenticated user has a vendor document in
 * `vendors/{phone}` with `isVendor === true` before allowing any mutation.
 *
 * Methods:
 *   POST   – add a new product
 *   PUT    – partial-update an existing product (any subset of fields)
 *   DELETE – permanently delete a product by id
 */

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function verifyVendor(req: NextRequest): Promise<{ uid: string; phone: string } | NextResponse> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized. Firebase ID token required.' }, { status: 401 });
    }

    const idToken = authHeader.slice(7);
    let uid: string;
    // The token phone_number claim is undefined for anonymous Firebase sessions.
    // The client sends the phone via x-vendor-phone header instead.
    let tokenPhone: string | undefined;

    let tokenEmail: string | undefined;

    try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
        tokenPhone = decoded.phone_number;
        tokenEmail = decoded.email;
    } catch (err) {
        console.error('[vendor API] token verification failed:', err);
        return NextResponse.json({ error: 'Invalid or expired authentication token.' }, { status: 401 });
    }

    // Phone supplied by client (from AuthContext.phoneNumber stored in sessionStorage)
    const clientPhone = req.headers.get('x-vendor-phone') ?? undefined;
    const phone = tokenPhone ?? clientPhone;

    // Helper: check if a Firestore doc qualifies as a vendor doc
    function isVendorDoc(data: FirebaseFirestore.DocumentData | undefined): boolean {
        if (!data) return false;
        return data.isVendor === true || data.role === 'vendor' || data.isActive === true;
    }

    // Build candidate document keys to try (UID first, then all phone variants)
    const keysToTry: string[] = [uid];
    if (phone) {
        const raw = phone.trim();
        keysToTry.push(raw);
        if (raw.startsWith('+91') && raw.length === 13) {
            keysToTry.push(raw.slice(3)); // 10-digit local
        } else if (/^\d{10}$/.test(raw)) {
            keysToTry.push(`+91${raw}`); // add +91 prefix
        }
        if (raw.startsWith('+') && !keysToTry.includes(raw.slice(1))) {
            keysToTry.push(raw.slice(1)); // strip leading +
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

    return NextResponse.json({ error: `Forbidden. Vendor role required. Tried keys: ${keysToTry.join(', ')}` }, { status: 403 });
}


// ─── POST — Add new product ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const auth = await verifyVendor(req);
    if (auth instanceof NextResponse) return auth;

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { name, price, categoryId, category, imageURL } = body;

    if (!name || !price || !categoryId) {
        return NextResponse.json({ error: 'name, price and categoryId are required.' }, { status: 422 });
    }

    try {
        const docRef = await adminDb.collection('products').add({
            name,
            price: Number(price),
            categoryId,
            category: category ?? categoryId,
            imageURL: imageURL ?? '',
            isAvailable: true,
            createdAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ id: docRef.id }, { status: 201 });
    } catch (err) {
        console.error('[API/products POST] Firestore write failed:', err);
        return NextResponse.json({ error: 'Failed to add product.' }, { status: 500 });
    }
}

// ─── PUT — Update existing product (partial) ──────────────────────────────────

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

    // Sanitise: only allow known fields to be updated
    const allowed: Record<string, unknown> = {};
    const allowedFields = ['name', 'price', 'categoryId', 'category', 'imageURL', 'isAvailable', 'description'];
    for (const field of allowedFields) {
        if (field in updates) {
            allowed[field] =
                field === 'price' ? Number(updates[field]) : updates[field];
        }
    }

    if (Object.keys(allowed).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update.' }, { status: 422 });
    }

    try {
        await adminDb.collection('products').doc(id).update({
            ...allowed,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[API/products PUT] Firestore write failed:', err);
        return NextResponse.json({ error: 'Failed to update product.' }, { status: 500 });
    }
}

// ─── DELETE — Remove a product ────────────────────────────────────────────────

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
        await adminDb.collection('products').doc(id).delete();
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[API/products DELETE] Firestore write failed:', err);
        return NextResponse.json({ error: 'Failed to delete product.' }, { status: 500 });
    }
}
