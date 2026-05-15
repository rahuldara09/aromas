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
    Printer, Search, Bell, AlertCircle, Plus, Calendar,
    Globe, Store as StoreIcon, MoreVertical, Download, ChevronLeft, ChevronRight, Image as ImageIcon, ExternalLink,
} from 'lucide-react';
import { cldUrl, isCloudinaryUrl } from '@/lib/cloudinary';
import OrderDetailsDrawer from './OrderDetailsDrawer';
import POSBillingGrid from './POSBillingGrid';

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
    const { orders, products, posProducts, playDispatchSound, isOnlineOrdersLocked } = useVendor();
    const [kitchenYellMode, setKitchenYellMode] = useState(false);
    const [selectedPreparingIds, setSelectedPreparingIds] = useState<string[]>([]);
    const [selectedDispatchIds, setSelectedDispatchIds] = useState<string[]>([]);
    const { isConnected: isPrinterConnected, printKOT: printReceipt, isPrinting } = useThermalPrinter();

    // ── MOBILE TAB STATE & FEEDBACK ────────────────────────────────
    const [mobileTab, setMobileTab] = useState<'new' | 'pos'>('new');
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

    // Live board: only new/unaccepted online orders — accepted orders move to History
    const activeOnlineOrders = useMemo(
        () => orders
            .filter(o => o.orderType !== 'pos' && (o.status === 'Placed' || o.status === 'Pending'))
            .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()),
        [orders]
    );
    const kitchenTally = useMemo(() => {
        const tally: Record<string, number> = {};
        preparingOrders.forEach(o => o.items.forEach(item => { tally[item.name] = (tally[item.name] || 0) + item.quantity; }));
        return Object.entries(tally).sort(([, a], [, b]) => b - a);
    }, [preparingOrders]);

    // Computed from already-loaded orders — no extra Firestore query needed
    const nextPosToken = useMemo(() => {
        const todayStr = new Date().toDateString();
        const todayCount = orders.filter(o =>
            o.orderType === 'pos' && new Date(o.orderDate).toDateString() === todayStr
        ).length;
        return (todayCount % 100) + 1;
    }, [orders]);

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
    const [posSearch, setPosSearch] = useState('');
    const [posCart, setPosCart] = useState<Record<string, number>>({});
    const [posSubmitting, setPosSubmitting] = useState(false);
    const [confirmPending, setConfirmPending] = useState(false);
    const [confirmProgress, setConfirmProgress] = useState(0);
    const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const [selectedCartIndex, setSelectedCartIndex] = useState<number | null>(null);
    const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState<number | null>(null);
    const posSearchRef = useRef<HTMLInputElement>(null);

    const posFiltered = useMemo(() => {
        const q = posSearch.toLowerCase().trim();
        if (!q) return [];

        // Serial number lookup (e.g. "12" → item with serialNumber=12)
        if (/^\d+$/.test(q)) {
            const serial = parseInt(q, 10);
            const bySerial = posProducts.filter((p: Product) => p.serialNumber === serial);
            if (bySerial.length > 0) return bySerial.slice(0, 1);
        }

        // Attach auto-generated shortcode (first letter of each word) or stored code
        const enriched = posProducts.map((p: Product) => ({
            p,
            sc: (p.code ?? p.name.split(/\s+/).map((w: string) => w[0] ?? '').join('')).toLowerCase(),
        }));

        // Exact shortcode match wins
        const exact = enriched.filter(({ sc }: { sc: string }) => sc === q);
        if (exact.length > 0) return exact.map(({ p }: { p: Product }) => p).slice(0, 6);

        // Shortcode prefix OR name substring
        return enriched
            .filter(({ p, sc }: { p: Product; sc: string }) => sc.startsWith(q) || p.name.toLowerCase().includes(q))
            .map(({ p }: { p: Product }) => p)
            .slice(0, 8);
    }, [posProducts, posSearch]);

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
            const p = (posProducts as Product[]).find(x => x.id === productId);
            return { productId, name: p?.name || '', price: p?.price || 0, quantity, imageURL: p?.imageURL || '' };
        }).filter(i => i.name),
        [posCart, posProducts]);

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
            const { orderId, posToken } = await createPOSOrder(posCartItems, posTotal, posTotal, 'Cash');
            const tokenStr = String(posToken);
            const printMockOrder = {
                id: orderId, items: posCartItems, orderDate: new Date(),
                status: 'Preparing', orderType: 'pos', payment_status: 'success',
                grandTotal: posTotal, orderToken: tokenStr, posToken,
            } as Order;
            try {
                await printReceipt(printMockOrder, tokenStr);
            } catch (err: unknown) {
                console.error('POS Print error:', err);
                toast.error('Print failed');
            }
            toast.success(`Token #${posToken} created`, { duration: 1500, style: { borderRadius: '12px', fontWeight: 600 } });

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
    }, [selectedCartIndex, posCartItems, addToPos, removeFromPos, handlePosConfirm]);

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
        if (historyStatus !== 'All') {
            const statusMap: Record<string, string[]> = {
                'Pending': ['Placed', 'Pending'],
                'Accepted': ['Preparing'],
                'Shipped': ['Dispatched'],
                'Delivered': ['Delivered', 'Completed'],
                'Others': ['Cancelled', 'refunded'],
            };
            const statuses = statusMap[historyStatus];
            if (statuses) f = f.filter(o => statuses.includes(o.status));
        }
        if (historySource !== 'All') f = f.filter(o => historySource === 'POS' ? o.orderType === 'pos' : o.orderType !== 'pos');
        return f;
    }, [orders, historySearch, historyDate, historyStatus, historySource]);

    const historySummary = useMemo(() => {
        const valid = filteredHistoryOrders.filter(o => o.status !== 'Cancelled');
        const onlineOrders = valid.filter(o => o.orderType !== 'pos').length;
        const posOrders = valid.filter(o => o.orderType === 'pos').length;
        return { totalOrders: valid.length, onlineOrders, posOrders, totalSales: valid.reduce((s, o) => s + o.grandTotal, 0) };
    }, [filteredHistoryOrders]);

    const statusCounts = useMemo(() => {
        const src = orders.filter(o => {
            if (historySource === 'POS') return o.orderType === 'pos';
            if (historySource === 'Online') return o.orderType !== 'pos';
            return true;
        });
        return {
            all: src.length,
            pending: src.filter(o => ['Placed', 'Pending'].includes(o.status)).length,
            accepted: src.filter(o => o.status === 'Preparing').length,
            shipped: src.filter(o => o.status === 'Dispatched').length,
            delivered: src.filter(o => ['Delivered', 'Completed'].includes(o.status)).length,
            others: src.filter(o => ['Cancelled', 'refunded'].includes(o.status)).length,
        };
    }, [orders, historySource]);

    const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryOrders.length / ITEMS_PER_PAGE));
    const paginatedOrders = useMemo(() => { const s = (historyPage - 1) * ITEMS_PER_PAGE; return filteredHistoryOrders.slice(s, s + ITEMS_PER_PAGE); }, [filteredHistoryOrders, historyPage]);
    useEffect(() => { setHistoryPage(1); }, [historySearch, historyDate, historyStatus, historySource]);

    // Auto-focus POS on mount
    useEffect(() => { setTimeout(() => posSearchRef.current?.focus(), 150); }, []);

    // ═══════════════════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════════════════
    return (
        <div className="h-full flex flex-col vendor-workspace overflow-hidden select-none transition-colors">
            {/* Live Board header — no tabs needed, history moved to /vendor/history */}

            <>
                {/* ── MOBILE TAB BAR ─────────────────────────────────── */}
                <div className="lg:hidden flex border-b border-slate-200 bg-white overflow-x-auto flex-shrink-0">
                    {[
                        { key: 'new', label: 'Orders', count: activeOnlineOrders.length, color: 'text-indigo-600 border-indigo-500' },
                        { key: 'pos', label: 'POS', count: null, color: 'text-slate-700 border-slate-700' },
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
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mobileTab === tab.key ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── MOBILE SINGLE-COLUMN CONTENT ─────────────────── */}
                <div className="lg:hidden flex-1 overflow-y-auto w-full">
                    {mobileTab === 'new' && (
                        <div className="flex flex-col bg-white min-h-full">
                            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-200 flex-shrink-0">
                                <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center"><Bell size={13} /></div>
                                <h2 className="font-extrabold text-sm text-gray-900 tracking-tight">ONLINE ORDERS</h2>
                                {activeOnlineOrders.length > 0 && <span className="ml-auto bg-indigo-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">{activeOnlineOrders.length}</span>}
                            </div>
                            <div className="flex-1 bg-slate-50 overflow-y-auto p-3 space-y-3 pb-8">
                                {isOnlineOrdersLocked ? (
                                    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                                        <AlertCircle size={22} className="text-red-400" />
                                        <div>
                                            <p className="text-[12px] font-bold text-gray-800">Online Orders Paused</p>
                                            <p className="text-[11px] text-gray-400 mt-1">Complete today's settlement to resume.</p>
                                        </div>
                                    </div>
                                ) : activeOnlineOrders.length === 0 ? (
                                    <EmptyState emoji="🔔" text="No active orders" sub="Incoming orders appear here" />
                                ) : (
                                    activeOnlineOrders.map(order => {
                                        const tok = tokenMap.get(order.id) || '???';
                                        return (
                                            <OnlineOrderCard
                                                key={order.id}
                                                order={order}
                                                token={tok}
                                                onViewDetails={() => setSelectedOrderDetails(order)}
                                                onAccept={() => handleAcceptAndPrint(order, tok)}
                                                onReject={async () => { try { await updateOrderStatus(order.id, 'Cancelled'); toast('Rejected', { icon: '🚫' }); } catch { toast.error('Failed'); } }}
                                                isPrinting={isPrinting}
                                            />
                                        );
                                    })
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

            {/* ── DESKTOP 2-COLUMN BOARD (lg+): 1/3 Online Orders | 2/3 POS ─ */}
            <div className="hidden lg:flex flex-1 overflow-hidden min-h-0 gap-4 p-4 bg-gray-50">

                {/* ── COL 1: ONLINE ORDERS (1/3) ── */}
                <section className="w-1/3 flex flex-col min-w-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex-1 bg-white overflow-y-auto scrollbar-thin">
                        {isOnlineOrdersLocked ? (
                            <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 p-6 text-center">
                                <AlertCircle size={22} className="text-red-400" />
                                <div>
                                    <p className="text-[13px] font-bold text-gray-800">Online Orders Paused</p>
                                    <p className="text-[11px] text-gray-400 mt-1 max-w-[180px]">Complete today's settlement to resume.</p>
                                </div>
                            </div>
                        ) : activeOnlineOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 opacity-40 select-none">
                                <Bell size={36} strokeWidth={1.5} className="text-gray-400" />
                                <p className="text-sm font-semibold text-gray-500">No active orders</p>
                                <p className="text-xs text-gray-400">Incoming orders appear here</p>
                            </div>
                        ) : (
                            <div className="p-3 space-y-3">
                                {!isPrinterConnected && (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] px-3 py-2 rounded-lg flex items-center gap-2 font-bold uppercase tracking-tight">
                                        <AlertCircle size={12} className="shrink-0 text-amber-500" />
                                        <span>Printer offline</span>
                                    </div>
                                )}
                                <AnimatePresence mode="popLayout">
                                    {activeOnlineOrders.map((order) => {
                                        const tok = tokenMap.get(order.id) || '???';
                                        return (
                                            <motion.div
                                                key={order.id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, x: 200 }}
                                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                            >
                                                <OnlineOrderCard
                                                    order={order}
                                                    token={tok}
                                                    onViewDetails={() => setSelectedOrderDetails(order)}
                                                    onAccept={() => handleAcceptAndPrint(order, tok)}
                                                    onReject={async () => { try { await updateOrderStatus(order.id, 'Cancelled'); toast('Rejected', { icon: '🚫' }); } catch { toast.error('Failed'); } }}
                                                    isPrinting={isPrinting}
                                                />
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── COL 2: POS TABLE (2/3) ── */}
                <section className="flex-1 flex flex-col min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    {/* POS Header — matches image 2 */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                            <Search size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="font-black text-[14px] text-gray-900 uppercase tracking-tight">Point of Sale</h2>

                        </div>

                    </div>

                    {/* Inline billing grid — self-contained, keyboard-only POS */}
                    <div className="flex-1 overflow-hidden min-h-0">
                        <POSBillingGrid
                            posProducts={posProducts as Product[]}
                            nextPosToken={nextPosToken}
                            printReceipt={async (order, token) => {
                                await printReceipt(order as Parameters<typeof printReceipt>[0], token);
                            }}
                        />
                    </div>
                </section>
            </div>
            <OrderDetailsDrawer
                isOpen={!!selectedOrderDetails}
                onClose={() => setSelectedOrderDetails(null)}
                order={selectedOrderDetails}
                onAccept={async (o) => {
                    const tok = tokenMap.get(o.id) || o.orderToken || o.id.slice(0, 6).toUpperCase();
                    await handleAcceptAndPrint(o, tok);
                }}
                onReject={async (o) => {
                    await updateOrderStatus(o.id, 'Cancelled');
                    toast('Order rejected', { icon: '🚫' });
                }}
            />
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
    const isPaid = order.payment_status === 'success';
    const isPOS = order.orderType === 'pos';
    const displayToken = isPOS ? `POS-#${token}` : `#${token}`;
    const placedAt = new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isDelivery = order.deliveryAddress?.deliveryType?.toLowerCase() !== 'takeaway';
    const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const platformFee = order.grandTotal - subtotal > 0 ? order.grandTotal - subtotal : 0;

    const elapsedBadge =
        urgency === 'red' ? 'bg-red-100 text-red-700 border-red-300' :
            urgency === 'amber' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                'bg-gray-100 text-gray-600 border-gray-300';

    return (
        <div className={`flex flex-col rounded-2xl overflow-hidden bg-white border-2 shadow-sm transition-shadow hover:shadow-md
            ${urgency === 'red' ? 'border-red-400' : urgency === 'amber' ? 'border-amber-400' : 'border-violet-200'}`}>

            {/* ── HEADER ── */}
            <div className="px-4 pt-3.5 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <span className="text-[26px] font-black text-gray-900 tracking-tight leading-none">{displayToken}</span>
                        {isPOS && (
                            <span className="text-[8px] font-black bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md border border-violet-200 uppercase tracking-widest">POS</span>
                        )}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${elapsedBadge} uppercase tracking-wide`}>
                            {mins}M
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest ${isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {isPaid ? 'PAID' : 'COD'}
                        </span>
                    </div>
                    <span className="text-[22px] font-black text-gray-900 leading-none shrink-0">₹{order.grandTotal}</span>
                </div>
                <p className="text-[11px] font-semibold text-gray-400 mt-1.5">
                    Placed at {placedAt}
                    {order.payment_provider && ` · ${order.payment_provider.toUpperCase()}`}
                    {isDelivery ? ' · Delivery' : ' · Pickup'}
                </p>
            </div>

            {/* ── ITEMS ── */}
            <div className="px-4 py-2.5 overflow-y-auto bg-white" style={{ maxHeight: '132px' }}>
                <div className="space-y-1.5">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-baseline justify-between gap-2">
                            <div className="flex items-baseline gap-2 min-w-0">
                                <span className="text-[12px] font-black text-violet-600 shrink-0 w-6 text-right leading-none">{item.quantity}x</span>
                                <span className="text-[13px] font-bold text-gray-900 truncate leading-snug">{item.name}</span>
                            </div>
                            <span className="text-[12px] font-semibold text-gray-500 shrink-0">₹{item.price * item.quantity}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 pt-2 border-t border-dashed border-gray-200 space-y-0.5">
                    <div className="flex justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        <span>Items</span>
                        <span>₹{subtotal}</span>
                    </div>
                    {platformFee > 0 && (
                        <div className="flex justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                            <span>Fee</span>
                            <span>₹{platformFee}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-[13px] font-black text-gray-900 uppercase tracking-wider pt-0.5">
                        <span>Total</span>
                        <span>₹{order.grandTotal}</span>
                    </div>
                </div>
            </div>

            {/* ── CUSTOMER / LOCATION ── */}
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 shrink-0 space-y-1">
                <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-10 shrink-0 mt-0.5">Time</span>
                    <span className="text-[11px] font-bold text-gray-800 text-right">{placedAt}</span>
                </div>
                <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-10 shrink-0 mt-0.5">User</span>
                    <span className="text-[11px] font-bold text-gray-900 text-right truncate max-w-[160px]">{(order.deliveryAddress?.name || 'Guest').toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-10 shrink-0 mt-0.5">Loc</span>
                    <span className="text-[11px] font-bold text-gray-800 text-right">
                        {order.deliveryAddress?.hostelNumber
                            ? `${order.deliveryAddress.hostelNumber.toUpperCase()} HOSTEL${order.deliveryAddress.roomNumber ? ` R${order.deliveryAddress.roomNumber}` : ''}`
                            : isPOS ? 'WALK-IN' : '—'}
                    </span>
                </div>
                {order.deliveryAddress?.mobile && (
                    <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-10 shrink-0 mt-0.5">Ph</span>
                        <span className="text-[11px] font-bold text-violet-600 text-right">{order.deliveryAddress.mobile}</span>
                    </div>
                )}

                {onViewDetails && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
                        className="mt-1 w-full py-1.5 text-[11px] font-bold text-violet-600 hover:bg-violet-50 border border-violet-300 rounded-xl transition-colors uppercase tracking-widest"
                    >
                        View Full Details
                    </button>
                )}
            </div>

            {children && <div className="px-3 pb-3 pt-2 bg-white border-t border-gray-100 shrink-0">{children}</div>}
        </div>
    );
}

// ─── ONLINE ORDER CARD ────────────────────────────────────────────────────────
function OnlineOrderCard({
    order, token, onViewDetails, onAccept, onReject, isPrinting,
}: {
    order: Order;
    token: string;
    onViewDetails?: () => void;
    onAccept?: () => void;
    onReject?: () => void;
    isPrinting?: boolean;
}) {
    const isNew = order.status === 'Placed' || order.status === 'Pending';
    const isPaid = order.payment_status === 'success';
    const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);

    const orderDate = new Date(order.orderDate);
    const isToday = orderDate.toDateString() === new Date().toDateString();
    const timeStr = isToday
        ? `Today, ${orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ', ' + orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const toDate = (v: unknown): Date | null => {
        if (!v) return null;
        if (v instanceof Date) return v;
        if (typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function')
            return (v as { toDate: () => Date }).toDate();
        const d = new Date(v as string | number);
        return isNaN(d.getTime()) ? null : d;
    };
    const fmtTime = (d: Date | null) =>
        d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const acceptedAt = toDate(order.timeline?.accepted);
    const placedAt = toDate(order.timeline?.placed) ?? orderDate;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all">

            {/* ── Header ── */}
            <div className="px-5 pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="text-[17px] font-black text-gray-900 tracking-tight">ORDER #{token}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-white uppercase tracking-widest">
                        New
                    </span>
                    {isPaid && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-900 text-white uppercase tracking-widest">PAID</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
                    <Calendar size={12} strokeWidth={2} />
                    <span>{timeStr}</span>
                    {onViewDetails && (
                        <button onClick={onViewDetails} className="ml-auto text-gray-300 hover:text-indigo-500 transition-colors">
                            <ExternalLink size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Items ── */}
            <div className="px-5 py-3 border-t border-gray-200 space-y-3">
                {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {item.imageURL ? (
                                <img src={isCloudinaryUrl(item.imageURL) ? cldUrl(item.imageURL, 88) : item.imageURL}
                                    alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon size={15} className="text-gray-300" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-gray-900 leading-tight">{item.name}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[11px] font-bold bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center leading-none flex-shrink-0">
                                    {item.quantity}
                                </span>
                                <span className="text-[12px] text-gray-400">× ₹{item.price.toFixed(2)}</span>
                            </div>
                        </div>
                        <span className="text-[14px] font-semibold text-gray-800 tabular-nums">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                ))}
            </div>

            {/* ── Price breakdown ── */}
            <div className="px-5 py-3 border-t border-gray-200 space-y-1.5">
                <div className="flex justify-between text-[13px]">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-700 font-medium tabular-nums">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                    <span className="text-gray-500">Delivery</span>
                    <span className={order.deliveryFee === 0 ? 'font-semibold text-emerald-500' : 'text-gray-700 font-medium tabular-nums'}>
                        {order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee.toFixed(2)}`}
                    </span>
                </div>
                {order.dukanFee > 0 && (
                    <div className="flex justify-between text-[13px]">
                        <span className="text-gray-500">Platform Fee</span>
                        <span className="text-gray-700 font-medium tabular-nums">₹{order.dukanFee.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-[15px] font-bold text-gray-900">Total</span>
                    <div className="flex items-center gap-2">
                        {isPaid && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wide">PAID</span>
                        )}
                        <span className="text-[16px] font-black text-gray-900 tabular-nums">₹{order.grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* ── Customer Details ── */}
            {order.deliveryAddress && (
                <div className="px-5 py-3 border-t border-gray-200">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Customer Details</p>
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-indigo-600 truncate">{order.deliveryAddress.name || 'Guest'}</p>
                            {order.deliveryAddress.hostelNumber && (
                                <p className="text-[12px] text-gray-500 mt-0.5">
                                    {order.deliveryAddress.hostelNumber} Hostel{order.deliveryAddress.roomNumber ? `, Room ${order.deliveryAddress.roomNumber}` : ''}
                                </p>
                            )}
                        </div>
                        {(order.customerPhone || order.deliveryAddress.mobile) && (
                            <p className="text-[12px] text-gray-500 font-medium shrink-0 tabular-nums">
                                {order.customerPhone || order.deliveryAddress.mobile}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* ── Activity ── */}
            <div className="px-5 py-3 border-t border-gray-200">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Activity</p>
                <div className="space-y-2.5">
                    {acceptedAt && (
                        <div className="flex items-start gap-2.5">
                            <div className="w-2 h-2 rounded-full border-2 border-indigo-500 mt-1 shrink-0" />
                            <div className="flex-1 flex justify-between items-start gap-2 min-w-0">
                                <div>
                                    <p className="text-[13px] font-semibold text-gray-800">Order accepted</p>
                                    <p className="text-[11px] text-gray-400">By you</p>
                                </div>
                                <p className="text-[11px] text-gray-400 shrink-0">{fmtTime(acceptedAt)}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-gray-300 mt-1 shrink-0" />
                        <div className="flex-1 flex justify-between items-start gap-2 min-w-0">
                            <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-gray-800">Order received</p>
                                <p className="text-[11px] text-gray-400 truncate">
                                    Via online store, ₹{order.grandTotal} via {order.payment_provider || 'cashfree'}
                                </p>
                            </div>
                            <p className="text-[11px] text-gray-400 shrink-0">{fmtTime(placedAt)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Actions ── */}
            <div className="px-4 py-3 border-t border-gray-200">
                {isNew && (
                    <div className="flex gap-2">
                        <button onClick={onReject}
                            className="flex-1 py-2.5 rounded-xl font-semibold text-[13px] text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
                            Reject
                        </button>
                        <button onClick={onAccept} disabled={isPrinting}
                            className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 font-bold text-[13px] transition-colors shadow-sm">
                            {isPrinting
                                ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Printing…</>
                                : <><Printer size={14} strokeWidth={2.5} /> Accept &amp; Print</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
