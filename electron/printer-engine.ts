/**
 * printer-engine.ts
 *
 * Native printer integration for Electron main process.
 * Ported from byte_printer/server.js — no HTTP server, no Express.
 * All operations are called directly via IPC handlers in main.ts.
 */

import { exec, execSync } from 'child_process';
import { app, ipcMain } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { PrintResult, PrinterInfo, PrinterStatus } from './ipc-types';

// ─── Receipt formatter (CommonJS module from byte_printer) ───────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { formatReceiptRaw, formatReceiptText, formatReportRaw } = require(
  app.isPackaged
    ? path.join(process.resourcesPath, 'byte_printer', 'receipt.js')
    : path.join(__dirname, '../byte_printer/receipt.js'),
);

// ─── Constants ────────────────────────────────────────────────────────────────
const VERSION = '1.0.0';
const PHYSICAL_PRINT_DELAY_MS = 3000;
const TEMP_CLEANUP_DELAY_MS = 8000;
const THERMAL_KEYWORDS = ['epson', 'pos', 'thermal', 'tm-t', 'tm_t', 'receipt', 'rp', 'xp', 'star', 'citizen', 'sewoo', 'bixolon', 'rongta', 'xprinter'];
const AVOID_KEYWORDS = ['pdf', 'onenote', 'microsoft', 'airprint', 'fax', 'xps', 'virtual', 'docuprint', 'foxit'];

const IS_WINDOWS = os.platform() === 'win32';

// ─── State ────────────────────────────────────────────────────────────────────
let activePrinterName: string | null = null;
let isConnected = false;
let availablePrinters: PrinterInfo[] = [];

// Serial promise queue — one print job at a time to protect the thermal hardware
let printQueue: Promise<void> = Promise.resolve();
let pendingJobCount = 0;

// ─── Printer scoring ──────────────────────────────────────────────────────────
function scorePrinter(name: string): number {
  const lower = name.toLowerCase();
  if (AVOID_KEYWORDS.some(k => lower.includes(k))) return -1;
  return THERMAL_KEYWORDS.reduce((score, k) => score + (lower.includes(k) ? 10 : 0), 1);
}

// ─── Detection ────────────────────────────────────────────────────────────────
function detectWindowsPrinters(): void {
  try {
    const output = execSync(
      'powershell -WindowStyle Hidden -NonInteractive -Command "Get-Printer | Select-Object -ExpandProperty Name"',
      { encoding: 'utf-8', windowsHide: true },
    );
    const all = output.split('\n').map(p => p.trim()).filter(Boolean);
    availablePrinters = all
      .map(name => ({ name, score: scorePrinter(name) }))
      .filter(p => p.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (availablePrinters.length > 0) {
      if (!activePrinterName) activePrinterName = availablePrinters[0].name;
      isConnected = true;
    } else {
      isConnected = false;
    }
  } catch {
    isConnected = false;
  }
}

function detectMacPrinters(): void {
  try {
    let allNames: string[] = [];
    try {
      const out = execSync('lpstat -a 2>/dev/null', { encoding: 'utf-8' }).trim();
      allNames = out.split('\n').map(line => line.split(' ')[0].trim()).filter(Boolean);
    } catch { /* empty */ }

    if (allNames.length === 0) {
      try {
        const out = execSync('lpstat -p 2>/dev/null', { encoding: 'utf-8' }).trim();
        allNames = out
          .split('\n')
          .filter(line => line.startsWith('printer '))
          .map(line => line.split(' ')[1])
          .filter(Boolean);
      } catch { /* empty */ }
    }

    availablePrinters = allNames
      .map(name => ({ name, score: scorePrinter(name) }))
      .filter(p => p.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (availablePrinters.length > 0) {
      if (!activePrinterName) {
        const best = availablePrinters[0];
        if (best.score > 1) {
          activePrinterName = best.name;
        } else {
          try {
            const defaultOut = execSync('lpstat -d 2>/dev/null', { encoding: 'utf-8' }).trim();
            const m = defaultOut.match(/system default destination:\s*(.+)/);
            activePrinterName = m ? m[1].trim() : best.name;
          } catch {
            activePrinterName = best.name;
          }
        }
      }
      isConnected = true;
    } else {
      try {
        const defaultOut = execSync('lpstat -d 2>/dev/null', { encoding: 'utf-8' }).trim();
        const m = defaultOut.match(/system default destination:\s*(.+)/);
        if (m) {
          activePrinterName = m[1].trim();
          availablePrinters = [{ name: activePrinterName, score: 1 }];
          isConnected = true;
        } else {
          isConnected = false;
        }
      } catch {
        isConnected = false;
      }
    }
  } catch {
    isConnected = false;
  }
}

export function detectPrinters(): void {
  if (IS_WINDOWS) {
    detectWindowsPrinters();
  } else {
    detectMacPrinters();
  }
}

function printerExists(name: string): boolean {
  return availablePrinters.some(p => p.name === name);
}

// ─── Raw physical print ───────────────────────────────────────────────────────
function printViaWindows(rawData: string[], token: string, printer: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `receipt_${token}_${Date.now()}.bin`);
  const buffer = Buffer.from(rawData.join(''), 'binary');
  fs.writeFileSync(tmpFile, buffer);

  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'printer-scripts', 'raw-print.ps1')
    : path.join(__dirname, '../byte_printer/scripts/raw-print.ps1');

  return new Promise((resolve, reject) => {
    const cmd = `powershell -WindowStyle Hidden -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}" -printerName "${printer}" -filePath "${tmpFile}"`;
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch { /* empty */ } }, TEMP_CLEANUP_DELAY_MS);
      if (err) reject(new Error(stderr || stdout || err.message));
      else resolve(stdout.trim());
    });
  });
}

function printViaCUPS(rawData: string[], token: string, printer: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `receipt_${token}_${Date.now()}.bin`);
    const buffer = Buffer.from(rawData.join(''), 'binary');
    fs.writeFileSync(tmpFile, buffer);
    const cmd = `lp -d "${printer}" -o raw "${tmpFile}"`;
    exec(cmd, (err, stdout, stderr) => {
      setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch { /* empty */ } }, TEMP_CLEANUP_DELAY_MS);
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

async function physicalPrint(rawData: string[], token: string, printer: string): Promise<void> {
  if (IS_WINDOWS) {
    await printViaWindows(rawData, token, printer);
  } else {
    await printViaCUPS(rawData, token, printer);
  }
}

// ─── Queue helper ─────────────────────────────────────────────────────────────
function enqueueJob(fn: () => Promise<void>): void {
  pendingJobCount++;
  printQueue = printQueue.then(async () => {
    try {
      await fn();
    } catch (err: unknown) {
      console.error('Print queue error:', (err as Error).message);
    } finally {
      pendingJobCount = Math.max(0, pendingJobCount - 1);
    }
  });
}

// ─── Public print functions ───────────────────────────────────────────────────
export async function printReceipt(
  order: object,
  token: string,
  requestedPrinter?: string,
): Promise<PrintResult> {
  const text: string = formatReceiptText(order, token);

  if (!isConnected || !activePrinterName) {
    return { success: true, printed: false, message: 'No printer — receipt logged', receipt: text };
  }

  let targetPrinter = activePrinterName;
  if (requestedPrinter && requestedPrinter !== activePrinterName) {
    if (printerExists(requestedPrinter)) targetPrinter = requestedPrinter;
  }

  enqueueJob(async () => {
    const rawData: string[] = formatReceiptRaw(order, token);
    try {
      await physicalPrint(rawData, token, targetPrinter);
    } catch (err: unknown) {
      console.error(`Print failed #${token}:`, (err as Error).message);
      if (targetPrinter !== activePrinterName && activePrinterName) {
        try {
          const fallbackRaw: string[] = formatReceiptRaw(order, token);
          await physicalPrint(fallbackRaw, token, activePrinterName);
        } catch (retryErr: unknown) {
          console.error(`Fallback print failed #${token}:`, (retryErr as Error).message);
        }
      }
    }
    await new Promise(r => setTimeout(r, PHYSICAL_PRINT_DELAY_MS));
  });

  return { success: true, printed: true, message: 'Queued for printing' };
}

export async function printReport(reportData: object): Promise<PrintResult> {
  if (!isConnected || !activePrinterName) {
    return { success: true, printed: false, message: 'No printer connected' };
  }

  const token = `RPT-${Date.now()}`;
  enqueueJob(async () => {
    const rawData: string[] = formatReportRaw(reportData);
    try {
      await physicalPrint(rawData, token, activePrinterName!);
    } catch (err: unknown) {
      console.error('Report print failed:', (err as Error).message);
    }
    await new Promise(r => setTimeout(r, PHYSICAL_PRINT_DELAY_MS));
  });

  return { success: true, printed: true, message: 'Report queued' };
}

export function getStatus(): PrinterStatus {
  return {
    connected: isConnected,
    printerName: activePrinterName,
    platform: os.platform(),
    queueDepth: pendingJobCount,
    version: VERSION,
  };
}

export function setPrinter(name: string): { success: boolean; error?: string } {
  detectPrinters();
  if (!printerExists(name)) {
    return { success: false, error: `Printer "${name}" not found` };
  }
  activePrinterName = name;
  isConnected = true;
  return { success: true };
}

// ─── IPC handler registration ─────────────────────────────────────────────────
export function setupPrinterHandlers(): void {
  detectPrinters();

  ipcMain.handle('printer:getStatus', () => {
    if (!isConnected || !activePrinterName) detectPrinters();
    return getStatus();
  });

  ipcMain.handle('printer:getPrinters', () => {
    detectPrinters();
    return availablePrinters;
  });

  ipcMain.handle('printer:setPrinter', (_event, name: string) => setPrinter(name));

  ipcMain.handle('printer:print', (_event, order: object, token: string, printerName?: string) =>
    printReceipt(order, token, printerName),
  );

  ipcMain.handle('printer:printReport', (_event, reportData: object) =>
    printReport(reportData),
  );
}
