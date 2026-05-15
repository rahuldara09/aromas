import { useState, useEffect } from 'react';
import { listenToGSTSettings } from '@/lib/vendor';
import { GSTSettings } from '@/types';

const DEFAULT: GSTSettings = { gstEnabled: false, gstType: 'included', gstPercentage: 5 };

export function useGSTSettings() {
    const [settings, setSettings] = useState<GSTSettings>(DEFAULT);

    useEffect(() => {
        const unsub = listenToGSTSettings(setSettings);
        return () => unsub();
    }, []);

    return settings;
}

/** Returns the GST breakdown for a given subtotal. */
export function computeGST(subtotal: number, gstPercentage: number, gstType: 'included' | 'excluded') {
    const rate = gstPercentage / 100;
    if (gstType === 'included') {
        const gstAmount = Math.round((subtotal * rate / (1 + rate)) * 100) / 100;
        return { baseAmount: Math.round((subtotal - gstAmount) * 100) / 100, gstAmount, total: subtotal };
    }
    const gstAmount = Math.round(subtotal * rate * 100) / 100;
    return { baseAmount: subtotal, gstAmount, total: Math.round((subtotal + gstAmount) * 100) / 100 };
}
