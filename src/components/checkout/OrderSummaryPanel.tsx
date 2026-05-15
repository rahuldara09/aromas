'use client';

import { useState } from 'react';
import { Tag, ChevronRight, ChevronDown } from 'lucide-react';
import { useGSTSettings, computeGST } from '@/hooks/useGSTSettings';

interface OrderSummaryPanelProps {
    subtotal: number;
    dukanFee: number;
    deliveryFee: number;
    grandTotal: number;
    onContinue?: () => void;
    continueLabel?: string;
    showContinue?: boolean;
}

export default function OrderSummaryPanel({
    subtotal,
    dukanFee,
    deliveryFee,
    grandTotal,
    onContinue,
    continueLabel = 'Continue',
    showContinue = true,
}: OrderSummaryPanelProps) {
    const gst = useGSTSettings();
    const [breakdownOpen, setBreakdownOpen] = useState(false);

    const gstBreakdown = gst.gstEnabled
        ? computeGST(subtotal, gst.gstPercentage, gst.gstType)
        : null;

    // For excluded GST the final total changes
    const effectiveTotal = gstBreakdown && gst.gstType === 'excluded'
        ? gstBreakdown.total + dukanFee + deliveryFee
        : grandTotal;

    return (
        <div className="w-full md:w-80 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden md:sticky md:top-20">
                {/* Coupons */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Tag size={16} className="text-green-600" />
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Coupons and offers</p>
                            <p className="text-xs text-gray-400">Save more with coupon and offers</p>
                        </div>
                    </div>
                    <button className="text-xs text-red-500 font-semibold flex items-center gap-0.5 hover:text-red-600 transition-colors">
                        Apply <ChevronRight size={13} />
                    </button>
                </div>

                {/* Pricing breakdown */}
                <div className="px-4 py-4 space-y-2.5">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Item total</span>
                        <span>₹{subtotal}</span>
                    </div>
                    {dukanFee > 0 && (
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Delivery + Packing</span>
                            <span>₹{dukanFee}</span>
                        </div>
                    )}

                    {/* GST line — only for excluded type */}
                    {gstBreakdown && gst.gstType === 'excluded' && (
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>GST ({gst.gstPercentage}%)</span>
                            <span>₹{gstBreakdown.gstAmount.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="border-t border-gray-100 pt-2.5">
                        <div className="flex justify-between">
                            <div>
                                <p className="font-bold text-gray-900">Grand total</p>
                                <p className="text-xs text-gray-400">
                                    {gstBreakdown
                                        ? gst.gstType === 'included'
                                            ? `Incl. ${gst.gstPercentage}% GST`
                                            : `Incl. all taxes`
                                        : 'Inclusive of all taxes'}
                                </p>
                            </div>
                            <p className="font-bold text-gray-900">₹{effectiveTotal}</p>
                        </div>
                    </div>

                    {/* Price breakdown toggle */}
                    {gstBreakdown && (
                        <div>
                            <button
                                onClick={() => setBreakdownOpen(o => !o)}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors mt-1"
                            >
                                {breakdownOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                {breakdownOpen ? 'Hide' : 'View'} price breakdown
                            </button>

                            {breakdownOpen && (
                                <div className="mt-2.5 bg-gray-50 rounded-xl border border-gray-100 px-3 py-3 space-y-1.5 text-xs text-gray-600">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Bill Details</p>

                                    <div className="flex justify-between">
                                        <span>Item total</span>
                                        <span>₹{subtotal}</span>
                                    </div>

                                    {gst.gstType === 'included' ? (
                                        <>
                                            <div className="flex justify-between text-gray-400 pl-3">
                                                <span>↳ Base price (excl. GST)</span>
                                                <span>₹{gstBreakdown.baseAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400 pl-3">
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
                                            <span>Delivery + Packing</span>
                                            <span>₹{dukanFee}</span>
                                        </div>
                                    )}

                                    {deliveryFee > 0 && (
                                        <div className="flex justify-between">
                                            <span>Delivery fee</span>
                                            <span>₹{deliveryFee}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-200 mt-1">
                                        <span>To Pay</span>
                                        <span>₹{effectiveTotal}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="text-xs text-gray-500 pt-1">
                        Average delivery time: <strong>30-60 minutes</strong>
                    </p>
                </div>

                {/* CTA */}
                {showContinue && onContinue && (
                    <div className="px-4 pb-4">
                        <button
                            onClick={onContinue}
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3.5 rounded-xl transition-colors"
                        >
                            {continueLabel}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
