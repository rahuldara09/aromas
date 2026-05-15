'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/types';
import { desktopPrint, desktopPrinterStatus, desktopGetPrinters, desktopSetPrinter, isElectron } from '@/lib/electron-bridge';

// ─── Web constants (HTTP bridge to byte_printer service) ──────────────────────
// Use 127.0.0.1 to take advantage of the fact that modern browsers
// consider loopback requests secure, allowing Mixed Content (HTTP from HTTPS).
const PRINTER_BASE_URL = 'http://127.0.0.1:9100';
const PRINTER_API_URL = `${PRINTER_BASE_URL}/print`;
const PRINTER_STATUS_URL = `${PRINTER_BASE_URL}/status`;
const PRINT_TIMEOUT_MS = 12000;

/**
 * useThermalPrinter
 *
 * Unified thermal printer hook for both web and desktop environments.
 *
 * In Electron (desktop): uses native IPC → zero HTTP overhead, instant printing.
 * In browser (web):      uses HTTP POST to the byte_printer Express service on :9100.
 *
 * The surface API is identical in both modes so all existing components work unchanged.
 */
export function useThermalPrinter() {
    const [isConnected, setIsConnected] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printerName, setPrinterName] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);

    // ─── HEALTH CHECK ──────────────────────────────────────────────────────────
    const checkHealth = useCallback(async () => {
        if (isElectron()) {
            // Desktop: query the native printer engine via IPC
            try {
                const status = await desktopPrinterStatus();
                if (status) {
                    setIsConnected(status.connected);
                    setPrinterName(status.printerName);
                } else {
                    setIsConnected(false);
                }
            } catch {
                setIsConnected(false);
            }
            return;
        }

        // Web: HTTP ping to byte_printer service
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(PRINTER_STATUS_URL, {
                method: 'GET',
                signal: ctrl.signal,
            });
            clearTimeout(timer);

            if (res.ok) {
                const data = await res.json();
                setIsConnected(data.connected);
                setPrinterName(data.printerName);
                if (data.username) setUsername(data.username);
            } else {
                setIsConnected(false);
            }
        } catch (err) {
            console.warn('Printer health check failed:', err);
            setIsConnected(false);
        }
    }, []);

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 5_000);
        return () => clearInterval(interval);
    }, [checkHealth]);

    // ─── PRINT KOT ────────────────────────────────────────────────────────────
    const printKOT = useCallback(
        async (order: Order, _tokenNum: string) => {
            setIsPrinting(true);
            try {
                if (isElectron()) {
                    // Desktop: IPC call → main process → thermal printer
                    const result = await desktopPrint(order as unknown as object, _tokenNum);
                    if (!result?.success) {
                        throw new Error('Print failed via desktop bridge');
                    }
                    setIsConnected(true);
                    return true;
                }

                // Web: HTTP POST to byte_printer service
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), PRINT_TIMEOUT_MS);

                let response: Response;
                try {
                    response = await fetch(PRINTER_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ order, token: _tokenNum }),
                        signal: ctrl.signal,
                    });
                } catch (err: unknown) {
                    if ((err as Error)?.name === 'AbortError') {
                        throw new Error('Print failed: request timed out');
                    }
                    throw new Error('Print failed: printer service unreachable');
                } finally {
                    clearTimeout(timer);
                }

                if (!response.ok) {
                    const text = await response.text().catch(() => '');
                    throw new Error(`Print failed: ${text || response.statusText}`);
                }

                setIsConnected(true);
                return true;
            } finally {
                setIsPrinting(false);
            }
        },
        [],
    );

    // ─── PRINTER LIST (desktop only — no-op on web) ───────────────────────────
    const getPrinters = useCallback(async () => {
        if (isElectron()) return desktopGetPrinters();
        return [];
    }, []);

    const setPrinter = useCallback(async (name: string) => {
        if (isElectron()) return desktopSetPrinter(name);
        return { success: false, error: 'Not in desktop mode' };
    }, []);

    return {
        isConnected,
        printerName,
        username,
        printKOT,
        isPrinting,
        // Desktop-only extras
        getPrinters,
        setPrinter,
    };
}
