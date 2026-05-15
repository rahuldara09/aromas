'use client';

/**
 * usePOSSync
 *
 * Background sync hook for the desktop POS app.
 * Runs ONLY in Electron — no-op in the web browser.
 *
 * Every SYNC_INTERVAL_MS it:
 *   1. Reads all unsynced bills from SQLite (via IPC)
 *   2. POSTs each one to /api/vendor/orders/pos (the existing Firebase route)
 *   3. On success, marks the bill as synced in SQLite
 *
 * Mount this in a layout or context that wraps vendor routes so it runs
 * continuously while the vendor is logged in.
 *
 * Usage:
 *   // In vendor layout or VendorContext
 *   usePOSSync(vendorId);
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { desktopGetPendingBills, desktopMarkBillSynced, isElectron } from '@/lib/electron-bridge';

const SYNC_INTERVAL_MS = 15_000; // Try to sync every 15 seconds
const MAX_RETRIES_PER_SESSION = 3; // Give up on a single bill after 3 tries (resets on remount)

interface SyncState {
  pendingCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
  isSyncing: boolean;
}

export function usePOSSync(vendorId: string | null | undefined): SyncState {
  const [state, setState] = useState<SyncState>({
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
    isSyncing: false,
  });

  // Track per-session retry counts so we don't hammer a broken bill
  const retryMap = useRef<Map<string, number>>(new Map());

  const runSync = useCallback(async () => {
    if (!isElectron() || !vendorId) return;

    const pending = await desktopGetPendingBills();
    const billsForThisVendor = pending.filter(b => b.vendorId === vendorId);

    if (billsForThisVendor.length === 0) {
      setState(s => ({ ...s, pendingCount: 0 }));
      return;
    }

    setState(s => ({ ...s, isSyncing: true, pendingCount: billsForThisVendor.length }));

    let successCount = 0;
    let lastError: string | null = null;

    for (const bill of billsForThisVendor) {
      // Skip bills that have failed too many times this session
      const retries = retryMap.current.get(bill.id) ?? 0;
      if (retries >= MAX_RETRIES_PER_SESSION) continue;

      try {
        const order = JSON.parse(bill.orderData);

        const res = await fetch('/api/vendor/orders/pos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...order,
            localBillId: bill.id,
            posToken: bill.posToken,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const firebaseId: string = data.orderId ?? data.id ?? bill.id;
          await desktopMarkBillSynced(bill.id, firebaseId);
          retryMap.current.delete(bill.id);
          successCount++;
        } else {
          const text = await res.text().catch(() => res.statusText);
          lastError = text;
          retryMap.current.set(bill.id, retries + 1);
        }
      } catch (err: unknown) {
        lastError = (err as Error).message;
        retryMap.current.set(bill.id, retries + 1);
      }
    }

    const remaining = await desktopGetPendingBills();
    const remainingForVendor = remaining.filter(b => b.vendorId === vendorId).length;

    setState({
      pendingCount: remainingForVendor,
      lastSyncAt: successCount > 0 ? new Date() : state.lastSyncAt,
      lastError,
      isSyncing: false,
    });
  }, [vendorId, state.lastSyncAt]);

  useEffect(() => {
    if (!isElectron() || !vendorId) return;

    // Run immediately, then on interval
    runSync();
    const interval = setInterval(runSync, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [runSync, vendorId]);

  return state;
}
