'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useVendor } from '@/contexts/VendorContext';
import { updateOrderStatus, batchUpdateOrderStatus, createPOSOrder } from '@/lib/vendor';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { Order, Product, OrderItem } from '@/types';
import { getOrderAgeMinutes, getOrderSlaState, getOrderStatusLabel } from '@/lib/order-status';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Printer, Search, Truck, Package, ChefHat, Bell, Phone, MapPin, Activity,
    X, List, Layers, BarChart2, ClipboardList, AlertCircle, Plus, Eye, Banknote, Smartphone, Clock, CheckCircle2, ChevronUp, ChevronDown, Calendar, CreditCard, RotateCcw,
    Globe, Store as StoreIcon, MoreVertical, Download, ChevronLeft, ChevronRight, TrendingUp, ShoppingCart
} from 'lucide-react';
import OrderDetailsDrawer from './OrderDetailsDrawer';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function minutesElapsed(orderDate: Date): number {
    return Math.floor((Date.now() - new Date(orderDate).getTime()) / 60_000);
}
function getUrgency(orderDate: Date): 'green' | 'amber' | 'red' {
    const m = minutesElapsed(orderDate);
    if (m < 10) return 'green';
    if (m < 20) return 'amber';
    return 'red';
}
function urgencyBorderClass(u: 'green' | 'amber' | 'red') {
    switch (u) {
        case 'green': return 'border-l-emerald-400';
        case 'amber': return 'border-l-amber-400';
        case 'red': return 'border-l-red-500';
    }
}
function urgencyBgClass(u: 'green' | 'amber' | 'red') {
    switch (u) {
        case 'green': return '';
        case 'amber': return 'bg-amber-50/60';
        case 'red': return 'bg-red-50/70';
    }
}
function buildDailyTokens(orders: Order[]): Map<string, string> {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const todayOrders = orders
        .filter(o => { const d = new Date(o.orderDate); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayStr; })
        .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
    const map = new Map<string, string>();
    todayOrders.forEach((o, i) => { map.set(o.id, String(i + 1).padStart(3, '0')); });
    return map;
}
function groupByHostel(orders: Order[]): Record<string, Order[]> {
    const groups: Record<string, Order[]> = {};
    orders.forEach(o => {
        const hostel = o.deliveryAddress?.hostelNumber || 'Unknown';
        if (!groups[hostel]) groups[hostel] = [];
        groups[hostel].push(o);
    });
    return groups;
}

function getBatchRoomSummary(orders: Order[]): string {
    const floors = Array.from(new Set(
        orders
            .map((order) => order.deliveryAddress?.roomNumber?.trim())
            .filter(Boolean)
            .map((room) => room![0])
            .filter((floor) => /\d/.test(floor))
    ));

    if (floors.length === 0) return 'rooms pending';
    return `floors ${floors.join(', ')}`;
}

function getBatchChipClass(state: 'normal' | 'warning' | 'overdue') {
    switch (state) {
        case 'warning':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'overdue':
            return 'bg-red-50 text-red-700 border-red-200';
        default:
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function VendorKanban() {
    const { orders, products, playDispatchSound } = useVendor();
    const [kitchenYellMode, setKitchenYellMode] = useState(false);
    const [selectedPreparingIds, setSelectedPreparingIds] = useState<string[]>([]);
    const [selectedDispatchIds, setSelectedDispatchIds] = useState<string[]>([]);
    const { isConnected: isPrinterConnected, printKOT: printReceipt, isPrinting } = useThermalPrinter();

    // ── MOBILE TAB STATE & FEEDBACK ────────────────────────────────
    const [mobileTab, setMobileTab] = useState<'new' | 'preparing' | 'pos'>('new');
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
    const notifyDispatch = useCallback((message: string) => {
        toast.success(message, {
            id: 'dispatch-notice',
            duration: 1400,
            style: { borderRadius: '10px', fontWeight: 600, fontSize: '13px' },
        });
    }, []);

    // ─── DERIVED DATA ──────────────────────────────────────────────────
    const tokenMap = useMemo(() => buildDailyTokens(orders), [orders]);
    const newOrders = useMemo(
        () =>
            orders
                .filter(o => (o.status === 'Placed' || o.status === 'Pending') && o.orderType !== 'pos')
                .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()),
        [orders]
    );
    const preparingOrders = useMemo(
        () =>
            orders
                .filter(o => o.status === 'Preparing' && o.orderType !== 'pos')
                .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()),
        [orders]
    );
    const dispatchedOrders = useMemo(
        () =>
            orders
                .filter(o => o.status === 'Dispatched' && o.orderType !== 'pos')
                .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()),
        [orders]
    );
    const preparingGroups = useMemo(() => Object.entries(groupByHostel(preparingOrders)).sort(([, a], [, b]) => {
        return getOrderAgeMinutes(b[0]) - getOrderAgeMinutes(a[0]);
    }), [preparingOrders]);
    const dispatchedGroups = useMemo(() => Object.entries(groupByHostel(dispatchedOrders)).sort(([, a], [, b]) => {
        return getOrderAgeMinutes(b[0]) - getOrderAgeMinutes(a[0]);
    }), [dispatchedOrders]);
    const kitchenTally = useMemo(() => {
        const tally: Record<string, number> = {};
        preparingOrders.forEach(o => o.items.forEach(item => { tally[item.name] = (tally[item.name] || 0) + item.quantity; }));
        return Object.entries(tally).sort(([, a], [, b]) => b - a);
    }, [preparingOrders]);

    // ─── HANDLERS ──────────────────────────────────────────────────────
    const preparingOrdersCount = preparingOrders.length;
    const preparingItemsCount = preparingOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
    const longestPreparingMins = preparingOrders.length > 0 ? Math.max(...preparingOrders.map(o => minutesElapsed(o.orderDate))) : 0;

    const handleAcceptAndPrint = useCallback(async (order: Order, token: string) => {
        try {
            await printReceipt(order, token);
            await updateOrderStatus(order.id, 'Preparing');
            toast.success(`#${token} accepted`, { style: { borderRadius: '14px', fontWeight: 600 } });
        } catch (err: unknown) {
            console.error(err);
            // Show error and allow retry — do NOT accept the order if printing failed
            toast.error(err instanceof Error ? err.message : 'Print failed', {
                duration: 4000,
                style: { borderRadius: '14px', fontWeight: 600 },
            });
        }
    }, [printReceipt]);

    const markOrdersOutForDelivery = useCallback(async (orderIds: string[], label: string) => {
        try {
            await batchUpdateOrderStatus(orderIds, 'Dispatched');
            setSelectedPreparingIds(prev => prev.filter(id => !orderIds.includes(id)));
            playDispatchSound();
            notifyDispatch(`${label} out for delivery`);
        } catch {
            toast.error('Failed to start delivery batch');
        }
    }, [playDispatchSound, notifyDispatch]);

    const markOrdersDelivered = useCallback(async (orderIds: string[], label: string) => {
        try {
            await batchUpdateOrderStatus(orderIds, 'Delivered');
            setSelectedDispatchIds(prev => prev.filter(id => !orderIds.includes(id)));
            notifyDispatch(`${label} delivered`);
        } catch {
            toast.error('Failed to close delivery batch');
        }
    }, [notifyDispatch]);

    // ─── POS STATE ─────────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<'board' | 'history'>('board');
    const [posSearch, setPosSearch] = useState('');
    const [posCart, setPosCart] = useState<Record<string, number>>({});
    const [posSubmitting, setPosSubmitting] = useState(false);
    const [confirmPending, setConfirmPending] = useState(false);
    const [confirmProgress, setConfirmProgress] = useState(0);
    const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const viewModeRef = useRef<'board' | 'history'>('board');
    const [selectedCartIndex, setSelectedCartIndex] = useState<number | null>(null);
    const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState<number | null>(null);
    const posSearchRef = useRef<HTMLInputElement>(null);

    const posFiltered = useMemo(() => {
        const q = posSearch.toLowerCase().trim();
        if (!q) return []; // Only show suggestions when typing
        return (products as Product[]).filter(p => p.name.toLowerCase().includes(q)).slice(0, 10);
    }, [products, posSearch]);

    // Reset suggestion highlight when search changes
    useEffect(() => {
        if (posFiltered.length > 0) {
            setHighlightedSuggestionIndex(0);
        } else {
            setHighlightedSuggestionIndex(null);
        }
    }, [posSearch, posFiltered.length]);

    useEffect(() => {
        const activePreparingIds = new Set(preparingOrders.map((order) => order.id));
        const activeDispatchIds = new Set(dispatchedOrders.map((order) => order.id));
        setSelectedPreparingIds((prev) => prev.filter((id) => activePreparingIds.has(id)));
        setSelectedDispatchIds((prev) => prev.filter((id) => activeDispatchIds.has(id)));
    }, [preparingOrders, dispatchedOrders]);

    const posCartItems: OrderItem[] = useMemo(() =>
        Object.entries(posCart).map(([productId, quantity]) => {
            const p = (products as Product[]).find(x => x.id === productId);
            return { productId, name: p?.name || '', price: p?.price || 0, quantity, imageURL: p?.imageURL || '' };
        }).filter(i => i.name),
        [posCart, products]);

    const posTotal = posCartItems.reduce((s, i) => s + i.price * i.quantity, 0);

    const addToPos = useCallback((product: Product) => {
        setPosCart(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
    }, []);

    const removeFromPos = useCallback((productId: string) => {
        setPosCart(prev => {
            const n = { ...prev };
            if ((n[productId] || 0) <= 1) delete n[productId];
            else n[productId]--;
            return n;
        });
    }, []);

    const handlePosConfirm = useCallback(async () => {
        if (posCartItems.length === 0) return;
        setPosSubmitting(true);
        setConfirmPending(false);
        setConfirmProgress(0);
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        try {
            const orderId = await createPOSOrder(posCartItems, posTotal, posTotal, 'Cash');
            
            // Build a sufficient mock order for the printer service
            // The local print server primarily relies on `orderId` and `items`
            const printMockOrder = {
                id: orderId,
                items: posCartItems,
                orderDate: new Date(),
                status: 'Preparing',
                orderType: 'pos',
                payment_status: 'success',
                grandTotal: posTotal,
            } as Order;

            const token = orderId.slice(-3).toUpperCase(); // Quick token generation for POS

            try {
                await printReceipt(printMockOrder, token);
                toast.success(`POS Order #${token} created & printed!`, { style: { borderRadius: '14px', fontWeight: 600 } });
            } catch (err: unknown) {
                console.error('POS Print error:', err);
                toast.success(`Order created! (Print failed: ${err instanceof Error ? err.message : 'Unknown error'})`, { style: { borderRadius: '14px', fontWeight: 600 } });
            }

            setPosCart({});
            setPosSearch('');
            setSelectedCartIndex(null);
            setTimeout(() => posSearchRef.current?.focus(), 30);
        } catch { toast.error('Failed to create POS order'); }
        finally { setPosSubmitting(false); }
    }, [posCartItems, posTotal, printReceipt]);

    const handlePosSearchKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = posSearch.trim();

            if (query !== "") {
                if (posFiltered.length > 0) {
                    const idx = highlightedSuggestionIndex !== null ? highlightedSuggestionIndex : 0;
                    addToPos(posFiltered[idx]);
                    setPosSearch('');
                    // Keep focus in search
                    setTimeout(() => posSearchRef.current?.focus(), 30);
                }
                return;
            }

            if (query === "" && posCartItems.length > 0) {
                // Double Enter to confirm logic
                if (confirmPending) {
                    handlePosConfirm();
                } else {
                    setConfirmPending(true);
                    setConfirmProgress(100);
                    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                    
                    const duration = 2000;
                    const interval = 20;
                    let timeLeft = duration;
                    
                    progressIntervalRef.current = setInterval(() => {
                        timeLeft -= interval;
                        setConfirmProgress((timeLeft / duration) * 100);
                        if (timeLeft <= 0) {
                            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                            setConfirmPending(false);
                            setConfirmProgress(0);
                        }
                    }, interval);

                    confirmTimerRef.current = setTimeout(() => {
                        setConfirmPending(false);
                        setConfirmProgress(0);
                    }, duration);
                }
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (posFiltered.length > 0) {
                setHighlightedSuggestionIndex(prev =>
                    prev === null ? 0 : Math.min(prev + 1, posFiltered.length - 1)
                );
            } else if (posCartItems.length > 0 && !posSearch) {
                // Move to cart if no search results and search is empty
                setSelectedCartIndex(0);
                posSearchRef.current?.blur();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (posFiltered.length > 0) {
                setHighlightedSuggestionIndex(prev =>
                    prev === null ? 0 : Math.max(prev - 1, 0)
                );
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (posSearch) {
                setPosSearch(''); // Clear search to close suggestions
            }
            posSearchRef.current?.focus();
        } else if (e.key === 'Tab') {
            if (posCartItems.length > 0 && !posSearch) {
                e.preventDefault();
                setSelectedCartIndex(0);
                posSearchRef.current?.blur();
            }
        }
    }, [posFiltered, addToPos, posCartItems.length, highlightedSuggestionIndex, posSearch, handlePosConfirm, confirmPending]);

    // Keyboard navigation logic
    useEffect(() => {
        if (viewMode !== 'board') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Global Submit Shortcuts
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (posCartItems.length > 0) {
                    if (confirmPending) {
                        handlePosConfirm();
                    } else {
                        // Trigger the same double-confirm logic
                        setConfirmPending(true);
                        setConfirmProgress(100);
                        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                        
                        const duration = 2000;
                        const interval = 20;
                        let timeLeft = duration;
                        
                        progressIntervalRef.current = setInterval(() => {
                            timeLeft -= interval;
                            setConfirmProgress((timeLeft / duration) * 100);
                            if (timeLeft <= 0) {
                                if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                                setConfirmPending(false);
                                setConfirmProgress(0);
                            }
                        }, interval);

                        confirmTimerRef.current = setTimeout(() => {
                            setConfirmPending(false);
                            setConfirmProgress(0);
                        }, duration);
                    }
                }
                return;
            }
            if (e.key === 'F9') {
                e.preventDefault();
                handlePosConfirm();
                return;
            }

            // Ignore if typing in another input that isn't the POS search
            if (e.target instanceof HTMLInputElement && e.target !== posSearchRef.current) return;

            if (selectedCartIndex !== null) {
                // Cart Item Focused
                if (e.key === 'ArrowUp') {
                    e.preventDefault(); // Prevent scrolling
                    if (selectedCartIndex > 0) {
                        setSelectedCartIndex(prev => prev! - 1);
                    } else {
                        setSelectedCartIndex(null);
                        posSearchRef.current?.focus();
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault(); // Prevent scrolling
                    if (selectedCartIndex < posCartItems.length - 1) {
                        setSelectedCartIndex(prev => prev! + 1);
                    }
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const item = posCartItems[selectedCartIndex];
                    if (item) removeFromPos(item.productId!);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const item = posCartItems[selectedCartIndex];
                    // safe cast since addToPos only destructs id
                    if (item) addToPos({ id: item.productId! } as Product);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setSelectedCartIndex(null);
                    posSearchRef.current?.focus();
                }
            } else {
                // Focus Shortcut (Ctrl + Down) -> moves to cart if not already focused
                if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
                    if (posCartItems.length > 0) {
                        e.preventDefault();
                        setSelectedCartIndex(0);
                        posSearchRef.current?.blur();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewMode, selectedCartIndex, posCartItems, addToPos, removeFromPos, handlePosConfirm]);

    // Auto-adjust selectedCartIndex if items are removed
    useEffect(() => {
        if (selectedCartIndex !== null) {
            if (posCartItems.length === 0) {
                setSelectedCartIndex(null);
                posSearchRef.current?.focus();
            } else if (selectedCartIndex >= posCartItems.length) {
                setSelectedCartIndex(posCartItems.length - 1);
            }
        }
    }, [posCartItems.length, selectedCartIndex]);

    // ─── VIEW / HISTORY STATE ───────────────────────────────────────────
    const [historySearch, setHistorySearch] = useState('');
    const [historyDate, setHistoryDate] = useState('');
    const [historyStatus, setHistoryStatus] = useState('All');
    const [historySource, setHistorySource] = useState('All');
    const [historyPage, setHistoryPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    const filteredHistoryOrders = useMemo(() => {
        let f = [...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
        if (historySearch) { const l = historySearch.toLowerCase(); f = f.filter(o => o.id.toLowerCase().includes(l) || (o.deliveryAddress?.name || '').toLowerCase().includes(l)); }
        if (historyDate) { f = f.filter(o => { const d = new Date(o.orderDate); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === historyDate; }); }
        if (historyStatus !== 'All') f = f.filter(o => o.status === historyStatus);
        if (historySource !== 'All') f = f.filter(o => historySource === 'POS' ? o.orderType === 'pos' : o.orderType !== 'pos');
        return f;
    }, [orders, historySearch, historyDate, historyStatus, historySource]);

    const historySummary = useMemo(() => {
        const valid = filteredHistoryOrders.filter(o => o.status !== 'Cancelled');
        const onlineOrders = valid.filter(o => o.orderType !== 'pos').length;
        const posOrders = valid.filter(o => o.orderType === 'pos').length;
        return { totalOrders: valid.length, onlineOrders, posOrders, totalSales: valid.reduce((s, o) => s + o.grandTotal, 0) };
    }, [filteredHistoryOrders]);

    const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryOrders.length / ITEMS_PER_PAGE));
    const paginatedOrders = useMemo(() => { const s = (historyPage - 1) * ITEMS_PER_PAGE; return filteredHistoryOrders.slice(s, s + ITEMS_PER_PAGE); }, [filteredHistoryOrders, historyPage]);
    useEffect(() => { setHistoryPage(1); }, [historySearch, historyDate, historyStatus, historySource]);

    // Auto-focus POS search when on board
    useEffect(() => { if (viewMode === 'board') setTimeout(() => posSearchRef.current?.focus(), 150); }, [viewMode]);

    // ═══════════════════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════════════════
    return (
        <div className="h-full flex flex-col vendor-workspace overflow-hidden select-none transition-colors">
            <div className="flex items-center gap-8 px-6 bg-white/95 backdrop-blur border-b border-slate-200 z-20 flex-shrink-0 h-12">
                <button 
                    onClick={() => setViewMode('board')} 
                    className={`h-full px-1 text-[13px] font-black transition-all border-b-[3px] uppercase tracking-wider flex items-center gap-2 ${viewMode === 'board' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                    Live Board
                </button>
                <button 
                    onClick={() => setViewMode('history')} 
                    className={`h-full px-1 text-[13px] font-black transition-all border-b-[3px] uppercase tracking-wider flex items-center gap-2 ${viewMode === 'history' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                    History
                </button>
            </div>

            {viewMode === 'board' ? (
                <>
                    {/* ── MOBILE TAB BAR ─────────────────────────────────── */}
                    <div className="lg:hidden flex border-b border-slate-200 bg-white overflow-x-auto flex-shrink-0">
                        {[
                            { key: 'new', label: 'New', count: newOrders.length, color: 'text-purple-600 border-purple-500' },
                            { key: 'preparing', label: 'Preparing', count: preparingOrders.length, color: 'text-amber-600 border-amber-500' },
                            { key: 'pos', label: 'POS', count: null, color: 'text-purple-600 border-purple-500' },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setMobileTab(tab.key as typeof mobileTab)}
                                className={`flex-1 min-w-[72px] flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${mobileTab === tab.key
                                    ? tab.color
                                    : 'border-transparent text-gray-400'
                                    }`}
                            >
                                {tab.label}
                                {tab.count !== null && tab.count > 0 && (
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mobileTab === tab.key ? 'bg-current opacity-0' : 'bg-gray-200 text-gray-600'
                                        }`}>{tab.count}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* ── MOBILE SINGLE-COLUMN CONTENT ─────────────────── */}
                    <div className="lg:hidden flex-1 overflow-y-auto w-full">
                        {mobileTab === 'new' && (
                            <div className="flex flex-col bg-white  min-h-full">
                                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-200 flex-shrink-0">
                                    <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center"><Bell size={13} /></div>
                                    <h2 className="font-extrabold text-sm text-gray-900 tracking-tight">NEW ORDERS</h2>
                                    {newOrders.length > 0 && <span className="ml-auto bg-purple-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">{newOrders.length}</span>}
                                </div>
                                <div className="flex-1 bg-slate-50 overflow-y-auto p-4 space-y-3 pb-8">
                                    {newOrders.length === 0 ? (
                                        <EmptyState emoji="🔔" text="No new orders" sub="Incoming orders appear here" />
                                    ) : (
                                        newOrders.map(order => {
                                            const tok = tokenMap.get(order.id) || '???';
                                            return (
                                                <div key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-in fade-in slide-in-from-bottom-2">
                                                    <OrderCard order={order} token={tok} onViewDetails={() => setSelectedOrderDetails(order)}>
                                                        <div className="flex gap-2 mt-2">
                                                            <button onClick={async () => { try { await updateOrderStatus(order.id, 'Cancelled'); toast('Rejected', { icon: '🚫' }); } catch { toast.error('Failed'); } }} className="flex-1 py-3 rounded-xl text-gray-500 hover:bg-gray-100 font-bold text-sm ring-1 ring-inset ring-gray-300 transition-colors min-h-[44px]">Reject</button>
                                                            <button disabled={isPrinting} onClick={() => handleAcceptAndPrint(order, tok)} className="flex-1 flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold text-sm py-3 rounded-xl shadow-sm transition-colors min-h-[44px]">
                                                                {isPrinting ? (
                                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                ) : (
                                                                    <Printer size={16} />
                                                                )}
                                                                {isPrinting ? 'Printing...' : 'Accept & Print'}
                                                            </button>
                                                        </div>
                                                    </OrderCard>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {mobileTab === 'preparing' && (
                            <div className="flex flex-col bg-white  min-h-full w-full max-w-full overflow-hidden">
                                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-200 shrink-0">
                                    <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-500 flex items-center justify-center"><ChefHat size={13} /></div>
                                    <h2 className="font-extrabold text-sm text-gray-900 tracking-tight">PREPARING BATCHES</h2>
                                    {(preparingOrdersCount + dispatchedOrders.length) > 0 && <span className="ml-auto bg-amber-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">{preparingOrdersCount + dispatchedOrders.length}</span>}
                                </div>
                                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="rounded-xl bg-white border border-gray-200 py-2">
                                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Pending</p>
                                            <p className="text-lg font-black text-gray-900 leading-none">{preparingOrdersCount + dispatchedOrders.length}</p>
                                        </div>
                                        <div className="rounded-xl bg-white border border-gray-200 py-2">
                                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Preparing</p>
                                            <p className="text-lg font-black text-amber-600 leading-none">{preparingOrdersCount}</p>
                                        </div>
                                        <div className="rounded-xl bg-white border border-gray-200 py-2">
                                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">On Trip</p>
                                            <p className="text-lg font-black text-emerald-600 leading-none">{dispatchedOrders.length}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 p-3 space-y-4 pb-8 overflow-y-auto bg-slate-50">
                                    {preparingGroups.length === 0 && dispatchedGroups.length === 0 ? <EmptyState emoji="👨‍🍳" text="Kitchen is clear" sub="No active batches right now" /> : (
                                        <>
                                            {preparingGroups.length > 0 && (
                                                <div className="space-y-3">
                                                    <p className="px-1 text-[11px] font-black tracking-[0.15em] text-gray-500 uppercase">Preparing Priority</p>
                                                    {preparingGroups.map(([hostel, hostelOrders]) => (
                                                        <HostelBatchCard
                                                            key={`mobile-preparing-${hostel}`}
                                                            title="Preparing"
                                                            hostel={hostel}
                                                            orders={hostelOrders}
                                                            tokenMap={tokenMap}
                                                            selectedIds={selectedPreparingIds}
                                                            accent="amber"
                                                            primaryActionLabel="Out for delivery"
                                                            onSelectionChange={(ids) => setSelectedPreparingIds(ids)}
                                                            onPrimaryAction={(ids) => markOrdersOutForDelivery(ids, hostel)}
                                                            onViewDetails={setSelectedOrderDetails}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {dispatchedGroups.length > 0 && (
                                                <div className="space-y-3">
                                                    <p className="px-1 text-[11px] font-black tracking-[0.15em] text-gray-500 uppercase">Out For Delivery</p>
                                                    {dispatchedGroups.map(([hostel, hostelOrders]) => (
                                                        <HostelBatchCard
                                                            key={`mobile-dispatched-${hostel}`}
                                                            title="Out for delivery"
                                                            hostel={hostel}
                                                            orders={hostelOrders}
                                                            tokenMap={tokenMap}
                                                            selectedIds={selectedDispatchIds}
                                                            accent="emerald"
                                                            primaryActionLabel="Delivered"
                                                            onSelectionChange={(ids) => setSelectedDispatchIds(ids)}
                                                            onPrimaryAction={(ids) => markOrdersDelivered(ids, hostel)}
                                                            onViewDetails={setSelectedOrderDetails}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {mobileTab === 'pos' && (
                            <div className="flex flex-col bg-white min-h-full">
                                {/* POS Search */}
                                <div className="px-4 py-3 border-b border-gray-200 shrink-0">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center"><Search size={13} /></div>
                                        <h2 className="font-extrabold text-sm text-gray-900 uppercase">Point of Sale</h2>
                                    </div>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input ref={posSearchRef} type="text" value={posSearch} onChange={e => setPosSearch(e.target.value)} onKeyDown={handlePosSearchKey}
                                            placeholder="Type item, press Enter to add..."
                                            className="w-full pl-9 pr-4 py-3 bg-gray-50 text-gray-900 text-sm font-bold placeholder:font-normal rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400" />
                                    </div>
                                    {posSearch && posFiltered.length > 0 && (
                                        <div className="flex flex-col gap-1 mt-2 max-h-52 overflow-y-auto">
                                            {posFiltered.map((product: Product, idx: number) => (
                                                <button key={product.id} onClick={() => { addToPos(product); setPosSearch(''); setTimeout(() => posSearchRef.current?.focus(), 20); }}
                                                    onMouseEnter={() => setHighlightedSuggestionIndex(idx)}
                                                    className={`flex items-center justify-between px-3 py-3 text-sm font-bold rounded-lg border transition-colors min-h-[44px] ${highlightedSuggestionIndex === idx ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-white border-transparent text-gray-700 hover:bg-gray-50'}`}>
                                                    <div className="flex items-center gap-2"><Plus size={12} className={highlightedSuggestionIndex === idx ? 'text-purple-500' : 'text-gray-400'} /><span>{product.name}</span></div>
                                                    <span className="font-semibold text-gray-400 text-xs">₹{product.price}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {/* Cart Items */}
                                <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50/50 space-y-2">
                                    {posCartItems.length === 0 ? <EmptyState emoji="🛒" text="Cart is empty" sub="Search an item and press Enter" /> : (
                                        posCartItems.map((item, idx) => (
                                            <div key={item.productId} className={`flex items-center justify-between p-3 rounded-xl border shadow-sm ${selectedCartIndex === idx ? 'bg-purple-50/50 border-purple-300 ring-2 ring-purple-500/20' : 'bg-white border-gray-200'}`}>
                                                <div className="flex-1 min-w-0 mr-3">
                                                    <h3 className="text-sm font-bold truncate text-gray-900">{item.name}</h3>
                                                    <p className="text-xs font-semibold text-gray-500">₹{item.price}</p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="flex items-center gap-1 rounded-lg border bg-gray-50 border-gray-200 p-0.5">
                                                        <button onClick={() => { setSelectedCartIndex(idx); removeFromPos(item.productId!); }} className="w-8 h-8 rounded-md flex items-center justify-center bg-white hover:bg-gray-100 text-gray-700 font-black text-lg min-w-[32px] min-h-[32px]">−</button>
                                                        <span className="text-sm font-black w-6 text-center text-gray-900">{item.quantity}</span>
                                                        <button onClick={() => { setSelectedCartIndex(idx); addToPos({ id: item.productId!, name: item.name, price: item.price, imageURL: item.imageURL || '', categoryId: '' }); }} className="w-8 h-8 rounded-md flex items-center justify-center bg-white hover:bg-gray-100 text-gray-700 font-black text-lg min-w-[32px] min-h-[32px]">+</button>
                                                    </div>
                                                    <span className="text-sm font-black w-14 text-right text-gray-900">₹{item.price * item.quantity}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {/* Confirm Footer */}
                                <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Total</span>
                                        <span className="text-3xl font-black text-gray-900">₹{posTotal}</span>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <button onClick={handlePosConfirm} disabled={posCartItems.length === 0 || posSubmitting}
                                            className={`w-full py-4 rounded-xl font-black text-sm transition-all ${posSubmitting ? 'bg-emerald-500 text-white' : (posCartItems.length > 0 ? 'bg-gray-900 text-white active:scale-95' : 'bg-gray-100 text-gray-400')}`}>
                                            {posSubmitting ? 'Processing...' : 'Confirm & Print'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : null}

            {viewMode === 'board' && (
                /* ── DESKTOP 3-COLUMN BOARD (lg+) ─────────────────── */
                <div className="hidden lg:flex flex-1 overflow-hidden min-h-0 gap-3 p-3">

                    {/* ── COL 1: NEW ORDERS ── */}
                    <section className="w-1/3 flex flex-col min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Bell size={16} strokeWidth={2.5} />
                            </div>
                            <h2 className="font-black text-[12px] tracking-widest text-slate-900 uppercase">New Orders</h2>
                            {newOrders.length > 0 && (
                                <span className="ml-auto bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{newOrders.length}</span>
                            )}
                        </div>
                        <div className="flex-1 bg-slate-50/80 overflow-y-auto scrollbar-thin flex flex-col">
                            {newOrders.length === 0 ? (
                                <EmptyState emoji="🔔" text="No new orders" sub="Incoming orders appear here" />
                            ) : (
                                <div className="flex-1 p-4 space-y-4">
                                    {!isPrinterConnected && (
                                        <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-3 py-2 rounded-md flex items-start gap-2 font-bold uppercase tracking-tight">
                                            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
                                            <span>Printer offline. Start server to enable silent printing.</span>
                                        </div>
                                    )}
                                    <AnimatePresence mode="popLayout">
                                        {newOrders.map((order) => {
                                            const tok = tokenMap.get(order.id) || '???';
                                            const urgency = getUrgency(order.orderDate);
                                            const accentColor = urgency === 'red' ? '#EF4444' : urgency === 'amber' ? '#F59E0B' : '#06B6D4';
                                            const accentHover = urgency === 'red' ? '#DC2626' : urgency === 'amber' ? '#D97706' : '#0891B2';

                                            return (
                                                <motion.div 
                                                    key={order.id} 
                                                    layout 
                                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, x: 200 }}
                                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                                >
                                                    <OrderCard order={order} token={tok} onViewDetails={() => setSelectedOrderDetails(order)}>
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={async () => { 
                                                                    try { 
                                                                        await updateOrderStatus(order.id, 'Cancelled'); 
                                                                        toast('Rejected', { icon: '🚫' }); 
                                                                    } catch { 
                                                                        toast.error('Failed'); 
                                                                    } 
                                                                }} 
                                                                className="px-3 py-2 rounded-md text-slate-500 hover:bg-slate-100 font-black text-[10px] border border-slate-200 transition-colors uppercase tracking-widest"
                                                            >
                                                                Reject
                                                            </button>
                                                            <button 
                                                                disabled={isPrinting} 
                                                                onClick={() => handleAcceptAndPrint(order, tok)} 
                                                                className="flex-1 flex items-center justify-center gap-1.5 text-white font-black text-[10px] py-2 rounded-md shadow-none transition-colors uppercase tracking-widest"
                                                                style={{ backgroundColor: accentColor }}
                                                            >
                                                                {isPrinting ? (
                                                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                ) : (
                                                                    <Printer size={14} strokeWidth={3} />
                                                                )}
                                                                {isPrinting ? 'Printing...' : 'Accept & Print'}
                                                            </button>
                                                        </div>
                                                    </OrderCard>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ── COL 2: KITCHEN BOARD ── */}
                    <section className="w-1/3 flex flex-col min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex flex-col flex-1 min-h-0">
                            <div className="flex items-center gap-2.5 px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0">
                                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                                    <ChefHat size={16} strokeWidth={2.5} />
                                </div>
                                <h2 className="font-black text-[12px] tracking-widest text-slate-900 uppercase">Preparing Priority</h2>
                            </div>

                            <div className="p-3 bg-white">
                                <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Total Pending Orders</span>
                                    <span className="text-3xl font-black text-slate-900 leading-none">{preparingOrdersCount + dispatchedOrders.length}</span>
                                </div>
                                <div className="mt-2.5 flex items-center gap-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    <span>{preparingOrdersCount} Preparing</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span>{dispatchedOrders.length} On trip</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span>{products.length} Items</span>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
                                {preparingGroups.length === 0 && dispatchedGroups.length === 0 ? <EmptyState emoji="👨‍🍳" text="Kitchen is clear" sub="No active batches right now" /> : (
                                    <>
                                        {preparingGroups.length > 0 && (
                                            <div className="space-y-3">
                                                {preparingGroups.map(([hostel, hostelOrders]) => (
                                                    <HostelBatchCard
                                                        key={`desktop-preparing-${hostel}`}
                                                        title="Preparing"
                                                        hostel={hostel}
                                                        orders={hostelOrders}
                                                        tokenMap={tokenMap}
                                                        selectedIds={selectedPreparingIds}
                                                        accent="amber"
                                                        primaryActionLabel="Out for delivery"
                                                        onSelectionChange={(ids) => setSelectedPreparingIds(ids)}
                                                        onPrimaryAction={(ids) => markOrdersOutForDelivery(ids, hostel)}
                                                        onViewDetails={setSelectedOrderDetails}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        {dispatchedGroups.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="px-1 text-[10px] font-black tracking-widest text-slate-500 uppercase pb-1">Out For Delivery</div>
                                                {dispatchedGroups.map(([hostel, hostelOrders]) => (
                                                    <HostelBatchCard
                                                        key={`desktop-dispatched-${hostel}`}
                                                        title="Out for delivery"
                                                        hostel={hostel}
                                                        orders={hostelOrders}
                                                        tokenMap={tokenMap}
                                                        selectedIds={selectedDispatchIds}
                                                        accent="emerald"
                                                        primaryActionLabel="Delivered"
                                                        onSelectionChange={(ids) => setSelectedDispatchIds(ids)}
                                                        onPrimaryAction={(ids) => markOrdersDelivered(ids, hostel)}
                                                        onViewDetails={setSelectedOrderDetails}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ── COL 3: DIRECT POS ── */}
                    <section className="w-1/3 flex flex-col min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0">
                            <div className="w-8 h-8 rounded-lg bg-[#eef4ff] text-[#3b82f6] flex items-center justify-center">
                                <Search size={16} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="font-black text-[12px] tracking-widest text-slate-900 uppercase">Point of Sale</h2>
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Fast checkout terminal</p>
                            </div>
                        </div>

                        <div className="p-4 bg-white border-b border-slate-100">
                            <div className="relative">
                                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    ref={posSearchRef}
                                    type="text"
                                    value={posSearch}
                                    onChange={e => setPosSearch(e.target.value)}
                                    onKeyDown={handlePosSearchKey}
                                    placeholder="Scan or search item..."
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 text-slate-900 text-[13px] font-black placeholder:text-slate-400 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-200 transition-all"
                                />
                            </div>
                            {posSearch && posFiltered.length > 0 && (
                                <div className="flex flex-col gap-1 mt-2">
                                    {posFiltered.map((product: Product, idx: number) => (
                                        <button key={product.id} onClick={() => { addToPos(product); setPosSearch(''); setTimeout(() => posSearchRef.current?.focus(), 20); }}
                                            onMouseEnter={() => setHighlightedSuggestionIndex(idx)}
                                            className={`flex items-center justify-between px-3 py-2.5 text-[13px] font-black rounded-xl border transition-colors uppercase tracking-widest ${highlightedSuggestionIndex === idx ? 'bg-slate-100 border-slate-300 text-slate-950' : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'}`}>
                                            <div className="flex items-center gap-3">
                                                <Plus size={14} strokeWidth={3} className="text-slate-500" />
                                                <span>{product.name}</span>
                                            </div>
                                            <span className={highlightedSuggestionIndex === idx ? 'text-slate-950' : 'text-slate-500'}>₹{product.price}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cart Items Area */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50/70 scrollbar-thin">
                            {posCartItems.length === 0 ? (
                                <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center p-8">
                                    <ShoppingCart size={64} className="text-slate-300 mb-6" strokeWidth={1} />
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Cart is empty</h3>
                                    <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-tighter text-center">Search an item and press Enter</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {posCartItems.map((item, idx) => (
                                        <div key={item.productId} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${selectedCartIndex === idx ? 'bg-slate-100 border-slate-300 shadow-sm' : 'bg-white border-slate-200'}`}>
                                            <div className="flex-1 min-w-0 mr-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 bg-slate-900 rounded-[2px] rotate-45 shrink-0" style={{ clipPath: 'polygon(0 0, 0% 100%, 100% 50%)' }} />
                                                    <h3 className="text-[14px] font-black text-slate-900 truncate uppercase tracking-tight">
                                                        {item.name}
                                                    </h3>
                                                </div>
                                                <p className="text-[11px] font-bold text-slate-400 mt-0.5 ml-4.5">₹{item.price}</p>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {/* Quantity Selector Style */}
                                                <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 p-0.5">
                                                    <button onClick={() => { setSelectedCartIndex(idx); removeFromPos(item.productId!); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-slate-900 shadow-sm hover:bg-slate-900 hover:text-white transition-all">
                                                        <span className="font-black text-lg leading-none">−</span>
                                                    </button>
                                                    <span className="w-8 text-center text-[13px] font-black text-slate-900">{item.quantity}</span>
                                                    <button onClick={() => { setSelectedCartIndex(idx); addToPos({ id: item.productId! } as Product); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-slate-900 shadow-sm hover:bg-slate-900 hover:text-white transition-all">
                                                        <span className="font-black text-lg leading-none">+</span>
                                                    </button>
                                                </div>
                                                
                                                <div className="text-right min-w-[50px]">
                                                    <span className="text-[16px] font-black text-slate-950 tracking-tighter">₹{item.price * item.quantity}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Confirm Footer */}
                        <div className="flex-shrink-0 bg-white border-t border-slate-100 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Total Amount</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[16px] font-black text-slate-900">₹</span>
                                    <span className="text-3xl font-black text-slate-900 tracking-tighter">{posTotal}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => {
                                        if (confirmPending) handlePosConfirm();
                                        else if (posCartItems.length > 0) {
                                            setConfirmPending(true);
                                            setConfirmProgress(100);
                                            const duration = 2000;
                                            const interval = 20;
                                            let timeLeft = duration;
                                            if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                                            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                                            progressIntervalRef.current = setInterval(() => {
                                                timeLeft -= interval;
                                                setConfirmProgress((timeLeft / duration) * 100);
                                                if (timeLeft <= 0) {
                                                    clearInterval(progressIntervalRef.current!);
                                                    setConfirmPending(false);
                                                }
                                            }, interval);
                                            confirmTimerRef.current = setTimeout(() => {
                                                setConfirmPending(false);
                                            }, duration);
                                        }
                                    }}
                                    disabled={posCartItems.length === 0 || posSubmitting}
                                    className={`relative w-full overflow-hidden flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl font-black text-[13px] transition-all duration-300 uppercase tracking-widest ${posSubmitting ? 'bg-slate-700 text-white' : (posCartItems.length > 0 ? (confirmPending ? 'bg-slate-950 text-white scale-[0.98]' : 'bg-slate-950 hover:bg-black text-white shadow-[0_18px_32px_rgba(15,23,42,0.18)]') : 'bg-slate-100 text-slate-400 cursor-not-allowed')}`}
                                >
                                    {posSubmitting ? (
                                        <span className="w-5 h-5 border-[3px] border-white/60 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-center gap-2">
                                                {confirmPending ? <RotateCcw size={16} strokeWidth={3} className="animate-spin-slow" /> : <CheckCircle2 size={16} strokeWidth={3} />}
                                                <span className="translate-y-[0.5px]">{confirmPending ? 'Enter again to confirm' : 'Confirm & Print'}</span>
                                            </div>
                                            {!confirmPending && <span className="text-[8px] font-black opacity-60">CTRL + ENTER</span>}
                                        </>
                                    )}

                                    {/* SLIDING TIMER BAR */}
                                    {confirmPending && (
                                        <div className="absolute bottom-0 left-0 h-1.5 bg-white/30 w-full overflow-hidden">
                                            <div 
                                                className="h-full bg-white transition-all duration-75 ease-linear"
                                                style={{ width: `${confirmProgress}%` }}
                                            />
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {viewMode === 'history' && (
                <div className="flex-1 overflow-y-auto bg-slate-100 px-4 sm:px-6 scrollbar-thin relative pb-10">
                    {/* ── KPI CARDS ── */}
                    <div className="flex items-stretch gap-3 sm:gap-4 my-4 shrink-0 overflow-x-auto pb-2">
                        {/* Revenue Card */}
                        <div className="bg-white border text-left border-[#CBD5E1] rounded-md p-4 flex-1 shadow-none min-w-[200px]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Total Revenue</p>
                            <p className="text-[28px] font-black text-slate-900 leading-none tracking-tighter">₹{historySummary.totalSales.toLocaleString()}</p>
                        </div>

                        {/* Orders Card */}
                        <div className="bg-white border text-left border-[#CBD5E1] rounded-md p-4 flex-1 shadow-none min-w-[160px]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Total Orders</p>
                            <p className="text-[28px] font-black text-slate-900 leading-none tracking-tighter">{historySummary.totalOrders}</p>
                        </div>

                        {/* POS Orders Card */}
                        <div className="bg-white border text-left border-[#CBD5E1] rounded-md p-4 flex-1 shadow-none min-w-[160px]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">POS Orders</p>
                            <p className="text-[28px] font-black text-slate-900 leading-none tracking-tighter">{historySummary.posOrders}</p>
                        </div>
                    </div>

                    {/* ── FILTERS ROW ── */}
                    <div className="flex flex-col gap-2 shrink-0 overflow-x-auto sticky top-0 z-20 bg-slate-100 py-2 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-[#CBD5E1]">
                        <div className="flex items-center gap-2 flex-wrap">
                            {['All', 'Online', 'POS'].map((source) => {
                                const isActive = historySource === source;
                                return (
                                    <button
                                        key={source}
                                        onClick={() => setHistorySource(source)}
                                        className={`rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors border ${isActive ? 'bg-[#374151] text-white border-[#1F2937]' : 'bg-white text-slate-600 border-[#CBD5E1] hover:bg-slate-50'}`}
                                    >
                                        {source}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex gap-2">
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="pl-9 pr-4 py-2.5 rounded-md border border-[#9CA3AF] bg-white text-[11px] font-black text-slate-700 outline-none focus:border-[#6D28D9] focus:ring-1 focus:ring-[#6D28D9] cursor-pointer w-40 uppercase tracking-widest" />
                                </div>
                                <div className="relative">
                                    <Activity size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select value={historyStatus} onChange={e => setHistoryStatus(e.target.value)} className="pl-9 pr-8 py-2.5 rounded-md border border-[#9CA3AF] bg-white text-[11px] font-black text-slate-700 appearance-none outline-none focus:border-[#6D28D9] focus:ring-1 focus:ring-[#6D28D9] cursor-pointer w-44 uppercase tracking-widest">
                                        <option value="All">All Statuses</option>
                                        <option value="Placed">Placed</option>
                                        <option value="Preparing">Preparing</option>
                                        <option value="Dispatched">Dispatched</option>
                                        <option value="Delivered">Delivered</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative w-64">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="text" value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="SEARCH ID OR NAME..." className="w-full pl-9 pr-4 py-2.5 rounded-md bg-white border border-[#9CA3AF] text-[11px] font-black placeholder:text-slate-400 focus:outline-none focus:border-[#6D28D9] focus:ring-1 focus:ring-[#6D28D9] text-slate-900 uppercase tracking-widest" />
                                </div>
                                <button className="flex items-center gap-1.5 bg-[#374151] hover:bg-[#1F2937] text-white px-3 py-2.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all border border-[#1F2937]">
                                    <Download size={12} strokeWidth={3} /> Export
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── TABLE ── */}
                    <div className="bg-white flex flex-col relative border border-[#CBD5E1] rounded-md overflow-hidden mt-2">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-[#334155] text-white">
                                        <th className="px-5 py-2 text-[10px] font-black uppercase tracking-widest">ID & Time</th>
                                        <th className="px-5 py-2 text-[10px] font-black uppercase tracking-widest">Customer</th>
                                        <th className="px-5 py-2 text-[10px] font-black uppercase tracking-widest">Order Content</th>
                                        <th className="px-5 py-2 text-[10px] font-black uppercase tracking-widest">Status</th>
                                        <th className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-right pr-6">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedOrders.length === 0 ? (
                                        <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-black uppercase tracking-widest">No orders found.</td></tr>
                                    ) : (
                                        paginatedOrders.map((order: Order) => {
                                            const isPOS = order.orderType === 'pos';
                                            let statusCls = "bg-slate-100 text-slate-700 border border-slate-200";
                                            if (order.status === 'Delivered') statusCls = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                                            if (order.status === 'Dispatched') statusCls = "bg-purple-50 text-purple-700 border border-purple-200";
                                            if (order.status === 'Preparing') statusCls = "bg-blue-50 text-blue-700 border border-blue-200";
                                            if (order.status === 'Cancelled') statusCls = "bg-red-50 text-red-700 border border-red-200";
                                            
                                            const mainItems = order.items.slice(0, 2);
                                            const remainingItemsCount = order.items.length - 2;
                                            const custName = order.deliveryAddress?.name || 'GUEST USER';
                                            const initial = custName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

                                            return (
                                                <tr key={order.id} className="hover:bg-cyan-50 transition-colors cursor-pointer group" onClick={() => setSelectedOrderDetails(order)}>
                                                    <td className="px-5 py-1.5">
                                                        <div className="font-black text-slate-900 text-[11px] tracking-tight whitespace-nowrap uppercase leading-none">ORD-{order.id.slice(0, 5)}</div>
                                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{new Date(order.orderDate).toLocaleDateString()} · {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </td>
                                                    <td className="px-5 py-1.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-6 h-6 rounded-md bg-slate-900 text-white text-[8px] font-black flex items-center justify-center shrink-0">{initial}</div>
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-slate-900 text-[11px] uppercase leading-none">{custName}</span>
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{isPOS ? 'POS SALE' : 'ONLINE ORDER'}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-1.5 max-w-[250px]">
                                                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tight leading-tight truncate">
                                                            {mainItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                                        </div>
                                                        {remainingItemsCount > 0 && (
                                                            <div className="text-[8px] font-black text-[#06B6D4] mt-0.5 uppercase tracking-widest">+{remainingItemsCount} MORE</div>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-1.5">
                                                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${statusCls}`}>
                                                            {getOrderStatusLabel(order.status).toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-1.5 text-right pr-6">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <span className="font-black text-slate-900 text-[13px] tracking-tighter">₹{order.grandTotal.toFixed(2)}</span>
                                                            <MoreVertical size={12} className="text-slate-300 group-hover:text-slate-900 transition-colors" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Pagination Footer */}
                        <div className="px-4 border-t border-[#CBD5E1] bg-slate-50 flex items-center justify-between shrink-0 h-12">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">
                                PAGE <span className="text-slate-900">{historyPage}</span> OF <span className="text-slate-900">{historyTotalPages}</span> — <span className="text-slate-900">{filteredHistoryOrders.length}</span> TICKETS
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="w-8 h-8 flex items-center justify-center rounded-md font-black text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors">
                                    <ChevronLeft size={16} strokeWidth={3} />
                                </button>
                                <button onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage === historyTotalPages} className="w-8 h-8 flex items-center justify-center rounded-md font-black text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors">
                                    <ChevronRight size={16} strokeWidth={3} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <OrderDetailsDrawer isOpen={!!selectedOrderDetails} onClose={() => setSelectedOrderDetails(null)} order={selectedOrderDetails} />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function HostelBatchCard({
    title,
    hostel,
    orders,
    tokenMap,
    selectedIds,
    accent,
    primaryActionLabel,
    onSelectionChange,
    onPrimaryAction,
    onViewDetails,
}: {
    title: string;
    hostel: string;
    orders: Order[];
    tokenMap: Map<string, string>;
    selectedIds: string[];
    accent: 'amber' | 'emerald';
    primaryActionLabel: string;
    onSelectionChange: (orderIds: string[]) => void;
    onPrimaryAction: (orderIds: string[]) => void;
    onViewDetails: (order: Order) => void;
}) {
    const orderIds = orders.map((order) => order.id);
    const selectedInBatch = orderIds.filter((id) => selectedIds.includes(id));
    const allSelected = selectedInBatch.length === orderIds.length && orderIds.length > 0;
    const batchAge = Math.max(...orders.map((order) => getOrderAgeMinutes(order)));
    const batchState = orders.some((order) => getOrderSlaState(order) === 'overdue')
        ? 'overdue'
        : orders.some((order) => getOrderSlaState(order) === 'warning')
            ? 'warning'
            : 'normal';
    const chipClass = getBatchChipClass(batchState);
    const accentClass = accent === 'amber'
        ? 'border-amber-200 bg-amber-50/40'
        : 'border-emerald-200 bg-emerald-50/40';
    const actionClass = accent === 'amber'
        ? 'bg-slate-900 hover:bg-slate-800'
        : 'bg-emerald-600 hover:bg-emerald-700';
    const actionText = accent === 'amber' ? 'Preparing' : 'Out for delivery';

    return (
        <div className={`rounded-md border shadow-none overflow-hidden ${accentClass} border-[#CBD5E1]`}>
            <div className="px-3 py-2 bg-white border-b border-[#CBD5E1]">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-black border uppercase tracking-wider ${accent === 'amber' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                        {hostel} Hostel
                    </span>
                    <span className="inline-flex items-center justify-center h-5 rounded-md bg-slate-900 text-white text-[10px] font-black px-2 uppercase tracking-tighter">
                        {orders.length} ITEMS
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight"> {getBatchRoomSummary(orders)}</span>
                    <span className={`ml-auto inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${chipClass}`}>
                        {batchAge}M
                    </span>
                </div>
            </div>

            <div className="divide-y divide-[#CBD5E1] bg-white">
                {orders.map((order) => {
                    const token = tokenMap.get(order.id) || '???';
                    const isSelected = selectedIds.includes(order.id);
                    const rowState = getOrderSlaState(order);
                    const dotClass = rowState === 'overdue' ? 'bg-red-500' : rowState === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
                    const itemText = order.items.map((item) => `${item.name} x${item.quantity}`).join(', ');
                    return (
                        <div
                            key={order.id}
                            onClick={() => onSelectionChange(isSelected ? selectedIds.filter((id) => id !== order.id) : [...selectedIds, order.id])}
                            className={`w-full px-3 py-2 transition-colors ${isSelected ? 'bg-cyan-50' : 'hover:bg-slate-50'} cursor-pointer`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`flex-shrink-0 w-2 h-2 rounded-md ${dotClass}`} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className={`text-[12px] font-black uppercase tracking-wide ${isSelected ? 'text-[#06B6D4]' : 'text-slate-900'}`}>
                                                #{token} <span className="font-bold text-slate-600">{order.deliveryAddress?.name || 'Guest'}</span>
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5 uppercase tracking-tight">{itemText}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">RM {order.deliveryAddress?.roomNumber || 'N/A'}</p>
                                            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest mt-0.5 ${accent === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {order.status === 'Preparing' ? 'PREP' : order.status === 'Dispatched' ? 'TRIP' : 'READY'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="px-3 py-2 bg-white border-t border-[#CBD5E1] flex items-center gap-2">
                <button
                    onClick={() => onSelectionChange(allSelected ? [] : orderIds)}
                    className="flex-1 rounded-md border border-[#CBD5E1] px-2 py-1.5 text-[10px] font-black text-slate-600 hover:bg-slate-50 uppercase tracking-widest transition-colors"
                >
                    {allSelected ? 'CLEAR ALL' : 'MARK ALL READY'}
                </button>
                <button
                    onClick={() => onPrimaryAction(selectedInBatch.length > 0 ? selectedInBatch : orderIds)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-black text-white uppercase tracking-widest transition-all ${actionClass.replace('rounded-lg', 'rounded-md')}`}
                >
                    {primaryActionLabel.toUpperCase()}
                </button>
            </div>
        </div>
    );
}

function EmptyState({ emoji, text, sub }: { emoji: string; text: string; sub?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <span className="text-5xl mb-3">{emoji}</span>
            <span className="text-sm font-bold text-gray-600 tracking-tight">{text}</span>
            {sub && <span className="text-xs text-gray-400 mt-1 font-medium">{sub}</span>}
        </div>
    );
}

function OrderCard({ order, token, onViewDetails, children }: { order: Order; token: string; onViewDetails?: () => void; children?: React.ReactNode }) {
    const urgency = getUrgency(order.orderDate);
    const mins = minutesElapsed(order.orderDate);
    const isPaid = order.status !== 'Pending';
    const isPOS = order.orderType === 'pos';
    const displayToken = isPOS ? `POS-#${token}` : `#${token}`;

    const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const platformFee = order.grandTotal - subtotal > 0 ? order.grandTotal - subtotal : 0;

    const urgencyBg = urgencyBgClass(urgency);
    const urgencyBorder = urgencyBorderClass(urgency);

    return (
        <div className={`flex flex-col rounded-md border border-[#CBD5E1] shadow-none hover:border-[#6D28D9] ${urgencyBorder} ${urgencyBg} transition-all relative group`}>
            {isPOS && <div className="absolute top-2 right-2 bg-[#6D28D9] text-white px-1.5 py-0.5 rounded-md text-[8px] font-black tracking-widest z-10 uppercase">POS</div>}
            
            {/* Header: Token + Amount */}
            <div className="px-3 py-1.5 flex items-center justify-between shrink-0 border-b border-[#CBD5E1] bg-slate-50">
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{displayToken}</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${urgency === 'red' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600'} uppercase tracking-tighter`}>{mins}M</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md border ${isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'} uppercase tracking-widest`}>{isPaid ? 'PAID' : 'COD'}</span>
                </div>
                <div className="flex items-center gap-2 text-right">
                    <span className="text-base font-black text-slate-900 tracking-tighter">₹{order.grandTotal}</span>
                </div>
            </div>

            {/* Items List */}
            <div className="px-3 py-1.5 flex-1 overflow-y-auto scrollbar-thin max-h-40">
                <div className="space-y-1">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-start justify-between text-[11px] group/item">
                            <div className="flex items-start gap-2 min-w-0">
                                <span className="text-[10px] font-black text-slate-900 min-w-[16px]">{item.quantity}x</span>
                                <span className="font-black text-slate-800 truncate uppercase tracking-tight text-[12px]">{item.name}</span>
                            </div>
                            <span className="font-black text-slate-400 text-[10px] shrink-0 ml-2">₹{item.price * item.quantity}</span>
                        </div>
                    ))}
                </div>

                {/* Bill Breakdown (Collapsed by default, subtle) */}
                <div className="mt-2.5 pt-1.5 border-t border-dashed border-[#CBD5E1] space-y-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="flex justify-between">
                        <span>Items</span>
                        <span>₹{subtotal}</span>
                    </div>
                    {platformFee > 0 && (
                        <div className="flex justify-between">
                            <span>Fee</span>
                            <span>₹{platformFee}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-black text-slate-900 text-[10px] pt-1 mt-0.5 border-t border-slate-100">
                        <span>Total</span>
                        <span>₹{order.grandTotal}</span>
                    </div>
                </div>
            </div>

            {/* Customer + Delivery Info (Condensed) */}
            <div className="px-3 py-1.5 bg-slate-50 border-t border-[#CBD5E1] shrink-0">
                <div className="grid grid-cols-1 gap-0.5 text-[9px] font-bold uppercase tracking-tight">
                    <div className="flex items-center justify-between gap-3 text-slate-400">
                        <span>Time</span>
                        <span className="text-slate-700">
                            {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-slate-400">
                        <span>User</span>
                        <span className="text-slate-900 truncate max-w-[120px]">{order.deliveryAddress?.name || 'GUEST'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-slate-400">
                        <span>Loc</span>
                        <span className="text-slate-700 truncate">
                            {order.deliveryAddress?.hostelNumber ? `H${order.deliveryAddress.hostelNumber}` : 'PICK'}
                            {order.deliveryAddress?.roomNumber ? ` R${order.deliveryAddress.roomNumber}` : ''}
                        </span>
                    </div>
                </div>
                {onViewDetails && (
                    <button onClick={(e) => { e.stopPropagation(); onViewDetails(); }} className="mt-2 w-full py-1 text-[9px] font-black text-[#6D28D9] hover:bg-indigo-50 border border-[#6D28D9] rounded-md transition-colors uppercase tracking-[0.2em]">
                        View Full Details
                    </button>
                )}
            </div>

            {children && <div className="p-2 bg-white border-t border-[#CBD5E1] shrink-0">{children}</div>}
        </div>
    );
}
