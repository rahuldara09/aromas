'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/types';

const PRINTER_BASE_URL = 'http://127.0.0.1:9100';
const PRINTER_API_URL = `${PRINTER_BASE_URL}/print`;
const PRINTER_STATUS_URL = `${PRINTER_BASE_URL}/status`;
const PRINT_TIMEOUT_MS = 12000;

export function useThermalPrinter() {
    const [isConnected, setIsConnected] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printerName, setPrinterName] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);

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
        checkHealth();
        const interval = setInterval(checkHealth, 5_000);
        return () => clearInterval(interval);
    }, [checkHealth]);

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

    const getPrinters = useCallback(async () => [], []);

    const setPrinter = useCallback(async (_name: string) => {
        return { success: false, error: 'Not in desktop mode' };
    }, []);

    return {
        isConnected,
        printerName,
        username,
        printKOT,
        isPrinting,
        getPrinters,
        setPrinter,
    };
}
