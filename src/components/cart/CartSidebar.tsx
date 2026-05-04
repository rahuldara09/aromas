'use client';

import { ShoppingCart, Loader2, ChevronRight } from 'lucide-react';
import EmptyCart from './EmptyCart';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { useState, useEffect } from 'react';
import { cldUrl, isCloudinaryUrl } from '@/lib/cloudinary';
import { useGSTSettings, computeGST } from '@/hooks/useGSTSettings';

export default function CartSidebar() {
    const items = useCartStore((s) => s.items);
    const subtotal = useCartStore((s) => s.subtotal());
    const dukanFee = useCartStore((s) => s.dukanFee());
    const grandTotal = useCartStore((s) => s.grandTotal());

    const gst = useGSTSettings();
    const [isMounted, setIsMounted] = useState(false);
    const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
    const [breakdownOpen, setBreakdownOpen] = useState(false);

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

    const gstBreakdown = gst.gstEnabled ? computeGST(subtotal, gst.gstPercentage, gst.gstType) : null;
    const effectiveTotal = gstBreakdown && gst.gstType === 'excluded'
        ? gstBreakdown.total + dukanFee
        : grandTotal;

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
                    <EmptyCart compact={true} />
                ) : (
                    <div>
                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                            {items.map((item) => (
                                <div key={item.product.id} className="flex items-center gap-2 px-3 py-2">
                                    <div className="w-9 h-9 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                                        {item.product.imageURL && !imgErrors[item.product.id] ? (
                                            <img
                                                src={isCloudinaryUrl(item.product.imageURL) ? cldUrl(item.product.imageURL, 80) : item.product.imageURL}
                                                alt={item.product.name}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-full object-cover"
                                                onError={() =>
                                                    setImgErrors((prev) => ({ ...prev, [item.product.id]: true }))
                                                }
                                            />
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
                            {dukanFee > 0 && (
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Delivery + Packing</span><span>₹{dukanFee}</span>
                                </div>
                            )}
                            {gstBreakdown && gst.gstType === 'excluded' && (
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>GST ({gst.gstPercentage}%)</span>
                                    <span>₹{gstBreakdown.gstAmount.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-xs font-bold text-gray-900 pt-1 border-t border-gray-100">
                                <span>Total</span>
                                <span>
                                    ₹{effectiveTotal}
                                    {gstBreakdown && gst.gstType === 'included' && (
                                        <span className="font-normal text-gray-400 ml-1">(incl. GST)</span>
                                    )}
                                </span>
                            </div>

                            {/* Price breakdown */}
                            {gstBreakdown && (
                                <>
                                    <button
                                        onClick={() => setBreakdownOpen(o => !o)}
                                        className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors mt-0.5"
                                    >
                                        <ChevronRight size={11} className={`transition-transform ${breakdownOpen ? 'rotate-90' : ''}`} />
                                        {breakdownOpen ? 'Hide' : 'View'} bill details
                                    </button>

                                    {breakdownOpen && (
                                        <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2.5 space-y-1 text-[11px] text-gray-500 mt-1">
                                            <div className="flex justify-between">
                                                <span>Item total</span><span>₹{subtotal}</span>
                                            </div>
                                            {gst.gstType === 'included' ? (
                                                <>
                                                    <div className="flex justify-between text-gray-400 pl-2">
                                                        <span>↳ Base</span>
                                                        <span>₹{gstBreakdown.baseAmount.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-gray-400 pl-2">
                                                        <span>↳ GST ({gst.gstPercentage}%)</span>
                                                        <span>₹{gstBreakdown.gstAmount.toFixed(2)}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex justify-between">
                                                    <span>GST ({gst.gstPercentage}%)</span>
                                                    <span>₹{gstBreakdown.gstAmount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {dukanFee > 0 && (
                                                <div className="flex justify-between">
                                                    <span>Delivery + Packing</span><span>₹{dukanFee}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-semibold text-gray-700 pt-1 border-t border-gray-200">
                                                <span>To Pay</span><span>₹{effectiveTotal}</span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
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
