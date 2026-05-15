'use client';

/**
 * usePOSBilling
 *
 * Local-first POS billing hook for the desktop app.
 *
 * Flow in Electron (desktop):
 *   1. Generate a local UUID for the bill
 *   2. Save to SQLite immediately (instant, no network)
 *   3. Print the receipt immediately via native IPC
 *   4. Attempt Firebase sync in the background (usePOSSync handles retries)
 *
 * Flow in browser (web):
 *   Falls back to the original HTTP API call — behaviour unchanged.
 *
 * Usage: drop-in inside POSDrawer or wherever createPOSOrder is called.
 */

import { useCallback, useState } from 'react';
import {
  desktopGetBillCount,
  desktopPrint,
  desktopSaveBill,
  isElectron,
} from '@/lib/electron-bridge';
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
  /** True when the receipt was sent to the printer (even if printing is async) */
  printed: boolean;
}

// ─── Token generation ─────────────────────────────────────────────────────────
// Simple daily counter stored in memory — reset on app restart (acceptable for POS)
let _sessionCounter = 0;

function buildPosToken(count: number): string {
  const now = new Date();
  const hhmm = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '');
  return `P${String(count).padStart(3, '0')}-${hhmm}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePOSBilling() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBill = useCallback(async (input: POSBillInput): Promise<POSBillResult | null> => {
    setIsCreating(true);
    setError(null);

    try {
      if (isElectron()) {
        return await createBillDesktop(input);
      } else {
        return await createBillWeb(input);
      }
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

// ─── Desktop path ─────────────────────────────────────────────────────────────

async function createBillDesktop(input: POSBillInput): Promise<POSBillResult> {
  const localId = crypto.randomUUID();
  const now = Date.now();

  // Derive counter from SQLite total so it's persistent across restarts
  const totalBills = await desktopGetBillCount();
  _sessionCounter = totalBills + 1;
  const posToken = buildPosToken(_sessionCounter);

  const order = buildOrderObject(localId, input, posToken, now);

  // 1. Persist locally (sync, instant)
  await desktopSaveBill({
    id: localId,
    vendorId: input.vendorId,
    orderData: JSON.stringify(order),
    posToken,
    createdAt: now,
  });

  // 2. Print immediately (async queue in main process — returns before paper exits)
  const printResult = await desktopPrint(order, posToken);

  return {
    localId,
    posToken,
    printed: printResult?.printed ?? false,
  };
}

// ─── Web path (unchanged behaviour) ──────────────────────────────────────────

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

// ─── Helper: build an Order-shaped object for SQLite + receipt formatter ─────

function buildOrderObject(
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
