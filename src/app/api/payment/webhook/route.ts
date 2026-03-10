import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { paymentService } from '@/services/payment/paymentService';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    let rawBody;
    const contentType = req.headers.get('content-type') || '';

    try {
        // PayU sends form-urlencoded data on success/failure
        if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await req.formData();
            rawBody = Object.fromEntries(formData);
        } else {
            rawBody = await req.json();
        }
    } catch {
        return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    try {
        console.log(`[webhook] Received payload for order.`);

        // 1. Verify Payment via Service Provider
        let verification;
        try {
            verification = await paymentService.verifyPayment(rawBody);
        } catch (err: any) {
            console.error('[webhook] Signature verification failed:', err.message);
            // Return an error for S2S or redirect with error
            return NextResponse.redirect(new URL(`/order/error?reason=invalid_signature`, req.url));
        }

        const orderRef = adminDb.collection('orders').doc(verification.orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) {
            console.error(`[webhook] Order ${verification.orderId} not found.`);
            return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
        }

        const orderData = orderSnap.data();

        // 2. Prevent Double Processing
        if (orderData?.payment_status === 'success' || orderData?.status === 'success' || orderData?.status === 'Placed') {
            console.log(`[webhook] Ignoring duplicate webhook for ${verification.orderId}`);
            return NextResponse.redirect(new URL(`/order/${verification.orderId}`, req.url));
        }

        // 3. Amount Validation (Security Check)
        if (orderData && Math.abs(orderData.grandTotal - verification.amount) > 1) {
            console.error(`[webhook] Amount mismatch for ${verification.orderId}. Expected ${orderData.grandTotal}, got ${verification.amount}`);
            await orderRef.update({
                payment_status: 'failed',
                status: 'failed'
            });
            return NextResponse.redirect(new URL(`/order/${verification.orderId}?error=amount_mismatch`, req.url));
        }

        // 4. Record Payment in Database
        const paymentData = {
            order_id: verification.orderId,
            provider: 'payu',
            transaction_id: verification.transactionId,
            amount: verification.amount,
            currency: verification.currency,
            status: verification.success ? 'success' : 'failed',
            raw_response: rawBody,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
        };

        const paymentRef = adminDb.collection('payments').doc(verification.transactionId);
        await paymentRef.set(paymentData);

        // 5. Update Order Status
        if (verification.success) {
            await orderRef.update({
                payment_status: 'success',
                status: 'success', // The order status model specifies this
                payment_transaction_id: verification.transactionId,
                payment_amount: verification.amount,
                payment_verified_at: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });
            console.log(`[webhook] Order ${verification.orderId} payment successful & verified.`);
        } else {
            await orderRef.update({
                payment_status: 'failed',
                status: 'failed',
                payment_transaction_id: verification.transactionId,
                updatedAt: FieldValue.serverTimestamp()
            });
            console.error(`[webhook] Order ${verification.orderId} payment failed according to PayU. Status: ${verification.providerRawStatus}`);
        }

        // Redirect user back to the order tracking page. 
        return NextResponse.redirect(new URL(`/order/${verification.orderId}`, req.url));

    } catch (err: any) {
        console.error('[webhook] Processing failed:', err.message);
        return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
    }
}
