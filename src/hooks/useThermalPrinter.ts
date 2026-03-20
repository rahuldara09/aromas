'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Order } from '@/types';

// Try HTTPS first (needed when site is on HTTPS), fall back to HTTP
const PRINT_URLS = [
    'https://localhost:9443',
    'http://localhost:9100',
];

const HEALTH_CHECK_INTERVAL = 5000;

export function useThermalPrinter() {
    const [isConnected, setIsConnected] = useState(false);
    const [printerName, setPrinterName] = useState<string | null>(null);
    const activeUrlRef = useRef<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // ─── HEALTH CHECK POLL ────────────────────────────────────────────
    useEffect(() => {
        const checkStatus = async () => {
            // Try each URL until one works
            for (const baseUrl of PRINT_URLS) {
                try {
                    const res = await fetch(`${baseUrl}/status`, {
                        signal: AbortSignal.timeout(2000),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setIsConnected(data.connected ?? true);
                        setPrinterName(data.printerName || 'Print Server');
                        activeUrlRef.current = baseUrl;
                        return; // Found a working URL
                    }
                } catch {
                    // Try next URL
                }
            }
            // None worked
            setIsConnected(false);
            setPrinterName(null);
            activeUrlRef.current = null;
        };

        checkStatus();
        intervalRef.current = setInterval(checkStatus, HEALTH_CHECK_INTERVAL);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // ─── PRINT KOT ───────────────────────────────────────────────────
    const printKOT = useCallback(async (order: Order, tokenNum: string) => {
        const baseUrl = activeUrlRef.current;
        if (!baseUrl) {
            throw new Error('Print server not reachable');
        }

        const res = await fetch(`${baseUrl}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order, token: tokenNum }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Print failed' }));
            throw new Error(err.error || 'Print failed');
        }

        return true;
    }, []);

    return {
        isConnected,
        printerName,
        printKOT
    };
}
