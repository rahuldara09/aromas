import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { adminDb } from '@/lib/firebaseAdmin';
import {
    startOfDayIST, endOfDayIST,
    docToOrderRow, buildItemRows, buildReportWorkbook,
} from '@/lib/report-excel';

const resend = new Resend(process.env.RESEND_API_KEY);

// GET is required for Vercel Cron jobs
export async function GET(req: NextRequest) {
    // Verify the request comes from Vercel cron infrastructure
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const vendorEmail = process.env.VENDOR_EMAIL;
        if (!vendorEmail) {
            return NextResponse.json({ error: 'VENDOR_EMAIL env var not set' }, { status: 500 });
        }

        // ── 1. Query today's orders (IST day boundaries) ──────────────────────
        const start = Timestamp.fromDate(startOfDayIST());
        const end   = Timestamp.fromDate(endOfDayIST());

        const snap = await adminDb
            .collection('orders')
            .where('orderDate', '>=', start)
            .where('orderDate', '<=', end)
            .orderBy('orderDate', 'asc')
            .get();

        const rawDocs = snap.docs.map(d => d.data());
        const orderRows = snap.docs.map(d => docToOrderRow(d.id, d.data()));
        const itemRows  = buildItemRows(orderRows, rawDocs);

        // ── 2. Compute summary ────────────────────────────────────────────────
        const revenueOrders = orderRows.filter(o => o.status !== 'Cancelled');
        const totalRevenue  = revenueOrders.reduce((s, o) => s + o.revenue, 0);
        const totalOrders   = orderRows.length;
        const cancelled     = orderRows.filter(o => o.status === 'Cancelled').length;
        const topItem       = itemRows[0]?.name ?? '—';

        const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        const dateLabel = todayIST.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
        });

        // ── 3. Generate Excel ─────────────────────────────────────────────────
        const excelBuffer = await buildReportWorkbook(orderRows, itemRows, {
            dateLabel,
            period: `${dateLabel} (IST)`,
        });

        // ── 4. Send email ─────────────────────────────────────────────────────
        const html = buildEmailHtml({
            dateLabel, totalRevenue, totalOrders, cancelled, topItem,
            itemRows: itemRows.slice(0, 5),
        });

        const { error } = await resend.emails.send({
            from: 'Aroma Ops <noreply@aromadhaba.in>',
            to: vendorEmail,
            subject: `Daily Sales Summary — ${dateLabel}`,
            html,
            attachments: [{
                filename: `aroma-daily-${todayIST.toISOString().slice(0, 10)}.xlsx`,
                content: excelBuffer.toString('base64'),
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }],
        });

        if (error) {
            console.error('[cron/daily-report] Resend error:', error);
            return NextResponse.json({ error: 'Email delivery failed', detail: error }, { status: 500 });
        }

        console.log(`[cron/daily-report] ✅ Sent to ${vendorEmail} — ${totalOrders} orders, ₹${totalRevenue}`);
        return NextResponse.json({
            success: true,
            date: dateLabel,
            orders: totalOrders,
            revenue: totalRevenue,
            sentTo: vendorEmail,
        });

    } catch (err) {
        console.error('[cron/daily-report] Error:', err);
        return NextResponse.json({ error: 'Internal error', detail: String(err) }, { status: 500 });
    }
}

// ─── HTML Email Template ──────────────────────────────────────────────────────

function buildEmailHtml(data: {
    dateLabel: string;
    totalRevenue: number;
    totalOrders: number;
    cancelled: number;
    topItem: string;
    itemRows: { name: string; qty: number; revenue: number }[];
}) {
    const { dateLabel, totalRevenue, totalOrders, cancelled, topItem, itemRows } = data;
    const itemRows_html = itemRows.map((item, i) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#6B7280;">${i + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;font-weight:600;color:#111827;">${item.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;text-align:center;color:#374151;">×${item.qty}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;text-align:right;font-weight:600;color:#6366F1;">₹${item.revenue.toLocaleString('en-IN')}</td>
        </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:32px 16px;">
  <div style="background:#fff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366F1,#4F46E5);padding:28px 32px;">
      <div style="font-size:11px;font-weight:700;color:#C7D2FE;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Daily Report</div>
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;">Aroma Dhaba</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#A5B4FC;">${dateLabel}</p>
    </div>

    <!-- KPI Grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #F3F4F6;">
      <div style="padding:20px 24px;border-right:1px solid #F3F4F6;">
        <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Revenue</div>
        <div style="font-size:28px;font-weight:800;color:#6366F1;margin-top:6px;">₹${totalRevenue.toLocaleString('en-IN')}</div>
      </div>
      <div style="padding:20px 24px;">
        <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Orders</div>
        <div style="font-size:28px;font-weight:800;color:#111827;margin-top:6px;">${totalOrders}</div>
      </div>
      <div style="padding:16px 24px;border-right:1px solid #F3F4F6;border-top:1px solid #F3F4F6;">
        <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Cancelled</div>
        <div style="font-size:22px;font-weight:700;color:${cancelled > 0 ? '#EF4444' : '#10B981'};margin-top:4px;">${cancelled}</div>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #F3F4F6;">
        <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Best Seller</div>
        <div style="font-size:14px;font-weight:700;color:#111827;margin-top:4px;">${topItem}</div>
      </div>
    </div>

    <!-- Top Items Table -->
    ${itemRows.length > 0 ? `
    <div style="padding:20px 24px 4px;">
      <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Top Items</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#F5F3FF;">
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#6366F1;text-transform:uppercase;">#</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#6366F1;text-transform:uppercase;">Item</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#6366F1;text-transform:uppercase;">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#6366F1;text-transform:uppercase;">Revenue</th>
          </tr>
        </thead>
        <tbody>${itemRows_html}</tbody>
      </table>
    </div>
    ` : ''}

    <!-- Attachment note -->
    <div style="padding:16px 24px;background:#F9FAFB;border-top:1px solid #F3F4F6;">
      <p style="margin:0;font-size:13px;color:#6B7280;">
        📎 Full Excel report attached — includes all transactions and item-wise breakdown.
      </p>
    </div>

    <!-- Retention warning -->
    <div style="padding:14px 24px;background:#FFFBEB;border-top:1px solid #FDE68A;">
      <p style="margin:0;font-size:12px;color:#92400E;">
        ⚠️ <strong>Reminder:</strong> Firebase data is retained for 30 days. Save this report for long-term records.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;border-top:1px solid #F3F4F6;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;">Aroma Ops · IIM Mumbai Campus · Automated daily report</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
