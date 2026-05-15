/**
 * sqlite-engine.ts
 *
 * SQLite billing storage for the desktop POS.
 * ONLY used for: active bills, pending sync queue, printer config.
 * Everything else (inventory, settings, analytics) stays in Firebase.
 *
 * Database file lives in app.getPath('userData') so it survives updates.
 */

import { app, ipcMain } from 'electron';
import path from 'path';
import type { LocalBill } from './ipc-types';

// better-sqlite3 is a native addon — must be rebuilt for the Electron ABI.
// The postinstall script handles this automatically.
// eslint-disable-next-line @typescript-eslint/no-var-requires
type Database = import('better-sqlite3').Database;
let db: Database;

// ─── Schema ───────────────────────────────────────────────────────────────────
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS bills (
    id          TEXT    PRIMARY KEY,
    vendor_id   TEXT    NOT NULL,
    order_data  TEXT    NOT NULL,
    pos_token   TEXT    NOT NULL,
    created_at  INTEGER NOT NULL,
    synced      INTEGER NOT NULL DEFAULT 0,
    synced_at   INTEGER,
    firebase_id TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_bills_vendor   ON bills(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_bills_synced   ON bills(synced);
  CREATE INDEX IF NOT EXISTS idx_bills_created  ON bills(created_at DESC);

  CREATE TABLE IF NOT EXISTS printer_config (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    printer_name TEXT,
    updated_at   INTEGER NOT NULL
  );
`;

// ─── Initialisation ───────────────────────────────────────────────────────────
export function initDatabase(): void {
  // Lazy-require so TS compilation doesn't choke when better-sqlite3 isn't rebuilt yet
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require('better-sqlite3');

  const dbPath = app.isPackaged
    ? path.join(app.getPath('userData'), 'pos.db')
    : path.join(__dirname, '../data/pos-dev.db');

  // Ensure data directory exists in dev
  if (!app.isPackaged) {
    const dir = path.dirname(dbPath);
    const { mkdirSync } = require('fs');
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  // WAL mode: better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(SCHEMA);
}

// ─── Bills CRUD ───────────────────────────────────────────────────────────────
export function saveBill(bill: Omit<LocalBill, 'synced' | 'syncedAt'>): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO bills
      (id, vendor_id, order_data, pos_token, created_at, synced)
    VALUES
      (@id, @vendorId, @orderData, @posToken, @createdAt, 0)
  `);
  stmt.run({
    id: bill.id,
    vendorId: bill.vendorId,
    orderData: bill.orderData,
    posToken: bill.posToken,
    createdAt: bill.createdAt,
  });
}

export function getPendingBills(): LocalBill[] {
  const rows = db.prepare(`
    SELECT id, vendor_id, order_data, pos_token, created_at, synced, synced_at, firebase_id
    FROM bills
    WHERE synced = 0
    ORDER BY created_at ASC
    LIMIT 50
  `).all() as Record<string, unknown>[];

  return rows.map(r => ({
    id: r['id'] as string,
    vendorId: r['vendor_id'] as string,
    orderData: r['order_data'] as string,
    posToken: r['pos_token'] as string,
    createdAt: r['created_at'] as number,
    synced: (r['synced'] as number) === 1,
    syncedAt: r['synced_at'] as number | undefined,
    firebaseId: r['firebase_id'] as string | undefined,
  }));
}

export function markBillSynced(id: string, firebaseId: string): void {
  db.prepare(`
    UPDATE bills
    SET synced = 1, synced_at = ?, firebase_id = ?
    WHERE id = ?
  `).run(Date.now(), firebaseId, id);
}

export function getBillCount(): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM bills').get() as { cnt: number };
  return row.cnt;
}

// ─── Printer config ───────────────────────────────────────────────────────────
export function savePrinterConfig(printerName: string): void {
  db.prepare(`
    INSERT OR REPLACE INTO printer_config (id, printer_name, updated_at)
    VALUES (1, ?, ?)
  `).run(printerName, Date.now());
}

export function loadPrinterConfig(): string | null {
  const row = db.prepare('SELECT printer_name FROM printer_config WHERE id = 1').get() as
    | { printer_name: string }
    | undefined;
  return row?.printer_name ?? null;
}

// ─── IPC handler registration ─────────────────────────────────────────────────
export function setupSQLiteHandlers(): void {
  ipcMain.handle(
    'billing:saveBill',
    (_event, bill: Omit<LocalBill, 'synced' | 'syncedAt'>) => {
      saveBill(bill);
    },
  );

  ipcMain.handle('billing:getPendingBills', () => getPendingBills());

  ipcMain.handle('billing:markBillSynced', (_event, id: string, firebaseId: string) => {
    markBillSynced(id, firebaseId);
  });

  ipcMain.handle('billing:getBillCount', () => getBillCount());
}
