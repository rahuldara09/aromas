'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useVendor } from '@/contexts/VendorContext';
import { updateOrderStatus, batchUpdateOrderStatus } from '@/lib/vendor';
import { Order } from '@/types';
import { Search, Calendar, Download, ChevronLeft, ChevronRight, Truck, CheckCircle2, X, Store, Globe } from 'lucide-react';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import OrderDetailsDrawer from '@/app/vendor/orders/OrderDetailsDrawer';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 30;

function itemSummary(items: Order['items']): string {
    return items.map(i => `${i.name} (${i.quantity})`).join(', ');
}

function fmtDate(d: Date, forceDate = false): string {
    const isToday = d.toDateString() === new Date().toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday && !forceDate) return timeStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ', ' + timeStr;
}

export default function VendorHistory() {
    const { orders } = useVendor();
    const { printKOT: printReceipt } = useThermalPrinter();

    const [historySearch, setHistorySearch] = useState('');
    const [historyDate, setHistoryDate] = useState('');
    const [historyStatus, setHistoryStatus] = useState('All');
    const [historySource, setHistorySource] = useState('Online');
    const [historyPage, setHistoryPage] = useState(1);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [bulkShipMode, setBulkShipMode] = useState(false);
    const [selectedShipIds, setSelectedShipIds] = useState<string[]>([]);

    const filteredOrders = useMemo(() => {
        let f = [...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

        if (historySearch) {
            const l = historySearch.toLowerCase().trim();
            f = f.filter(o =>
                o.id.toLowerCase().includes(l) ||
                (o.orderToken || '').toLowerCase().includes(l) ||
                String(o.posToken || '').includes(l) ||
                (o.deliveryAddress?.name || '').toLowerCase().includes(l) ||
                o.items.some(i => i.name.toLowerCase().includes(l))
            );
        }
        if (historyDate) {
            f = f.filter(o => {
                const d = new Date(o.orderDate);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === historyDate;
            });
        }
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
        if (historySource !== 'All') {
            f = f.filter(o => historySource === 'POS' ? o.orderType === 'pos' : o.orderType !== 'pos');
        }
        return f;
    }, [orders, historySearch, historyDate, historyStatus, historySource]);

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

    const todayOnlinePreparingIds = useMemo(() => {
        const todayStr = new Date().toDateString();
        return orders
            .filter(o => o.status === 'Preparing' && o.orderType !== 'pos' && new Date(o.orderDate).toDateString() === todayStr)
            .map(o => o.id);
    }, [orders]);

    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));
    const paginated = useMemo(() => {
        const s = (historyPage - 1) * ITEMS_PER_PAGE;
        return filteredOrders.slice(s, s + ITEMS_PER_PAGE);
    }, [filteredOrders, historyPage]);

    useEffect(() => { setHistoryPage(1); }, [historySearch, historyDate, historyStatus, historySource]);
    useEffect(() => {
        if (historySource !== 'Online' && historySource !== 'All') {
            setBulkShipMode(false);
            setSelectedShipIds([]);
        }
    }, [historySource]);

    const handleAcceptOrder = async (o: Order) => {
        try {
            await printReceipt(o, o.orderToken || o.id.slice(0, 6).toUpperCase());
            await updateOrderStatus(o.id, 'Preparing');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed');
        }
    };
    const handleRejectOrder = async (o: Order) => { await updateOrderStatus(o.id, 'Cancelled'); toast('Rejected', { icon: '🚫' }); };
    const handleShipOnline = async (o: Order) => {
        try { await batchUpdateOrderStatus([o.id], 'Delivered'); toast.success('Shipped & delivered'); }
        catch { toast.error('Failed'); }
    };
    const handleDeliverOrder = async (o: Order) => {
        try { await batchUpdateOrderStatus([o.id], 'Delivered'); toast.success('Delivered'); }
        catch { toast.error('Failed'); }
    };
    const handleBulkShipAll = async () => {
        if (!selectedShipIds.length) return;
        const count = selectedShipIds.length;
        try {
            await batchUpdateOrderStatus(selectedShipIds, 'Delivered');
            setSelectedShipIds([]); setBulkShipMode(false);
            toast.success(`${count} order${count > 1 ? 's' : ''} delivered`);
        } catch { toast.error('Bulk ship failed'); }
    };
    const toggleBulkMode = () => { setBulkShipMode(b => !b); setSelectedShipIds([]); };

    const CHIPS = [
        { key: 'All', count: statusCounts.all },
        { key: 'Pending', count: statusCounts.pending },
        { key: 'Accepted', count: statusCounts.accepted },
        { key: 'Shipped', count: statusCounts.shipped },
        { key: 'Delivered', count: statusCounts.delivered },
        { key: 'Others', count: statusCounts.others },
    ] as const;

    // Status badge config
    const SC: Record<string, { dot: string; label: string; cls: string }> = {
        'Placed': { dot: 'bg-gray-400', label: 'Pending', cls: 'text-gray-600 border-gray-200 bg-gray-50' },
        'Pending': { dot: 'bg-gray-400', label: 'Pending', cls: 'text-gray-600 border-gray-200 bg-gray-50' },
        'Preparing': { dot: 'bg-amber-400', label: 'Preparing', cls: 'text-amber-700 border-amber-200 bg-amber-50' },
        'Dispatched': { dot: 'bg-blue-400', label: 'Shipped', cls: 'text-blue-700 border-blue-200 bg-blue-50' },
        'Delivered': { dot: 'bg-emerald-500', label: 'Delivered', cls: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
        'Completed': { dot: 'bg-emerald-500', label: 'Completed', cls: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
        'Cancelled': { dot: 'bg-red-400', label: 'Cancelled', cls: 'text-red-600 border-red-200 bg-red-50' },
    };

    const canBulkShip = historySource === 'Online' || historySource === 'All';

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">

            {/* ── Status chips ── */}
            <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0 flex items-center gap-1.5 flex-wrap">
                {CHIPS.map(chip => (
                    <button
                        key={chip.key}
                        onClick={() => setHistoryStatus(chip.key)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-all ${historyStatus === chip.key
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        {chip.key}
                        {chip.count > 0 && (
                            <span className={`text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 ${historyStatus === chip.key ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                                {chip.count}
                            </span>
                        )}
                    </button>
                ))}

                <div className="ml-auto flex items-center gap-1.5">
                    {(['All', 'Online', 'POS'] as const).map(src => (
                        <button
                            key={src}
                            onClick={() => setHistorySource(src)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all ${historySource === src
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                        >
                            {src === 'Online' && <Globe size={10} />}
                            {src === 'POS' && <Store size={10} />}
                            {src}
                        </button>
                    ))}

                    {canBulkShip && (
                        <button
                            onClick={bulkShipMode && selectedShipIds.length > 0 ? handleBulkShipAll : toggleBulkMode}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-bold border transition-all ${bulkShipMode && selectedShipIds.length > 0
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : bulkShipMode
                                    ? 'bg-indigo-50 text-indigo-600 border-indigo-300'
                                    : 'text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'
                                }`}
                        >
                            <Truck size={10} />
                            {bulkShipMode && selectedShipIds.length > 0 ? `Ship All (${selectedShipIds.length})` : 'Bulk Ship'}
                        </button>
                    )}
                    {bulkShipMode && (
                        <button onClick={toggleBulkMode} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk mode hint */}
            {bulkShipMode && (
                <div className="px-5 py-2 bg-indigo-50 border-b border-indigo-100 flex-shrink-0 flex items-center gap-3">
                    <span className="text-[12px] text-indigo-600 font-medium">
                        {selectedShipIds.length === 0 ? 'Select accepted online orders to bulk ship' : `${selectedShipIds.length} selected`}
                    </span>
                    {todayOnlinePreparingIds.length > 0 && selectedShipIds.length < todayOnlinePreparingIds.length && (
                        <button onClick={() => setSelectedShipIds(todayOnlinePreparingIds)} className="text-[12px] text-indigo-500 hover:text-indigo-800 font-semibold transition-colors underline-offset-2 hover:underline">
                            Select all today&apos;s ({todayOnlinePreparingIds.length})
                        </button>
                    )}
                </div>
            )}

            {/* ── Search + filters ── */}
            <div className="px-5 py-2.5 border-b border-gray-100 flex-shrink-0 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={historySearch}
                        onChange={e => setHistorySearch(e.target.value)}
                        placeholder="Search token, order ID, customer or item…"
                        className="w-full pl-9 pr-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 text-gray-700 placeholder:text-gray-400 bg-gray-50/50"
                    />
                </div>
                <div className="relative">
                    <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}
                        className="pl-9 pr-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 text-gray-700 cursor-pointer bg-gray-50/50" />
                </div>
                <button className="ml-auto flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download size={12} /> Export
                </button>
            </div>

            {/* ── Table ── */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur border-b border-gray-200">
                        <tr>
                            <th className="pl-4 pr-2 py-3 w-8"></th>
                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Token / Order</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Time</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Items</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payment</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {paginated.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-16 text-center text-[13px] text-gray-400">
                                    {historySearch ? `No orders match "${historySearch}"` : 'No orders found'}
                                </td>
                            </tr>
                        ) : paginated.map((order: Order) => {
                            const isPOS = order.orderType === 'pos';
                            const isPaid = order.payment_status === 'success';
                            const isPreparing = order.status === 'Preparing';
                            const isDispatched = order.status === 'Dispatched';
                            const showCheck = bulkShipMode && isPreparing && !isPOS;
                            const isChecked = selectedShipIds.includes(order.id);
                            const d = new Date(order.orderDate);
                            const timeStr = fmtDate(d);
                            const summary = itemSummary(order.items);
                            const sc = SC[order.status] ?? { dot: 'bg-gray-300', label: order.status, cls: 'text-gray-500 border-gray-200 bg-gray-50' };

                            // Token display
                            const tokenDisplay = isPOS
                                ? `#${order.posToken ?? order.orderToken ?? '?'}`
                                : `#${order.orderToken || order.id.slice(-6).toUpperCase()}`;

                            // Internal display ID
                            const internalId = isPOS && order.posToken
                                ? `2026${String(order.posToken).padStart(3, '0')}`
                                : null;

                            return (
                                <tr
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={`cursor-pointer transition-colors group ${isChecked ? 'bg-indigo-50/60' : 'hover:bg-gray-50/80'}`}
                                >
                                    {/* Checkbox */}
                                    <td className="pl-4 pr-2 py-3" onClick={e => e.stopPropagation()}>
                                        {showCheck && (
                                            <input type="checkbox" checked={isChecked}
                                                onChange={e => setSelectedShipIds(prev => e.target.checked ? [...prev, order.id] : prev.filter(id => id !== order.id))}
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                        )}
                                    </td>

                                    {/* Token / Order ID */}

                                    <td className="px-4 py-3">
                                        <div className="flex items-start gap-2">
                                            {isPOS ? (
                                                <span className="w-5 h-5 rounded bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <Store size={10} className="text-violet-600" />
                                                </span>
                                            ) : (
                                                <span className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <Globe size={10} className="text-indigo-500" />
                                                </span>
                                            )}

                                            <div>
                                                <p className={`text-[14px] font-bold leading-tight ${isPOS ? 'text-violet-700' : 'text-indigo-600'}`}>
                                                    {tokenDisplay} / {internalId}
                                                </p>


                                            </div>
                                        </div>
                                    </td>

                                    {/* Time */}
                                    <td className="px-4 py-3">
                                        <span className="text-[12px] text-gray-600 tabular-nums whitespace-nowrap">{timeStr}</span>
                                    </td>

                                    {/* Customer */}
                                    <td className="px-4 py-3">
                                        {!isPOS ? (
                                            <div className="flex flex-col">
                                                <p className="text-[13px] font-medium text-gray-800">
                                                    {order.deliveryAddress?.name || 'Guest'}
                                                </p>

                                            </div>
                                        ) : (
                                            <span className="text-[12px] text-gray-300">—</span>
                                        )}
                                    </td>
                                    {/* Items */}
                                    <td className="px-4 py-3 max-w-[220px]">
                                        <p className="text-[12px] text-gray-700 truncate" title={summary}>{summary}</p>
                                    </td>
                                    {/* Type */}
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold border ${isPOS
                                                    ? 'bg-violet-50 text-violet-700 border-violet-200'
                                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                                }`}
                                        >
                                            {isPOS ? 'Offline' : 'Online'}
                                        </span>
                                    </td>
                                    {/* Payment */}
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                            {isPaid ? 'Paid' : 'COD'}
                                        </span>
                                    </td>

                                    {/* Status + Actions */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${sc.cls}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                {sc.label}
                                            </span>
                                            {/* Online Preparing → Ship */}
                                            {isPreparing && !isPOS && (
                                                <button onClick={e => { e.stopPropagation(); handleShipOnline(order); }}
                                                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold transition-colors">
                                                    <Truck size={9} /> Ship
                                                </button>
                                            )}
                                            {/* Dispatched → Deliver */}
                                            {isDispatched && !isPOS && (
                                                <button onClick={e => { e.stopPropagation(); handleDeliverOrder(order); }}
                                                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold transition-colors">
                                                    <CheckCircle2 size={9} /> Deliver
                                                </button>
                                            )}
                                        </div>
                                    </td>

                                    {/* Amount */}
                                    <td className="px-4 py-3 text-right">
                                        <span className="text-[13px] font-semibold text-gray-900 tabular-nums">₹{order.grandTotal.toFixed(2)}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── Pagination ── */}
            <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-white">
                <span className="text-[12px] text-gray-400">
                    {filteredOrders.length === 0 ? 'No results' : `${(historyPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(historyPage * ITEMS_PER_PAGE, filteredOrders.length)} of ${filteredOrders.length}`}
                </span>
                <div className="flex items-center gap-1">
                    <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 disabled:opacity-30 transition-colors">
                        <ChevronLeft size={14} strokeWidth={2.5} />
                    </button>
                    {Array.from({ length: Math.min(7, totalPages) }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setHistoryPage(p)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-[12px] font-medium transition-colors ${historyPage === p ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                            {p}
                        </button>
                    ))}
                    {totalPages > 7 && <span className="px-1 text-gray-300 text-[12px]">…</span>}
                    {totalPages > 7 && (
                        <button onClick={() => setHistoryPage(totalPages)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-[12px] font-medium transition-colors ${historyPage === totalPages ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                            {totalPages}
                        </button>
                    )}
                    <button onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))} disabled={historyPage === totalPages}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 disabled:opacity-30 transition-colors">
                        <ChevronRight size={14} strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            <OrderDetailsDrawer
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                order={selectedOrder}
                onAccept={handleAcceptOrder}
                onReject={handleRejectOrder}
                onShip={selectedOrder?.orderType !== 'pos' ? handleShipOnline : undefined}
                onDeliver={handleDeliverOrder}
            />
        </div>
    );
}
