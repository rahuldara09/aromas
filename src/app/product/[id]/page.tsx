'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Leaf, Drumstick } from 'lucide-react';
import { Product } from '@/types';
import { getProductById, getSimilarProducts, getRecommendedProducts, getCategories } from '@/lib/firestore';
import { useCartStore } from '@/store/cartStore';
import CldImage from '@/components/products/CldImage';
import QuantitySelector from '@/components/products/QuantitySelector';
import ProductDetailSkeleton from '@/components/products/ProductDetailSkeleton';
import HorizontalProductScroll from '@/components/products/HorizontalProductScroll';
import Header from '@/components/layout/Header';
import MobileCartBar from '@/components/cart/MobileCartBar';

/**
 * Determine veg / non-veg classification from product name.
 * (Same logic as in ProductCard.tsx)
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

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params.id as string;

    const [product, setProduct] = useState<Product | null>(null);
    const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
    const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
    const [categoryName, setCategoryName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [imgError, setImgError] = useState(false);

    const cartItems = useCartStore((s) => s.items);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        if (!productId) return;

        async function loadProduct() {
            setLoading(true);
            setError(false);
            setImgError(false);
            try {
                const prod = await getProductById(productId);
                if (!prod) {
                    setError(true);
                    setLoading(false);
                    return;
                }
                setProduct(prod);

                // Fetch category name
                const cats = await getCategories();
                const match = cats.find((c) => c.id === prod.categoryId);
                setCategoryName(match?.name ?? '');

                // Fetch similar + recommended in parallel
                const [similar, recommended] = await Promise.all([
                    getSimilarProducts(prod.categoryId, prod.id, 10),
                    getRecommendedProducts(prod.categoryId, prod.id, 10),
                ]);
                setSimilarProducts(similar);
                setRecommendedProducts(recommended);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        }
        loadProduct();
    }, [productId]);

    if (loading) return <ProductDetailSkeleton />;

    if (error || !product) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Header />
                <div className="flex flex-col items-center justify-center py-32 text-center px-4">
                    <div className="text-6xl mb-4">😕</div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Product not found</h1>
                    <p className="text-gray-500 mb-6 text-sm">
                        This item may have been removed or the link is incorrect.
                    </p>
                    <button
                        onClick={() => router.push('/menu')}
                        className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        Browse Menu
                    </button>
                </div>
            </div>
        );
    }

    const displayPrice = product.onlinePrice ?? product.price;
    const vegStatus = getVegStatus(product.name);
    const isOut = product.isAvailable === false;

    // Cart quantity for the sticky bottom bar
    const cartItem = isMounted ? cartItems.find((i) => i.product.id === product.id) : undefined;
    const cartQty = cartItem?.quantity ?? 0;
    const totalCartItems = isMounted ? cartItems.reduce((sum, i) => sum + i.quantity, 0) : 0;

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />

            {/* ── Sticky back bar (mobile) ─────────────────────────────── */}
            <div className="sticky top-14 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-2.5 md:hidden">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        aria-label="Go back"
                    >
                        <ArrowLeft size={16} className="text-gray-700" />
                    </button>
                    <span className="text-sm font-semibold text-gray-800 truncate">{product.name}</span>
                </div>
            </div>

            {/* ── Main content ────────────────────────────────────────── */}
            <main className="max-w-4xl mx-auto px-4 py-6 pb-32 md:pb-10">
                <div className="md:flex md:gap-10">
                    {/* ── Left: Product image ────────────────────────── */}
                    <div className="md:w-[45%] md:flex-shrink-0 mb-6 md:mb-0">
                        {/* Desktop back button */}
                        <button
                            onClick={() => router.back()}
                            className="hidden md:flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
                        >
                            <ArrowLeft size={16} />
                            Back
                        </button>

                        <div className="relative bg-[#F5F6F8] rounded-3xl p-6 aspect-square flex items-center justify-center overflow-hidden border border-gray-100/50 shadow-sm">
                            {/* Veg/Non-Veg badge */}
                            {vegStatus && (
                                <div className="absolute top-4 right-4 z-10">
                                    {vegStatus === 'veg' ? (
                                        <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm border border-green-200">
                                            <div className="flex items-center justify-center w-4 h-4 border-[1.5px] border-[#008F4C] rounded-sm bg-white">
                                                <div className="w-2 h-2 rounded-full bg-[#008F4C]" />
                                            </div>
                                            <span className="text-[10px] font-bold text-green-700 uppercase">Veg</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm border border-red-200">
                                            <div className="flex items-center justify-center w-4 h-4 border-[1.5px] border-[#EB2D2D] rounded-sm bg-white">
                                                <div className="w-2 h-2 rounded-full bg-[#EB2D2D]" />
                                            </div>
                                            <span className="text-[10px] font-bold text-red-700 uppercase">Non-Veg</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="relative w-full h-full rounded-2xl overflow-hidden">
                                {product.imageURL && !imgError ? (
                                    <CldImage
                                        src={product.imageURL}
                                        alt={product.name}
                                        width={600}
                                        sizes="(max-width: 768px) 100vw, 45vw"
                                        className="transition-transform duration-500"
                                        onError={() => setImgError(true)}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-7xl text-gray-300 bg-white/50">
                                        🍽
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Right: Product info ─────────────────────────── */}
                    <div className="md:flex-1 md:pt-10">
                        {/* Category breadcrumb */}
                        {categoryName && (
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                                {categoryName}
                            </span>
                        )}

                        {/* Product name */}
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2 leading-tight">
                            {product.name}
                        </h1>

                        {/* Price + weight/unit row */}
                        <div className="flex items-center gap-3 mb-5">
                            <span className="text-xl sm:text-2xl font-black text-[#1A1C1E] italic">
                                ₹{displayPrice}
                            </span>
                            {product.weight && (
                                <span className="text-sm text-gray-400 font-medium border-l border-gray-200 pl-3">
                                    {product.weight}
                                </span>
                            )}
                            {product.unit && (
                                <span className="text-sm text-gray-400 font-medium">
                                    · {product.unit}
                                </span>
                            )}
                            {!product.weight && !product.unit && (
                                <span className="text-sm text-gray-400 font-medium border-l border-gray-200 pl-3">
                                    1 unit
                                </span>
                            )}
                        </div>

                        {/* Out of stock or quantity selector */}
                        {isOut ? (
                            <div className="inline-block text-xs font-extrabold text-gray-400 uppercase tracking-widest py-2 px-4 bg-gray-50 rounded-lg border border-gray-100 mb-6">
                                Out of Stock
                            </div>
                        ) : (
                            <div className="mb-6">
                                <QuantitySelector product={product} size="lg" />
                            </div>
                        )}

                        {/* ── Divider ──────────────────────────────── */}
                        <div className="border-t border-gray-100 my-6" />

                        {/* ── Description ─────────────────────────── */}
                        {product.description && (
                            <div className="mb-6">
                                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <span className="text-base">📋</span>
                                    Product Details
                                </h2>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {product.description}
                                </p>
                            </div>
                        )}

                        {/* ── Ingredients ─────────────────────────── */}
                        {product.ingredients && product.ingredients.length > 0 ? (
                            <div className="mb-6">
                                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <span className="text-base">🧂</span>
                                    Ingredients
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {product.ingredients.map((ingredient, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-100 text-xs font-medium text-gray-700 border border-gray-200/50"
                                        >
                                            {ingredient}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="mb-6">
                                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <span className="text-base">🧂</span>
                                    Ingredients
                                </h2>
                                <p className="text-xs text-gray-400 italic">No ingredient info available for this item.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Similar Products ────────────────────────────────── */}
                {similarProducts.length > 0 && (
                    <div className="border-t border-gray-100 mt-4">
                        <HorizontalProductScroll
                            title="Similar Products"
                            products={similarProducts}
                            categoryName={categoryName}
                        />
                    </div>
                )}

                {/* ── Recommended Products ────────────────────────────── */}
                {recommendedProducts.length > 0 && (
                    <div className="border-t border-gray-100">
                        <HorizontalProductScroll
                            title="You May Also Like"
                            products={recommendedProducts}
                        />
                    </div>
                )}
            </main>

            {/* ── Sticky bottom Add to Cart bar (mobile only) ────────── */}
            {!isOut && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-base font-extrabold text-gray-900 truncate">{product.name}</p>
                            <p className="text-sm font-bold text-gray-500 italic">₹{displayPrice}</p>
                        </div>
                        <div className="flex-shrink-0 ml-3">
                            <QuantitySelector product={product} size="md" />
                        </div>
                    </div>
                </div>
            )}

            {/* The existing MobileCartBar from the app (shows when cart has items) */}
            {isOut && <MobileCartBar />}
        </div>
    );
}
