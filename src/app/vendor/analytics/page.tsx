'use client';

import { useVendor } from '@/contexts/VendorContext';
import { useMemo, useState, useCallback } from 'react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
    Download, Mail, Printer, AlertCircle, ChevronRight,
    Package, Loader2, TrendingUp, ShoppingBag, Ban, BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';

type RangeKey = 'today' | '7d' | '30d' | 'custom';

const REVENUE_STATUSES = new Set([
    'Placed', 'Pending', 'Preparing', 'Dispatched', 'Delivered', 'Completed', 'Paid',
]);

function buildRangeStart(range: RangeKey, customFrom: string): Date {
    const now = new Date();
    if (range === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    if (range === '7d') return new Date(now.getTime() - 6 * 86400000);
    if (range === '30d') return new Date(now.getTime() - 29 * 86400000);
    return customFrom ? new Date(customFrom) : new Date(now.getTime() - 6 * 86400000);
}

function generateCSV(rows: (string | number)[][]): string {
    return '﻿' + rows
        .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
}

function triggerDownload(content: string, filename: string, mime = 'text/csv;charset=utf-8;') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function VendorAnalytics() {
    const { orders } = useVendor();

    const [range, setRange] = useState<RangeKey>('7d');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [chartMode, setChartMode] = useState<'revenue' | 'orders'>('revenue');
    const [emailSending, setEmailSending] = useState(false);
    const [posPrinting, setPosPrinting] = useState(false);
    const [orderLogOpen, setOrderLogOpen] = useState(false);
    const [orderLogPage, setOrderLogPage] = useState(1);
    const ORDER_LOG_PAGE_SIZE = 25;

    // ── Filtering ─────────────────────────────────────────────────────
    const { from, to } = useMemo(() => {
        const from = buildRangeStart(range, customFrom);
        const to = range === 'custom' && customTo
            ? (() => { const d = new Date(customTo); d.setHours(23, 59, 59, 999); return d; })()
            : new Date();
        return { from, to };
    }, [range, customFrom, customTo]);

    const filteredOrders = useMemo(() =>
        orders.filter(o => {
            const d = new Date(o.orderDate);
            return d >= from && d <= to;
        }),
        [orders, from, to]
    );

    const revenueOrders = useMemo(() =>
        filteredOrders.filter(o => REVENUE_STATUSES.has(o.status)),
        [filteredOrders]
    );

    // ── KPI Metrics ───────────────────────────────────────────────────
    const metrics = useMemo(() => {
        const revenue = revenueOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);
        const count = revenueOrders.length;
        const cancelled = filteredOrders.filter(o => o.status === 'Cancelled').length;
        const avg = count > 0 ? Math.round(revenue / count) : 0;

        const itemQty = new Map<string, number>();
        revenueOrders.forEach(o =>
            o.items.forEach(i => itemQty.set(i.name, (itemQty.get(i.name) || 0) + i.quantity))
        );
        const topItem = [...itemQty.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

        return { revenue, count, cancelled, avg, topItem };
    }, [filteredOrders, revenueOrders]);

    // ── Revenue / Orders Chart ────────────────────────────────────────
    const trendData = useMemo(() => {
        if (range === 'today') {
            const hours = Array.from({ length: 24 }, (_, i) => ({
                label: `${i}:00`, revenue: 0, orders: 0,
            }));
            revenueOrders.forEach(o => {
                const h = new Date(o.orderDate).getHours();
                hours[h].revenue += o.grandTotal || 0;
                hours[h].orders++;
            });
            return hours.filter((_, i) => i >= 7 && i <= 23);
        }

        const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1);
        const data = Array.from({ length: days }, (_, i) => {
            const d = new Date(from.getTime() + i * 86400000);
            return {
                label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                dateStr: d.toLocaleDateString('en-CA'),
                revenue: 0,
                orders: 0,
            };
        });
        revenueOrders.forEach(o => {
            const key = new Date(o.orderDate).toLocaleDateString('en-CA');
            const bucket = data.find(d => d.dateStr === key);
            if (bucket) { bucket.revenue += o.grandTotal || 0; bucket.orders++; }
        });
        return data;
    }, [revenueOrders, range, from, to]);

    // ── Peak Hours ────────────────────────────────────────────────────
    const peakData = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: `${String(i).padStart(2, '0')}:00`, orders: 0,
        }));
        revenueOrders.forEach(o => {
            hours[new Date(o.orderDate).getHours()].orders++;
        });
        const relevant = hours.filter((_, i) => i >= 7 && i <= 23);
        const max = Math.max(...relevant.map(h => h.orders), 1);
        return relevant.map(h => ({ ...h, pct: Math.round((h.orders / max) * 100) }));
    }, [revenueOrders]);

    // ── Top Items ─────────────────────────────────────────────────────
    const topItemsData = useMemo(() => {
        const map = new Map<string, { qty: number; revenue: number }>();
        revenueOrders.forEach(o =>
            o.items.forEach(i => {
                const ex = map.get(i.name) || { qty: 0, revenue: 0 };
                map.set(i.name, { qty: ex.qty + i.quantity, revenue: ex.revenue + i.price * i.quantity });
            })
        );
        return [...map.entries()]
            .map(([name, d]) => ({ name, ...d }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 8);
    }, [revenueOrders]);

    // ── Item Sales Table ──────────────────────────────────────────────
    const itemSales = useMemo(() => {
        const map = new Map<string, { qty: number; revenue: number; appearances: number }>();
        revenueOrders.forEach(o =>
            o.items.forEach(i => {
                const ex = map.get(i.name) || { qty: 0, revenue: 0, appearances: 0 };
                map.set(i.name, {
                    qty: ex.qty + i.quantity,
                    revenue: ex.revenue + i.price * i.quantity,
                    appearances: ex.appearances + 1,
                });
            })
        );
        return [...map.entries()]
            .map(([name, d]) => ({ name, ...d }))
            .sort((a, b) => b.revenue - a.revenue);
    }, [revenueOrders]);

    const totalItemRevenue = useMemo(() =>
        itemSales.reduce((s, x) => s + x.revenue, 0), [itemSales]
    );

    // ── Export helpers ────────────────────────────────────────────────
    const ordersCSV = useCallback(() => {
        const rows: (string | number)[][] = [
            ['Order ID', 'Token', 'Date', 'Time', 'Customer', 'Type', 'Items', 'Revenue (₹)', 'Status'],
        ];
        [...filteredOrders]
            .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
            .forEach(o => rows.push([
                o.id,
                o.orderToken || o.id.slice(0, 6).toUpperCase(),
                new Date(o.orderDate).toLocaleDateString('en-IN'),
                new Date(o.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                o.deliveryAddress?.name || o.customerPhone || 'Walk-in',
                o.orderType === 'pos' ? 'POS' : 'Online',
                o.items.map(i => `${i.name} ×${i.quantity}`).join(' | '),
                o.grandTotal || 0,
                o.status,
            ]));
        return generateCSV(rows);
    }, [filteredOrders]);

    const itemsCSV = useCallback(() => {
        const rows: (string | number)[][] = [
            ['Item Name', 'Qty Sold', 'Revenue (₹)', 'Avg Price (₹)', 'Orders'],
        ];
        itemSales.forEach(item => rows.push([
            item.name,
            item.qty,
            item.revenue,
            Math.round(item.revenue / item.qty),
            item.appearances,
        ]));
        return generateCSV(rows);
    }, [itemSales]);

    const rangeTag = range === 'today' ? 'today'
        : range === '7d' ? '7days'
        : range === '30d' ? '30days'
        : `${customFrom}_${customTo}`;

    const exportOrders = useCallback(() => {
        triggerDownload(ordersCSV(), `orders-${rangeTag}-${new Date().toLocaleDateString('en-CA')}.csv`);
        toast.success('Orders report downloaded');
    }, [ordersCSV, rangeTag]);

    const exportItems = useCallback(() => {
        triggerDownload(itemsCSV(), `items-${rangeTag}-${new Date().toLocaleDateString('en-CA')}.csv`);
        toast.success('Item report downloaded');
    }, [itemsCSV, rangeTag]);

    const sendEmail = useCallback(async () => {
        const email = typeof window !== 'undefined' ? localStorage.getItem('vendorEmail') : null;
        if (!email) { toast.error('Vendor email not found'); return; }
        setEmailSending(true);
        try {
            const rangeLabel = range === 'today' ? 'Today' : range === '7d' ? 'Last 7 Days'
                : range === '30d' ? 'Last 30 Days' : 'Custom Range';
            const res = await fetch('/api/vendor/send-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    ordersCSV: ordersCSV(),
                    itemsCSV: itemsCSV(),
                    filename: `sales-report-${new Date().toLocaleDateString('en-CA')}.csv`,
                    subject: `Sales Report — ${rangeLabel} · Aroma Dhaba`,
                    summary: {
                        revenue: metrics.revenue,
                        orders: metrics.count,
                        cancelled: metrics.cancelled,
                        topItem: metrics.topItem,
                        rangeLabel,
                    },
                }),
            });
            if (!res.ok) throw new Error('send failed');
            toast.success(`Report emailed to ${email}`);
        } catch {
            toast.error('Failed to send email');
        } finally {
            setEmailSending(false);
        }
    }, [ordersCSV, itemsCSV, metrics, range]);

    // ── Range Label ───────────────────────────────────────────────────
    const rangeLabel = range === 'today' ? 'Today'
        : range === '7d' ? 'Last 7 days'
        : range === '30d' ? 'Last 30 days'
        : 'Custom range';

    const xAxisInterval = range === '30d' ? 4 : range === 'today' ? 2 : 'preserveStartEnd';

    const handlePrint = () => window.print();

    const printToPOS = useCallback(async () => {
        setPosPrinting(true);
        try {
            const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
            const dateStr  = todayIST.toLocaleDateString('en-IN', {
                day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC',
            });
            const payload = {
                title:   `${rangeLabel.toUpperCase()} REPORT`,
                date:    dateStr,
                range:   rangeLabel,
                summary: {
                    revenue:   metrics.revenue,
                    orders:    metrics.count,
                    cancelled: metrics.cancelled,
                },
                items: topItemsData.slice(0, 6).map(i => ({
                    name:    i.name,
                    qty:     i.qty,
                    revenue: i.revenue,
                })),
            };
            const res = await fetch('http://127.0.0.1:9100/print-report', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Printer returned error');
            const data = await res.json();
            if (data.printed) {
                toast.success('Report printed on POS printer');
            } else {
                toast('No printer connected — report logged to console', { icon: '💡' });
            }
        } catch {
            toast.error('POS printer unreachable. Is the print server running?');
        } finally {
            setPosPrinting(false);
        }
    }, [metrics, topItemsData, rangeLabel]);

    return (
        <div className="vendor-workspace h-full overflow-y-auto">

            {/* ── STICKY FILTER + ACTION BAR ── */}
            <div className="analytics-filter-bar sticky top-0 z-20 bg-[#F7F7F8]/95 backdrop-blur-sm border-b border-gray-200/50 px-5 py-3">
                <div className="flex items-center gap-3 flex-wrap justify-between">

                    {/* Title */}
                    <div className="shrink-0">
                        <h1 className="text-[17px] font-bold text-gray-900 leading-none">Analytics</h1>
                        <p className="text-[11px] text-gray-500 mt-0.5 font-medium">{rangeLabel} · {filteredOrders.length} orders</p>
                    </div>

                    {/* Quick filters */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {(['today', '7d', '30d'] as RangeKey[]).map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                                    range === r
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                            >
                                {r === 'today' ? 'Today' : r === '7d' ? '7 days' : '30 days'}
                            </button>
                        ))}
                        <div className="flex items-center gap-1">
                            <input
                                type="date"
                                value={customFrom}
                                onChange={e => { setCustomFrom(e.target.value); if (e.target.value) setRange('custom'); }}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] text-gray-600 bg-white outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-colors"
                            />
                            <span className="text-[11px] text-gray-400">–</span>
                            <input
                                type="date"
                                value={customTo}
                                onChange={e => { setCustomTo(e.target.value); if (e.target.value) setRange('custom'); }}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] text-gray-600 bg-white outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={exportOrders}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-[12px] font-semibold hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                        >
                            <Download size={13} /> Export
                        </button>
                        <button
                            onClick={printToPOS}
                            disabled={posPrinting}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-[12px] font-semibold hover:border-gray-300 hover:text-gray-900 transition-colors disabled:opacity-60"
                            title="Print to POS thermal printer"
                        >
                            {posPrinting
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Printer size={13} />
                            }
                            POS Print
                        </button>
                        <button
                            onClick={sendEmail}
                            disabled={emailSending}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-[12px] font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
                        >
                            {emailSending
                                ? <><Loader2 size={13} className="animate-spin" /> Sending…</>
                                : <><Mail size={13} /> Email Report</>
                            }
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-5">

                {/* ── DATA RETENTION BANNER ── */}
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-2.5">
                    <AlertCircle size={13} className="text-amber-500 shrink-0" />
                    <p className="text-[12px] text-amber-700 font-medium">
                        <span className="font-bold">Data is retained for 30 days.</span>{' '}
                        Export or email reports regularly to preserve your sales history.
                    </p>
                    <button
                        onClick={exportOrders}
                        className="ml-auto text-[12px] font-bold text-amber-600 hover:text-amber-800 whitespace-nowrap flex items-center gap-1 transition-colors"
                    >
                        Export now <ChevronRight size={12} />
                    </button>
                </div>

                {/* ── KPI CARDS ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard
                        label="Revenue"
                        value={`₹${metrics.revenue.toLocaleString()}`}
                        sub={`${metrics.count} orders`}
                        icon={<TrendingUp size={14} />}
                        accent
                    />
                    <KpiCard
                        label="Avg Order Value"
                        value={`₹${metrics.avg.toLocaleString()}`}
                        sub="per completed order"
                        icon={<ShoppingBag size={14} />}
                    />
                    <KpiCard
                        label="Cancelled"
                        value={String(metrics.cancelled)}
                        sub={filteredOrders.length > 0
                            ? `${Math.round(metrics.cancelled / filteredOrders.length * 100)}% of orders`
                            : 'no orders'}
                        icon={<Ban size={14} />}
                        danger={metrics.cancelled > 0}
                    />
                    <KpiCard
                        label="Best Seller"
                        value={metrics.topItem}
                        sub="by quantity"
                        icon={<BarChart3 size={14} />}
                        small
                    />
                </div>

                {/* ── ROW 1: Revenue Trend + Peak Hours ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                    {/* Revenue / Orders Trend */}
                    <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                            <div>
                                <p className="text-[14px] font-bold text-gray-900">Revenue Trend</p>
                                <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                                    {range === 'today' ? 'Hourly' : 'Daily'} · {rangeLabel}
                                </p>
                            </div>
                            <div className="flex bg-gray-50 p-0.5 rounded-lg border border-gray-100 gap-0.5">
                                {(['revenue', 'orders'] as const).map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setChartMode(m)}
                                        className={`px-3 py-1 text-[11px] rounded-md transition-all capitalize ${
                                            chartMode === m
                                                ? 'bg-white text-indigo-700 font-semibold shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 h-[260px]">
                            {trendData.every(d => d[chartMode] === 0) ? (
                                <EmptyChart label="No data for selected range" />
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.14} />
                                                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#F3F4F6" />
                                        <XAxis dataKey="label" axisLine={false} tickLine={false}
                                            tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 500 }} dy={6}
                                            interval={xAxisInterval as number | 'preserveStartEnd'}
                                        />
                                        <YAxis axisLine={false} tickLine={false}
                                            tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 500 }} />
                                        <Tooltip
                                            cursor={{ stroke: '#E5E7EB', strokeWidth: 1 }}
                                            contentStyle={{
                                                borderRadius: '12px', border: '1px solid #E5E7EB',
                                                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                                                fontSize: 12, background: '#fff',
                                            }}
                                            formatter={(v: number | undefined) => [
                                                chartMode === 'revenue' ? `₹${(v ?? 0).toLocaleString()}` : (v ?? 0),
                                                chartMode === 'revenue' ? 'Revenue' : 'Orders',
                                            ]}
                                        />
                                        <Area type="monotone" dataKey={chartMode}
                                            stroke="#6366F1" strokeWidth={2}
                                            fillOpacity={1} fill="url(#trendGrad)"
                                            dot={false}
                                            activeDot={{ r: 4, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Peak Hours */}
                    <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-50">
                            <p className="text-[14px] font-bold text-gray-900">Peak Hours</p>
                            <p className="text-[11px] font-medium text-gray-400 mt-0.5">Order volume by hour</p>
                        </div>
                        <div className="p-4 h-[260px]">
                            {peakData.every(d => d.orders === 0) ? (
                                <EmptyChart label="No orders in range" />
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={peakData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#F3F4F6" />
                                        <XAxis dataKey="hour" axisLine={false} tickLine={false}
                                            tick={{ fontSize: 9, fill: '#9CA3AF' }} interval={2} dy={4} />
                                        <YAxis axisLine={false} tickLine={false}
                                            tick={{ fontSize: 9, fill: '#9CA3AF' }} />
                                        <Tooltip
                                            cursor={{ fill: '#F9FAFB' }}
                                            contentStyle={{
                                                borderRadius: '12px', border: '1px solid #E5E7EB',
                                                fontSize: 12, background: '#fff',
                                            }}
                                            formatter={(v: number | undefined) => [v ?? 0, 'Orders']}
                                        />
                                        <Bar dataKey="orders" radius={[3, 3, 0, 0]} maxBarSize={18}>
                                            {peakData.map((entry, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={entry.pct > 70 ? '#6366F1' : entry.pct > 40 ? '#A5B4FC' : '#E0E7FF'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── ROW 2: Top Items (horizontal bar) ── */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                        <div>
                            <p className="text-[14px] font-bold text-gray-900">Top Selling Items</p>
                            <p className="text-[11px] font-medium text-gray-400 mt-0.5">By quantity · {rangeLabel}</p>
                        </div>
                        <button
                            onClick={exportItems}
                            className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                        >
                            <Download size={12} /> Export Items
                        </button>
                    </div>
                    <div className="p-4 h-[220px]">
                        {topItemsData.length === 0 ? (
                            <EmptyChart label="No sales data for selected range" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topItemsData} layout="vertical"
                                    margin={{ top: 0, right: 48, left: 4, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#F3F4F6" />
                                    <XAxis type="number" axisLine={false} tickLine={false}
                                        tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                                    <YAxis type="category" dataKey="name" width={120}
                                        axisLine={false} tickLine={false}
                                        tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} />
                                    <Tooltip
                                        cursor={{ fill: '#F9FAFB' }}
                                        contentStyle={{
                                            borderRadius: '12px', border: '1px solid #E5E7EB',
                                            fontSize: 12, background: '#fff',
                                        }}
                                        formatter={(v: number | undefined) => [`${v ?? 0} units`, 'Quantity']}
                                    />
                                    <Bar dataKey="qty" fill="#6366F1" radius={[0, 3, 3, 0]} maxBarSize={14}
                                        label={{
                                            position: 'right', fontSize: 11,
                                            fill: '#6B7280', fontWeight: 600,
                                        }}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* ── ITEM SALES TABLE ── */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                        <div>
                            <p className="text-[14px] font-bold text-gray-900">Item-wise Sales Report</p>
                            <p className="text-[11px] font-medium text-gray-400 mt-0.5">{itemSales.length} items · {rangeLabel}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={exportItems}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-[12px] font-semibold hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                            >
                                <Download size={12} /> CSV
                            </button>
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-[12px] font-semibold hover:border-gray-300 transition-colors"
                            >
                                <Printer size={12} /> Print
                            </button>
                        </div>
                    </div>

                    {itemSales.length === 0 ? (
                        <div className="py-14 text-center">
                            <Package size={26} className="text-gray-200 mx-auto mb-3" />
                            <p className="text-[13px] text-gray-400">No sales data for selected range</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">#</th>
                                        <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Item</th>
                                        <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Qty</th>
                                        <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Revenue</th>
                                        <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Avg ₹</th>
                                        <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">In Orders</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest min-w-[120px]">Share</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {itemSales.map((item, i) => {
                                        const share = totalItemRevenue > 0
                                            ? Math.round((item.revenue / totalItemRevenue) * 100) : 0;
                                        return (
                                            <tr key={item.name} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="px-5 py-3 text-[12px] text-gray-400">{i + 1}</td>
                                                <td className="px-5 py-3">
                                                    <p className="text-[13px] font-semibold text-gray-900">{item.name}</p>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className="text-[13px] font-semibold text-gray-900">×{item.qty}</span>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className="text-[13px] font-semibold text-indigo-600">
                                                        ₹{item.revenue.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className="text-[12px] text-gray-500">
                                                        ₹{Math.round(item.revenue / item.qty)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className="text-[12px] text-gray-500">{item.appearances}</span>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-indigo-400 rounded-full transition-all"
                                                                style={{ width: `${share}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-medium text-gray-400 w-7 text-right">
                                                            {share}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-100 bg-gray-50/60">
                                        <td className="px-5 py-3" />
                                        <td className="px-5 py-3 text-[12px] font-bold text-gray-700">Total</td>
                                        <td className="px-5 py-3 text-right text-[12px] font-bold text-gray-900">
                                            ×{itemSales.reduce((s, x) => s + x.qty, 0)}
                                        </td>
                                        <td className="px-5 py-3 text-right text-[13px] font-bold text-indigo-700">
                                            ₹{totalItemRevenue.toLocaleString()}
                                        </td>
                                        <td colSpan={3} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── FULL ORDER LOG (collapsed by default) ── */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    {/* Header — always visible, click to expand */}
                    <div
                        onClick={() => { setOrderLogOpen(v => !v); setOrderLogPage(1); }}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors text-left cursor-pointer"
                    >
                        <div>
                            <p className="text-[14px] font-bold text-gray-900">Full Order Log</p>
                            <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                                {filteredOrders.length} orders · {rangeLabel}
                                {!orderLogOpen && filteredOrders.length > 0 && (
                                    <span className="ml-2 text-indigo-500 font-semibold">Click to expand</span>
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={e => { e.stopPropagation(); exportOrders(); }}
                                className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                            >
                                <Download size={12} /> Export
                            </button>
                            <ChevronRight
                                size={16}
                                className={`text-gray-400 transition-transform duration-200 ${orderLogOpen ? 'rotate-90' : ''}`}
                            />
                        </div>
                    </div>

                    {/* Expandable content */}
                    {orderLogOpen && (
                        filteredOrders.length === 0 ? (
                            <div className="py-14 text-center border-t border-gray-50">
                                <Package size={26} className="text-gray-200 mx-auto mb-3" />
                                <p className="text-[13px] text-gray-400">No orders in selected range</p>
                            </div>
                        ) : (() => {
                            const sorted = [...filteredOrders].sort(
                                (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
                            );
                            const totalPages = Math.ceil(sorted.length / ORDER_LOG_PAGE_SIZE);
                            const pageOrders = sorted.slice(0, orderLogPage * ORDER_LOG_PAGE_SIZE);
                            const hasMore = pageOrders.length < sorted.length;

                            return (
                                <div className="border-t border-gray-50">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr>
                                                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Order</th>
                                                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Customer</th>
                                                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Items</th>
                                                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Time</th>
                                                    <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Amount</th>
                                                    <th className="text-center px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {pageOrders.map(order => (
                                                    <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                                                        <td className="px-5 py-3">
                                                            <p className="text-[12px] font-bold text-gray-900">
                                                                #{order.orderToken || order.id.slice(0, 6).toUpperCase()}
                                                            </p>
                                                            <p className="text-[10px] font-medium text-gray-400 mt-0.5">
                                                                {order.orderType === 'pos' ? 'POS' : 'Online'}
                                                            </p>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <p className="text-[12px] font-semibold text-gray-800">
                                                                {order.deliveryAddress?.name || order.customerPhone || 'Walk-in'}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                                {order.deliveryAddress?.hostelNumber
                                                                    ? `H${order.deliveryAddress.hostelNumber}`
                                                                    : ''}
                                                            </p>
                                                        </td>
                                                        <td className="px-5 py-3 max-w-[180px]">
                                                            <p className="text-[11px] text-gray-600 truncate">
                                                                {order.items.slice(0, 2)
                                                                    .map(i => i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name)
                                                                    .join(', ')}
                                                                {order.items.length > 2 ? ` +${order.items.length - 2}` : ''}
                                                            </p>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <p className="text-[11px] font-medium text-gray-600">
                                                                {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                                {new Date(order.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                            </p>
                                                        </td>
                                                        <td className="px-5 py-3 text-right">
                                                            <span className="text-[13px] font-bold text-gray-900">
                                                                ₹{(order.grandTotal || 0).toLocaleString()}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 text-center">
                                                            <StatusBadge status={order.status} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Load more / pagination footer */}
                                    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 bg-gray-50/40">
                                        <p className="text-[11px] text-gray-400 font-medium">
                                            Showing {pageOrders.length} of {sorted.length} orders
                                            {totalPages > 1 && ` · Page ${orderLogPage} of ${totalPages}`}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            {hasMore && (
                                                <button
                                                    onClick={() => setOrderLogPage(p => p + 1)}
                                                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-[12px] font-semibold hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                                                >
                                                    Load {Math.min(ORDER_LOG_PAGE_SIZE, sorted.length - pageOrders.length)} more
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { setOrderLogOpen(false); setOrderLogPage(1); }}
                                                className="px-3 py-1.5 text-gray-400 rounded-lg text-[12px] font-semibold hover:text-gray-700 transition-colors"
                                            >
                                                Collapse
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    )}
                </div>

            </div>
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, accent, danger, small }: {
    label: string; value: string; sub: string; icon: React.ReactNode;
    accent?: boolean; danger?: boolean; small?: boolean;
}) {
    return (
        <div className={`rounded-2xl border px-5 py-4 ${accent ? 'bg-indigo-600 border-indigo-500' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between mb-2">
                <p className={`text-[10px] font-bold uppercase tracking-widest ${accent ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {label}
                </p>
                <span className={`${accent ? 'text-indigo-300' : danger ? 'text-red-400' : 'text-gray-300'}`}>
                    {icon}
                </span>
            </div>
            <p className={`font-bold leading-none truncate ${small ? 'text-[17px]' : 'text-[26px]'} ${
                accent ? 'text-white' : danger ? 'text-red-500' : 'text-gray-900'
            }`}>
                {value}
            </p>
            <p className={`text-[11px] mt-2 font-medium ${accent ? 'text-indigo-200' : 'text-gray-400'}`}>{sub}</p>
        </div>
    );
}

function EmptyChart({ label }: { label: string }) {
    return (
        <div className="h-full flex items-center justify-center">
            <p className="text-[12px] text-gray-300 font-medium">{label}</p>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const cls: Record<string, string> = {
        Delivered: 'bg-emerald-50 text-emerald-700',
        Completed: 'bg-emerald-50 text-emerald-700',
        Paid: 'bg-emerald-50 text-emerald-700',
        Preparing: 'bg-indigo-50 text-indigo-700',
        Dispatched: 'bg-indigo-50 text-indigo-700',
        Cancelled: 'bg-red-50 text-red-600',
        Placed: 'bg-amber-50 text-amber-700',
        Pending: 'bg-amber-50 text-amber-700',
    };
    return (
        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${cls[status] || 'bg-gray-100 text-gray-500'}`}>
            {status}
        </span>
    );
}
