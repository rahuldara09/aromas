'use client';

/**
 * Animated skeleton loader for the product detail page.
 * Uses the shimmer animation defined in globals.css.
 */
export default function ProductDetailSkeleton() {
    return (
        <div className="min-h-screen bg-gray-50 animate-pulse">
            {/* Back bar skeleton */}
            <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full skeleton-shimmer" />
                    <div className="w-32 h-4 rounded skeleton-shimmer" />
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Image skeleton */}
                <div className="w-full aspect-square max-w-sm mx-auto rounded-3xl skeleton-shimmer mb-6" />

                {/* Name + price */}
                <div className="space-y-3 mb-6">
                    <div className="w-3/4 h-6 rounded skeleton-shimmer" />
                    <div className="flex items-center gap-3">
                        <div className="w-16 h-5 rounded skeleton-shimmer" />
                        <div className="w-12 h-4 rounded skeleton-shimmer" />
                    </div>
                </div>

                {/* Unit selector + button */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-20 h-9 rounded-lg skeleton-shimmer" />
                    <div className="w-24 h-9 rounded-lg skeleton-shimmer" />
                </div>

                {/* Description */}
                <div className="space-y-2 mb-8">
                    <div className="w-32 h-5 rounded skeleton-shimmer" />
                    <div className="w-full h-4 rounded skeleton-shimmer" />
                    <div className="w-5/6 h-4 rounded skeleton-shimmer" />
                    <div className="w-2/3 h-4 rounded skeleton-shimmer" />
                </div>

                {/* Ingredients */}
                <div className="space-y-3 mb-8">
                    <div className="w-28 h-5 rounded skeleton-shimmer" />
                    <div className="flex gap-2 flex-wrap">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="w-16 h-7 rounded-full skeleton-shimmer" />
                        ))}
                    </div>
                </div>

                {/* Similar products row */}
                <div className="space-y-3">
                    <div className="w-36 h-5 rounded skeleton-shimmer" />
                    <div className="flex gap-4 overflow-hidden">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex-shrink-0 w-36">
                                <div className="aspect-square rounded-2xl skeleton-shimmer mb-2" />
                                <div className="w-full h-3 rounded skeleton-shimmer mb-1" />
                                <div className="w-1/2 h-3 rounded skeleton-shimmer" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
