// Shared IPC type definitions — used by both main process and renderer (via preload)

export interface PrinterInfo {
  name: string;
  score: number;
}

export interface PrinterStatus {
  connected: boolean;
  printerName: string | null;
  platform: string;
  queueDepth: number;
  version: string;
}

export interface PrintResult {
  success: boolean;
  printed: boolean;
  message?: string;
  receipt?: string;
}

export interface LocalBill {
  id: string;
  vendorId: string;
  orderData: string;   // JSON-serialised Order object
  posToken: string;
  createdAt: number;   // Unix ms
  synced: boolean;
  syncedAt?: number;   // Unix ms — set after Firebase upload succeeds
  firebaseId?: string; // Firestore document ID once synced
}

// The object exposed to renderer via contextBridge
export interface ElectronBridge {
  printer: {
    getStatus: () => Promise<PrinterStatus>;
    getPrinters: () => Promise<PrinterInfo[]>;
    setPrinter: (name: string) => Promise<{ success: boolean; error?: string }>;
    print: (order: object, token: string, printerName?: string) => Promise<PrintResult>;
    printReport: (reportData: object) => Promise<PrintResult>;
  };
  billing: {
    saveBill: (bill: Omit<LocalBill, 'synced' | 'syncedAt'>) => Promise<void>;
    getPendingBills: () => Promise<LocalBill[]>;
    markBillSynced: (id: string, firebaseId: string) => Promise<void>;
    getBillCount: () => Promise<number>;
  };
  system: {
    platform: string;
    version: string;
    isDesktop: true;
  };
}

// Augment the global Window so TypeScript knows about electronBridge
declare global {
  interface Window {
    electronBridge?: ElectronBridge;
  }
}
