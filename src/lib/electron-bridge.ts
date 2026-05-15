'use client';

/**
 * electron-bridge.ts
 *
 * Renderer-side helper that detects whether the app is running inside Electron
 * and provides typed access to the electronBridge exposed by preload.ts.
 *
 * Import this in any component/hook that needs desktop-native capabilities.
 * It is safe to import in the web build — all functions become no-ops/stubs.
 */

import type { ElectronBridge, LocalBill, PrintResult, PrinterStatus } from '../../electron/ipc-types';

// ─── Detection ────────────────────────────────────────────────────────────────

export function isElectron(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as { electronBridge?: unknown }).electronBridge !== 'undefined'
  );
}

function getBridge(): ElectronBridge | null {
  if (!isElectron()) return null;
  return (window as { electronBridge: ElectronBridge }).electronBridge;
}

// ─── Printer ──────────────────────────────────────────────────────────────────

export async function desktopPrinterStatus(): Promise<PrinterStatus | null> {
  return getBridge()?.printer.getStatus() ?? null;
}

export async function desktopGetPrinters() {
  return getBridge()?.printer.getPrinters() ?? [];
}

export async function desktopSetPrinter(name: string) {
  return getBridge()?.printer.setPrinter(name) ?? { success: false, error: 'Not in desktop mode' };
}

export async function desktopPrint(
  order: object,
  token: string,
  printerName?: string,
): Promise<PrintResult | null> {
  return getBridge()?.printer.print(order, token, printerName) ?? null;
}

export async function desktopPrintReport(reportData: object): Promise<PrintResult | null> {
  return getBridge()?.printer.printReport(reportData) ?? null;
}

// ─── Billing (SQLite) ─────────────────────────────────────────────────────────

export async function desktopSaveBill(
  bill: Omit<LocalBill, 'synced' | 'syncedAt'>,
): Promise<void> {
  await getBridge()?.billing.saveBill(bill);
}

export async function desktopGetPendingBills(): Promise<LocalBill[]> {
  return getBridge()?.billing.getPendingBills() ?? [];
}

export async function desktopMarkBillSynced(id: string, firebaseId: string): Promise<void> {
  await getBridge()?.billing.markBillSynced(id, firebaseId);
}

export async function desktopGetBillCount(): Promise<number> {
  return getBridge()?.billing.getBillCount() ?? 0;
}

// ─── System ───────────────────────────────────────────────────────────────────

export function desktopPlatform(): string | null {
  return getBridge()?.system.platform ?? null;
}

export function desktopVersion(): string | null {
  return getBridge()?.system.version ?? null;
}
