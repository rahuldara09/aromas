'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Banner from '@/components/layout/Banner';
import Header from '@/components/layout/Header';
import ProductCard from '@/components/products/ProductCard';
import CartSidebar from '@/components/cart/CartSidebar';
import MobileCartBar from '@/components/cart/MobileCartBar';
import { Category, Product } from '@/types';
import { getCategories, getAllProducts, MOCK_CATEGORIES, MOCK_PRODUCTS } from '@/lib/firestore';

export default function MenuContent() {
    const searchParams = useSearchParams();
    const initialCategoryId = searchParams.get('category') ?? '';

    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>(initialCategoryId);
    const [loading, setLoading] = useState(true);
    const productSectionRef = useRef<HTMLDivElement>(null);
    const categoryBarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function load() {
            try {
                const [cats, prods] = await Promise.all([getCategories(), getAllProducts()]);
                setCategories(cats);
                setProducts(prods);
                if (!initialCategoryId && cats.length > 0) {
                    setActiveCategory(cats[0].id);
                }
            } catch {
                setCategories(MOCK_CATEGORIES);
                setProducts(MOCK_PRODUCTS);
                if (!initialCategoryId) setActiveCategory(MOCK_CATEGORIES[0].id);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const activeCategoryMatch = categories.find((c) => c.id === activeCategory);
    const activeCategoryName = activeCategoryMatch?.name ?? '';
    const activeCategoryAlternative = activeCategoryName.toLowerCase().replace(/\s+/g, '-');

    const activeProducts = products.filter((p) =>
        p.categoryId === activeCategory ||
        p.categoryId === activeCategoryAlternative ||
        p.categoryId === activeCategoryName ||
        (p as any).category === activeCategoryName
    );

    const getProductCount = (cat: Category) => {
        const alt = cat.name.toLowerCase().replace(/\s+/g, '-');
        return products.filter((p) =>
            p.categoryId === cat.id ||
            p.categoryId === alt ||
            p.categoryId === cat.name ||
            (p as any).category === cat.name
        ).length;
    };

    const handleCategoryClick = (id: string) => {
        setActiveCategory(id);
        productSectionRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

        // On mobile: scroll active tab into view in the horizontal bar
        if (categoryBarRef.current) {
            const activeBtn = categoryBarRef.current.querySelector(`[data-cat="${id}"]`) as HTMLElement;
            if (activeBtn) {
                activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
                    <p className="text-gray-500 text-sm">Loading menu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden">
            <Banner />
            <Header />

            {/* ── MOBILE: Horizontal scrollable category tab bar ──────────────── */}
            <div
                ref={categoryBarRef}
                className="md:hidden sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm flex overflow-x-auto scrollbar-hide"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {categories.map((cat) => {
                    const isActive = cat.id === activeCategory;
                    const count = getProductCount(cat);
                    return (
                        <button
                            key={cat.id}
                            data-cat={cat.id}
                            onClick={() => handleCategoryClick(cat.id)}
                            className={`flex-shrink-0 px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 ${isActive
                                    ? 'border-red-500 text-red-600 bg-red-50/50'
                                    : 'border-transparent text-gray-500 hover:text-gray-800'
                                }`}
                        >
                            {cat.name}
                            {count > 0 && (
                                <span className={`ml-1 text-[10px] ${isActive ? 'text-red-400' : 'text-gray-400'}`}>
                                    ({count})
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── DESKTOP: Full sidebar + cart layout ─────────────────────────── */}
            <div className="hidden md:flex h-[calc(100vh-88px)] w-full max-w-7xl mx-auto">
                {/* Category Sidebar */}
                <aside className="w-44 flex-shrink-0 bg-white border-r border-gray-100 overflow-y-auto scrollbar-thin">
                    {categories.map((cat) => {
                        const count = getProductCount(cat);
                        const isActive = cat.id === activeCategory;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => handleCategoryClick(cat.id)}
                                className={`w-full text-left px-4 py-3 text-sm border-l-2 transition-all duration-150 ${isActive
                                        ? 'border-red-500 bg-red-50 text-red-600 font-semibold'
                                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                {cat.name}{' '}
                                {count > 0 && (
                                    <span className={`text-xs ml-0.5 ${isActive ? 'text-red-400' : 'text-gray-400'}`}>
                                        ({count})
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </aside>

                {/* Product List */}
                <main ref={productSectionRef} className="flex-1 overflow-y-auto scrollbar-thin bg-white">
                    {/* Category header */}
                    <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-3 z-10">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                                {activeCategoryName}
                            </h2>
                            {activeProducts.length > 0 && (
                                <span className="bg-red-500 text-white text-xs font-bold rounded px-1.5 py-0.5">
                                    {activeProducts.length}
                                </span>
                            )}
                        </div>
                    </div>

                    {activeProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="text-5xl mb-4">🍽️</div>
                            <p className="text-gray-500">No items in this category yet.</p>
                        </div>
                    ) : (
                        <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {activeProducts.map((product) => (
                                <ProductCard 
                                    key={product.id} 
                                    product={product} 
                                    categoryName={activeCategoryName} 
                                />
                            ))}
                        </div>
                    )}
                </main>

                {/* Cart Sidebar */}
                <div className="w-[300px] flex-shrink-0 bg-gray-50 border-l border-gray-100 p-4 pr-6 overflow-y-auto scrollbar-thin">
                    <CartSidebar />
                </div>
            </div>

            {/* ── MOBILE: Product grid (full width, no sidebar) ───────────────── */}
            <div className="md:hidden bg-white">
                {/* Category label */}
                <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                        {activeCategoryName}
                    </h2>
                    {activeProducts.length > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold rounded px-1.5 py-0.5">
                            {activeProducts.length}
                        </span>
                    )}
                </div>

                {activeProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="text-5xl mb-4">🍽️</div>
                        <p className="text-gray-500">No items in this category yet.</p>
                    </div>
                ) : (
                    <div className="px-3 pb-28 grid grid-cols-2 gap-3 min-[420px]:grid-cols-2 max-[380px]:grid-cols-1">
                        {activeProducts.map((product) => (
                            <ProductCard 
                                key={product.id} 
                                product={product} 
                                categoryName={activeCategoryName} 
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── MOBILE: Sticky bottom cart bar ──────────────────────────────── */}
            <MobileCartBar />
        </div>
    );
}
