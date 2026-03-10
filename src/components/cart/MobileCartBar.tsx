'use client';

import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { useEffect, useState } from 'react';

/**
 * Sticky bottom cart bar — visible only on mobile (md:hidden).
 * Zomato/Swiggy style: shows item count + grand total + "View Cart" CTA.
 * Hidden when cart is empty.
 */
export default function MobileCartBar() {
    const items = useCartStore((s) => s.items);
    const grandTotal = useCartStore((s) => s.grandTotal());
    const totalItems = useCartStore((s) => s.totalItems());
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Don't render until hydrated, and hide when cart is empty
    if (!mounted || totalItems === 0) return null;

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-4">
            <Link
                href="/checkout"
                className="flex items-center justify-between w-full bg-red-500 text-white rounded-2xl px-4 py-3.5 shadow-2xl active:scale-[0.98] transition-transform"
                style={{ boxShadow: '0 -2px 20px rgba(239,68,68,0.25), 0 8px 24px rgba(239,68,68,0.3)' }}
            >
                {/* Left: item count badge */}
                <div className="flex items-center gap-2.5">
                    <span className="bg-red-600 text-white text-xs font-black rounded-lg px-2 py-1 min-w-[28px] text-center tabular-nums">
                        {totalItems}
                    </span>
                    <span className="text-sm font-semibold">
                        {totalItems === 1 ? '1 item' : `${totalItems} items`}
                    </span>
                </div>

                {/* Center: label */}
                <span className="text-sm font-bold tracking-wide">View Cart</span>

                {/* Right: total */}
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black tabular-nums">₹{grandTotal}</span>
                    <ShoppingCart size={16} className="opacity-80" />
                </div>
            </Link>
        </div>
    );
}
