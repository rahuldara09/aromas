/**
 * preload.ts
 *
 * Runs in a sandboxed renderer context with access to Node/Electron APIs.
 * Exposes a safe, typed interface to the renderer via contextBridge.
 * The renderer accesses this as window.electronBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronBridge, LocalBill } from './ipc-types';

const bridge: ElectronBridge = {
  // ─── Printer ─────────────────────────────────────────────────────────────
  printer: {
    getStatus: () => ipcRenderer.invoke('printer:getStatus'),
    getPrinters: () => ipcRenderer.invoke('printer:getPrinters'),
    setPrinter: (name: string) => ipcRenderer.invoke('printer:setPrinter', name),
    print: (order: object, token: string, printerName?: string) =>
      ipcRenderer.invoke('printer:print', order, token, printerName),
    printReport: (reportData: object) =>
      ipcRenderer.invoke('printer:printReport', reportData),
  },

  // ─── Billing (SQLite) ─────────────────────────────────────────────────────
  billing: {
    saveBill: (bill: Omit<LocalBill, 'synced' | 'syncedAt'>) =>
      ipcRenderer.invoke('billing:saveBill', bill),
    getPendingBills: () => ipcRenderer.invoke('billing:getPendingBills'),
    markBillSynced: (id: string, firebaseId: string) =>
      ipcRenderer.invoke('billing:markBillSynced', id, firebaseId),
    getBillCount: () => ipcRenderer.invoke('billing:getBillCount'),
  },

  // ─── System info (sync — available immediately) ───────────────────────────
  system: {
    platform: process.platform,
    version: process.env.npm_package_version ?? '1.0.0',
    isDesktop: true,
  },
};

contextBridge.exposeInMainWorld('electronBridge', bridge);
