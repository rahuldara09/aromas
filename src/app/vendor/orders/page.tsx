'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useVendor } from '@/contexts/VendorContext';
import { updateOrderStatus, batchDispatchOrders, createPOSOrder } from '@/lib/vendor';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { Order, Product, OrderItem } from '@/types';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Printer, Search, Truck, Package, ChefHat, Bell, Phone, MapPin,
    X, List, Layers, BarChart2, ClipboardList, AlertCircle, Plus, Eye, Banknote, Smartphone, Clock, CheckCircle2, ChevronUp, ChevronDown, Calendar, CreditCard, RotateCcw
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
function printKOT(order: Order, token: string) {
    const printWindow = window.open('', '_blank', 'width=300,height=500');
    if (!printWindow) return;
    const itemsHtml = order.items.map(it => `<tr><td style="padding:4px 0;font-size:20px;font-weight:800">${it.quantity}×</td><td style="padding:4px 8px;font-size:16px">${it.name}</td></tr>`).join('');
    printWindow.document.write(`<html><head><title>KOT #${token}</title><style>*{margin:0;padding:0}body{font-family:'Courier New',monospace;padding:12px;width:280px}h1{text-align:center;font-size:56px;font-weight:900;letter-spacing:-2px}h2{text-align:center;font-size:13px;font-weight:400;border-bottom:2px dashed #000;padding-bottom:8px;margin:4px 0 10px}table{width:100%}p{font-size:12px;margin:10px 0 0;border-top:1px dashed #000;padding-top:6px}</style></head><body><h1>#${token}</h1><h2>${new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${order.deliveryAddress?.deliveryType || 'Delivery'}</h2><table>${itemsHtml}</table><p>${order.deliveryAddress?.name || 'Guest'} · ${order.deliveryAddress?.hostelNumber || ''} Rm ${order.deliveryAddress?.roomNumber || ''}</p></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function VendorKanban() {
    const { orders, products, playDispatchSound } = useVendor();
    const [preparingSearchToken, setPreparingSearchToken] = useState('');
    const [dispatchSearchToken, setDispatchSearchToken] = useState('');
    const [kitchenYellMode, setKitchenYellMode] = useState(false);
    const { isConnected: isPrinterConnected, printKOT: qzPrintKOT } = useThermalPrinter();

    // ── MOBILE TAB STATE & FEEDBACK ────────────────────────────────
    const [mobileTab, setMobileTab] = useState<'new' | 'preparing' | 'dispatch' | 'pos'>('new');
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
    const [isDispatchExpanded, setIsDispatchExpanded] = useState(true);
    const [inlineFeedback, setInlineFeedback] = useState<{ id: string, token: string } | null>(null);

    // ─── DERIVED DATA ──────────────────────────────────────────────────
    const tokenMap = useMemo(() => buildDailyTokens(orders), [orders]);
    const newOrders = useMemo(() => orders.filter(o => o.status === 'Placed' || o.status === 'Pending').sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()), [orders]);
    const preparingOrders = useMemo(() => orders.filter(o => o.status === 'Preparing').sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()), [orders]);
    const dispatchOrders = useMemo(() => orders.filter(o => o.status === 'Completed'), [orders]);
    const hostelBatches = useMemo(() => groupByHostel(dispatchOrders), [dispatchOrders]);
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
            if (isPrinterConnected) { await qzPrintKOT(order, token); } else { printKOT(order, token); }
            await updateOrderStatus(order.id, 'Preparing');
            toast.success(`#${token} accepted`, { style: { borderRadius: '14px', fontWeight: 600 } });
        } catch (err) { console.error(err); toast.error('Failed to print/accept order'); }
    }, [isPrinterConnected, qzPrintKOT]);

    const dispatchWithUndo = useCallback((orderId: string, token: string) => {
        const run = async () => {
            try {
                await updateOrderStatus(orderId, 'Completed');
                setInlineFeedback({ id: orderId, token });
                
                // Auto dismiss after 3 seconds
                setTimeout(() => {
                    setInlineFeedback(prev => prev?.id === orderId ? null : prev);
                }, 3000);
            } catch { toast.error('Failed to move order'); }
        };
        run();
    }, [playDispatchSound]);

    const handleUndoDispatch = useCallback(async (orderId: string) => {
        try {
            setInlineFeedback(null); // Instantly dismiss feedback
            await updateOrderStatus(orderId, 'Preparing');
        } catch { toast.error('Failed to undo dispatch'); }
    }, []);

    const handlePreparingSearchDispatch = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const q = preparingSearchToken.trim().padStart(3, '0');
        if (!q.trim()) return;
        const match = preparingOrders.find(o => tokenMap.get(o.id) === q);
        if (match) { dispatchWithUndo(match.id, q); setPreparingSearchToken(''); }
        else toast.error(`Token #${q} not found in Preparing`);
    }, [preparingSearchToken, preparingOrders, tokenMap, dispatchWithUndo]);

    const handleDispatchSearchDeliver = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const q = dispatchSearchToken.trim().padStart(3, '0');
        if (!q.trim()) return;
        const match = dispatchOrders.find(o => tokenMap.get(o.id) === q);
        if (match) {
            const run = async () => {
                try {
                    await batchDispatchOrders([match.id]);
                    playDispatchSound();
                    toast.success(`Token #${q} delivered`);
                } catch { toast.error('Deliver failed'); }
            };
            run();
            setDispatchSearchToken('');
        }
        else toast.error(`Token #${q} not found in Dispatch`);
    }, [dispatchSearchToken, dispatchOrders, tokenMap, playDispatchSound]);

    const handleBatchDispatch = useCallback((orderIds: string[], hostel: string) => {
        const run = async () => {
            try {
                await batchDispatchOrders(orderIds);
                playDispatchSound();
                toast.success(`${hostel} batch dispatched (${orderIds.length} orders)`);
            } catch { toast.error('Batch dispatch failed'); }
        };
        run();
    }, [playDispatchSound]);

    // ─── POS STATE ─────────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<'board' | 'history'>('board');
    const [posSearch, setPosSearch] = useState('');
    const [posCart, setPosCart] = useState<Record<string, number>>({});
    const [posPayment, setPosPayment] = useState<'Cash' | 'UPI'>('Cash');
    const [posSubmitting, setPosSubmitting] = useState(false);
    const [confirmPending, setConfirmPending] = useState(false);
    const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);
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
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        try {
            await createPOSOrder(posCartItems, posTotal, posTotal, posPayment);
            // Silently create the order without a toast announcement
            setPosCart({});
            setPosSearch('');
            setSelectedCartIndex(null);
            setTimeout(() => posSearchRef.current?.focus(), 30);
        } catch { toast.error('Failed to create POS order'); }
        finally { setPosSubmitting(false); }
    }, [posCartItems, posTotal, posPayment]);

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
                    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                    confirmTimerRef.current = setTimeout(() => {
                        setConfirmPending(false);
                    }, 900);
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
                handlePosConfirm();
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
        return { totalOrders: valid.length, totalSales: valid.reduce((s, o) => s + o.grandTotal, 0) };
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
        <div className="h-full flex flex-col bg-gray-50  overflow-hidden select-none transition-colors">
            {/* VIEW MODE TOGGLE */}
            <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 bg-white  border-b border-gray-200  shadow-sm z-20 flex-shrink-0 overflow-x-auto">
                <div className="flex bg-gray-100  p-1 rounded-xl flex-shrink-0">
                    <button onClick={() => setViewMode('board')} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'board' ? 'bg-white  text-gray-900  shadow-sm' : 'text-gray-500  hover:text-gray-700'}`}>
                        <BarChart2 size={16} /> Live Board
                    </button>
                    <button onClick={() => setViewMode('history')} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'history' ? 'bg-white  text-gray-900  shadow-sm' : 'text-gray-500  hover:text-gray-700'}`}>
                        <ClipboardList size={16} /> History
                    </button>
                </div>
                {viewMode === 'history' && (
                    <div className="flex flex-1 items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search by ID or Name..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 text-gray-900" />
                        </div>
                        <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="w-36 lg:w-44 px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100" />
                        <select value={historySource} onChange={e => setHistorySource(e.target.value)} className="w-28 lg:w-36 px-3 lg:px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 text-gray-700 cursor-pointer appearance-none">
                            <option value="All">All Sources</option>
                            <option value="POS">POS Only</option>
                            <option value="Online">Online Only</option>
                        </select>
                        <select value={historyStatus} onChange={e => setHistoryStatus(e.target.value)} className="w-32 lg:w-44 px-3 lg:px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 text-gray-700 cursor-pointer appearance-none">
                            <option value="All">All Statuses</option>
                            <option value="Placed">Placed</option>
                            <option value="Preparing">Preparing</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                )}
                
                {/* INLINE DISPATCH FEEDBACK */}
                <div className="ml-auto overflow-hidden">
                    <AnimatePresence>
                        {inlineFeedback && (
                            <motion.div
                                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg whitespace-nowrap border border-gray-100"
                            >
                                <span className="text-xs font-semibold text-gray-500">
                                    <span className="font-extrabold text-gray-700 mr-1.5">#{inlineFeedback.token}</span>
                                    Moved to pickup
                                </span>
                                <button
                                    onClick={() => handleUndoDispatch(inlineFeedback.id)}
                                    className="text-xs font-bold text-gray-400 hover:text-gray-900 underline decoration-gray-300 hover:decoration-gray-900 transition-colors ml-2"
                                >
                                    undo
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {viewMode === 'board' ? (
                <>
                    {/* ── MOBILE TAB BAR ─────────────────────────────────── */}
                    <div className="lg:hidden flex border-b border-gray-200 bg-white  overflow-x-auto flex-shrink-0">
                        {[
                            { key: 'new', label: 'New', count: newOrders.length, color: 'text-blue-600 border-blue-500' },
                            { key: 'preparing', label: 'Preparing', count: preparingOrders.length, color: 'text-amber-600 border-amber-500' },
                            { key: 'dispatch', label: 'Dispatch', count: dispatchOrders.length, color: 'text-emerald-600 border-emerald-500' },
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
                                    <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center"><Bell size={13} /></div>
                                    <h2 className="font-extrabold text-sm text-gray-900 tracking-tight">NEW ORDERS</h2>
                                    {newOrders.length > 0 && <span className="ml-auto bg-red-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">{newOrders.length}</span>}
                                </div>
                                <div className="flex-1 bg-gray-50/50 overflow-y-auto p-4 space-y-3 pb-8">
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
                                                            <button onClick={() => handleAcceptAndPrint(order, tok)} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black text-white font-bold text-sm py-3 rounded-xl shadow-sm transition-colors min-h-[44px]"><Printer size={16} />Accept & Print</button>
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
                                    <h2 className="font-extrabold text-sm text-gray-900 tracking-tight">PREPARING</h2>
                                    {preparingOrdersCount > 0 && <span className="ml-auto bg-amber-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">{preparingOrdersCount}</span>}
                                </div>
                                <form onSubmit={handlePreparingSearchDispatch} className="px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
                                    <div className="relative">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input type="text" value={preparingSearchToken} onChange={e => setPreparingSearchToken(e.target.value)} placeholder="Token # → Enter to dispatch" className="w-full pl-9 pr-8 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm font-bold placeholder:font-normal focus:outline-none focus:border-amber-400" />
                                    </div>
                                </form>
                                <div className="flex-1 p-3 space-y-3 pb-8 overflow-y-auto">
                                    {preparingOrders.length === 0 ? <EmptyState emoji="👨‍🍳" text="Kitchen is clear" sub="No items being prepared" /> : (
                                        preparingOrders.map(order => {
                                            const tok = tokenMap.get(order.id) || '???';
                                            const mins = minutesElapsed(order.orderDate);
                                            return (
                                                <button key={order.id} onClick={() => dispatchWithUndo(order.id, tok)} className={`w-full flex items-center justify-between p-3 sm:p-4 bg-white rounded-xl border border-gray-200 border-l-4 ${mins >= 20 ? 'border-l-red-500' : mins >= 10 ? 'border-l-amber-400' : 'border-l-gray-300'} shadow-sm text-left min-h-[64px]`}>
                                                    <div className="flex items-center gap-3 min-w-0 pr-2">
                                                        <span className={`text-xl sm:text-2xl font-black tracking-tighter shrink-0 ${mins >= 20 ? 'text-red-700' : 'text-gray-900'}`}>#{tok}</span>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-gray-500">{order.items.reduce((s, i) => s + i.quantity, 0)} Items</p>
                                                            <p className="text-[11px] sm:text-xs text-gray-400 font-medium truncate w-full">{order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 shrink-0">
                                                        <span className={`text-xs sm:text-sm font-bold ${mins >= 20 ? 'text-red-500' : 'text-gray-400'}`}>{mins}m</span>
                                                        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap">
                                                            <Truck size={12} className="sm:w-3.5 sm:h-3.5" /> Dispatch
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {mobileTab === 'dispatch' && (
                            <div className="flex flex-col bg-white  min-h-full">
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
                                    <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-500 flex items-center justify-center"><Truck size={13} /></div>
                                    <h2 className="font-extrabold text-sm text-gray-900 tracking-tight">DISPATCH</h2>
                                    {dispatchOrders.length > 0 && <span className="ml-auto bg-emerald-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">{dispatchOrders.length}</span>}
                                </div>
                                <form onSubmit={handleDispatchSearchDeliver} className="px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
                                    <div className="relative">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input type="text" value={dispatchSearchToken} onChange={e => setDispatchSearchToken(e.target.value)} placeholder="Token # → Enter to deliver" className="w-full pl-9 pr-8 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm font-bold placeholder:font-normal focus:outline-none focus:border-emerald-400" />
                                    </div>
                                </form>
                                <div className="flex-1 p-4 space-y-3 pb-8 overflow-y-auto">
                                    {dispatchOrders.length === 0 ? <EmptyState emoji="📦" text="No ready orders" sub="Dispatched orders appear here" /> : (
                                        dispatchOrders.map(order => (
                                            <div key={order.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                                                <div>
                                                    <span className="text-3xl font-black text-gray-900 tracking-tighter">#{tokenMap.get(order.id)}</span>
                                                    <p className="text-xs font-bold text-gray-400 mt-1">₹{order.grandTotal}</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button onClick={() => handleUndoDispatch(order.id)} className="flex flex-col items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 border border-gray-200 font-extrabold px-4 py-3 rounded-xl transition-all min-h-[56px]" title="Undo Dispatch">
                                                        <RotateCcw size={16} />
                                                        <span className="text-[9px] uppercase tracking-wide leading-none mt-0.5">Undo</span>
                                                    </button>
                                                    <button onClick={() => handleBatchDispatch([order.id], order.deliveryAddress?.hostelNumber || 'Pickup')} className="flex flex-col items-center gap-1 bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-200 font-extrabold px-6 py-3 rounded-xl transition-all min-h-[56px]">
                                                        <Package size={18} />
                                                        <span className="text-[10px] uppercase tracking-wide leading-none mt-0.5">Deliver</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
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
                                {/* Payment Footer */}
                                <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Total</span>
                                        <span className="text-3xl font-black text-gray-900">₹{posTotal}</span>
                                    </div>
                                    <div className="flex bg-gray-100 p-1 rounded-xl mb-3">
                                        {(['Cash', 'UPI'] as const).map(m => (
                                            <button key={m} onClick={() => setPosPayment(m)} className={`flex-1 py-2.5 text-sm font-extrabold rounded-lg transition-all min-h-[44px] ${posPayment === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{m}</button>
                                        ))}
                                    </div>
                                    <button onClick={handlePosConfirm} disabled={posCartItems.length === 0 || posSubmitting}
                                        className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-extrabold text-base transition-all min-h-[56px] ${posCartItems.length > 0 && !posSubmitting ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                                        {posSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✓ Confirm & Print'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── DESKTOP 3-COLUMN BOARD (lg+) ─────────────────── */}
                    <div className="hidden lg:flex flex-1 overflow-hidden min-h-0">

                        {/* ── COL 1: NEW ORDERS ── */}
                        <section className="w-1/3 flex flex-col border-r border-gray-200  min-w-0 bg-white ">
                            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-200  flex-shrink-0 shadow-sm">
                                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center"><Bell size={13} /></div>
                                <h2 className="font-extrabold text-sm text-gray-900  tracking-tight">NEW ORDERS</h2>
                                {newOrders.length > 0 && <span className="ml-auto bg-red-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">{newOrders.length}</span>}
                            </div>
                            <div className="flex-1 bg-gray-50/50  overflow-y-auto scrollbar-thin flex flex-col">
                                {newOrders.length === 0 ? (
                                    <EmptyState emoji="🔔" text="No new orders" sub="Incoming orders appear here" />
                                ) : (
                                    <div className="flex flex-col min-h-full">
                                        {/* Stacked deck */}
                                        <div className="relative p-4 flex flex-col z-10 shrink-0 h-[28rem]">
                                            {!isPrinterConnected && (
                                                <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg flex items-start gap-2 font-semibold">
                                                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
                                                    <span>Awaiting QZ Tray... click <strong>&quot;Trust Always&quot;</strong> when prompted.</span>
                                                </div>
                                            )}
                                            <div className="relative w-full flex-1">
                                                <AnimatePresence mode="popLayout">
                                                    {newOrders.slice(0, 3).reverse().map((order, i, arr) => {
                                                        const tok = tokenMap.get(order.id) || '???';
                                                        const isFront = i === arr.length - 1;
                                                        const offsetIndex = arr.length - 1 - i;
                                                        return (
                                                            <motion.div key={order.id} layout initial={{ opacity: 0, scale: 0.8, y: 50 }}
                                                                animate={{ opacity: Math.max(0, 1 - offsetIndex * 0.2), scale: Math.max(0.8, 1 - offsetIndex * 0.05), y: offsetIndex * 16, zIndex: 30 - offsetIndex }}
                                                                exit={{ opacity: 0, x: 200, scale: 0.9 }}
                                                                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                                                                className="absolute inset-x-0 top-0 w-full" style={{ transformOrigin: 'top center' }}>
                                                                <OrderCard order={order} token={tok} onViewDetails={() => setSelectedOrderDetails(order)}>
                                                                    {isFront && (
                                                                        <div className="flex gap-2">
                                                                            <button onClick={async () => { try { await updateOrderStatus(order.id, 'Cancelled'); toast('Rejected', { icon: '🚫' }); } catch { toast.error('Failed'); } }} className="px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100 font-bold text-xs ring-1 ring-inset ring-gray-300 transition-colors">Reject</button>
                                                                            <button onClick={() => handleAcceptAndPrint(order, tok)} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black text-white font-bold text-xs py-2 rounded-lg shadow-sm transition-colors"><Printer size={14} />Accept & Print</button>
                                                                        </div>
                                                                    )}
                                                                </OrderCard>
                                                            </motion.div>
                                                        );
                                                    })}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                        {/* Queue */}
                                        {newOrders.length > 1 && (
                                            <div className="border-t border-gray-200 bg-white mt-2 shrink-0">
                                                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Queue ({newOrders.length - 1})</span>
                                                </div>
                                                <div className="flex flex-col p-3 space-y-1.5">
                                                    {newOrders.slice(1).map(order => (
                                                        <div key={order.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white text-sm shadow-sm">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-gray-900 text-base">#{tokenMap.get(order.id)}</span>
                                                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[10px] font-bold">{minutesElapsed(order.orderDate)}m</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-gray-500">{order.items.length} items</span>
                                                                <span className="font-bold text-gray-900 text-sm bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">₹{order.grandTotal}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* ── COL 2: PREPARING (top) + DISPATCH (bottom) ── */}
                        <section className="w-1/3 flex flex-col border-r border-gray-200  min-w-0 bg-white ">
                            {/* PREPARING */}
                            <div className="flex flex-col flex-1 min-h-0 bg-gray-50/50">
                                <div className="flex flex-col flex-shrink-0 bg-white border-b border-gray-200">
                                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
                                        <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-500 flex items-center justify-center"><ChefHat size={13} /></div>
                                        <h2 className="font-extrabold text-sm text-gray-900  tracking-tight">PREPARING</h2>
                                        {preparingOrdersCount > 0 && <span className="ml-auto bg-amber-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">{preparingOrdersCount}</span>}
                                    </div>
                                    <form onSubmit={handlePreparingSearchDispatch} className="px-3 py-2 bg-white">
                                        <div className="relative">
                                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input type="text" value={preparingSearchToken} onChange={e => setPreparingSearchToken(e.target.value)} placeholder="Token # → Enter to dispatch" className="w-full pl-9 pr-8 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100" />
                                            {preparingSearchToken && <button type="button" onClick={() => setPreparingSearchToken('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
                                        </div>
                                    </form>
                                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-500">
                                        <span>{preparingOrdersCount} Orders | {preparingItemsCount} Items</span>
                                        {longestPreparingMins > 0 && <span className={longestPreparingMins > 20 ? 'text-red-500 font-bold' : ''}>Longest: {longestPreparingMins}m</span>}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                                    {preparingOrders.length === 0 ? <EmptyState emoji="👨‍🍳" text="Kitchen is clear" sub="No items being prepared" /> : (
                                        <div className="flex flex-col gap-2">
                                            {preparingOrders.map(order => {
                                                const tok = tokenMap.get(order.id) || '???';
                                                const mins = minutesElapsed(order.orderDate);
                                                let borderCls = 'border-l-gray-300';
                                                let textCls = 'text-gray-900';
                                                if (mins >= 20) { borderCls = 'border-l-red-500'; textCls = 'text-red-700'; }
                                                else if (mins >= 10) { borderCls = 'border-l-amber-400'; textCls = 'text-amber-700'; }
                                                return (
                                                    <button key={order.id} onClick={() => dispatchWithUndo(order.id, tok)} className={`group flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 border-l-4 ${borderCls} shadow-sm hover:shadow transition-all relative overflow-hidden text-left`} title={`${mins}m | Tap to Dispatch`}>
                                                        <div className="flex items-center gap-4">
                                                            <span className={`text-2xl font-black tracking-tighter w-14 ${textCls}`}>#{tok}</span>
                                                            <div className="flex flex-col justify-center">
                                                                <span className="text-xs font-bold text-gray-500">
                                                                    {order.items.reduce((sum, item) => sum + item.quantity, 0)} Items
                                                                </span>
                                                                <span className="text-[10px] font-semibold text-gray-400 truncate max-w-[140px]">
                                                                    {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className={`font-bold text-xs ${mins >= 20 ? 'text-red-500' : 'text-gray-400'}`}>{mins}m</span>
                                                        <div className="absolute inset-0 bg-emerald-500/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-2">
                                                            <Truck size={18} /><span className="font-extrabold text-sm">DISPATCH</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* DISPATCH */}
                            <div className={`flex flex-col border-t border-gray-200 transition-all duration-300 ${isDispatchExpanded ? 'flex-1 min-h-[40%] bg-gray-50/50' : 'h-[49px] min-h-0 shrink-0 bg-white overflow-hidden'}`}>
                                <div className="flex flex-col bg-white border-b border-gray-200 flex-shrink-0">
                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 cursor-pointer select-none hover:bg-gray-50 transition-colors" onClick={() => setIsDispatchExpanded(r => !r)}>
                                        <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0"><Truck size={13} /></div>
                                        <h2 className="font-extrabold text-sm text-gray-900 tracking-tight">DISPATCH</h2>
                                        {dispatchOrders.length > 0 && <span className="ml-auto bg-emerald-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">{dispatchOrders.length}</span>}
                                        <button className={`${dispatchOrders.length === 0 ? 'ml-auto' : 'ml-2'} text-gray-400 hover:text-gray-900 transition-colors`}>
                                            {isDispatchExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                        </button>
                                    </div>
                                    <form onSubmit={handleDispatchSearchDeliver} className="px-3 py-2">
                                        <div className="relative">
                                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input type="text" value={dispatchSearchToken} onChange={e => setDispatchSearchToken(e.target.value)} placeholder="Token # → Enter to deliver" className="w-full pl-9 pr-8 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100" />
                                            {dispatchSearchToken && <button type="button" onClick={() => setDispatchSearchToken('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
                                        </div>
                                    </form>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                                    {dispatchOrders.length === 0 ? (
                                        <EmptyState emoji="📦" text="No ready orders" sub="Dispatched orders appear here" />
                                    ) : (
                                        dispatchOrders.sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()).map(order => (
                                            <div key={order.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-emerald-200 transition-colors">
                                                <div className="flex flex-col leading-none">
                                                    <span className="text-4xl font-black text-gray-900 tracking-tighter">#{tokenMap.get(order.id)}</span>
                                                    <span className="text-xs font-extrabold text-gray-400 mt-2">₹{order.grandTotal}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button onClick={() => handleUndoDispatch(order.id)} className="flex flex-col items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 font-extrabold px-4 py-3 rounded-xl shadow-sm transition-all active:scale-95 group shrink-0" title="Undo Dispatch">
                                                        <RotateCcw size={16} className="group-hover:-rotate-45 transition-transform" />
                                                        <span className="text-[9px] tracking-wide uppercase leading-none mt-0.5">Undo</span>
                                                    </button>
                                                    <button onClick={() => handleBatchDispatch([order.id], order.deliveryAddress?.hostelNumber || 'Pickup')} className="flex flex-col items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-500 font-extrabold px-6 py-3 rounded-xl shadow-sm transition-all active:scale-95 group shrink-0">
                                                        <Package size={18} className="group-hover:scale-110 transition-transform" />
                                                        <span className="text-[10px] tracking-wide uppercase leading-none mt-0.5">Deliver</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* ── COL 3: POS (DEDICATED BILLING COLUMN) ── */}
                        <section className="w-1/3 flex flex-col min-w-0 bg-white ">
                            {/* POS Header & Search */}
                            <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 shadow-sm bg-white">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center"><Search size={13} /></div>
                                    <h2 className="font-extrabold text-sm text-gray-900 tracking-tight uppercase">Point of Sale</h2>
                                </div>
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        ref={posSearchRef}
                                        type="text"
                                        value={posSearch}
                                        onChange={e => setPosSearch(e.target.value)}
                                        onKeyDown={handlePosSearchKey}
                                        placeholder="Type item, press Enter to add..."
                                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 text-gray-900 text-sm font-bold placeholder:text-gray-400 placeholder:font-normal rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-shadow"
                                    />
                                </div>
                                {posSearch && posFiltered.length > 0 && (
                                    <div className="flex flex-col gap-1 mt-2">
                                        {posFiltered.map((product: Product, idx: number) => (
                                            <button key={product.id} onClick={() => { addToPos(product); setPosSearch(''); setTimeout(() => posSearchRef.current?.focus(), 20); }}
                                                // onMouseEnter so mouse hover aligns with keyboard state
                                                onMouseEnter={() => setHighlightedSuggestionIndex(idx)}
                                                className={`flex items-center justify-between px-3 py-2 text-sm font-bold rounded-lg border transition-colors ${highlightedSuggestionIndex === idx ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-white border-transparent text-gray-700 hover:bg-gray-50'}`}>
                                                <div className="flex items-center gap-2">
                                                    <Plus size={12} className={highlightedSuggestionIndex === idx ? 'text-purple-500' : 'text-gray-400'} />
                                                    <span>{product.name}</span>
                                                </div>
                                                <span className="font-semibold text-gray-400 text-xs">₹{product.price}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Cart Items Area */}
                            <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50/50 scrollbar-thin">
                                {posCartItems.length === 0 ? (
                                    <EmptyState emoji="🛒" text="Cart is empty" sub="Search an item and press Enter" />
                                ) : (
                                    <div className="space-y-2">
                                        {posCartItems.map((item, idx) => (
                                            <div key={item.productId} className={`flex items-center justify-between p-3 rounded-xl border shadow-sm transition-colors ${selectedCartIndex === idx ? 'bg-purple-50/50 border-purple-300 ring-2 ring-purple-500/20' : 'bg-white border-gray-200'}`}>
                                                <div className="flex-1 min-w-0 mr-3">
                                                    <h3 className={`text-sm font-bold truncate ${selectedCartIndex === idx ? 'text-purple-900' : 'text-gray-900'}`}>
                                                        {selectedCartIndex === idx && <span className="text-purple-500 mr-2 text-xs">▶</span>}
                                                        {item.name}
                                                    </h3>
                                                    <p className="text-xs font-semibold text-gray-500">₹{item.price}</p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className={`flex items-center gap-1 rounded-lg border p-0.5 ${selectedCartIndex === idx ? 'bg-white border-purple-200 shadow-sm' : 'bg-gray-50 border-gray-200'}`}>
                                                        <button onClick={() => { setSelectedCartIndex(idx); removeFromPos(item.productId!); }} className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors shadow-sm font-black text-sm leading-none ${selectedCartIndex === idx ? 'bg-purple-100 hover:bg-purple-200 text-purple-700' : 'bg-white hover:bg-gray-100 text-gray-700'}`}>
                                                            −
                                                        </button>
                                                        <span className={`text-sm font-black w-6 text-center ${selectedCartIndex === idx ? 'text-purple-900' : 'text-gray-900'}`}>{item.quantity}</span>
                                                        <button onClick={() => { setSelectedCartIndex(idx); addToPos({ id: item.productId!, name: item.name, price: item.price, imageURL: item.imageURL || '', categoryId: '' }); }} className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors shadow-sm font-black text-sm leading-none ${selectedCartIndex === idx ? 'bg-purple-100 hover:bg-purple-200 text-purple-700' : 'bg-white hover:bg-gray-100 text-gray-700'}`}>
                                                            +
                                                        </button>
                                                    </div>
                                                    <span className={`text-sm font-black w-12 text-right ${selectedCartIndex === idx ? 'text-purple-900' : 'text-gray-900'}`}>₹{item.price * item.quantity}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Payment & Confirm Footer */}
                            <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Total Amount</span>
                                    <span className="text-3xl font-black text-gray-900">₹{posTotal}</span>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex bg-gray-100 p-1 rounded-xl">
                                        {(['Cash', 'UPI'] as const).map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setPosPayment(m)}
                                                className={`flex-1 py-2 text-sm font-extrabold rounded-lg transition-all ${posPayment === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handlePosConfirm}
                                        disabled={posCartItems.length === 0 || posSubmitting}
                                        className={`relative w-full overflow-hidden flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-base transition-all duration-300 ${posCartItems.length > 0 && !posSubmitting ? (confirmPending ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 scale-[1.02] ring-4 ring-indigo-500/20' : 'bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow') : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                    >
                                        {confirmPending && <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />}
                                        {posSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>
                                            {confirmPending ? 'Enter again to confirm' : '✓ Confirm & Print'}
                                            {!confirmPending && <span className="text-[10px] font-bold bg-black/15 text-white/90 px-1.5 py-0.5 rounded ml-1 transition-opacity">Ctrl+Enter</span>}
                                        </>}
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                </>
            ) : null}

            {viewMode === 'history' && (
                /* ═══ HISTORY TABLE ═══ */
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-50  p-6">
                    <div className="flex items-center gap-4 mb-6 shrink-0">
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex-1 shadow-sm">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Orders Served</p>
                            <p className="text-3xl font-black text-gray-900 mt-1">{historySummary.totalOrders}</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex-1 shadow-sm">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Sales</p>
                            <p className="text-3xl font-black text-emerald-600 mt-1">₹{historySummary.totalSales}</p>
                        </div>
                    </div>
                    <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
                        <div className="overflow-auto flex-1 scrollbar-thin">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider sticky top-0 z-10">
                                        <th className="px-5 py-4 font-medium">Order ID</th>
                                        <th className="px-5 py-4 font-medium">Source</th>
                                        <th className="px-5 py-4 font-medium">Date/Time</th>
                                        <th className="px-5 py-4 font-medium">Customer</th>
                                        <th className="px-5 py-4 font-medium">Items</th>
                                        <th className="px-5 py-4 font-medium text-right">Total</th>
                                        <th className="px-5 py-4 font-medium text-center">Prep Time</th>
                                        <th className="px-5 py-4 font-medium">Status</th>
                                        <th className="px-5 py-4 font-medium text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-[14px]">
                                    {paginatedOrders.length === 0 ? (
                                        <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-500 font-medium">No orders found.</td></tr>
                                    ) : (
                                        paginatedOrders.map((order: Order) => {
                                            const isExpanded = selectedOrderDetails?.id === order.id;
                                            const isPOS = order.orderType === 'pos';
                                            const prepMins = order.prep_time ? `${order.prep_time}m` : '-';
                                            const rowBg = isExpanded ? 'bg-blue-50/30' : isPOS ? 'bg-purple-50/10' : '';
                                            
                                            return (
                                                <tr key={order.id} className={`hover:bg-gray-50/80 transition-colors ${rowBg}`}>
                                                    <td className="px-5 py-5 font-bold text-gray-900">#{tokenMap.get(order.id) || order.id.slice(0, 6).toUpperCase()}</td>
                                                    <td className="px-5 py-5">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${isPOS ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {isPOS ? 'POS' : 'Online'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-5 text-gray-500 whitespace-nowrap">
                                                        <div className="font-medium">{new Date(order.orderDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                        <div className="text-[12px]">{new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </td>
                                                    <td className="px-5 py-5">
                                                        <div className="font-bold text-gray-900 max-w-[140px] truncate" title={order.deliveryAddress?.name || 'Guest'}>{order.deliveryAddress?.name || 'Guest'}</div>
                                                        <div className="text-[12px] text-gray-500 mt-0.5 flex items-center gap-1">
                                                            <Phone size={10} className="text-gray-400" />{order.deliveryAddress?.mobile || order.customerPhone || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-5">
                                                        <span className="text-[13px] text-gray-600 font-medium line-clamp-2 max-w-[200px]">{order.items.map((i: OrderItem) => `${i.quantity} ${i.name}`).join(', ')}</span>
                                                    </td>
                                                    <td className="px-5 py-5 text-right">
                                                        <div className="font-bold text-gray-900">₹{order.grandTotal}</div>
                                                        <div className="flex items-center justify-end gap-1 mt-1 text-[11px]">
                                                            {order.payment_provider?.toLowerCase() === 'upi' || order.payment_provider === 'payu' ? <Smartphone size={10} className="text-purple-600" /> : <Banknote size={10} className="text-emerald-600" />}
                                                            <span className={`font-semibold ${order.status !== 'Pending' && order.status !== 'Cancelled' ? 'text-emerald-600' : order.status === 'Cancelled' ? 'text-gray-500' : 'text-amber-600'}`}>
                                                                {order.status !== 'Pending' && order.status !== 'Cancelled' ? 'PAID' : order.status === 'Cancelled' ? 'CXL' : 'COD'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-5 text-center">
                                                        <span className="text-[13px] font-medium text-gray-500">{prepMins}</span>
                                                    </td>
                                                    <td className="px-5 py-5">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-sm text-[11px] font-bold uppercase tracking-wider ${order.status === 'Completed' || order.status === 'Dispatched' || order.status === 'Delivered' ? 'bg-[#2eaa25] text-white' : order.status === 'Cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-700'}`}>{order.status}</span>
                                                    </td>
                                                    <td className="px-5 py-5 text-center">
                                                        <button onClick={() => setSelectedOrderDetails(order)} className={`text-[13px] font-semibold transition-all ${isExpanded ? 'text-blue-700' : 'text-blue-500 hover:text-blue-700'}`}>
                                                            {isExpanded ? 'Viewing' : 'View'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {historyTotalPages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between shrink-0 gap-3">
                                <span className="text-sm font-medium text-gray-500">Page <span className="font-bold text-gray-900">{historyPage}</span> of <span className="font-bold text-gray-900">{historyTotalPages}</span></span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="px-4 py-2 rounded-lg border border-gray-200 font-bold text-sm bg-white text-gray-700 disabled:opacity-50 hover:bg-gray-50 transition-colors">Previous</button>
                                    <button onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage === historyTotalPages} className="px-4 py-2 rounded-lg border border-gray-200 font-bold text-sm bg-white text-gray-700 disabled:opacity-50 hover:bg-gray-50 transition-colors">Next</button>
                                </div>
                            </div>
                        )}
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

    return (
        <div className={`flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow border-l-4 ${urgency === 'red' ? 'border-l-red-500' : urgency === 'amber' ? 'border-l-amber-400' : 'border-l-gray-300'} transition-all relative max-h-80`}>
            {isPOS && <div className="absolute top-3 right-3 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wide border border-purple-200 z-10">WALK-IN</div>}
            <div className="px-3 pt-3 pb-2 flex items-center justify-between shrink-0">
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-900 tracking-tighter">{displayToken}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${urgency === 'red' ? 'bg-red-100 text-red-700' : 'text-gray-500'}`}>{mins}m</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isPaid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{isPaid ? 'PAID' : 'COD'}</span>
                </div>
                <div className="flex items-center gap-2 text-right">
                    <span className="text-xl font-black text-gray-900">₹{order.grandTotal}</span>
                    {onViewDetails && (
                        <button onClick={(e) => { e.stopPropagation(); onViewDetails(); }} className="p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors" title="View Details">
                            <Eye size={16} />
                        </button>
                    )}
                </div>
            </div>
            <div className="px-3 py-1 space-y-0.5 flex-1 overflow-y-auto scrollbar-thin">
                {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm leading-tight">
                        <span className="font-bold text-gray-900">{item.quantity}×</span>
                        <span className="font-medium text-gray-700 truncate">{item.name}</span>
                    </div>
                ))}
            </div>
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex flex-col gap-1 mt-auto shrink-0">
                <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                    <span className="truncate">{order.deliveryAddress?.name || 'Guest'} · {order.deliveryAddress?.hostelNumber || 'Pickup'} {order.deliveryAddress?.roomNumber ? `Rm ${order.deliveryAddress.roomNumber}` : ''}</span>
                    {(order.customerPhone || order.deliveryAddress?.mobile) && (
                        <a href={`tel:${order.customerPhone || order.deliveryAddress?.mobile}`} className="text-blue-500 font-bold hover:underline">Call</a>
                    )}
                </div>
            </div>
            {children && <div className="p-2 bg-white border-t border-gray-100 shrink-0">{children}</div>}
        </div>
    );
}
