'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/types';


// The browser must communicate directly with the local print server over HTTP.
// Because the local print server now explicitly broadcasts `Access-Control-Allow-Private-Network: true`,
// Chrome will perfectly allow it to fetch from `127.0.0.1:9100`!
const PRINTER_API_URL = 'http://127.0.0.1:9100/print';
const PRINTER_HEALTH_URL = 'http://127.0.0.1:9100';
const PRINT_TIMEOUT_MS = 5000;


/**
 * useThermalPrinter
 *
 * Sends print jobs to the local Express printer service at localhost:4000.
 * Replaces the QZ Tray WebSocket approach with a simple HTTP POST.
 *
 * isConnected → true when the printer service is reachable (checked on mount)
 * isPrinting  → true while a print job is in-flight
 * printKOT    → sends POST /print with { orderId, items }; throws on error/timeout
 */
export function useThermalPrinter() {
    const [isConnected, setIsConnected] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    // ─── HEALTH CHECK ────────────────────────────────────────────────────────
    // Ping the printer service on mount and periodically to keep isConnected fresh.
    const checkHealth = useCallback(async () => {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 3000);
            const res = await fetch(`${PRINTER_HEALTH_URL}/status`, {
                method: 'GET',
                signal: ctrl.signal,
            });
            clearTimeout(timer);
            setIsConnected(res.ok);
        } catch {
            // Service unreachable or /health not defined — try a lightweight OPTIONS
            try {
                const ctrl2 = new AbortController();
                const timer2 = setTimeout(() => ctrl2.abort(), 3000);
                await fetch(PRINTER_API_URL, {
                    method: 'OPTIONS',
                    signal: ctrl2.signal,
                });
                clearTimeout(timer2);
                setIsConnected(true);
            } catch {
                setIsConnected(false);
            }
        }
    }, []);

    useEffect(() => {
        // Initial check
        checkHealth();

        // Re-check every 10 seconds so the banner updates when the service starts/stops
        const interval = setInterval(checkHealth, 10_000);
        return () => clearInterval(interval);
    }, [checkHealth]);

    // ─── PRINT KOT ───────────────────────────────────────────────────────────
    const printKOT = useCallback(
        async (order: Order, _tokenNum: string) => {
            setIsPrinting(true);

            try {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), PRINT_TIMEOUT_MS);

                let response: Response;
                try {
                    response = await fetch(PRINTER_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            order,
                            token: _tokenNum,
                        }),
                        signal: ctrl.signal,
                    });
                } catch (err: any) {
                    // AbortError = timeout; other errors = service down
                    if (err?.name === 'AbortError') {
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

                // Service is clearly reachable after a successful print
                setIsConnected(true);
                return true;
            } finally {
                setIsPrinting(false);
            }
        },
        [],
    );

    return {
        isConnected,
        printerName: isConnected ? 'Local Printer Service' : null,
        printKOT,
        isPrinting,
    };
}
