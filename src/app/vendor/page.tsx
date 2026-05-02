'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useVendor } from '@/contexts/VendorContext';
import {
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { ChevronRight, Package } from 'lucide-react';

export default function VendorDashboardHome() {
    const { orders, products } = useVendor();
    const [chartRange, setChartRange] = useState<'7d' | 'monthly' | 'yearly'>('7d');
    const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');

    const todayStr = new Date().toDateString();

    const todayOrders = useMemo(() =>
        orders.filter(o => new Date(o.orderDate).toDateString() === todayStr),
        [orders]
    );

    const todaySales = todayOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const onlineOrdersToday = todayOrders.filter(o => o.orderType !== 'pos');
    const posOrdersToday    = todayOrders.filter(o => o.orderType === 'pos');
    const onlineRev = onlineOrdersToday.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const posRev    = posOrdersToday.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const outOfStock = products.filter(p => p.isAvailable === false).length;

    // ── Chart data ──────────────────────────────────────────────────
    const chartData = useMemo(() => {
        const now = new Date();
        const val = (o: typeof orders[number]) => chartMetric === 'revenue' ? (o.grandTotal || 0) : 1;
        const ok = (o: typeof orders[number]) => o.status !== 'Cancelled';
        const data: { name: string; value: number }[] = [];

        if (chartRange === '7d') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now); d.setDate(now.getDate() - i);
                data.push({ name: d.toLocaleDateString('en-US', { weekday: 'short' }), value: 0 });
            }
            orders.forEach(o => {
                if (!ok(o)) return;
                const diff = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(o.orderDate).setHours(0, 0, 0, 0)) / 86400000);
                if (diff >= 0 && diff <= 6 && data[6 - diff]) data[6 - diff].value += val(o);
            });
        } else if (chartRange === 'monthly') {
            const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            for (let d = 1; d <= days; d++) data.push({ name: String(d), value: 0 });
            orders.forEach(o => {
                if (!ok(o)) return;
                const dt = new Date(o.orderDate);
                if (dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth())
                    data[dt.getDate() - 1].value += val(o);
            });
        } else {
            ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                .forEach(m => data.push({ name: m, value: 0 }));
            orders.forEach(o => {
                if (!ok(o)) return;
                const dt = new Date(o.orderDate);
                if (dt.getFullYear() === now.getFullYear()) data[dt.getMonth()].value += val(o);
            });
        }
        return data;
    }, [orders, chartRange, chartMetric]);

    const chartTotal = chartData.reduce((s, d) => s + d.value, 0);
    const chartAvg = chartData.length ? Math.round(chartTotal / chartData.length) : 0;
    const peakDay = chartData.reduce((p, c) => c.value > p.value ? c : p, { name: '—', value: 0 });

    // ── Online-only recent orders (with items) ───────────────────────
    const recentOnline = useMemo(() =>
        [...orders]
            .filter(o => o.orderType !== 'pos' && (o.status === 'Placed' || o.status === 'Pending'))
            .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
            .slice(0, 14)
            .map(o => {
                const shown = o.items.slice(0, 2).map(i =>
                    i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name
                ).join(', ');
                const extra = o.items.length > 2 ? ` +${o.items.length - 2} more` : '';
                return {
                    id: o.id,
                    token: o.orderToken || o.id.slice(0, 6).toUpperCase(),
                    customerName: o.deliveryAddress?.name || o.customerPhone || 'Customer',
                    amount: o.grandTotal,
                    status: o.status,
                    items: shown + extra || '—',
                    time: new Date(o.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };
            }),
        [orders]
    );

    const statusDot = (s: string) => {
        if (s === 'Delivered' || s === 'Completed') return 'bg-emerald-400';
        if (s === 'Preparing' || s === 'Dispatched') return 'bg-indigo-400';
        if (s === 'Cancelled') return 'bg-red-400';
        return 'bg-amber-400';
    };

    const statusLabel = (s: string) => {
        if (s === 'Placed' || s === 'Pending') return 'New';
        return s;
    };

    const fmt = (n: number) => chartMetric === 'revenue' ? `₹${n.toLocaleString()}` : String(n);

    return (
        /* Outer: no scroll — everything must fit in viewport */
        <div className="vendor-workspace h-full flex flex-col overflow-hidden p-4 gap-3 max-w-[1600px] mx-auto w-full">

            {/* ── STATS ROW — compact single line ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shrink-0">
                <div className="flex divide-x divide-gray-100">

                    <div className="flex-1 px-6 py-3.5 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Orders</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400">Online {onlineOrdersToday.length}</span>
                                <span className="text-gray-200">·</span>
                                <span className="text-[10px] text-gray-400">POS {posOrdersToday.length}</span>
                            </div>
                        </div>
                        <p className="text-[30px] font-bold text-gray-900 leading-none">{todayOrders.length}</p>
                    </div>

                    <div className="flex-1 px-6 py-3.5 bg-indigo-50/40 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Revenue</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400">Online ₹{onlineRev.toLocaleString()}</span>
                                <span className="text-gray-200">·</span>
                                <span className="text-[10px] text-gray-400">POS ₹{posRev.toLocaleString()}</span>
                            </div>
                        </div>
                        <p className="text-[30px] font-bold text-indigo-600 leading-none">₹{todaySales.toLocaleString()}</p>
                    </div>

                    <div className="flex-1 px-6 py-3.5 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Out of stock</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">items unavailable</p>
                        </div>
                        <p className={`text-[30px] font-bold leading-none ${outOfStock > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {outOfStock}
                        </p>
                    </div>

                </div>
            </div>

            {/* ── MAIN: Chart (left) + Online Orders (right) ── */}
            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-3">

                {/* LEFT — Sales chart */}
                <div className="xl:col-span-7 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden">

                    {/* Header row: title + inline mini-stats + controls */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 shrink-0 gap-4">
                        <div className="shrink-0">
                            <p className="text-[14px] font-bold text-gray-900">Revenue Trend</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                {chartRange === '7d' ? 'Last 7 days' : chartRange === 'monthly' ? 'This month' : 'This year'}
                            </p>
                        </div>

                        {/* Inline micro-stats (hidden on small) */}
                        <div className="hidden xl:flex items-center gap-4 flex-1 justify-center">
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400">Total</p>
                                <p className="text-[13px] font-semibold text-gray-900 mt-0.5">{fmt(chartTotal)}</p>
                            </div>
                            <div className="w-px h-6 bg-gray-100" />
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400">Avg / day</p>
                                <p className="text-[13px] font-semibold text-gray-900 mt-0.5">{fmt(chartAvg)}</p>
                            </div>
                            <div className="w-px h-6 bg-gray-100" />
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400">Peak day</p>
                                <p className="text-[13px] font-semibold text-gray-900 mt-0.5">{peakDay.name}</p>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <select
                                value={chartMetric}
                                onChange={e => setChartMetric(e.target.value as 'revenue' | 'orders')}
                                className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-600 outline-none cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                            >
                                <option value="revenue">Revenue</option>
                                <option value="orders">Orders</option>
                            </select>
                            <select
                                value={chartRange}
                                onChange={e => setChartRange(e.target.value as '7d' | 'monthly' | 'yearly')}
                                className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-600 outline-none cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                            >
                                <option value="7d">7 days</option>
                                <option value="monthly">Month</option>
                                <option value="yearly">Year</option>
                            </select>
                        </div>
                    </div>

                    {/* Chart — fills the rest of the panel */}
                    <div className="flex-1 min-h-0 px-4 pt-4 pb-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false}
                                    tick={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 500 }} dy={6} />
                                <YAxis axisLine={false} tickLine={false}
                                    tick={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 500 }}
                                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(value % 1000 !== 0 ? 1 : 0)}K` : value}
                                />
                                <Tooltip
                                    cursor={{ fill: '#F3F4F6', opacity: 0.4 }}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: '1px solid #E5E7EB',
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                                        fontSize: 12,
                                        background: '#fff',
                                    }}
                                />
                                <Bar
                                    dataKey="value"
                                    fill="#6354F0"
                                    radius={[4, 4, 0, 0]}
                                    barSize={24}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* RIGHT — Online orders only, with customer name + items */}
                <div className="xl:col-span-5 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden">

                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 shrink-0">
                        <div>
                            <p className="text-[14px] font-bold text-gray-900">New Online Orders</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Awaiting acceptance</p>
                        </div>
                        <Link href="/vendor/orders"
                            className="flex items-center gap-1 text-[12px] text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                            View all <ChevronRight size={13} />
                        </Link>
                    </div>

                    {/* Scrollable order list */}
                    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
                        {recentOnline.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-3 text-center py-10">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                    <Package size={16} className="text-gray-300" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-medium text-gray-500">All caught up</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">No orders waiting for acceptance</p>
                                </div>
                            </div>
                        ) : recentOnline.map(order => (
                            <div key={order.id}
                                className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">

                                {/* Status dot */}
                                <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${statusDot(order.status)}`} />

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-gray-900 truncate leading-none">
                                        {order.customerName}
                                    </p>
                                    <p className="text-[11px] text-gray-500 truncate mt-1 leading-none">
                                        {order.items}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1 leading-none">
                                        #{order.token} · {order.time}
                                    </p>
                                </div>

                                {/* Amount + status */}
                                <div className="text-right shrink-0">
                                    <p className="text-[13px] font-semibold text-gray-900 leading-none">₹{order.amount}</p>
                                    <span className={`inline-block mt-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded-md leading-none
                                        ${order.status === 'Preparing' || order.status === 'Dispatched'
                                            ? 'bg-indigo-50 text-indigo-600'
                                            : order.status === 'Delivered' || order.status === 'Completed'
                                                ? 'bg-emerald-50 text-emerald-600'
                                                : order.status === 'Cancelled'
                                                    ? 'bg-red-50 text-red-600'
                                                    : 'bg-amber-50 text-amber-600'
                                        }`}>
                                        {statusLabel(order.status)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
