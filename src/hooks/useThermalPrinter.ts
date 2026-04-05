'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/types';


// The browser must communicate directly with the local print server.
// To handle Mixed Content (HTTPS site talking to localhost):
// 1. Use port 9100 for local development (HTTP).
// 2. Use port 9443 for production (HTTPS).
const isPageSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
const PRINTER_BASE_URL = isPageSecure ? 'https://localhost:9443' : 'http://localhost:9100';

const PRINTER_API_URL = `${PRINTER_BASE_URL}/print`;
const PRINTER_STATUS_URL = `${PRINTER_BASE_URL}/status`;
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
    const [printerName, setPrinterName] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);

    // ─── HEALTH CHECK ────────────────────────────────────────────────────────
    // Ping the printer service on mount and periodically to keep isConnected fresh.
    const checkHealth = useCallback(async () => {
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
        // Initial check
        checkHealth();

        // Re-check every 5 seconds so the settings status is responsive
        const interval = setInterval(checkHealth, 5_000);
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
        printerName,
        username,
        printKOT,
        isPrinting,
    };
}
