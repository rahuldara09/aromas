'use client';

import React from 'react';
import { useVendor } from '@/contexts/VendorContext';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface Props {
    onPayClick: () => void;
}

export function SettlementBanner({ onPayClick }: Props) {
    const { currentSettlement, isOnlineOrdersLocked } = useVendor();

    // No settlement doc yet (before 9AM cron, or 0-order day already auto-paid)
    if (!currentSettlement) return null;

    const { status, payable_amount } = currentSettlement;

    // Paid — show reassuring green pill
    if (status === 'paid') {
        return (
            <div className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700">
                <CheckCircle2 size={12} className="shrink-0" />
                <span className="text-[11px] font-semibold hidden xl:inline">Settled</span>
            </div>
        );
    }

    // Verification pending — amber pill
    if (status === 'verification_pending') {
        return (
            <div className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-700">
                <Clock size={12} className="shrink-0" />
                <span className="text-[11px] font-semibold hidden xl:inline">Payment Verifying</span>
            </div>
        );
    }

    // Pending / overdue / rejected — red alert button
    if (isOnlineOrdersLocked) {
        const label = status === 'rejected' ? 'Payment Rejected' : `Pay ₹${payable_amount}`;
        return (
            <button
                onClick={onPayClick}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors animate-pulse"
            >
                <AlertCircle size={12} className="shrink-0" />
                <span className="text-[11px] font-bold">{label}</span>
            </button>
        );
    }

    return null;
}
