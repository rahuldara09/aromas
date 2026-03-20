'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Order } from '@/types';
import { formatReceipt } from '@/lib/receiptFormatter';

// Global QZ Tray type
declare global {
    interface Window {
        qz: any;
    }
}

const DEFAULT_PRINTER = 'Printer_POS_80';

export function useThermalPrinter() {
    const [isConnected, setIsConnected] = useState(false);
    const [printerName, setPrinterName] = useState<string | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const connectingRef = useRef(false);

    // ─── CONNECT TO QZ TRAY ───────────────────────────────────────────
    const connect = useCallback(async () => {
        if (typeof window === 'undefined' || !window.qz) return;
        if (connectingRef.current) return;

        const qz = window.qz;

        // Skip if already connected
        if (qz.websocket.isActive()) {
            setIsConnected(true);
            return;
        }

        connectingRef.current = true;

        // ── Certificate: allow unsigned for development ──
        qz.security.setCertificatePromise(function(resolve: any, reject: any) {
            // Must be a valid x509 base64 structure, "FAKE_CERT" will throw Java ASN.1 parsing errors on the socket
            const cert = '-----BEGIN CERTIFICATE-----\n' +
                'MIIBkTCB+wIJAM2C5drVksMXMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnFp\n' +
                'dHJheTAeFw0yMzAxMDEwMDAwMDBaFw0yNTAxMDEwMDAwMDBaMBExDzANBgNVBAMM\n' +
                'BnFpdHJheTBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQC3q2dFiYHJW4bXx3YDzVJp\n' +
                'Xr6v3Kx7Fn7GdxnXzKFJrE0d/JrE0d/JrE0d/JrE0d/JrE0d/JrE0dAgMBAAEw\n' +
                'DQYJKoZIhvcNAQELBQADQQBPlKLH\n' +
                '-----END CERTIFICATE-----';
            if (typeof resolve === 'function') {
                resolve(cert);
            } else {
                return Promise.resolve(cert); // Fallback for newer QZ Tray API
            }
        });

        // ── Signing: empty promise (unsigned mode) ──
        qz.security.setSignatureAlgorithm('SHA512');
        qz.security.setSignaturePromise(function(toSign: any) {
            return function(resolve: any, reject: any) {
                if (typeof resolve === 'function') {
                    resolve();
                } else {
                    return Promise.resolve(); // Fallback
                }
            };
        });

        try {
            await qz.websocket.connect({ retries: 5, delay: 1 });
            setIsConnected(true);
            console.log('✅ QZ Tray connected');

            // ── Discover printers ──
            await discoverPrinter();
        } catch (err: any) {
            console.error('❌ QZ Tray connection failed:', err?.message || err);
            setIsConnected(false);
        } finally {
            connectingRef.current = false;
        }
    }, []);

    // ─── DISCOVER PRINTER ─────────────────────────────────────────────
    const discoverPrinter = useCallback(async () => {
        if (!window.qz?.websocket?.isActive()) return;

        const qz = window.qz;
        try {
            const printers: string[] = await qz.printers.find();
            console.log('🖨️ Available printers:', printers);

            // Try to find POS printer by name
            const target =
                printers.find((p) => p === DEFAULT_PRINTER) ||
                printers.find(
                    (p) =>
                        p.toLowerCase().includes('pos') ||
                        p.toLowerCase().includes('thermal') ||
                        p.toLowerCase().includes('receipt') ||
                        p.toLowerCase().includes('80mm') ||
                        p.toLowerCase().includes('epson'),
                );

            if (target) {
                setPrinterName(target);
                console.log(`✅ Using printer: ${target}`);
            } else if (printers.length > 0) {
                // Fallback to default system printer
                try {
                    const def = await qz.printers.getDefault();
                    setPrinterName(def);
                    console.log(`✅ Using default printer: ${def}`);
                } catch {
                    setPrinterName(printers[0]);
                    console.log(`✅ Using first printer: ${printers[0]}`);
                }
            } else {
                console.warn('⚠️ No printers found');
                setPrinterName(null);
            }
        } catch (err) {
            console.error('Printer discovery failed:', err);
        }
    }, []);

    // ─── INITIALIZE ON MOUNT ──────────────────────────────────────────
    useEffect(() => {
        let mounted = true;

        const init = () => {
            if (!mounted) return;
            if (typeof window !== 'undefined' && window.qz) {
                connect();
            }
        };

        // QZ Tray script may not be loaded yet — retry a few times
        const timer = setTimeout(init, 1500);
        const timer2 = setTimeout(init, 3000);
        const timer3 = setTimeout(init, 5000);

        return () => {
            mounted = false;
            clearTimeout(timer);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [connect]);

    // ─── RECONNECT ON DISCONNECT ──────────────────────────────────────
    useEffect(() => {
        if (typeof window === 'undefined' || !window.qz) return;

        const handleClose = () => {
            console.log('⚠️ QZ Tray disconnected');
            setIsConnected(false);
            setPrinterName(null);

            // Auto-reconnect after 3 seconds
            setTimeout(() => {
                connect();
            }, 3000);
        };

        try {
            window.qz.websocket.setClosedCallbacks(handleClose);
        } catch {}

        return () => {
            try {
                window.qz.websocket.setClosedCallbacks(() => {});
            } catch {}
        };
    }, [connect]);

    // ─── PRINT KOT ───────────────────────────────────────────────────
    const printKOT = useCallback(
        async (order: Order, tokenNum: string) => {
            if (typeof window === 'undefined' || !window.qz) {
                throw new Error('QZ Tray library not loaded.');
            }

            if (!window.qz.websocket.isActive()) {
                await connect();
                if (!window.qz.websocket.isActive()) {
                    throw new Error('Please start QZ Tray');
                }
            }

            let targetPrinter = printerName;
            
            if (!targetPrinter) {
                // Try discovery one more time if printer not set
                await discoverPrinter();
                // discoverPrinter updates the state asynchronously, but the state won't update in this execution context
                // so we won't wait for it. We'll rely on what QZ Tray discovers directly if possible.
                // However, since we're using a known default printer 'Printer_POS_80', we can default to it directly.
                targetPrinter = 'Printer_POS_80';
            }
            setIsPrinting(true);

            try {
                const qz = window.qz;

                // Generate ESC/POS receipt data
                const receiptData = formatReceipt(order, tokenNum);

                // Create printer config
                const config = qz.configs.create(targetPrinter, {
                    encoding: 'UTF-8',
                });

                // Print silently
                await qz.print(config, receiptData);
                console.log(`🖨️ Printed receipt #${tokenNum}`);

                return true;
            } finally {
                setIsPrinting(false);
            }
        },
        [printerName],
    );

    return {
        isConnected,
        printerName,
        printKOT,
        isPrinting,
    };
}
