'use client';

import { Tag, ChevronRight } from 'lucide-react';

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
    return (
        <div className="w-full md:w-72 flex-shrink-0">
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
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Dukan</span>
                        <span>₹{dukanFee}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Delivery fee</span>
                        <span className="text-gray-400 line-through text-xs mr-1">₹0</span>
                        <span className="text-green-600 font-medium">FREE</span>
                    </div>

                    <div className="border-t border-gray-100 pt-2.5">
                        <div className="flex justify-between">
                            <div>
                                <p className="font-bold text-gray-900">Grand total</p>
                                <p className="text-xs text-gray-400">Inclusive of all taxes</p>
                            </div>
                            <p className="font-bold text-gray-900">₹{grandTotal}</p>
                        </div>
                    </div>

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
