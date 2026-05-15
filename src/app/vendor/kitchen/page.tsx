'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useVendor } from '@/contexts/VendorContext';
import { ChefHat, Search, Maximize, Clock, Flame, Zap, ZapOff, CheckCircle2, Activity, Timer } from 'lucide-react';
import { Order, OrderItem } from '@/types';
import toast from 'react-hot-toast';

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────
const minutesElapsed = (dateInput: string | Date) => {
    const diff = new Date().getTime() - new Date(dateInput).getTime();
    return Math.floor(diff / 60000);
};

const urgencyColor = (mins: number) => {
    if (mins >= 15) return 'bg-red-600 text-white border-red-700';
    if (mins >= 10) return 'bg-amber-500 text-white border-amber-600';
    if (mins >= 5) return 'bg-[#06B6D4] text-white border-cyan-600';
    return 'bg-slate-800 text-white border-slate-700';
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

        return Array.from(map.values()).sort((a, b) => b.oldestMins - a.oldestMins || b.totalQuantity - a.totalQuantity);
    }, [preparingOrders, tokenMap, completedItems, currentTime]);

    // Telemetry
    const totalOrdersCount = preparingOrders.length;
    const totalItemsCount = itemsPending.reduce((sum, item) => sum + item.totalQuantity, 0);
    const maxWaitTime = itemsPending.length > 0 ? itemsPending[0].oldestMins : 0;

    const loadFactor = totalItemsCount * 1.5;
    let loadStatus = { label: 'OPTIMAL', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20' };
    if (loadFactor >= 25) loadStatus = { label: 'CRITICAL', color: 'text-red-400 bg-red-400/10 border-red-500/20 animate-pulse' };
    else if (loadFactor >= 12) loadStatus = { label: 'HIGH LOAD', color: 'text-amber-400 bg-amber-400/10 border-amber-500/20' };

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
        toast.success(`COMPLETED: ${itemName}`);
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
        toast.success(`BATCH CLEARED: ${itemName}`, { icon: '🔥' });
    };

    const checkAndFulfillOrder = (orderId: string, currentCompletedSet: Set<string>) => {
        const order = preparingOrders.find(o => o.id === orderId);
        if (!order) return;

        const allItemsDone = order.items.every(item => currentCompletedSet.has(`${order.id}-${item.name}`));
        if (allItemsDone) {
            toast(`TICKET #${tokenMap.get(orderId)} READY`, { icon: '🏁', duration: 4000 });
        }
    };

    return (
        <div className={`vendor-pos-shell fixed inset-0 z-50 flex flex-col font-sans select-none overflow-hidden transition-colors duration-300 ${rushMode ? 'bg-black' : 'bg-[#111827]'} text-white`}>
            
            {/* ── HEADER ── */}
            <header className="vendor-topbar flex h-16 border-b border-[#111827] items-center justify-between px-6 flex-shrink-0 z-10 w-full">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 text-white flex items-center justify-center">
                            <ChefHat size={22} strokeWidth={3} />
                        </div>
                        <div>
                            <h1 className="text-[16px] font-black tracking-[0.2em] uppercase leading-none">Kitchen Display</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Terminal ID: KDS-01</p>
                        </div>
                    </div>

                    <div className="h-10 w-px bg-slate-800" />

                    <div className="flex gap-8">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Queue</span>
                            <span className="text-xl font-black leading-none">{totalOrdersCount}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Items</span>
                            <span className="text-xl font-black leading-none text-cyan-300">{totalItemsCount}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Wait Time</span>
                            <span className={`text-xl font-black leading-none ${maxWaitTime >= 15 ? 'text-red-500' : 'text-white'}`}>{maxWaitTime}m</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {recommender && (
                        <div className="hidden xl:flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-md">
                            <Flame size={16} className="text-amber-500" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Recommended Priority</span>
                                <span className="text-[11px] font-black text-white uppercase tracking-wider">{recommender.totalQuantity}x {recommender.name}</span>
                            </div>
                        </div>
                    )}

                    <div className={`px-4 py-2 rounded-md border flex items-center gap-2 font-black text-[10px] tracking-widest uppercase ${loadStatus.color}`}>
                        {loadStatus.label}
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-md border border-slate-800">
                        <button
                            onClick={() => setRushMode(!rushMode)}
                            className={`p-2 rounded-md transition-all ${rushMode ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-transparent text-slate-500 hover:text-white'}`}
                        >
                            <Zap size={18} strokeWidth={3} />
                        </button>
                        <button className="p-2 rounded-md text-slate-500 hover:text-white transition-colors">
                            <Maximize size={18} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── WORKSPACE ── */}
            <div className="flex flex-1 overflow-hidden">
                
                {/* 1. MAIN PRODUCTION GRID */}
                <main className="flex-1 flex flex-col bg-slate-900/50 p-6 overflow-y-auto scrollbar-thin">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-[11px] font-black text-slate-500 tracking-[0.3em] uppercase">Active Production Grid</h2>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            <Timer size={12} /> Auto-refresh: 30s
                        </div>
                    </div>

                    {itemsPending.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-700">
                            <ChefHat size={80} strokeWidth={1} className="mb-6 opacity-10" />
                            <p className="text-xl font-black uppercase tracking-[0.2em]">Kitchen Idle</p>
                            <p className="text-[11px] font-bold mt-2 uppercase tracking-widest opacity-50">Monitoring incoming traffic...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max">
                            {itemsPending.map(item => {
                                const isExpanded = expandedItem === item.name;
                                const colorClass = urgencyColor(item.oldestMins);

                                return (
                                    <div
                                        key={item.name}
                                        className={`flex flex-col rounded-md border transition-all duration-200 ${isExpanded ? 'ring-4 ring-[#6D28D9]/30 scale-[1.01] z-10 border-[#6D28D9]' : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'}`}
                                    >
                                        <div
                                            className="p-5 cursor-pointer flex flex-col gap-4"
                                            onClick={() => setExpandedItem(isExpanded ? null : item.name)}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <h3 className={`font-black uppercase tracking-tight leading-none ${isExpanded ? 'text-3xl text-white' : 'text-xl text-slate-200'}`}>
                                                    {item.name}
                                                </h3>
                                                <span className={`font-black tabular-nums px-3 py-1 rounded-md ${isExpanded ? 'bg-[#6D28D9] text-white text-4xl' : 'bg-slate-800 text-[#06B6D4] text-2xl'}`}>
                                                    {item.totalQuantity}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between mt-auto">
                                                <div className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-md border uppercase tracking-widest ${colorClass}`}>
                                                    <Clock size={12} strokeWidth={3} /> {item.oldestMins}m
                                                </div>
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                    In {item.orders.length} Tickets
                                                </span>
                                            </div>
                                        </div>

                                        {/* EXPANDED BREAKDOWN */}
                                        {isExpanded && (
                                            <div className="bg-[#111827] border-t border-slate-800 p-4">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleMarkBatchComplete(item.name); }}
                                                    className="w-full flex items-center justify-center gap-2 bg-[#06B6D4] hover:bg-cyan-500 text-white font-black py-4 rounded-md mb-4 transition-all uppercase tracking-[0.2em] text-[11px]"
                                                >
                                                    <CheckCircle2 size={16} strokeWidth={3} /> Clear Batch
                                                </button>

                                                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                                                    {item.orders.sort((a, b) => b.mins - a.mins).map(order => (
                                                        <div key={order.orderId} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-md p-3 hover:border-slate-600 transition-colors">
                                                            <div className="flex items-center gap-4">
                                                                <span className="font-black text-xl tracking-tighter w-12 text-[#6D28D9]">#{order.token}</span>
                                                                <span className="font-black bg-slate-800 text-white px-2 py-0.5 rounded-md text-[11px] uppercase">{order.quantity}×</span>
                                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${order.mins >= 15 ? 'bg-red-600 text-white' : 'text-slate-500'}`}>{order.mins}m</span>
                                                            </div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleMarkItemComplete(order.orderId, item.name); }}
                                                                className="px-3 py-1.5 bg-slate-800 hover:bg-[#6D28D9] text-white border border-slate-700 hover:border-[#6D28D9] text-[9px] font-black rounded-md transition-all uppercase tracking-widest"
                                                            >
                                                                Done
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

                {/* 2. ORDER LEDGER SIDEBAR */}
                <aside className="w-80 bg-[#111827] border-l border-[#1F2937] p-6 flex flex-col flex-shrink-0">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-[11px] font-black text-slate-500 tracking-[0.3em] uppercase">Order Ledger</h2>
                        <span className="text-[9px] font-black bg-slate-800 text-slate-400 px-2 py-1 rounded-md uppercase tracking-widest">{preparingOrders.length} Tickets</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 scrollbar-none pr-1">
                        {preparingOrders.length === 0 ? (
                            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest text-center mt-12">No active tickets</p>
                        ) : (
                            preparingOrders.map(order => {
                                const tok = tokenMap.get(order.id) || '???';
                                const mins = minutesElapsed(order.orderDate);
                                const totalOrderQty = order.items.reduce((s, i) => s + i.quantity, 0);
                                const localCompletedQty = order.items.filter(i => completedItems.has(`${order.id}-${i.name}`)).reduce((s, i) => s + i.quantity, 0);
                                const progress = Math.round((localCompletedQty / totalOrderQty) * 100);

                                return (
                                    <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-md p-4 flex flex-col gap-3 relative overflow-hidden group hover:border-slate-600 transition-colors">
                                        <div className="absolute left-0 bottom-0 h-1 bg-[#06B6D4] transition-all duration-500" style={{ width: `${progress}%` }} />

                                        <div className="flex items-center justify-between">
                                            <span className={`text-2xl font-black tracking-tighter ${mins >= 20 ? 'text-red-500' : 'text-white'}`}>#{tok}</span>
                                            <span className={`text-[9px] font-black px-2 py-1 rounded-md bg-black uppercase tracking-widest ${mins >= 20 ? 'text-red-500' : 'text-slate-500'}`}>{mins}m wait</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                                            <span className="text-slate-500">{totalOrderQty} Items</span>
                                            <span className={progress === 100 ? 'text-emerald-500' : 'text-[#06B6D4]'}>{progress}% Prod</span>
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
