import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getTodayIST, getSettlementPeriod, getYesterdayIST } from '@/lib/settlement';

/**
 * GET /api/cron/daily-settlement
 *
 * Called by Vercel Cron at 9:00 AM IST (03:30 UTC) every day.
 * 1. Marks yesterday's unsettled settlement as 'overdue'.
 * 2. Counts online orders in the 7AM→7AM window.
 * 3. Creates today's settlement document.
 * 4. Locks online ordering if amount > 0 (until vendor pays).
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const today = getTodayIST();
        const yesterday = getYesterdayIST();
        const { start, end } = getSettlementPeriod(today);
        const settingsRef = adminDb.collection('settings').doc('storeSettings');
        const settlementsCol = adminDb.collection('vendor_daily_settlements');

        // ── 1. Mark yesterday's pending settlement as overdue ──────────────────
        const yesterdayRef = settlementsCol.doc(yesterday);
        const yesterdaySnap = await yesterdayRef.get();
        if (yesterdaySnap.exists) {
            const yd = yesterdaySnap.data()!;
            if (yd.status === 'pending' || yd.status === 'verification_pending') {
                await yesterdayRef.update({
                    status: 'overdue',
                    updated_at: FieldValue.serverTimestamp(),
                });
            }
        }

        // ── 2. Check if today's settlement already exists ──────────────────────
        const todayRef = settlementsCol.doc(today);
        const todaySnap = await todayRef.get();
        if (todaySnap.exists) {
            return NextResponse.json({
                message: `Settlement for ${today} already exists.`,
                status: todaySnap.data()?.status,
            });
        }

        // ── 3. Count paid online orders in the settlement window ───────────────
        const ordersSnap = await adminDb.collection('orders')
            .where('orderDate', '>=', Timestamp.fromDate(start))
            .where('orderDate', '<', Timestamp.fromDate(end))
            .get();

        const onlineOrders = ordersSnap.docs.filter(d => {
            const data = d.data();
            // Count non-POS orders that were actually paid / placed successfully
            if (data.orderType === 'pos') return false;
            if (data.payment_status === 'success') return true;
            // Legacy orders without payment_status that are not cancelled/pending
            if (!data.payment_status && !['pending_payment', 'payment_processing', 'failed', 'Cancelled'].includes(data.status)) return true;
            return false;
        });

        const totalOnlineOrders = onlineOrders.length;
        const ratePerOrder = 2; // ₹2 per order
        const payableAmount = totalOnlineOrders * ratePerOrder;

        // ── 4. Determine initial status ────────────────────────────────────────
        // If 0 orders → auto-mark as paid (no fee due)
        const initialStatus = payableAmount === 0 ? 'paid' : 'pending';
        const vendorId = process.env.VENDOR_EMAIL ?? 'vendor';

        await todayRef.set({
            vendor_id: vendorId,
            settlement_date: today,
            period_start: Timestamp.fromDate(start),
            period_end: Timestamp.fromDate(end),
            total_online_orders: totalOnlineOrders,
            rate_per_order: ratePerOrder,
            payable_amount: payableAmount,
            status: initialStatus,
            transaction_id: null,
            screenshot_url: null,
            paid_at: null,
            verified_at: null,
            verified_by: null,
            rejection_reason: null,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
        });

        // ── 5. Update online ordering lock ─────────────────────────────────────
        const shouldLock = payableAmount > 0;
        await settingsRef.set({ settlementLocked: shouldLock }, { merge: true });

        console.log(`[daily-settlement] ${today}: ${totalOnlineOrders} orders × ₹${ratePerOrder} = ₹${payableAmount} | status: ${initialStatus} | locked: ${shouldLock}`);

        return NextResponse.json({
            success: true,
            settlement_date: today,
            total_online_orders: totalOnlineOrders,
            payable_amount: payableAmount,
            status: initialStatus,
            locked: shouldLock,
        });
    } catch (err) {
        console.error('[daily-settlement] Error:', err);
        return NextResponse.json({ error: 'Settlement generation failed.' }, { status: 500 });
    }
}
