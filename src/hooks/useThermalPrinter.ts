'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Order } from '@/types';

const PRINT_SERVER_URL = 'http://localhost:9100';
const HEALTH_CHECK_INTERVAL = 5000; // 5 seconds

export function useThermalPrinter() {
    const [isConnected, setIsConnected] = useState(false);
    const [printerName, setPrinterName] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // ─── HEALTH CHECK POLL ────────────────────────────────────────────
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${PRINT_SERVER_URL}/status`, {
                    signal: AbortSignal.timeout(2000),
                });
                if (res.ok) {
                    const data = await res.json();
                    setIsConnected(data.connected ?? true); // server is running
                    setPrinterName(data.printerName || 'Print Server');
                } else {
                    setIsConnected(false);
                    setPrinterName(null);
                }
            } catch {
                setIsConnected(false);
                setPrinterName(null);
            }
        };

        // Check immediately, then poll
        checkStatus();
        intervalRef.current = setInterval(checkStatus, HEALTH_CHECK_INTERVAL);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // ─── PRINT KOT ───────────────────────────────────────────────────
    const printKOT = useCallback(async (order: Order, tokenNum: string) => {
        const res = await fetch(`${PRINT_SERVER_URL}/print`, {
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
