'use client';

import { Plus, Check } from 'lucide-react';
import { Product } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useState, useEffect } from 'react';
import CldImage from '@/components/products/CldImage';

interface ProductCardProps {
    product: Product;
    categoryName?: string;
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

/** Standard Veg badge: white rounded square + green border + green circle */
function VegBadge() {
    return (
        <div className="flex items-center justify-center w-5 h-5 border-[1.5px] border-[#008F4C] rounded-md bg-white">
            <div className="w-2.5 h-2.5 rounded-full bg-[#008F4C]" />
        </div>
    );
}

/** Standard Non-Veg badge: white rounded square + red border + red circle */
function NonVegBadge() {
    return (
        <div className="flex items-center justify-center w-5 h-5 border-[1.5px] border-[#EB2D2D] rounded-md bg-white">
            <div className="w-2.5 h-2.5 rounded-full bg-[#EB2D2D]" />
        </div>
    );
}

export default function ProductCard({ product, categoryName }: ProductCardProps) {
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
            className={`flex flex-col rounded-2xl overflow-hidden transition-all duration-300 h-full
                ${isOut ? 'opacity-60 grayscale-[0.5] pointer-events-none' : 'hover:translate-y-[-2px]'}`}
        >
            {/* ── Visual Container for Image (Gray bg, High rounding) ──────────────── */}
            <div className="relative group bg-[#F5F6F8] rounded-[32px] p-4 aspect-square flex items-center justify-center overflow-hidden mb-3 border border-gray-100/50 shadow-sm">
                <div className={`relative w-full h-full rounded-2xl overflow-hidden shadow-inner ${isOut ? 'grayscale opacity-75' : ''}`}>
                    {product.imageURL && !imgError ? (
                        <CldImage
                            src={product.imageURL}
                            alt={product.name}
                            width={300}
                            sizes="(max-width: 640px) 50vw, 300px"
                            className="transition-transform duration-500 group-hover:scale-105"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300 bg-white/50 animate-pulse">🍽</div>
                    )}
                </div>

                {/* Veg / Non-Veg badge — top-right overlapping the gray container slightly */}
                {vegStatus && (
                    <div className="absolute top-4 right-4 z-10 shadow-sm scale-90 sm:scale-100">
                        {vegStatus === 'veg' ? <VegBadge /> : <NonVegBadge />}
                    </div>
                )}
            </div>

            {/* ── Product details ────────────────────────────────────────── */}
            <div className="flex flex-col flex-1 px-1">
                {/* Category: Small, uppercase, gray */}
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 truncate">
                    {categoryName || 'Menu Item'}
                </span>

                {/* Name: Dark, bold, larger */}
                <h3 className="font-extrabold text-gray-900 text-sm sm:text-base leading-tight mb-1 line-clamp-2 min-h-[2.5rem]">
                    {product.name}
                </h3>

                {/* Unit: Regular, small, gray */}
                <p className="text-[12px] text-gray-500 font-medium mb-3">1 unit</p>

                {/* Footer: Price + Button (Functional section) */}
                <div className="flex items-center justify-between mt-auto gap-2">
                    {!isOut && (
                        <p className="text-[#1A1C1E] font-black text-sm sm:text-base italic">₹{product.price}</p>
                    )}

                    <div className={isOut ? 'w-full' : 'flex-shrink-0'}>
                        {isOut ? (
                            <div className="w-full text-center text-[10px] font-extrabold text-gray-400 uppercase tracking-widest py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                                Out of Stock
                            </div>
                        ) : qty > 0 ? (
                            <div className="flex items-center border border-red-500/30 bg-red-50/50 rounded-lg overflow-hidden h-7 sm:h-8 shadow-sm">
                                <button
                                    onClick={() => updateQuantity(product.id, qty - 1)}
                                    className="w-7 sm:w-8 h-full flex items-center justify-center text-red-600 hover:bg-red-100 active:bg-red-200 font-bold text-lg transition-colors touch-manipulation"
                                    aria-label="Decrease quantity"
                                >
                                    −
                                </button>
                                <span className="text-xs sm:text-sm font-bold text-gray-900 min-w-[18px] text-center tabular-nums">
                                    {qty}
                                </span>
                                <button
                                    onClick={() => updateQuantity(product.id, qty + 1)}
                                    className="w-7 sm:w-8 h-full flex items-center justify-center text-red-600 hover:bg-red-100 active:bg-red-200 font-bold text-lg transition-colors touch-manipulation"
                                    aria-label="Increase quantity"
                                >
                                    +
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleAdd}
                                className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 h-7 sm:h-8 rounded-lg text-[11px] sm:text-xs font-black tracking-wide transition-all duration-300 touch-manipulation shadow-sm
                                    ${justAdded
                                        ? 'bg-green-500 text-white border-green-500 translate-y-[-1px]'
                                        : 'bg-white border-red-500/20 text-red-600 hover:bg-red-600 hover:border-red-600 hover:text-white'
                                    }`}
                                aria-label={`Add ${product.name} to cart`}
                            >
                                {justAdded ? <Check size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
                                {justAdded ? 'Added' : 'ADD'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
