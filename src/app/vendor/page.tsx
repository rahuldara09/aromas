'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useVendor } from '@/contexts/VendorContext';
import { useAuth } from '@/contexts/AuthContext';
import { toggleProductAvailability } from '@/lib/vendor';
import { Product } from '@/types';
import toast from 'react-hot-toast';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import {
    TrendingUp,
    IndianRupee,
    PackageCheck,
    ShoppingBag,
    Clock,
    CheckCircle2,
    Activity,
    ArrowUpRight,
    AlertTriangle
} from 'lucide-react';

export default function VendorDashboardHome() {
    const { orders, products } = useVendor();
    const { user, phoneNumber } = useAuth();
    const [chartType, setChartType] = useState<'bar' | 'area'>('area');

    // ─── DERIVED METRICS ───────────────────────────────────────────────
    const todayOrders = useMemo(() => {
        const todayStr = new Date().toDateString();
        return orders.filter(o => new Date(o.orderDate).toDateString() === todayStr);
    }, [orders]);

    const yesterdayOrders = useMemo(() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toDateString();
        return orders.filter(o => new Date(o.orderDate).toDateString() === yStr);
    }, [orders]);

    const activeOrders = orders.filter(o => o.status === 'Placed' || o.status === 'Pending' || o.status === 'Preparing');
    const deliveredOrders = todayOrders.filter(o => o.status === 'Delivered' || o.status === 'Dispatched' || o.status === 'Completed');
    const todaySales = todayOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const yesterdaySales = yesterdayOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    const salesChange = yesterdaySales > 0 ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100) : 0;
    const ordersChange = yesterdayOrders.length > 0 ? Math.round(((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length) * 100) : 0;

    const avgWaitTime = useMemo(() => {
        if (activeOrders.length === 0) return 0;
        const totalMins = activeOrders.reduce((sum, o) => {
            return sum + Math.floor((Date.now() - new Date(o.orderDate).getTime()) / 60000);
        }, 0);
        return Math.round(totalMins / activeOrders.length);
    }, [activeOrders]);

    const onlineOrdersToday = todayOrders.filter(o => o.orderType !== 'pos');
    const posOrdersToday = todayOrders.filter(o => o.orderType === 'pos');
    const onlineRevenue = onlineOrdersToday.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const posRevenue = posOrdersToday.reduce((s, o) => s + (o.grandTotal || 0), 0);

    // ─── CHART DATA (Orders by Hour) ───────────────────────────────────
    const chartData = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            label: `${i % 12 || 12}${i < 12 ? 'AM' : 'PM'}`,
            orders: 0,
            revenue: 0
        }));

        todayOrders.forEach(o => {
            const h = new Date(o.orderDate).getHours();
            hours[h].orders += 1;
            hours[h].revenue += o.grandTotal || 0;
        });

        const currentHour = new Date().getHours();
        const startHour = Math.max(0, currentHour - 11);
        return hours.slice(startHour, currentHour + 1);
    }, [todayOrders]);

    // ─── LOW STOCK ────────────────────────────────────────────────────
    const lowStockProducts = products.filter(p => p.isAvailable === false);

    const handleToggleProduct = async (product: Product) => {
        try {
            const idToken = await user!.getIdToken();
            await toggleProductAvailability(product.id, true, idToken, phoneNumber ?? '');
            toast.success(`${product.name} is back in stock!`);
        } catch {
            toast.error('Failed to update stock');
        }
    };

    // ─── TOP SELLERS ──────────────────────────────────────────────────
    const topItems = useMemo(() => {
        const tally: Record<string, number> = {};
        todayOrders.forEach(o => {
            o.items.forEach(item => {
                tally[item.name] = (tally[item.name] || 0) + item.quantity;
            });
        });
        const sorted = Object.entries(tally).sort(([, a], [, b]) => b - a).slice(0, 5);
        const max = sorted.length ? sorted[0][1] : 1;
        return sorted.map(([name, count]) => ({ name, count, percentage: (count / max) * 100 }));
    }, [todayOrders]);

    // ─── RECENT ACTIVITY ───────────────────────────────────────────────
    const recentActivity = useMemo(() => {
        return [...todayOrders]
            .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
            .slice(0, 5)
            .map(o => ({
                id: o.id,
                token: o.orderToken || o.id.slice(0, 6).toUpperCase(),
                time: new Date(o.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                amount: o.grandTotal,
                items: o.items.length,
                status: o.status,
                source: o.orderType === 'pos' ? 'POS' : 'Online'
            }));
    }, [todayOrders]);


    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-20">

            {/* ═══ KPI CARDS ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Today's Revenue"
                    value={`₹${todaySales.toLocaleString('en-IN')}`}
                    change={salesChange}
                    icon={<IndianRupee size={18} />}
                    iconBg="bg-emerald-50 text-emerald-600"
                />
                <KPICard
                    title="Orders Today"
                    value={todayOrders.length}
                    change={ordersChange}
                    icon={<ShoppingBag size={18} />}
                    iconBg="bg-blue-50 text-blue-600"
                />
                <KPICard
                    title="Delivered"
                    value={deliveredOrders.length}
                    subtitle={`of ${todayOrders.length} orders`}
                    icon={<PackageCheck size={18} />}
                    iconBg="bg-violet-50 text-violet-600"
                />
                <KPICard
                    title="Avg Wait"
                    value={`${avgWaitTime}m`}
                    subtitle={activeOrders.length > 0 ? `${activeOrders.length} active` : 'No active orders'}
                    icon={<Clock size={18} />}
                    iconBg={avgWaitTime > 15 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}
                />
            </div>

            {/* ═══ REVENUE BREAKDOWN STRIP ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <TrendingUp size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Online Revenue</p>
                        <p className="text-xl font-black text-gray-900 mt-0.5">₹{onlineRevenue.toLocaleString('en-IN')}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">{onlineOrdersToday.length} orders</span>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <ShoppingBag size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">POS Revenue</p>
                        <p className="text-xl font-black text-gray-900 mt-0.5">₹{posRevenue.toLocaleString('en-IN')}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">{posOrdersToday.length} orders</span>
                </div>
            </div>

            {/* ═══ CHART + TOP ITEMS ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col min-h-[360px]">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-base font-extrabold text-gray-900 tracking-tight">Revenue & Orders</h3>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">Today&apos;s hourly breakdown</p>
                        </div>
                        <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
                            <button
                                onClick={() => setChartType('area')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${chartType === 'area' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Area
                            </button>
                            <button
                                onClick={() => setChartType('bar')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${chartType === 'bar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Bar
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'bar' ? (
                                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} dy={8} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} />
                                    <Tooltip
                                        cursor={{ fill: '#f9fafb' }}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: 13, fontWeight: 600 }}
                                    />
                                    <Bar dataKey="revenue" name="Revenue (₹)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                                    <Bar dataKey="orders" name="Orders" fill="#e5e7eb" radius={[6, 6, 0, 0]} maxBarSize={28} />
                                </BarChart>
                            ) : (
                                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} dy={8} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: 13, fontWeight: 600 }}
                                    />
                                    <Area type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#10b981" strokeWidth={2.5} fill="url(#revenueGrad)" dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                                </AreaChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Selling Items */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col min-h-[360px]">
                    <h3 className="text-base font-extrabold text-gray-900 tracking-tight mb-1">Top Sellers</h3>
                    <p className="text-xs text-gray-500 font-medium mb-5">Today&apos;s most ordered items</p>

                    <div className="flex-1 space-y-4">
                        {topItems.length === 0 ? (
                            <p className="text-sm text-gray-400 py-8 text-center font-medium">No sales data yet today.</p>
                        ) : (
                            topItems.map((item, i) => (
                                <div key={item.name} className="flex items-center gap-3">
                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                        i === 0 ? 'bg-amber-50 text-amber-700' :
                                        i === 1 ? 'bg-gray-100 text-gray-600' :
                                        'bg-gray-50 text-gray-500'
                                    }`}>
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between text-sm mb-1.5">
                                            <span className="font-bold text-gray-900 truncate">{item.name}</span>
                                            <span className="font-bold text-gray-500 shrink-0 ml-2">{item.count}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-emerald-400' : 'bg-emerald-300'}`}
                                                style={{ width: `${item.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ BOTTOM ROW: ACTIVITY + STOCK ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Activity size={16} className="text-blue-500" />
                        <h3 className="text-base font-extrabold text-gray-900">Recent Orders</h3>
                    </div>

                    {recentActivity.length === 0 ? (
                        <p className="text-sm text-gray-400 py-6 text-center font-medium">No orders today yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {recentActivity.map((log) => (
                                <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/70 border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                            log.source === 'POS' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                                        }`}>
                                            #{log.token.slice(-3)}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">
                                                {log.items} items · ₹{log.amount}
                                            </p>
                                            <p className="text-xs text-gray-500 font-medium mt-0.5">{log.time} · {log.source}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0 ${
                                        log.status === 'Delivered' || log.status === 'Dispatched' || log.status === 'Completed'
                                            ? 'bg-emerald-50 text-emerald-700' 
                                            : log.status === 'Cancelled' ? 'bg-gray-100 text-gray-500'
                                            : log.status === 'Preparing' ? 'bg-amber-50 text-amber-700'
                                            : 'bg-blue-50 text-blue-700'
                                    }`}>
                                        {log.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Stock Alerts */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-base font-extrabold text-gray-900">Stock Status</h3>
                        {lowStockProducts.length === 0 ? (
                            <span className="bg-emerald-50 text-emerald-700 font-bold text-[10px] px-2 py-1 rounded-full uppercase tracking-wide border border-emerald-200/50">
                                All Good
                            </span>
                        ) : (
                            <span className="bg-red-50 text-red-700 font-bold text-[10px] px-2 py-1 rounded-full uppercase tracking-wide border border-red-200">
                                {lowStockProducts.length} Out
                            </span>
                        )}
                    </div>

                    {lowStockProducts.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                                <CheckCircle2 size={24} className="text-emerald-600" />
                            </div>
                            <p className="text-sm font-bold text-gray-900 mb-1">All items in stock</p>
                            <p className="text-xs text-gray-500">{products.length} menu items available</p>
                            <Link href="/vendor/menu" className="mt-4 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                                Manage Inventory →
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-2 flex-1">
                            {lowStockProducts.slice(0, 5).map(product => (
                                <div key={product.id} className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <AlertTriangle size={14} className="text-red-500 shrink-0" />
                                        <span className="text-sm font-bold text-gray-900 truncate">{product.name}</span>
                                    </div>
                                    <button
                                        onClick={() => handleToggleProduct(product)}
                                        className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                                    >
                                        Restock
                                    </button>
                                </div>
                            ))}
                            {lowStockProducts.length > 5 && (
                                <Link href="/vendor/menu" className="block text-center text-xs font-bold text-gray-500 hover:text-gray-700 mt-2">
                                    +{lowStockProducts.length - 5} more →
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── KPI CARD ──────────────────────────────────────────────────────────────
function KPICard({
    title,
    value,
    change,
    subtitle,
    icon,
    iconBg = 'bg-emerald-50 text-emerald-600',
}: {
    title: string;
    value: string | number;
    change?: number;
    subtitle?: string;
    icon: React.ReactNode;
    iconBg?: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h4>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                    {icon}
                </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">{value}</p>
            {change !== undefined && change !== 0 ? (
                <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded ${change > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        <ArrowUpRight size={10} className={`mr-0.5 ${change < 0 ? 'rotate-90' : ''}`} />
                        {change > 0 ? '+' : ''}{change}%
                    </span>
                    <span className="text-[10px] font-medium text-gray-400">vs yesterday</span>
                </div>
            ) : subtitle ? (
                <p className="text-xs text-gray-500 font-medium">{subtitle}</p>
            ) : null}
        </div>
    );
}
