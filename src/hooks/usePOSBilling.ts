'use client';

import { useCallback, useState } from 'react';
import type { Order, OrderItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface POSBillInput {
  vendorId: string;
  items: OrderItem[];
  grandTotal: number;
  paymentMethod: 'cash' | 'upi';
}

interface POSBillResult {
  localId: string;
  posToken: string;
  printed: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePOSBilling() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBill = useCallback(async (input: POSBillInput): Promise<POSBillResult | null> => {
    setIsCreating(true);
    setError(null);

    try {
      return await createBillWeb(input);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? 'Failed to create bill';
      setError(msg);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { createBill, isCreating, error };
}

// ─── Web path ─────────────────────────────────────────────────────────────────

async function createBillWeb(input: POSBillInput): Promise<POSBillResult> {
  const res = await fetch('/api/vendor/orders/pos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: input.items,
      grandTotal: input.grandTotal,
      paymentMethod: input.paymentMethod,
      vendorId: input.vendorId,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }

  const data = await res.json();
  return {
    localId: data.orderId ?? data.id ?? 'web',
    posToken: data.posToken ?? String(data.orderToken ?? ''),
    printed: data.printed ?? false,
  };
}

// ─── Helper kept for any callers that build Order objects locally ─────────────

export function buildOrderObject(
  id: string,
  input: POSBillInput,
  posToken: string,
  timestamp: number,
): Partial<Order> {
  const itemTotal = input.items.reduce((s, i) => s + i.price * i.quantity, 0);
  return {
    id,
    userId: input.vendorId,
    orderType: 'pos',
    items: input.items,
    itemTotal,
    dukanFee: 0,
    deliveryFee: 0,
    grandTotal: input.grandTotal,
    orderDate: new Date(timestamp),
    status: 'Placed',
    orderToken: posToken,
    payment_status: input.paymentMethod === 'upi' ? 'success' : 'pending',
    deliveryAddress: {
      name: 'Walk-in',
      mobile: '',
      hostelNumber: '',
      roomNumber: '',
      deliveryType: 'Takeaway',
    },
  };
}
