import { NextRequest, NextResponse } from 'next/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { adminDb } from '@/lib/firebaseAdmin';
import {
    startOfMonthIST, endOfMonthIST, prevMonthIST,
    docToOrderRow, buildItemRows, buildReportWorkbook,
} from '@/lib/report-excel';

const resend = new Resend(process.env.RESEND_API_KEY);
const BATCH_SIZE = 400; // Stay well under Firestore's 500 limit

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const vendorEmail = process.env.VENDOR_EMAIL;
        if (!vendorEmail) {
            return NextResponse.json({ error: 'VENDOR_EMAIL env var not set' }, { status: 500 });
        }

        const { year, month, label: monthLabel } = prevMonthIST();

        // ── 1. Query all orders from previous month ────────────────────────────
        const start = Timestamp.fromDate(startOfMonthIST(year, month));
        const end   = Timestamp.fromDate(endOfMonthIST(year, month));

        console.log(`[cron/monthly-archive] Archiving ${monthLabel}: ${start.toDate().toISOString()} → ${end.toDate().toISOString()}`);

        const snap = await adminDb
            .collection('orders')
            .where('orderDate', '>=', start)
            .where('orderDate', '<=', end)
            .orderBy('orderDate', 'asc')
            .get();

        if (snap.empty) {
            console.log(`[cron/monthly-archive] No orders found for ${monthLabel} — skipping.`);
            return NextResponse.json({ success: true, archived: 0, message: 'No orders to archive' });
        }

        const docs = snap.docs;
        const rawDocs = docs.map(d => d.data());

        // ── 2. Generate Excel before touching Firestore ────────────────────────
        const orderRows = docs.map(d => docToOrderRow(d.id, d.data()));
        const itemRows  = buildItemRows(orderRows, rawDocs);

        const excelBuffer = await buildReportWorkbook(orderRows, itemRows, {
            dateLabel: monthLabel,
            period: monthLabel,
        });

        // ── 3. Batch-archive to orders_archive collection ─────────────────────
        let archived = 0;
        let batch = adminDb.batch();
        let batchCount = 0;

        for (const doc of docs) {
            const archiveRef = adminDb.collection('orders_archive').doc(doc.id);
            batch.set(archiveRef, {
                ...doc.data(),
                archivedAt: FieldValue.serverTimestamp(),
                archiveMonth: `${year}-${String(month + 1).padStart(2, '0')}`,
            });
            batchCount++;
            archived++;

            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                batch = adminDb.batch();
                batchCount = 0;
                console.log(`[cron/monthly-archive] Committed batch — ${archived}/${docs.length}`);
            }
        }
        if (batchCount > 0) {
            await batch.commit();
        }

        console.log(`[cron/monthly-archive] ✅ Archived ${archived} orders to orders_archive`);

        // ── 4. Send archive email with Excel attachment ────────────────────────
        const totalRevenue = orderRows
            .filter(o => o.status !== 'Cancelled')
            .reduce((s, o) => s + o.revenue, 0);

        const { error } = await resend.emails.send({
            from: 'Aroma Ops <noreply@aromadhaba.in>',
            to: vendorEmail,
            subject: `Monthly Archive — ${monthLabel} · Aroma Dhaba`,
            html: buildArchiveEmailHtml({
                monthLabel,
                totalOrders: archived,
                totalRevenue,
                topItem: itemRows[0]?.name ?? '—',
            }),
            attachments: [{
                filename: `aroma-archive-${year}-${String(month + 1).padStart(2, '0')}.xlsx`,
                content: excelBuffer.toString('base64'),
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }],
        });

        if (error) {
            console.error('[cron/monthly-archive] Resend error:', error);
            // Don't fail — data is already archived in Firestore
        }

        return NextResponse.json({
            success: true,
            month: monthLabel,
            archived,
            revenue: totalRevenue,
            emailSent: !error,
        });

    } catch (err) {
        console.error('[cron/monthly-archive] Error:', err);
        return NextResponse.json({ error: 'Internal error', detail: String(err) }, { status: 500 });
    }
}

function buildArchiveEmailHtml(data: {
    monthLabel: string;
    totalOrders: number;
    totalRevenue: number;
    topItem: string;
}) {
    const { monthLabel, totalOrders, totalRevenue, topItem } = data;
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:540px;margin:0 auto;padding:32px 16px;">
  <div style="background:#fff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden;">

    <div style="background:linear-gradient(135deg,#111827,#1F2937);padding:28px 32px;">
      <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Monthly Archive</div>
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;">Aroma Dhaba</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#9CA3AF;">${monthLabel} · Data archived successfully</p>
    </div>

    <div style="padding:24px 32px;">
      <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
        Your <strong>${monthLabel}</strong> sales data has been archived to secure storage and is attached as an Excel file.
      </p>

      <div style="background:#F9FAFB;border-radius:12px;border:1px solid #F3F4F6;padding:16px 20px;display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div>
          <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Total Orders</div>
          <div style="font-size:24px;font-weight:800;color:#111827;margin-top:4px;">${totalOrders}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Revenue</div>
          <div style="font-size:24px;font-weight:800;color:#6366F1;margin-top:4px;">₹${totalRevenue.toLocaleString('en-IN')}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Best Seller</div>
          <div style="font-size:14px;font-weight:700;color:#111827;margin-top:4px;">${topItem}</div>
        </div>
      </div>

      <div style="background:#ECFDF5;border-radius:10px;padding:14px 16px;border:1px solid #A7F3D0;">
        <p style="margin:0;font-size:13px;color:#065F46;">
          ✅ <strong>${totalOrders} orders</strong> archived to <code>orders_archive</code> collection in Firestore. The attached Excel file is your permanent backup.
        </p>
      </div>
    </div>

    <div style="padding:14px 32px;background:#FFF7ED;border-top:1px solid #FED7AA;">
      <p style="margin:0;font-size:12px;color:#9A3412;">
        📂 <strong>Action required:</strong> Save the attached Excel file in a safe location for long-term record keeping.
      </p>
    </div>

    <div style="padding:16px 32px;border-top:1px solid #F3F4F6;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;">Aroma Ops · IIM Mumbai Campus · Automated monthly archive</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
