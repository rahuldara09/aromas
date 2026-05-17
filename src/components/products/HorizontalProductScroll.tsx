'use client';

import { useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { Product } from '@/types';
import ProductCard from '@/components/products/ProductCard';

interface HorizontalProductScrollProps {
    title: string;
    products: Product[];
    categoryName?: string;
}

/**
 * Horizontal scrollable row of ProductCard components.
 * Used for "Similar Products" and "You May Also Like" sections.
 */
export default function HorizontalProductScroll({ title, products, categoryName }: HorizontalProductScrollProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    if (products.length === 0) return null;

    const scrollRight = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
        }
    };

    return (
        <section className="py-6">
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                    {title}
                </h2>
                {products.length > 3 && (
                    <button
                        onClick={scrollRight}
                        className="flex items-center gap-0.5 text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                        aria-label="Scroll right"
                    >
                        See more
                        <ChevronRight size={14} />
                    </button>
                )}
            </div>

            {/* Scrollable row */}
            <div
                ref={scrollRef}
                className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x-mandatory pb-2"
            >
                {products.map((product) => (
                    <div
                        key={product.id}
                        className="flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px]"
                    >
                        <ProductCard product={product} categoryName={categoryName} />
                    </div>
                ))}
            </div>
        </section>
    );
}
