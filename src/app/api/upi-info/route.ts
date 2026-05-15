import { NextResponse } from 'next/server';

/**
 * GET /api/upi-info
 * Public endpoint — returns UPI ID and payee name for the vendor.
 * Used by the vendor portal to generate per-order payment deeplinks.
 */
export async function GET() {
    const upiId = process.env.VENDOR_UPI_ID ?? '';
    const payeeName = process.env.VENDOR_UPI_NAME ?? 'Aroma Dhaba';
    return NextResponse.json({ upiId, payeeName });
}
