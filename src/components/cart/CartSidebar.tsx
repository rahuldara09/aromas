'use client';

import { ShoppingCart, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { useState, useEffect } from 'react';

export default function CartSidebar() {
    const items = useCartStore((s) => s.items);
    const subtotal = useCartStore((s) => s.subtotal());
    const dukanFee = useCartStore((s) => s.dukanFee());
    const grandTotal = useCartStore((s) => s.grandTotal());

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return (
            <aside className="w-full flex-shrink-0 sticky top-20">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex justify-center items-center h-48">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            </aside>
        );
    }

    return (
        <aside className="w-full flex-shrink-0 sticky top-20">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <ShoppingCart size={16} />
                        Cart
                    </h3>
                </div>

                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <AlertTriangle size={28} className="text-yellow-400 mb-3" />
                        <p className="text-sm font-semibold text-gray-700">Your cart is empty</p>
                        <p className="text-xs text-gray-400 mt-1">Looks like you haven&apos;t made your choice yet.</p>
                    </div>
                ) : (
                    <div>
                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                            {items.map((item) => (
                                <div key={item.product.id} className="flex items-center gap-2 px-3 py-2">
                                    <div className="w-9 h-9 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                                        {item.product.imageURL ? (
                                            <img src={item.product.imageURL} alt={item.product.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">🍽</div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-800 truncate">{item.product.name}</p>
                                        <p className="text-xs text-gray-500">₹{item.product.price} × {item.quantity}</p>
                                    </div>
                                    <span className="text-xs font-semibold text-gray-800">₹{item.product.price * item.quantity}</span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-gray-100 px-4 py-3 space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Subtotal</span><span>₹{subtotal}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Dukan fee</span><span>₹{dukanFee}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-gray-900 pt-1 border-t border-gray-100">
                                <span>Total</span><span>₹{grandTotal}</span>
                            </div>
                        </div>
                        <div className="px-3 pb-3">
                            <Link
                                href="/checkout"
                                className="block w-full bg-red-500 hover:bg-red-600 text-white text-sm font-semibold text-center py-2.5 rounded-lg transition-colors"
                            >
                                Checkout →
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
