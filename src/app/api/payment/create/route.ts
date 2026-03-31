import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { CreateOrderSchema } from '@/lib/schemas';
import { FieldValue } from 'firebase-admin/firestore';
import { rateLimit, getClientIp, tooManyRequests } from '@/lib/rateLimit';
import { paymentService } from '@/services/payment/paymentService';
import { Order } from '@/types';

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    const rl = await rateLimit(`payment:create:${ip}`, 5, 60_000); // 5 attempts per minute
    if (!rl.success) return tooManyRequests(rl.resetAt);

    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let uid: string;
    try {
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
        uid = decoded.uid;
    } catch {
        return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
    }

    // 2. Parse Body
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    try {
        let orderRef;
        let orderData: any;

        if (body.orderId) {
            // ─── RE-INITIATE PAYMENT ──────────────────────────────────────────
            const existingOrderRef = adminDb.collection('orders').doc(body.orderId);
            const existingOrderSnap = await existingOrderRef.get();
            
            if (!existingOrderSnap.exists) {
                return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
            }

            orderData = existingOrderSnap.data();
            if (orderData.userId !== uid) {
                return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
            }

            if (orderData.status !== 'pending_payment' && orderData.status !== 'failed') {
                return NextResponse.json({ error: 'Order already processed.' }, { status: 400 });
            }

            orderRef = existingOrderRef;
            console.log(`[payment/create] Re-initiating payment for order ${body.orderId}`);
        } else {
            // ─── CREATE NEW ORDER ─────────────────────────────────────────────
            const parsed = CreateOrderSchema.safeParse(body);
            if (!parsed.success) {
                console.error('[payment/create] validation failed:', parsed.error.flatten());
                return NextResponse.json({ error: 'Invalid order data.', details: parsed.error.flatten() }, { status: 422 });
            }

            const data = parsed.data;

            // Server-side total calculation
            const serverItemTotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const expectedGrandTotal = serverItemTotal + data.dukanFee + data.deliveryFee;

            if (Math.abs(expectedGrandTotal - data.grandTotal) > 1) {
                return NextResponse.json({ error: 'Order total mismatch. Please refresh.' }, { status: 422 });
            }

            // Calculate ETA & Token
            const activeSnap = await adminDb.collection('orders')
                .where('status', 'in', ['Placed', 'Pending', 'Preparing'])
                .get();
            const etaMinutes = 10 + activeSnap.size * 4;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todaySnap = await adminDb.collection('orders')
                .where('orderDate', '>=', today)
                .get();
            const orderToken = String(todaySnap.size + 1).padStart(3, '0');

            orderData = {
                userId: uid,
                customerPhone: data.customerPhone.startsWith('+91') ? data.customerPhone : `+91${data.customerPhone}`,
                items: data.items,
                itemTotal: serverItemTotal,
                dukanFee: data.dukanFee,
                deliveryFee: data.deliveryFee,
                grandTotal: expectedGrandTotal,
                deliveryAddress: data.deliveryAddress,
                status: 'pending_payment',
                payment_status: 'pending',
                orderToken,
                etaMinutes,
                orderDate: FieldValue.serverTimestamp(),
                timestamp: FieldValue.serverTimestamp(),
                expectedReadyTime: new Date(Date.now() + etaMinutes * 60 * 1000),
            };

            orderRef = await adminDb.collection('orders').add(orderData);
        }

        // 3. Generate Payment Session via Provider
        const orderInfo: Order = {
            id: orderRef.id,
            ...orderData,
            orderDate: orderData.orderDate?.toDate ? orderData.orderDate.toDate() : new Date(),
        } as unknown as Order;

        const protocol = req.headers.get('x-forwarded-proto') || (req.url.startsWith('https') ? 'https' : 'http');
        const host = req.headers.get('host') || req.nextUrl.host;
        const dynamicBaseUrl = `${protocol}://${host}`;

        const session = await paymentService.createPaymentSession(orderInfo, dynamicBaseUrl);

        // Update the order with the generated transaction ID
        await orderRef.update({
            payment_provider: 'cashfree',
            payment_transaction_id: session.transactionId,
            updatedAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            success: true,
            orderId: orderRef.id,
            session
        }, { status: 201 });

    } catch (err: any) {
        console.error('[payment/create] failed:', err);
        return NextResponse.json({ error: err.message || 'Failed to initiate payment session.' }, { status: 500 });
    }
}
