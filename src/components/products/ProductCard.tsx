'use client';

import { Plus, Check } from 'lucide-react';
import { Product } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useState, useEffect } from 'react';

interface ProductCardProps {
    product: Product;
}

/**
 * Determine veg / non-veg classification from product name.
 */
function getVegStatus(name: string): 'veg' | 'nonveg' | null {
    const lower = name.toLowerCase();

    const nonVegKeywords = [
        'chicken', 'egg', 'shawarma', 'shorma', 'sorama', 'shawrma', 'butter chicken',
    ];
    for (const kw of nonVegKeywords) {
        if (lower.includes(kw)) return 'nonveg';
    }

    const vegKeywords = [
        'veg', 'paneer', 'dal', 'chana', 'rajma', 'aloo', 'bhindi', 'soyabin',
        'lassi', 'milkshake', 'malai', 'dahi', 'jeera', 'pulav', 'mushroom',
        'plain rice', 'bhedi rice', 'plain paratha', 'methi', 'onion', 'guddu',
        'mix veg', 'palak', 'kadai', 'shahi', 'matar', 'gobi', 'tadka',
        'kolhapuri', 'handi', 'makhani', 'masala', 'sprite', 'pepsi',
        'thums up', 'diet coke', 'one up', 'monster', 'predator', 'nescafe',
        'calvin', 'ocean fruit', 'charg campa', 'sezwan', 'fried rice', 'schezwan',
        'manchurian rice', 'triple rice', 'biryani', 'noodles', 'frankie',
        'sandwich', 'paratha',
    ];
    for (const kw of vegKeywords) {
        if (lower.includes(kw)) return 'veg';
    }

    return null;
}

/** Indian-standard Veg badge: white square (green border) + filled green circle */
function VegBadge() {
    return (
        <span
            title="Veg"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 17,
                height: 17,
                border: '1.5px solid #2e7d32',
                borderRadius: 2,
                backgroundColor: '#fff',
                flexShrink: 0,
            }}
        >
            <span style={{ display: 'block', width: 9, height: 9, borderRadius: '50%', backgroundColor: '#2e7d32' }} />
        </span>
    );
}

/** Indian-standard Non-Veg badge: white square (dark red border) + red upward triangle */
function NonVegBadge() {
    return (
        <span
            title="Non-Veg"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 17,
                height: 17,
                border: '1.5px solid #8b1a1a',
                borderRadius: 2,
                backgroundColor: '#fff',
                flexShrink: 0,
            }}
        >
            <span style={{ display: 'block', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid #b71c1c' }} />
        </span>
    );
}

export default function ProductCard({ product }: ProductCardProps) {
    const addItem = useCartStore((s) => s.addItem);
    const cartItems = useCartStore((s) => s.items);
    const updateQuantity = useCartStore((s) => s.updateQuantity);
    const [justAdded, setJustAdded] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [imgError, setImgError] = useState(false);

    useEffect(() => { setIsMounted(true); }, []);

    const cartItem = cartItems.find((i) => i.product.id === product.id);
    const qty = isMounted ? (cartItem?.quantity ?? 0) : 0;

    const handleAdd = () => {
        addItem(product);
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 800);
    };

    const isOut = product.isAvailable === false;
    const vegStatus = getVegStatus(product.name);

    return (
        <div
            className={`flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden transition-shadow h-full
                ${isOut ? 'opacity-60 grayscale-[0.5] pointer-events-none' : 'hover:shadow-md active:shadow-sm'}`}
        >
            {/* ── Product image: 1:1 square ratio ──────────────────────────── */}
            <div className={`relative w-full aspect-square bg-gray-50 flex-shrink-0 overflow-hidden ${isOut ? 'grayscale opacity-75' : ''}`}>
                {product.imageURL && !imgError ? (
                    <img
                        src={product.imageURL}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">🍽</div>
                )}

                {/* Veg / Non-Veg badge — top-right */}
                {vegStatus && (
                    <span style={{ position: 'absolute', top: 6, right: 6, zIndex: 10, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}>
                        {vegStatus === 'veg' ? <VegBadge /> : <NonVegBadge />}
                    </span>
                )}
            </div>

            {/* ── Product info ─────────────────────────────────────────────── */}
            <div className="flex flex-col flex-1 p-2.5 sm:p-3">
                {/* Name: max 2 lines, ellipsis */}
                <h3 className="font-medium text-gray-900 text-[13px] sm:text-sm leading-snug line-clamp-2 min-h-[2.4rem] mb-auto">
                    {product.name}
                </h3>

                {/* Footer Row: price + ADD button */}
                <div className="flex items-center justify-between mt-2 gap-1">
                    {!isOut && (
                        <p className="text-gray-900 font-bold text-sm whitespace-nowrap">₹{product.price}</p>
                    )}

                    <div className={isOut ? 'w-full' : 'flex-shrink-0'}>
                        {isOut ? (
                            <div className="w-full text-center text-[10px] font-extrabold text-gray-400 uppercase tracking-widest py-1.5 bg-gray-100 rounded-lg border border-gray-200">
                                Out of Stock
                            </div>
                        ) : qty > 0 ? (
                            /* ── Quantity stepper (Zomato-style) ── */
                            <div className="flex items-center border border-red-400 rounded-lg overflow-hidden h-7">
                                <button
                                    onClick={() => updateQuantity(product.id, qty - 1)}
                                    className="w-7 h-full flex items-center justify-center text-red-500 hover:bg-red-50 active:bg-red-100 font-bold text-base transition-colors touch-manipulation"
                                    aria-label="Decrease quantity"
                                >
                                    −
                                </button>
                                <span className="text-xs font-semibold text-gray-800 min-w-[20px] text-center tabular-nums">
                                    {qty}
                                </span>
                                <button
                                    onClick={() => updateQuantity(product.id, qty + 1)}
                                    className="w-7 h-full flex items-center justify-center text-red-500 hover:bg-red-50 active:bg-red-100 font-bold text-base transition-colors touch-manipulation"
                                    aria-label="Increase quantity"
                                >
                                    +
                                </button>
                            </div>
                        ) : (
                            /* ── ADD button ── */
                            <button
                                onClick={handleAdd}
                                className={`flex items-center justify-center gap-1 px-2.5 h-7 rounded-lg border text-xs font-bold transition-all duration-200 touch-manipulation
                                    ${justAdded
                                        ? 'bg-green-50 border-green-400 text-green-600'
                                        : 'border-red-400 text-red-500 hover:bg-red-50 active:bg-red-100'
                                    }`}
                                aria-label={`Add ${product.name} to cart`}
                            >
                                {justAdded ? <Check size={12} /> : <Plus size={12} />}
                                {justAdded ? 'Added' : 'ADD'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
