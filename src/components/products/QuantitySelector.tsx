'use client';

import { Plus, Check, Minus } from 'lucide-react';
import { Product } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useState, useEffect } from 'react';

interface QuantitySelectorProps {
    product: Product;
    size?: 'sm' | 'md' | 'lg';
}

/**
 * Reusable quantity selector that integrates with the existing cart store.
 * Shows "ADD" button when quantity is 0, switches to +/- stepper when > 0.
 */
export default function QuantitySelector({ product, size = 'md' }: QuantitySelectorProps) {
    const addItem = useCartStore((s) => s.addItem);
    const cartItems = useCartStore((s) => s.items);
    const updateQuantity = useCartStore((s) => s.updateQuantity);
    const [justAdded, setJustAdded] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => { setIsMounted(true); }, []);

    const cartItem = cartItems.find((i) => i.product.id === product.id);
    const qty = isMounted ? (cartItem?.quantity ?? 0) : 0;

    // Online orders always use onlinePrice; fall back to price if not set yet
    const displayPrice = product.onlinePrice ?? product.price;

    const handleAdd = () => {
        addItem(displayPrice === product.price ? product : { ...product, price: displayPrice });
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 800);
    };

    const sizeClasses = {
        sm: { btn: 'h-7 px-3 text-[11px]', stepper: 'h-7', stepBtn: 'w-7', qty: 'text-xs min-w-[18px]' },
        md: { btn: 'h-9 px-5 text-sm', stepper: 'h-9', stepBtn: 'w-9', qty: 'text-sm min-w-[24px]' },
        lg: { btn: 'h-11 px-6 text-base', stepper: 'h-11', stepBtn: 'w-11', qty: 'text-base min-w-[28px]' },
    };

    const s = sizeClasses[size];

    if (qty > 0) {
        return (
            <div className={`flex items-center border border-red-500/30 bg-red-50/50 rounded-lg overflow-hidden ${s.stepper} shadow-sm`}>
                <button
                    onClick={() => updateQuantity(product.id, qty - 1)}
                    className={`${s.stepBtn} h-full flex items-center justify-center text-red-600 hover:bg-red-100 active:bg-red-200 font-bold text-lg transition-colors touch-manipulation`}
                    aria-label="Decrease quantity"
                >
                    <Minus size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} strokeWidth={3} />
                </button>
                <span className={`${s.qty} font-bold text-gray-900 text-center tabular-nums`}>
                    {qty}
                </span>
                <button
                    onClick={() => updateQuantity(product.id, qty + 1)}
                    className={`${s.stepBtn} h-full flex items-center justify-center text-red-600 hover:bg-red-100 active:bg-red-200 font-bold text-lg transition-colors touch-manipulation`}
                    aria-label="Increase quantity"
                >
                    <Plus size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} strokeWidth={3} />
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleAdd}
            className={`flex items-center justify-center gap-1.5 ${s.btn} rounded-lg font-black tracking-wide transition-all duration-300 touch-manipulation shadow-sm
                ${justAdded
                    ? 'bg-green-500 text-white border-green-500 translate-y-[-1px]'
                    : 'bg-white border border-red-500/20 text-red-600 hover:bg-red-600 hover:border-red-600 hover:text-white'
                }`}
            aria-label={`Add ${product.name} to cart`}
        >
            {justAdded ? <Check size={size === 'sm' ? 12 : 14} strokeWidth={3} /> : <Plus size={size === 'sm' ? 12 : 14} strokeWidth={3} />}
            {justAdded ? 'Added' : 'ADD'}
        </button>
    );
}
