// src/app/api/vendor/orders/pos/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin'; // assume admin Firestore instance
import { rateLimit, getClientIp, tooManyRequests } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Schema for POS order payload
const PosOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })
  ),
  // client-provided total (may be tampered)
  totalAmount: z.number().positive(),
  paymentMethod: z.enum(['Cash', 'UPI']),
});

export async function POST(req: Request) {
  const ip = getClientIp();
  // Simple rate limit: 5 POS orders per minute per IP
  const rl = await rateLimit(`posOrders:${ip}`, 5, 60_000);
  if (rl.success === false) {
    return tooManyRequests(rl);
  }

  const body = await req.json();
  const parseResult = PosOrderSchema.safeParse(body);
  if (!parseResult.success) {
    logger.warn('Invalid POS order payload', parseResult.error.flatten());
    return NextResponse.json({ error: 'Invalid order data' }, { status: 400 });
  }
  const { items, totalAmount, paymentMethod } = parseResult.data;

  // Fetch product prices from Firestore and compute expected total
  const productRefs = items.map((i) => adminDb.collection('products').doc(i.productId));
  const snapshots = await adminDb.getAll(...productRefs);
  let computedTotal = 0;
  for (let i = 0; i < items.length; i++) {
    const snap = snapshots[i];
    if (!snap.exists) {
      logger.warn('POS order contains unknown product', items[i].productId);
      return NextResponse.json({ error: 'Invalid product in order' }, { status: 400 });
    }
    const data = snap.data() as { price: number };
    computedTotal += data.price * items[i].quantity;
  }

  // Allow a small rounding tolerance (cents)
  if (Math.abs(computedTotal - totalAmount) > 0.01) {
    logger.warn('POS order total mismatch', { expected: computedTotal, provided: totalAmount });
    return NextResponse.json({ error: 'Order total mismatch' }, { status: 400 });
  }

  // Create POS order using server-side logic (reuse vendor lib)
  const { createPOSOrder } = await import('@/lib/vendor');
  const orderId = await createPOSOrder(
    items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    totalAmount,
    totalAmount,
    paymentMethod as 'Cash' | 'UPI'
  );

  logger.info('POS order created', { orderId, ip });
  return NextResponse.json({ orderId }, { status: 201 });
}
