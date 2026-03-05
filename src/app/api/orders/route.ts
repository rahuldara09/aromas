import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { CreateOrderSchema } from '@/lib/schemas';
import { FieldValue } from 'firebase-admin/firestore';
import { rateLimit, getClientIp, tooManyRequests } from '@/lib/rateLimit';

/**
 * POST /api/orders
 *
 * Secure order creation endpoint. Flow:
 *  1. Verify Firebase ID token (rejects unauthenticated requests)
 *  2. Validate request body with Zod (rejects malformed/crafted orders)
 *  3. Write order to Firestore via Admin SDK (server-to-server, trusted)
 *
 * Rate limited upstream in middleware (5 orders / minute / IP).
 */
export async function POST(req: NextRequest) {
    // ── 0. Rate Limiting: 5 orders per minute per IP ─────────────────────────
    const ip = getClientIp(req);
    const rl = await rateLimit(`orders:${ip}`, 5, 60_000);
    if (!rl.success) return tooManyRequests(rl.resetAt);


    // ── 1. Authentication: verify Firebase ID token ──────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized. Firebase ID token required.' }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    let uid: string;
    try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
    } catch {
        return NextResponse.json({ error: 'Invalid or expired authentication token.' }, { status: 401 });
    }

    // ── 2. Validation: parse and validate the order body ─────────────────────
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const result = CreateOrderSchema.safeParse(body);
    if (!result.success) {
        return NextResponse.json(
            { error: 'Invalid order data.', details: result.error.flatten().fieldErrors },
            { status: 422 }
        );
    }

    const {
        customerPhone,
        items,
        itemTotal,
        dukanFee,
        deliveryFee,
        grandTotal,
        deliveryAddress,
    } = result.data;

    // ── 3. Server-side total verification ────────────────────────────────────
    // Recalculate total server-side to prevent price manipulation
    const serverItemTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const expectedGrandTotal = serverItemTotal + dukanFee + deliveryFee;
    const tolerance = 1; // ₹1 tolerance for floating point
    if (Math.abs(expectedGrandTotal - grandTotal) > tolerance) {
        return NextResponse.json(
            { error: 'Order total does not match item prices. Please refresh and try again.' },
            { status: 422 }
        );
    }

    // ── 4. Write to Firestore via Admin SDK (bypasses client security rules) ──
    try {
        // Calculate active queue for ETA
        const activeSnap = await adminDb.collection('orders')
            .where('status', 'in', ['Placed', 'Pending', 'Preparing'])
            .get();
        const etaMinutes = 10 + activeSnap.size * 4;

        // Token: sequential count of today's orders
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySnap = await adminDb.collection('orders')
            .where('orderDate', '>=', today)
            .get();
        const orderToken = String(todaySnap.size + 1).padStart(3, '0');

        const orderRef = await adminDb.collection('orders').add({
            userId: uid,
            customerPhone,
            items,
            itemTotal: serverItemTotal,
            dukanFee,
            deliveryFee,
            grandTotal: expectedGrandTotal,
            deliveryAddress,
            status: 'Placed',
            orderToken,
            etaMinutes,
            orderDate: FieldValue.serverTimestamp(),
            timestamp: FieldValue.serverTimestamp(),
            expectedReadyTime: new Date(Date.now() + etaMinutes * 60 * 1000),
        });

        return NextResponse.json({ orderId: orderRef.id, orderToken, etaMinutes }, { status: 201 });
    } catch (err) {
        console.error('[API/orders] Firestore write failed:', err);
        return NextResponse.json({ error: 'Failed to create order. Please try again.' }, { status: 500 });
    }
}

// Reject non-POST methods
export async function GET() {
    return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 });
}
