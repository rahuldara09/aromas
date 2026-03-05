'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useVendor } from '@/contexts/VendorContext';
import { ChefHat, Search, Maximize, Clock, Flame, Zap, ZapOff, CheckCircle2 } from 'lucide-react';
import { Order, OrderItem } from '@/types';
import toast from 'react-hot-toast';

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────
const minutesElapsed = (dateInput: string | Date) => {
    const diff = new Date().getTime() - new Date(dateInput).getTime();
    return Math.floor(diff / 60000);
};

const urgencyColor = (mins: number) => {
    if (mins >= 15) return 'bg-red-500 text-white border-red-600 shadow-red-500/20';
    if (mins >= 10) return 'bg-orange-500 text-white border-orange-600 shadow-orange-500/20';
    if (mins >= 5) return 'bg-amber-400 text-amber-900 border-amber-500 shadow-amber-400/20';
    return 'bg-gray-800 text-gray-100 border-gray-700 shadow-black/10';
};

const buildDailyTokens = (orders: Order[]) => {
    const sorted = [...orders].sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
    const map = new Map<string, string>();
    sorted.forEach((o, i) => map.set(o.id, (i + 1).toString().padStart(3, '0')));
    return map;
};

// ─── TYPES ──────────────────────────────────────────────────────────
type AggregatedItem = {
    name: string;
    totalQuantity: number;
    orders: { orderId: string; token: string; quantity: number; mins: number }[];
    oldestMins: number;
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────
export default function KitchenDisplayScreen() {
    const { orders } = useVendor();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [rushMode, setRushMode] = useState(false);
    const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    // Keep timers ticking
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    // ─── DERIVED STATE ──────────────────────────────────────────────
    const tokenMap = useMemo(() => buildDailyTokens(orders), [orders]);

    const preparingOrders = useMemo(() =>
        orders.filter(o => o.status === 'Preparing')
            .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime())
        , [orders]);

    const itemsPending = useMemo(() => {
        const map = new Map<string, AggregatedItem>();

        preparingOrders.forEach(order => {
            const token = tokenMap.get(order.id) || '???';
            const mins = minutesElapsed(order.orderDate);

            order.items.forEach(item => {
                // If item relies on product ID or name, we group by name to merge identical products.
                // We create a composite key for local state completion tracking: `${orderId}-${item.name}`
                const completionKey = `${order.id}-${item.name}`;
                if (completedItems.has(completionKey)) return;

                if (!map.has(item.name)) {
                    map.set(item.name, {
                        name: item.name,
                        totalQuantity: 0,
                        orders: [],
                        oldestMins: mins
                    });
                }
                const agg = map.get(item.name)!;
                agg.totalQuantity += item.quantity;
                agg.orders.push({ orderId: order.id, token, quantity: item.quantity, mins });
                agg.oldestMins = Math.max(agg.oldestMins, mins);
            });
        });

        // Sort: Most urgent (oldest) first. Recommender will highlight the top item.
        return Array.from(map.values()).sort((a, b) => b.oldestMins - a.oldestMins || b.totalQuantity - a.totalQuantity);
    }, [preparingOrders, tokenMap, completedItems, currentTime]); // Add currentTime to force recalculation of oldestMins periodically if needed, though usually just re-evaluating on interaction is fine.

    // Telemetry
    const totalOrdersCount = preparingOrders.length;
    const totalItemsCount = itemsPending.reduce((sum, item) => sum + item.totalQuantity, 0);
    const maxWaitTime = itemsPending.length > 0 ? itemsPending[0].oldestMins : 0;

    // Load Status: Assuming ~1.5m active cooking per item on board
    const loadFactor = totalItemsCount * 1.5;
    let loadStatus = { label: 'NORMAL', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20' };
    if (loadFactor >= 25) loadStatus = { label: 'OVERLOADED', color: 'text-red-400 bg-red-400/10 border-red-500/20 animate-pulse' };
    else if (loadFactor >= 12) loadStatus = { label: 'BUSY', color: 'text-amber-400 bg-amber-400/10 border-amber-500/20' };

    const recommender = itemsPending.length > 0 ? itemsPending.reduce((prev, current) => (prev.totalQuantity > current.totalQuantity) ? prev : current) : null;

    // ─── HANDLERS ───────────────────────────────────────────────────
    const handleMarkItemComplete = (orderId: string, itemName: string) => {
        const key = `${orderId}-${itemName}`;
        setCompletedItems(prev => {
            const next = new Set(prev);
            next.add(key);
            checkAndFulfillOrder(orderId, next);
            return next;
        });
        toast.success(`Marked ${itemName} complete`);
    };

    const handleMarkBatchComplete = (itemName: string) => {
        const itemAgg = itemsPending.find(i => i.name === itemName);
        if (!itemAgg) return;

        setCompletedItems(prev => {
            const next = new Set(prev);
            itemAgg.orders.forEach(o => next.add(`${o.orderId}-${itemName}`));
            itemAgg.orders.forEach(o => checkAndFulfillOrder(o.orderId, next));
            return next;
        });
        setExpandedItem(null);
        toast.success(`${itemName} batch cleared!`, { icon: '🔥' });
    };

    const checkAndFulfillOrder = (orderId: string, currentCompletedSet: Set<string>) => {
        const order = preparingOrders.find(o => o.id === orderId);
        if (!order) return;

        const allItemsDone = order.items.every(item => currentCompletedSet.has(`${order.id}-${item.name}`));
        if (allItemsDone) {
            // Ideally call updateOrderStatus(orderId, 'Completed') here
            // But we don't have updateOrderStatus imported natively directly, it's typically in the context or passed down.
            // For now, in local state, it will just diminish in `itemsPending`. 
            // We will need to actually call updateOrderStatus to move it to dispatch permanently.
            toast(`Order #${tokenMap.get(orderId)} READY for Dispatch!`, { icon: '🏁', duration: 4000 });
        }
    };

    // ─── RENDER ─────────────────────────────────────────────────────
    return (
        <div className={`fixed inset-0 z-50 flex flex-col font-sans transition-colors duration-300 ${rushMode ? 'bg-[#0a0a0a]' : 'bg-gray-950'} text-gray-100`}>
            {/* TOP BAR */}
            <header className={`flex items-center justify-between px-6 py-4 border-b ${rushMode ? 'border-red-900/50 bg-red-950/20' : 'border-gray-800 bg-gray-900'} shrink-0`}>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                            <ChefHat size={24} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">KDS <span className="text-gray-500 font-bold">STATION</span></h1>
                    </div>

                    <div className="h-8 w-px bg-gray-800" />

                    <div className="flex gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Orders</span>
                            <span className="text-xl font-black leading-none">{totalOrdersCount}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pending Items</span>
                            <span className="text-xl font-black leading-none text-orange-400">{totalItemsCount}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Longest Wait</span>
                            <span className={`text-xl font-black leading-none ${maxWaitTime >= 15 ? 'text-red-500 animate-pulse' : 'text-gray-100'}`}>{maxWaitTime}m</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {recommender && (
                        <div className="hidden lg:flex items-center gap-3 bg-gray-800/50 border border-gray-700 px-4 py-2 rounded-xl">
                            <Flame size={16} className="text-orange-500" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Recommended Batch</span>
                                <span className="text-sm font-black text-white">{recommender.totalQuantity}× {recommender.name}</span>
                            </div>
                        </div>
                    )}

                    <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-black text-xs tracking-wide ${loadStatus.color}`}>
                        <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${loadFactor >= 25 ? 'bg-red-400' : loadFactor >= 12 ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${loadFactor >= 25 ? 'bg-red-500' : loadFactor >= 12 ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        </span>
                        {loadStatus.label}
                    </div>

                    <button
                        onClick={() => setRushMode(!rushMode)}
                        className={`p-3 rounded-xl transition-all border ${rushMode ? 'bg-red-500 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}
                        title="Toggle Rush Mode (High Contrast)"
                    >
                        {rushMode ? <Zap size={20} /> : <ZapOff size={20} />}
                    </button>

                    <button className="p-3 bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-white rounded-xl transition-colors">
                        <Maximize size={20} />
                    </button>
                </div>
            </header>

            {/* MAIN WORKSPACE */}
            <div className="flex flex-1 overflow-hidden">
                {/* ── ALGO BOARD (70%) ── */}
                <main className="w-[70%] flex flex-col border-r border-gray-800/60 p-6 overflow-y-auto scrollbar-thin">
                    <h2 className="text-sm font-black text-gray-500 tracking-widest mb-6">ITEM COOKING BOARD</h2>

                    {itemsPending.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                            <ChefHat size={64} className="mb-4 opacity-20" />
                            <p className="text-xl font-bold">Kitchen is Clear</p>
                            <p className="text-sm font-medium mt-1">No pending items to cook</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max">
                            {itemsPending.map(item => {
                                const isExpanded = expandedItem === item.name;
                                const colorClass = urgencyColor(item.oldestMins);

                                return (
                                    <div
                                        key={item.name}
                                        className={`flex flex-col rounded-2xl border transition-all duration-300 shadow-lg ${colorClass} ${isExpanded ? 'ring-4 ring-white/20 scale-[1.02] z-10' : 'hover:scale-[1.01]'}`}
                                    >
                                        <div
                                            className="p-5 cursor-pointer flex flex-col gap-2"
                                            onClick={() => setExpandedItem(isExpanded ? null : item.name)}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <h3 className={`font-black leading-tight break-words ${rushMode ? 'text-4xl uppercase' : 'text-2xl'}`}>
                                                    {item.name}
                                                </h3>
                                                <span className={`font-black tabular-nums bg-black/20 px-3 py-1 rounded-lg ${rushMode ? 'text-5xl' : 'text-3xl'}`}>
                                                    {item.totalQuantity}<span className="text-lg opacity-50 ml-1">×</span>
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between mt-auto pt-4">
                                                <div className="flex items-center gap-1.5 text-sm font-bold opacity-80 bg-black/10 px-2.5 py-1 rounded-lg">
                                                    <Clock size={14} />
                                                    Oldest: {item.oldestMins}m
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                                                    In {item.orders.length} Orders
                                                </span>
                                            </div>
                                        </div>

                                        {/* EXPANDED BREAKDOWN */}
                                        {isExpanded && (
                                            <div className="bg-gray-950/95 border-t border-white/10 p-4 rounded-b-2xl overflow-hidden backdrop-blur-md">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleMarkBatchComplete(item.name); }}
                                                    className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-black p-3 rounded-xl mb-4 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                                >
                                                    <CheckCircle2 size={20} /> CLEAR ENTIRE BATCH
                                                </button>

                                                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                                                    {item.orders.sort((a, b) => b.mins - a.mins).map(order => (
                                                        <div key={order.orderId} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl p-3">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-black text-xl tracking-tighter w-16 text-gray-300">#{order.token}</span>
                                                                <span className="font-bold bg-gray-800 text-white px-2 py-0.5 rounded text-sm">{order.quantity}×</span>
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${order.mins >= 15 ? 'bg-red-500/20 text-red-400' : 'text-gray-500'}`}>{order.mins}m</span>
                                                            </div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleMarkItemComplete(order.orderId, item.name); }}
                                                                className="px-3 py-1.5 bg-gray-800 hover:bg-emerald-500 hover:text-white border border-gray-700 hover:border-emerald-500 text-gray-300 text-xs font-extrabold rounded-lg transition-colors"
                                                            >
                                                                DONE
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>

                {/* ── ORDER TIMELINE REPO (30%) ── */}
                <aside className="w-[30%] bg-[#0f0f11] p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-sm font-black text-gray-500 tracking-widest">ORDER LEDGER</h2>
                        <span className="text-xs font-bold bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full">{preparingOrders.length} Pending</span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin">
                        {preparingOrders.length === 0 ? (
                            <p className="text-sm font-bold text-gray-600">No active tickets.</p>
                        ) : (
                            preparingOrders.map(order => {
                                const tok = tokenMap.get(order.id) || '???';
                                const mins = minutesElapsed(order.orderDate);
                                // Calculate how many items are currently tracked as completed for this order locally
                                const totalOrderQty = order.items.reduce((s, i) => s + i.quantity, 0);
                                const localCompletedQty = order.items.filter(i => completedItems.has(`${order.id}-${i.name}`)).reduce((s, i) => s + i.quantity, 0);
                                const progress = Math.round((localCompletedQty / totalOrderQty) * 100);

                                return (
                                    <div key={order.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden group">
                                        {/* Progress Bar Background */}
                                        <div className="absolute left-0 bottom-0 h-1 bg-emerald-500/50 transition-all duration-500" style={{ width: `${progress}%` }} />

                                        <div className="flex items-center justify-between">
                                            <span className={`text-2xl font-black tracking-tighter ${mins >= 20 ? 'text-red-400' : 'text-gray-100'}`}>#{tok}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded bg-gray-950 ${mins >= 20 ? 'text-red-500' : 'text-gray-500'}`}>{mins}m waiting</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs font-semibold">
                                            <span className="text-gray-400">{totalOrderQty} Total Items</span>
                                            <span className={progress === 100 ? 'text-emerald-400' : 'text-orange-400'}>{progress}% complete</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
