'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/types';

// Declaring qz globally to satisfy TS since it's loaded via CDN
declare global {
    interface Window {
        qz: any;
    }
}

export function useThermalPrinter() {
    const [isConnected, setIsConnected] = useState(false);
    const [printerName, setPrinterName] = useState<string | null>(null);

    // ─── INITIALIZE QZ TRAY ───────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;

        const initQZ = async () => {
            if (typeof window === 'undefined' || !window.qz) return;
            const qz = window.qz;

            try {
                // If already connected, skip
                if (qz.websocket.isActive()) {
                    if (mounted) setIsConnected(true);
                    return;
                }

                await qz.websocket.connect();
                if (mounted) setIsConnected(true);

                // Auto-discover default printer
                const printers: string[] = await qz.printers.find();
                console.log('QZ Printers found:', printers);

                // Try to find a logical thermal printer match
                const target = printers.find(p =>
                    p.toLowerCase().includes('receipt') ||
                    p.toLowerCase().includes('thermal') ||
                    p.toLowerCase().includes('pos') ||
                    p.toLowerCase().includes('80mm') ||
                    p.toLowerCase().includes('epson') ||
                    p.toLowerCase().includes('tvs')
                );

                if (target && mounted) {
                    setPrinterName(target);
                } else if (printers.length > 0 && mounted) {
                    // Fallback to default if no POS named printer found
                    const def = await qz.printers.getDefault();
                    setPrinterName(def);
                }
            } catch (err) {
                console.error("QZ Tray connection failed:", err);
                if (mounted) setIsConnected(false);
            }
        };

        // We use a slight delay to ensure the CDN script has fully parsed attached to window
        const timer = setTimeout(() => {
            initQZ();
        }, 1000);

        return () => {
            mounted = false;
            clearTimeout(timer);
        };
    }, []);

    // ─── PRINT KOT LOGIC ──────────────────────────────────────────────────
    const printKOT = useCallback(async (order: Order, tokenNum: string) => {
        if (!window.qz || !window.qz.websocket.isActive()) {
            throw new Error('QZ Tray is not connected');
        }
        if (!printerName) {
            throw new Error('No printer selected or found');
        }

        const qz = window.qz;

        // Construct 80mm ESC/POS Payload
        // ESC @ = Init \x1B\x40
        // ESC a 1 = Center align \x1B\x61\x01
        // GS ! 11 = Double height & width \x1D\x21\x11
        // ESC a 0 = Left align \x1B\x61\x00
        // GS V A 0 = Full cut \x1D\x56\x41

        const timestamp = new Date(order.orderDate).toLocaleString();

        const data = [
            '\x1B\x40',             // Initialize
            '\x1B\x61\x01',         // Center Align
            'AROMA DHABA\x0A',      // Header
            '\x0A',
            '\x1D\x21\x11',         // Massive text size
            `#${tokenNum}\x0A`,     // TOKEN
            '\x1D\x21\x00',         // Normal text size
            '\x0A',
            '\x1B\x61\x00',         // Left Align
            `Time: ${timestamp}\x0A`,
            '--------------------------------\x0A',
            ...order.items.map(item => `${item.quantity}x ${item.name}\x0A`),
            '--------------------------------\x0A',
            `Dest: ${order.deliveryAddress?.hostelNumber || 'Pickup'} - Rm ${order.deliveryAddress?.roomNumber || '?'}\x0A`,
            `Total: Rs. ${order.grandTotal}\x0A`,
            `Status: ${order.status === 'Pending' ? 'UNPAID COD' : 'PAID ONLINE'}\x0A`,
            '\x0A\x0A\x0A',
            '\x1D\x56\x41',         // Paper Cut
        ];

        const config = qz.configs.create(printerName);

        try {
            await qz.print(config, data);
            return true;
        } catch (e) {
            console.error("Print Failed", e);
            throw e;
        }
    }, [printerName]);

    return {
        isConnected,
        printerName,
        printKOT
    };
}
