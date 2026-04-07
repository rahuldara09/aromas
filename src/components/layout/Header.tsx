'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Grid3X3, ShoppingCart, User, Search, X, Menu } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Product } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface HeaderProps {
    variant?: 'default' | 'checkout';
    checkoutStep?: number;
}

const CHECKOUT_STEPS = [
    { label: 'CART', step: 1 },
    { label: 'ADDRESS', step: 2 },
    { label: 'INFO', step: 3 },
    { label: 'PAYMENT', step: 4 },
];

export default function Header({ variant = 'default', checkoutStep = 1 }: HeaderProps) {
    const router = useRouter();
    const totalItems = useCartStore((s) => s.totalItems());
    const { user, isLoggedIn, openAuthModal } = useAuth();

    // ── Hydration fix ──────────────────────────────────────────────────────────
    // totalItems reads from localStorage (Zustand persist) which is unavailable
    // on the server, so SSR renders 0 while the client has real data → mismatch.
    // We defer the badge render until after hydration.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const displayCount = mounted ? totalItems : 0;
    // ──────────────────────────────────────────────────────────────────────────

    // ── Mobile search toggle ───────────────────────────────────────────────────
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mobileInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (mobileSearchOpen) {
            setTimeout(() => mobileInputRef.current?.focus(), 100);
        }
    }, [mobileSearchOpen]);

    // ── Search State ──────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const [confirmPending, setConfirmPending] = useState(false);
    const confirmTimer = useRef<NodeJS.Timeout | null>(null);

    const searchRef = useRef<HTMLDivElement>(null);
    const addItem = useCartStore(s => s.addItem);
    const items = useCartStore(s => s.items);
    const updateQuantity = useCartStore(s => s.updateQuantity);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced Search
    useEffect(() => {
        const fetchResults = async () => {
            if (!searchQuery.trim()) {
                setSearchResults([]);
                setShowDropdown(false);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            setShowDropdown(true);

            try {
                // For a small catalog, we might fetch everything or use a smart indexing tool like Algolia.
                // Here we fetch active products and filter client-side for "like" matching performance.
                const q = query(collection(db, 'products'), where('isAvailable', '==', true));
                const snapshot = await getDocs(q);
                const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

                const term = searchQuery.toLowerCase();
                const matched = allProducts
                    .filter(p => p.name.toLowerCase().includes(term) || (p.categoryId && p.categoryId.toLowerCase().includes(term)))
                    .slice(0, 6); // Top 6 results maximum

                setSearchResults(matched);
                setSelectedIndex(-1); // reset selection
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(fetchResults, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    // Keyboard Navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!searchQuery.trim() && totalItems > 0) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!confirmPending) {
                    setConfirmPending(true);
                    toast.success("Press Enter again to checkout", { icon: '🛒' });
                    confirmTimer.current = setTimeout(() => {
                        setConfirmPending(false);
                    }, 1200);
                } else {
                    setConfirmPending(false);
                    if (confirmTimer.current) clearTimeout(confirmTimer.current);
                    router.push('/checkout');
                }
            }
            return;
        }

        if (!showDropdown || !searchQuery) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
                const product = searchResults[selectedIndex];
                const cartItem = items.find(i => i.product.id === product.id);
                if (e.key === 'ArrowRight') {
                    if (cartItem) updateQuantity(product.id, cartItem.quantity + 1);
                    else addItem(product);
                } else if (e.key === 'ArrowLeft' && cartItem) {
                    updateQuantity(product.id, cartItem.quantity - 1);
                }
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
                const product = searchResults[selectedIndex];
                const cartItem = items.find(i => i.product.id === product.id);
                if (cartItem) {
                    updateQuantity(product.id, cartItem.quantity + 1);
                } else {
                    addItem(product);
                    toast.success(`Added ${product.name} to cart`);
                }
            }
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const handleAddToCart = (product: Product) => {
        addItem(product);
        toast.success(`Added ${product.name} to cart`);
    };
    // ──────────────────────────────────────────────────────────────────────────

    return (
        <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
            {/* ── MOBILE: compact header row ───────────────────────────────── */}
            <div className="md:hidden px-4 h-14 flex items-center justify-between gap-1">
                {/* Logo & Hamburger - grouped together */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="p-1 -ml-1 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        aria-label="Open Menu"
                    >
                        <Menu size={22} />
                    </button>
                    <Link href="/" title="Aroma Dhaba IIM Mumbai">
                        <span className="text-xl font-black tracking-tighter text-gray-900" style={{ letterSpacing: '-0.04em' }}>aromas</span>
                    </Link>
                </div>

                {/* Right icons - pushed to the right */}
                <div className="flex items-center gap-0.5 sm:gap-1.5">
                    <button
                        onClick={() => setMobileSearchOpen(o => !o)}
                        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label="Search"
                    >
                        {mobileSearchOpen ? <X size={18} className="text-gray-700" /> : <Search size={18} className="text-gray-700" />}
                    </button>
                    <Link href="/checkout" className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors" aria-label="Cart">
                        {displayCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[14px] h-[14px] px-0.5 flex items-center justify-center">
                                {displayCount}
                            </span>
                        )}
                        <ShoppingCart size={18} className="text-gray-700" />
                    </Link>
                    <button
                        onClick={isLoggedIn ? () => router.push('/account') : openAuthModal}
                        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label="Account"
                    >
                        <User size={18} className="text-gray-700" />
                    </button>
                </div>
            </div>

            {/* ── MOBILE: Expandable search bar ───────────────────────────── */}
            {mobileSearchOpen && (
                <div className="md:hidden px-3 pb-2.5">
                    <div ref={searchRef} className="relative w-full">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                        <input
                            ref={mobileInputRef}
                            type="text"
                            placeholder="Search for products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => { if (searchQuery) setShowDropdown(true); }}
                            onKeyDown={handleKeyDown}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all placeholder:text-gray-400"
                        />
                        {showDropdown && searchQuery && (
                            <div className="absolute top-[110%] left-0 w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 flex flex-col pt-1 pb-2">
                                {isSearching ? (
                                    <div className="px-4 py-6 text-center text-sm text-gray-500">Searching...</div>
                                ) : searchResults.length > 0 ? (
                                    <div className="flex flex-col max-h-[60vh] overflow-y-auto">
                                        {searchResults.map((product, idx) => {
                                            const isSelected = idx === selectedIndex;
                                            const cartItem = items.find(i => i.product.id === product.id);
                                            const qty = cartItem ? cartItem.quantity : 0;
                                            return (
                                                <div
                                                    key={product.id}
                                                    onMouseEnter={() => setSelectedIndex(idx)}
                                                    className={`flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl transition-colors cursor-pointer ${isSelected ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                                                    onClick={qty === 0 ? () => handleAddToCart(product) : undefined}
                                                >
                                                    <div className="w-10 h-10 shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                                        {product.imageURL ? (
                                                            <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-gray-400 text-[10px]">🍽</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className={`text-sm font-semibold truncate ${isSelected ? 'text-red-900' : 'text-gray-900'}`}>{product.name}</span>
                                                        <span className="text-xs text-gray-500 capitalize">{product.categoryId?.replace(/-/g, ' ')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-sm font-black text-gray-900">₹{product.price}</span>
                                                        {qty > 0 ? (
                                                            <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-1.5 py-0.5">
                                                                <button onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, qty - 1); }} className="w-5 h-5 flex items-center justify-center text-red-500 font-bold">-</button>
                                                                <span className="text-xs font-bold w-3 text-center">{qty}</span>
                                                                <button onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, qty + 1); }} className="w-5 h-5 flex items-center justify-center text-red-500 font-bold">+</button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-700">+ADD</button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="px-4 py-8 text-center text-sm text-gray-500">No items found</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── DESKTOP: original full header ──────────────────────────── */}
            <div className="hidden md:grid max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 grid-cols-[auto_1fr_auto] items-center gap-4">
                {variant === 'checkout' ? (
                    <>
                        {/* Logo */}
                        <Link href="/" className="justify-self-start" title="Aroma Dhaba IIM Mumbai">
                            <span className="text-2xl font-black tracking-tight text-gray-900" style={{ fontFamily: 'var(--font-geist-sans, sans-serif)', letterSpacing: '-0.03em' }}>aromas</span>
                        </Link>

                        {/* Checkout stepper */}
                        <div className="justify-self-center">
                            <div className="flex items-center gap-2">
                                {CHECKOUT_STEPS.map((s, idx) => (
                                    <div key={s.step} className="flex items-center">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center
                          ${checkoutStep >= s.step
                                                        ? 'bg-red-500 text-white'
                                                        : 'bg-gray-100 text-gray-400'
                                                    }`}
                                            >
                                                {s.step}
                                            </span>
                                            <span
                                                className={`text-xs font-semibold tracking-wide ${checkoutStep >= s.step ? 'text-red-500' : 'text-gray-400'
                                                    }`}
                                            >
                                                {s.label}
                                            </span>
                                        </div>
                                        {idx < CHECKOUT_STEPS.length - 1 && (
                                            <div
                                                className={`w-8 h-px mx-2 ${checkoutStep > s.step ? 'bg-red-400' : 'bg-gray-200'
                                                    }`}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Right nav */}
                        <nav className="flex items-center gap-4 justify-self-end">
                            <button onClick={() => router.push('/categories')} className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-red-500 transition-colors">
                                <Grid3X3 size={16} />
                                <span className="hidden sm:inline">Categories</span>
                            </button>
                            <Link href="/checkout" className="relative flex items-center gap-1.5 text-sm font-semibold text-white bg-red-500 rounded-full px-4 py-1.5 hover:bg-red-600 transition-colors shadow-sm">
                                {displayCount > 0 && (
                                    <span className="absolute -top-1.5 -left-1.5 bg-red-700 text-white text-[10px] font-black tracking-tighter rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                                        {displayCount}
                                    </span>
                                )}
                                <ShoppingCart size={15} />
                                <span>Cart</span>
                            </Link>
                            <button
                                onClick={isLoggedIn ? () => router.push('/account') : openAuthModal}
                                className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-red-500 transition-colors"
                            >
                                <User size={16} />
                                <span className="hidden sm:inline">Account</span>
                            </button>
                        </nav>
                    </>
                ) : (
                    <>
                        {/* Logo */}
                        <Link href="/" className="justify-self-start" title="Aroma Dhaba IIM Mumbai">
                            <span className="text-2xl font-black tracking-tight text-gray-900" style={{ fontFamily: 'var(--font-geist-sans, sans-serif)', letterSpacing: '-0.03em' }}>aromas</span>
                        </Link>

                        {/* Search bar */}
                        <div className="justify-self-center w-full max-w-lg">
                            <div ref={searchRef} className="w-full relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                                <input
                                    type="text"
                                    placeholder="Search for products..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => { if (searchQuery) setShowDropdown(true); }}
                                    onKeyDown={handleKeyDown}
                                    className="w-full pl-9 pr-4 py-[7px] text-sm border border-gray-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all placeholder:text-gray-400"
                                />

                                {/* Dropdown Menu */}
                                {showDropdown && searchQuery && (
                                    <div className="absolute top-[120%] left-0 w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 flex flex-col pt-1 pb-2">
                                        {isSearching ? (
                                            <div className="px-4 py-6 text-center text-sm text-gray-500 font-medium">Searching our kitchen...</div>
                                        ) : searchResults.length > 0 ? (
                                            <div className="flex flex-col max-h-[400px] overflow-y-auto">
                                                {searchResults.map((product, idx) => {
                                                    const isSelected = idx === selectedIndex;
                                                    const cartItem = items.find(i => i.product.id === product.id);
                                                    const qty = cartItem ? cartItem.quantity : 0;
                                                    return (
                                                        <div
                                                            key={product.id}
                                                            onMouseEnter={() => setSelectedIndex(idx)}
                                                            className={`flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl transition-colors cursor-pointer ${isSelected ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                                                            onClick={qty === 0 ? () => handleAddToCart(product) : undefined}
                                                        >
                                                            {/* Image thumbnail */}
                                                            <div className="w-10 h-10 shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                                                {product.imageURL ? (
                                                                    <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-gray-400 text-[10px] font-bold">NO IMG</span>
                                                                )}
                                                            </div>

                                                            {/* Info */}
                                                            <div className="flex flex-col flex-1 min-w-0">
                                                                <span className={`text-sm font-semibold truncate ${isSelected ? 'text-red-900' : 'text-gray-900'}`}>{product.name}</span>
                                                                <span className="text-xs font-medium text-gray-500 truncate capitalize">{product.categoryId?.replace(/-/g, ' ')}</span>
                                                            </div>

                                                            {/* Price & Action */}
                                                            <div className="flex items-center gap-3 shrink-0">
                                                                <span className="text-sm font-black text-gray-900 shrink-0">₹{product.price}</span>
                                                                {qty > 0 ? (
                                                                    <div className={`flex items-center gap-2 border rounded-lg px-1.5 py-0.5 shadow-sm ${isSelected ? 'border-red-200 bg-white' : 'border-gray-200 bg-white'}`}>
                                                                        <button onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, qty - 1); }} className="w-6 h-6 flex items-center justify-center text-red-500 font-bold hover:bg-red-50 rounded-md transition-colors">-</button>
                                                                        <span className="text-xs font-bold w-3 text-center text-gray-800 tabular-nums">{qty}</span>
                                                                        <button onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, qty + 1); }} className="w-6 h-6 flex items-center justify-center text-red-500 font-bold hover:bg-red-50 rounded-md transition-colors">+</button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSelected ? 'bg-red-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'}`}
                                                                    >
                                                                        + ADD
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="px-4 py-8 text-center flex flex-col items-center justify-center">
                                                <Search className="w-6 h-6 text-gray-300 mb-2" />
                                                <div className="text-sm font-semibold text-gray-900">No items found</div>
                                                <div className="text-xs text-gray-500 mt-1">Try searching for &quot;rice&quot; or &quot;paneer&quot;</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Nav */}
                        <nav className="flex items-center gap-[1.5rem] justify-self-end">
                            <Link href="/categories" className="text-sm font-semibold text-gray-700 hover:text-red-500 transition-colors">
                                Categories
                            </Link>


                            <Link href="/checkout" className="relative flex items-center gap-1.5 text-sm text-gray-700 hover:text-red-500 transition-colors">
                                {displayCount > 0 && (
                                    <span className="absolute -top-1.5 -left-1.5 bg-red-500 text-white text-[10px] font-black tracking-tighter rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center">
                                        {displayCount}
                                    </span>
                                )}
                                <ShoppingCart size={17} />
                                <span className="hidden sm:inline">Cart</span>
                            </Link>
                            <button
                                onClick={isLoggedIn ? () => router.push('/account') : openAuthModal}
                                className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-red-500 transition-colors"
                            >
                                <User size={17} />
                                <span className="hidden sm:inline">Account</span>
                            </button>
                        </nav>
                    </>
                )}
            </div>

            {/* ── MOBILE MENU DRAWER ────────────────────────────────────────── */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
                    <div className="fixed inset-y-0 left-0 w-[280px] bg-white shadow-2xl flex flex-col pt-5 pb-8">
                        <div className="px-6 flex items-center justify-between mb-8">
                            <span className="text-2xl font-black tracking-tight text-gray-900">aromas</span>
                            <button onClick={() => setMobileMenuOpen(false)} className="p-2 -mr-2 text-gray-500">
                                <X size={24} />
                            </button>
                        </div>

                        <nav className="flex-1 px-4 space-y-1">
                            <Link
                                href="/categories"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-4 px-4 py-3 text-base font-bold text-gray-900 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                            >
                                Categories
                            </Link>
                            <Link
                                href="/about"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-4 px-4 py-3 text-base font-bold text-gray-900 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                            >
                                About Us
                            </Link>
                            <Link
                                href="/contact"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-4 px-4 py-3 text-base font-bold text-gray-900 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                            >
                                Contact Us
                            </Link>
                            <Link
                                href="/blog"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-4 px-4 py-3 text-base font-bold text-gray-900 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                            >
                                Campus Blog
                            </Link>
                        </nav>

                        <div className="px-6 pt-6 border-t border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">My Account</p>
                            <button
                                onClick={() => { setMobileMenuOpen(false); isLoggedIn ? router.push('/account') : openAuthModal(); }}
                                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg hover:bg-gray-800 transition-all"
                            >
                                <User size={18} />
                                {user ? 'View Account' : 'Log in / Sign up'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

