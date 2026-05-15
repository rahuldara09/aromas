import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    try {
        const { email, ordersCSV, itemsCSV, filename, subject, summary } = await req.json();

        if (!email || !ordersCSV) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const ordersBuffer = Buffer.from('﻿' + ordersCSV, 'utf-8');
        const itemsBuffer = itemsCSV
            ? Buffer.from('﻿' + itemsCSV, 'utf-8')
            : null;

        const { revenue, orders, cancelled, topItem, rangeLabel } = summary || {};

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; margin: 0; padding: 0; background: #F9FAFB; }
    .wrapper { max-width: 580px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #fff; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden; }
    .header { background: #6366F1; padding: 24px 28px; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; font-weight: 700; }
    .header p { color: #C7D2FE; margin: 4px 0 0; font-size: 13px; }
    .body { padding: 24px 28px; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
    .stat { background: #F9FAFB; border-radius: 10px; padding: 14px 16px; border: 1px solid #F3F4F6; }
    .stat .label { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; }
    .stat .value { font-size: 22px; font-weight: 700; color: #111827; margin-top: 4px; }
    .note { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 12px 16px; margin-top: 20px; font-size: 12px; color: #92400E; }
    .footer { padding: 16px 28px; border-top: 1px solid #F3F4F6; font-size: 11px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>Aroma Dhaba · Sales Report</h1>
        <p>${rangeLabel || 'Period'} · Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <div class="body">
        <p style="font-size:14px;color:#374151;margin:0 0 4px;">Your sales report is attached as a CSV file. Open it in Excel or Google Sheets.</p>
        ${summary ? `
        <div class="stats">
          <div class="stat">
            <div class="label">Revenue</div>
            <div class="value" style="color:#6366F1;">₹${Number(revenue || 0).toLocaleString()}</div>
          </div>
          <div class="stat">
            <div class="label">Orders</div>
            <div class="value">${orders || 0}</div>
          </div>
          <div class="stat">
            <div class="label">Cancelled</div>
            <div class="value" style="color:${(cancelled || 0) > 0 ? '#EF4444' : '#10B981'};">${cancelled || 0}</div>
          </div>
          <div class="stat">
            <div class="label">Best Seller</div>
            <div class="value" style="font-size:14px;">${topItem || '—'}</div>
          </div>
        </div>
        ` : ''}
        <div class="note">
          ⚠️ <strong>Data is retained for 30 days.</strong> Save this report for long-term access to your sales history.
        </div>
      </div>
      <div class="footer">
        Aroma Ops · Aroma Dhaba, IIM Mumbai · This is an automated report
      </div>
    </div>
  </div>
</body>
</html>
        `.trim();

        const attachments: { filename: string; content: Buffer; contentType: string }[] = [
            {
                filename: filename || 'orders-report.csv',
                content: ordersBuffer,
                contentType: 'text/csv',
            },
        ];

        if (itemsBuffer) {
            attachments.push({
                filename: (filename || 'report').replace('orders', 'items'),
                content: itemsBuffer,
                contentType: 'text/csv',
            });
        }

        const { error } = await resend.emails.send({
            from: 'Aroma Ops <noreply@aromadhaba.in>',
            to: email,
            subject: subject || 'Sales Report · Aroma Dhaba',
            html,
            attachments,
        });

        if (error) {
            console.error('Resend error:', error);
            return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('send-report error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
