import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * CRON API: Mark stale pending_payment orders as payment_failed after 15 minutes.
 * This prevents orders from being stuck in "Processing" forever if the 
 * user abandons the payment gateway or if a webhook is never received.
 */
export async function GET() {
    try {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

        const staleOrdersSnap = await adminDb.collection('orders')
            .where('status', '==', 'pending_payment')
            .where('timestamp', '<=', fifteenMinsAgo)
            .get();

        if (staleOrdersSnap.empty) {
            return NextResponse.json({ message: 'No stale orders found.' });
        }

        const batch = adminDb.batch();
        const results: string[] = [];

        staleOrdersSnap.forEach(doc => {
            batch.update(doc.ref, {
                status: 'failed',
                payment_status: 'failed',
                updatedAt: FieldValue.serverTimestamp(),
                timeout_cancelled_at: FieldValue.serverTimestamp(),
                cancellation_reason: 'Payment timeout (15 mins exceeded)'
            });
            results.push(doc.id);
        });

        await batch.commit();

        console.log(`[cron/cleanup] Marked ${results.length} orders as failed due to timeout.`);

        return NextResponse.json({
            success: true,
            modifiedCount: results.length,
            orderIds: results
        });

    } catch (err: any) {
        console.error('[cron/cleanup] Error:', err.message);
        return NextResponse.json({ error: 'Cleanup failed.' }, { status: 500 });
    }
}
