'use client';

import { ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface EmptyCartProps {
    compact?: boolean;
}

export default function EmptyCart({ compact = false }: EmptyCartProps) {
    const router = useRouter();

    return (
        <div className={`flex flex-col items-center justify-center ${compact ? 'py-10' : 'py-20'} px-6 text-center`}>
            {/* Illustration */}
            <div className="relative mb-8">
                <div className={`${compact ? 'w-32 h-32' : 'w-48 h-48'} bg-gray-50 rounded-full flex items-center justify-center relative shadow-inner`}>
                    {/* Decorative bits to mimic the screenshot */}
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-full flex gap-3 mb-2 opacity-40">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                        <div className="w-1.5 h-4 bg-gray-300 rounded-full rotate-12"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    </div>
                    
                    <div className="absolute top-8 left-1/4 opacity-30">
                        <span className="text-xl font-bold text-gray-400">+</span>
                    </div>
                    <div className="absolute top-6 right-1/4 opacity-30">
                        <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-400"></div>
                    </div>
                    
                    {/* The Bag */}
                    <div className="relative z-10">
                        <div className={`${compact ? 'w-16 h-16' : 'w-24 h-24'} bg-gray-200 rounded-lg flex flex-col items-center justify-start pt-2 relative shadow-sm`}>
                            {/* Handle */}
                            <div className="w-8 h-4 border-2 border-gray-300 rounded-t-full -mt-5 mb-1"></div>
                            {/* Bag details */}
                            <div className="w-10 h-0.5 bg-gray-300 rounded-full mb-1"></div>
                            <div className="w-6 h-0.5 bg-gray-300 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Text */}
            <h2 className={`${compact ? 'text-lg' : 'text-2xl'} font-bold text-gray-900 mb-2`}>Your cart is empty</h2>
            <p className={`${compact ? 'text-xs' : 'text-base leading-relaxed'} text-gray-400 font-medium mb-10 max-w-[260px] mx-auto`}>
                Looks like you haven&apos;t made<br />your menu yet.
            </p>

            {/* CTA */}
            <button
                onClick={() => router.push('/menu')}
                className={`${compact ? 'py-2.5 px-6 text-sm' : 'py-3.5 px-10 text-base'} bg-red-600 text-white font-bold rounded-xl shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all transform hover:scale-[1.02] active:scale-[0.98]`}
            >
                Back to Menu
            </button>
        </div>
    );
}
