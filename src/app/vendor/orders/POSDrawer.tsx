'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Plus, Minus, CheckCircle } from 'lucide-react';
import { useVendor } from '@/contexts/VendorContext';
import { createPOSOrder } from '@/lib/vendor';
import { Product, OrderItem } from '@/types';
import toast from 'react-hot-toast';

interface POSDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function POSDrawer({ isOpen, onClose }: POSDrawerProps) {
    const { products } = useVendor();
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<Record<string, number>>({});
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI'>('Cash');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter products
    const filteredProducts = useMemo(() => {
        if (!searchQuery) return products;
        const q = searchQuery.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(q));
    }, [products, searchQuery]);

    const addToCart = (product: Product) => {
        setCart(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => {
            const current = prev[productId] || 0;
            if (current <= 1) {
                const next = { ...prev };
                delete next[productId];
                return next;
            }
            return { ...prev, [productId]: current - 1 };
        });
    };

    // Derived cart properties
    const cartItems: OrderItem[] = Object.entries(cart).map(([productId, quantity]) => {
        const product = products.find(p => p.id === productId);
        return {
            productId,
            name: product?.name || 'Unknown Item',
            price: product?.price || 0,
            quantity,
            imageURL: product?.imageURL || ''
        };
    });

    const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const hasItems = cartItems.length > 0;

    const handleConfirm = async () => {
        if (!hasItems) return;
        setIsSubmitting(true);
        try {
            await createPOSOrder(cartItems, totalAmount, totalAmount, paymentMethod);
            // reset & close
            setCart({});
            setSearchQuery('');
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
                        className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] xl:w-[450px] bg-white  border-l border-gray-200  shadow-2xl z-50 flex flex-col pt-16"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-gray-100  flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-gray-900  tracking-tight">POS Walk-In</h2>
                                <p className="text-xs font-semibold text-gray-500">Quick order entry</p>
                            </div>
                            <button onClick={onClose} className="p-2 bg-gray-50 hover:bg-gray-100  :bg-gray-700 rounded-full transition-colors">
                                <X size={20} className="text-gray-600 " />
                            </button>
                        </div>

                        {/* Search & Menu */}
                        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-gray-50 ">
                            {/* Search */}
                            <div className="p-4 shrink-0 bg-white  border-b border-gray-100 ">
                                <div className="relative">
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search menu items..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50  border border-gray-200  rounded-xl focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 text-sm font-medium transition-all"
                                    />
                                </div>
                            </div>

                            {/* Menu List */}
                            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                                <div className="space-y-3">
                                    {filteredProducts.map(product => {
                                        const qty = cart[product.id] || 0;
                                        return (
                                            <div key={product.id} className="flex flex-col sm:flex-row items-center justify-between p-3 bg-white  border border-gray-200  rounded-xl shadow-sm">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <h3 className="text-sm font-bold text-gray-900  truncate">{product.name}</h3>
                                                    <p className="text-sm font-extrabold text-gray-600  mt-0.5">₹{product.price}</p>
                                                </div>
                                                <div className="shrink-0 mt-3 sm:mt-0 flex items-center bg-gray-50  border border-gray-200  rounded-lg overflow-hidden shrink-0">
                                                    {qty > 0 ? (
                                                        <>
                                                            <button onClick={() => removeFromCart(product.id)} className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-gray-200 :bg-gray-700 transition-colors">
                                                                <Minus size={14} strokeWidth={3} />
                                                            </button>
                                                            <span className="w-6 text-center text-sm font-bold text-gray-900 ">{qty}</span>
                                                            <button onClick={() => addToCart(product)} className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-gray-200 :bg-gray-700 transition-colors">
                                                                <Plus size={14} strokeWidth={3} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => addToCart(product)}
                                                            className="px-4 h-8 bg-red-50  text-red-600  font-bold text-xs hover:bg-red-100 transition-colors w-full sm:w-auto"
                                                        >
                                                            ADD
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Sticky Footer Cart Area */}
                        <div className="shrink-0 bg-white  border-t border-gray-200  p-5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-sm font-bold text-gray-500 ">Total Amount</span>
                                <span className="text-2xl font-black text-gray-900  tracking-tight">₹{totalAmount}</span>
                            </div>

                            {/* Payment Toggle */}
                            <div className="flex p-1 bg-gray-100  rounded-lg mb-4">
                                {(["Cash", "UPI"] as const).map(method => (
                                    <button
                                        key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${paymentMethod === method
                                                ? 'bg-white  shadow-sm text-gray-900 '
                                                : 'text-gray-500 hover:text-gray-700 :text-gray-300'
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
                                        : 'bg-gray-200  text-gray-400  cursor-not-allowed'
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
