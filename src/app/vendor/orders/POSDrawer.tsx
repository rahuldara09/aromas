'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, CheckCircle, Hash, ShoppingCart } from 'lucide-react';
import { useVendor } from '@/contexts/VendorContext';
import { createPOSOrder } from '@/lib/vendor';
import { Product, OrderItem } from '@/types';
import toast from 'react-hot-toast';

interface POSDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

type EnrichedProduct = Product & { shortcode: string; sn: number };

function generateShortcode(name: string): string {
    return name
        .split(/\s+/)
        .map(w => w[0] ?? '')
        .join('')
        .toLowerCase();
}

export default function POSDrawer({ isOpen, onClose }: POSDrawerProps) {
    const { posProducts } = useVendor();
    const [query, setQuery] = useState('');
    const [cart, setCart] = useState<Record<string, number>>({});
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI'>('Cash');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Enrich products with shortcode + serial number once
    const enriched = useMemo<EnrichedProduct[]>(() =>
        posProducts.map((p, i) => ({
            ...p,
            shortcode: p.code ?? generateShortcode(p.name),
            sn: p.serialNumber ?? (i + 1),
        })),
        [posProducts]
    );

    // Smart suggestions: serial number → exact shortcode → partial (name + shortcode)
    const suggestions = useMemo<EnrichedProduct[]>(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];

        if (/^\d+$/.test(q)) {
            const serial = parseInt(q, 10);
            return enriched.filter(p => p.sn === serial).slice(0, 1);
        }

        const exactCode = enriched.filter(p => p.shortcode === q);
        if (exactCode.length > 0) return exactCode.slice(0, 6);

        return enriched
            .filter(p => p.shortcode.startsWith(q) || p.name.toLowerCase().includes(q))
            .slice(0, 6);
    }, [query, enriched]);

    const showDropdown = suggestions.length > 0 && query.trim().length > 0;

    // Reset highlight when suggestions change
    useEffect(() => { setHighlightedIndex(0); }, [suggestions]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlightedIndex]);

    // Focus input when drawer opens
    useEffect(() => {
        if (isOpen) {
            const t = setTimeout(() => inputRef.current?.focus(), 300);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    const addToCart = useCallback((product: Product) => {
        setCart(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
        setQuery('');
        inputRef.current?.focus();
    }, []);

    const removeFromCart = useCallback((productId: string) => {
        setCart(prev => {
            const qty = prev[productId] || 0;
            if (qty <= 1) {
                const next = { ...prev };
                delete next[productId];
                return next;
            }
            return { ...prev, [productId]: qty - 1 };
        });
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showDropdown) return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (suggestions[highlightedIndex]) addToCart(suggestions[highlightedIndex]);
                break;
            case 'Escape':
                setQuery('');
                break;
        }
    };

    const cartItems: OrderItem[] = Object.entries(cart).map(([productId, quantity]) => {
        const p = enriched.find(x => x.id === productId);
        return {
            productId,
            name: p?.name ?? 'Unknown Item',
            price: p?.price ?? 0,   // POS price: base price, no GST, no packaging
            quantity,
            imageURL: p?.imageURL ?? '',
        };
    });

    const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const hasItems = cartItems.length > 0;

    const handleConfirm = async () => {
        if (!hasItems) return;
        setIsSubmitting(true);
        try {
            await createPOSOrder(cartItems, totalAmount, totalAmount, paymentMethod as 'Cash' | 'UPI');
            setCart({});
            setQuery('');
            setPaymentMethod('Cash');
            onClose();
        } catch (error) {
            toast.error('Failed to create POS order');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] xl:w-[460px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col pt-16"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 tracking-tight">POS Walk-In</h2>
                                <p className="text-xs font-semibold text-gray-500">Type name · shortcode · or #number</p>
                            </div>
                            <button onClick={onClose} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={20} className="text-gray-600" />
                            </button>
                        </div>

                        {/* Smart Input */}
                        <div className="px-4 pt-4 pb-2 bg-white shrink-0">
                            <div className="relative">
                                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Search by name, code or serial no…"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 text-sm font-medium transition-all"
                                />

                                {/* Dropdown */}
                                <AnimatePresence>
                                    {showDropdown && (
                                        <motion.ul
                                            ref={listRef}
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            transition={{ duration: 0.1 }}
                                            className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-10 overflow-hidden max-h-64 overflow-y-auto"
                                        >
                                            {suggestions.map((p, idx) => (
                                                <li key={p.id}>
                                                    <button
                                                        onMouseDown={e => { e.preventDefault(); addToCart(p); }}
                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${idx === highlightedIndex
                                                            ? 'bg-red-50 text-red-700'
                                                            : 'hover:bg-gray-50 text-gray-800'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <span className="text-xs font-bold text-gray-400 w-6 shrink-0">{p.sn}</span>
                                                            <span className="text-sm font-semibold truncate">{p.name}</span>
                                                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{p.shortcode}</span>
                                                        </div>
                                                        <span className="text-sm font-extrabold text-gray-700 shrink-0 ml-3">₹{p.price}</span>
                                                    </button>
                                                </li>
                                            ))}
                                        </motion.ul>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Hint bar */}
                            <div className="flex gap-4 mt-2 px-1">
                                {(['vs', 'pcs', 'cb'].map(code => {
                                    const item = enriched.find(p => p.shortcode === code);
                                    return item ? (
                                        <button
                                            key={code}
                                            onMouseDown={e => { e.preventDefault(); addToCart(item); }}
                                            className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            {code}
                                        </button>
                                    ) : null;
                                }))}
                                <span className="text-[10px] text-gray-300 ml-auto">↑↓ navigate · Enter to add</span>
                            </div>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto px-4 py-2 bg-gray-50 scrollbar-thin">
                            {!hasItems ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
                                    <ShoppingCart size={40} strokeWidth={1.5} />
                                    <p className="text-sm font-semibold">Cart is empty</p>
                                    <p className="text-xs">Start typing to add items</p>
                                </div>
                            ) : (
                                <div className="space-y-2 py-2">
                                    {cartItems.map(item => (
                                        <div key={item.productId} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                                            <div className="flex-1 min-w-0 pr-3">
                                                <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                                                <p className="text-xs font-extrabold text-gray-500 mt-0.5">
                                                    ₹{item.price} × {item.quantity} = <span className="text-gray-800">₹{item.price * item.quantity}</span>
                                                </p>
                                            </div>
                                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shrink-0">
                                                <button
                                                    onClick={() => removeFromCart(item.productId)}
                                                    className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-gray-100 transition-colors"
                                                >
                                                    <Minus size={13} strokeWidth={3} />
                                                </button>
                                                <span className="w-7 text-center text-sm font-black text-gray-900">{item.quantity}</span>
                                                <button
                                                    onClick={() => {
                                                        const p = enriched.find(x => x.id === item.productId);
                                                        if (p) addToCart(p);
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-gray-100 transition-colors"
                                                >
                                                    <Plus size={13} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 bg-white border-t border-gray-200 p-5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-sm font-bold text-gray-500">
                                    {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} · POS price (no GST)
                                </span>
                                <span className="text-2xl font-black text-gray-900 tracking-tight">₹{totalAmount}</span>
                            </div>

                            {/* Payment Toggle */}
                            <div className="flex p-1 bg-gray-100 rounded-lg mb-4">
                                {(['Cash', 'UPI'] as const).map(method => (
                                    <button
                                        key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${paymentMethod === method
                                            ? 'bg-white shadow-sm text-gray-900'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {method}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleConfirm}
                                disabled={!hasItems || isSubmitting}
                                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-lg transition-all ${hasItems && !isSubmitting
                                    ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white shadow-lg shadow-red-500/20'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {isSubmitting ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle size={22} />
                                        Confirm & Print
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
