'use client';

import { Plus, Check } from 'lucide-react';
import { Product } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useState, useEffect } from 'react';

interface ProductCardProps {
    product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
    const addItem = useCartStore((s) => s.addItem);
    const cartItems = useCartStore((s) => s.items);
    const updateQuantity = useCartStore((s) => s.updateQuantity);
    const removeItem = useCartStore((s) => s.removeItem);
    const [justAdded, setJustAdded] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const cartItem = cartItems.find((i) => i.product.id === product.id);
    const qty = isMounted ? (cartItem?.quantity ?? 0) : 0;

    const handleAdd = () => {
        addItem(product);
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 800);
    };

    return (
        <div className="flex flex-col bg-white border border-gray-100 rounded-xl p-3 hover:shadow-md transition-shadow group h-full">
            {/* Product image */}
            <div className="w-full aspect-[4/3] rounded-lg bg-gray-50 overflow-hidden mb-3 relative flex-shrink-0">
                {product.imageURL ? (
                    <img
                        src={product.imageURL}
                        alt={product.name}
                        className="w-full h-full object-contain absolute inset-0"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300 absolute inset-0">🍽</div>
                )}
            </div>

            {/* Product info */}
            <div className="flex flex-col flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{product.name}</h3>

                {/* Footer Row */}
                <div className="flex justify-between items-center mt-auto pt-3">
                    <p className="text-gray-900 font-semibold truncate pr-2">₹{product.price}</p>

                    {/* ADD button / quantity control */}
                    <div className="flex-shrink-0">
                        {qty > 0 ? (
                            <div className="flex items-center border border-red-400 rounded-lg overflow-hidden h-8">
                                <button
                                    onClick={() => updateQuantity(product.id, qty - 1)}
                                    className="w-7 h-full flex items-center justify-center text-red-500 hover:bg-red-50 font-bold text-base transition-colors"
                                >
                                    −
                                </button>
                                <span className="text-sm font-semibold text-gray-800 min-w-[20px] text-center">{qty}</span>
                                <button
                                    onClick={() => updateQuantity(product.id, qty + 1)}
                                    className="w-7 h-full flex items-center justify-center text-red-500 hover:bg-red-50 font-bold text-base transition-colors"
                                >
                                    +
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleAdd}
                                className={`flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg border text-sm font-semibold transition-all duration-200
                        ${justAdded
                                        ? 'bg-green-50 border-green-400 text-green-600'
                                        : 'border-red-400 text-red-500 hover:bg-red-50'
                                    }`}
                            >
                                {justAdded ? <Check size={14} /> : <Plus size={14} />}
                                {justAdded ? 'Added' : 'ADD'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
