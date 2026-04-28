'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useVendor } from '@/contexts/VendorContext';
import { useAuth } from '@/contexts/AuthContext';
import { toggleProductAvailability } from '@/lib/vendor';
import { getOrderStatusLabel, isOrderActiveStatus, isOrderCompletedStatus } from '@/lib/order-status';
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
    Area,
    ComposedChart
} from 'recharts';
import {
    TrendingUp,
    IndianRupee,
    PackageCheck,
    Globe,
    ShoppingBag,
    Clock,
    CheckCircle2,
    Activity,
    ArrowUpRight,
    AlertTriangle,
    Plus,
    ExternalLink,
    Search,
    Lightbulb,
    ArrowRight,
    Archive,
    BarChart2,
    Eye
} from 'lucide-react';

export default function VendorDashboardHome() {
    const { orders, products, isStoreOpen, toggleStore } = useVendor();
    const { user, phoneNumber } = useAuth();
    const [chartRange, setChartRange] = useState<'7d' | 'monthly' | 'yearly'>('7d');
    const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');

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

    const activeOrders = orders.filter(o => isOrderActiveStatus(o.status));
    const deliveredOrders = todayOrders.filter(o => isOrderCompletedStatus(o.status));
    const todaySales = todayOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const yesterdaySales = yesterdayOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    const salesChange = yesterdaySales > 0 ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100) : 0;
    const ordersChange = yesterdayOrders.length > 0 ? Math.round(((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length) * 100) : 0;

    const onlineOrdersToday = todayOrders.filter(o => o.orderType !== 'pos');
    const posOrdersToday = todayOrders.filter(o => o.orderType === 'pos');
    const onlineRevenue = onlineOrdersToday.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const posRevenue = posOrdersToday.reduce((s, o) => s + (o.grandTotal || 0), 0);

    // ─── CHART DATA (Range + Metric) ───────────────────────────────────
    const chartData = useMemo(() => {
        const now = new Date();
        const includeOrder = (o: typeof orders[number]) => o.status !== 'Cancelled';
        const valueForOrder = (o: typeof orders[number]) => chartMetric === 'revenue' ? (o.grandTotal || 0) : 1;
        const data: { name: string; value: number }[] = [];

        if (chartRange === '7d') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                data.push({ name: d.toLocaleDateString('en-US', { weekday: 'short' }), value: 0 });
            }

            orders.forEach(o => {
                if (!includeOrder(o)) return;
                const d = new Date(o.orderDate);
                const diffTime = new Date(now).setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0);
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays <= 6) {
                    const index = 6 - diffDays;
                    if (data[index]) data[index].value += valueForOrder(o);
                }
            });
            return data;
        }

        if (chartRange === 'monthly') {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) data.push({ name: String(d), value: 0 });

            orders.forEach(o => {
                if (!includeOrder(o)) return;
                const dt = new Date(o.orderDate);
                if (dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()) {
                    const dayIndex = dt.getDate() - 1;
                    if (data[dayIndex]) data[dayIndex].value += valueForOrder(o);
                }
            });
            return data;
        }

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        monthNames.forEach(m => data.push({ name: m, value: 0 }));
        orders.forEach(o => {
            if (!includeOrder(o)) return;
            const dt = new Date(o.orderDate);
            if (dt.getFullYear() === now.getFullYear()) {
                data[dt.getMonth()].value += valueForOrder(o);
            }
        });
        return data;
    }, [orders, chartRange, chartMetric]);

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
        return [...orders]
            .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
            .slice(0, 10)
            .map(o => {
                const firstItem = o.items[0]?.name || 'Item';
                const itemsText = o.items.length > 1 ? `${firstItem} +${o.items.length - 1} more` : firstItem;
                return {
                    id: o.id,
                    token: o.orderToken || o.id.slice(0, 6).toUpperCase(),
                    customerName: o.deliveryAddress?.name || o.customerPhone || 'Walk-in',
                    amount: o.grandTotal,
                    items: itemsText,
                    status: o.status,
                    source: o.orderType === 'pos' ? 'POS' : 'Online'
                };
            });
    }, [orders]);

    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6 h-full flex flex-col overflow-y-auto w-full bg-slate-50">
            {/* ── HEADER ── */}
            <div className="shrink-0">
                <h2 className="text-[28px] font-bold text-slate-900 tracking-tight">
                    Welcome back, Admin
                </h2>
                <p className="text-[14px] text-slate-500 mt-1">Here&apos;s what&apos;s happening at your canteen today</p>
            </div>

            {/* ═══ TOP SECTION: 3 STAT CARDS ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 shrink-0">
                {/* Today's Orders */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 relative">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Today&apos;s Orders</p>
                    <p className="text-[42px] font-bold text-slate-900 leading-none">{todayOrders.length}</p>
                    <p className="text-[13px] text-slate-500 mt-2">
                        {todayOrders.length === 0 ? 'No orders yet today' : `${deliveredOrders.length} completed`}
                    </p>
                </div>

                {/* Today's Earnings */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 relative">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Today&apos;s Earnings</p>
                    <p className="text-[42px] font-bold text-slate-900 leading-none">₹{todaySales.toLocaleString()}</p>
                    <p className="text-[13px] mt-2">
                        {todaySales === 0 ? (
                            <span className="text-blue-600">Store is currently {isStoreOpen ? 'open' : 'closed'}</span>
                        ) : (
                            <span className="text-emerald-600">+{salesChange}% from yesterday</span>
                        )}
                    </p>
                </div>

                {/* Active Orders */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 relative">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Active Orders</p>
                    <p className="text-[42px] font-bold text-blue-600 leading-none">{activeOrders.length}</p>
                    <p className="text-[13px] text-slate-500 mt-2">
                        {activeOrders.length === 0 ? 'All orders fulfilled' : 'Pending action required'}
                    </p>
                </div>
            </div>

            {/* ═══ MIDDLE SECTION: CHART + QUICK ACTIONS ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
                {/* Revenue Trend Chart */}
                <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col min-h-[340px]">
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <h3 className="text-[17px] font-semibold text-slate-900">
                                {chartMetric === 'revenue' ? 'Revenue Trend' : 'Order Trend'}
                            </h3>
                            <p className="text-[12px] text-slate-400 mt-0.5">Last 7 days</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={chartMetric}
                                onChange={(e) => setChartMetric(e.target.value as 'revenue' | 'orders')}
                                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none"
                            >
                                <option value="revenue">Revenue</option>
                                <option value="orders">Orders</option>
                            </select>
                            <select
                                value={chartRange}
                                onChange={(e) => setChartRange(e.target.value as '7d' | 'monthly' | 'yearly')}
                                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none"
                            >
                                <option value="7d">Last 7 days</option>
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 w-full relative min-h-0 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eef5" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b' }} dy={10} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 13, fill: '#64748b' }}
                                    tickFormatter={(val) => chartMetric === 'revenue' ? `₹${val / 1000}K` : `${val}`}
                                    width={50}
                                />
                                <Tooltip
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px -5px rgba(0,0,0,0.1)', fontSize: 13, fontWeight: 600 }}
                                    formatter={(value: number | string | undefined) => [
                                        chartMetric === 'revenue'
                                            ? `₹${Number(value || 0).toLocaleString()}`
                                            : Number(value || 0),
                                        chartMetric === 'revenue' ? 'Revenue' : 'Orders',
                                    ]}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="lg:col-span-4 flex flex-col gap-5">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col">
                        <h3 className="text-[17px] font-semibold text-slate-900 mb-5">Quick Actions</h3>
                        <div className="flex flex-col gap-3">
                            <Link href="/vendor/orders" className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-sm text-[14px]">
                                <ShoppingBag size={16} />
                                View Live Orders
                            </Link>
                            <Link href="/vendor/menu" className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-colors border border-slate-200 text-[14px]">
                                <Archive size={16} />
                                Manage Inventory
                            </Link>
                            <Link href="/vendor/analytics" className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-colors border border-slate-200 text-[14px]">
                                <Activity size={16} />
                                View Analytics
                            </Link>
                        </div>
                    </div>

                    {/* Store Status */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
                        <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Store Status</p>
                        <div className="flex items-center justify-between">
                            <span className="text-[15px] font-semibold text-slate-900">Accepting Orders</span>
                            <button
                                onClick={toggleStore}
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${isStoreOpen ? 'bg-blue-600' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-sm transition-transform ${isStoreOpen ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} style={{ width: 22, height: 22 }} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ RECENT ORDERS TABLE ═══ */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 flex flex-col flex-1 min-h-[300px] overflow-hidden">
                <div className="p-6 border-b border-slate-200 shrink-0 flex items-center justify-between">
                    <h3 className="text-[18px] font-semibold text-slate-900">Recent Orders</h3>
                    <Link href="/vendor/orders" className="text-[13px] font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
                        View all orders
                        <ArrowRight size={14} />
                    </Link>
                </div>
                <div className="overflow-x-auto flex-1 h-full">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-[12px] uppercase tracking-wider">
                                <th className="py-4 px-6 font-semibold">Order ID</th>
                                <th className="py-4 px-3 font-semibold">Customer</th>
                                <th className="py-4 px-3 font-semibold">Items</th>
                                <th className="py-4 px-3 font-semibold">Total</th>
                                <th className="py-4 px-6 font-semibold text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[14px]">
                            {recentActivity.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-gray-500">No recent orders</td>
                                </tr>
                            ) : (
                                recentActivity.map((order) => {
                                    const isCompleted = isOrderCompletedStatus(order.status);
                                    const isInTransit = order.status === 'Dispatched';
                                    const isPreparing = order.status === 'Preparing';
                                    const isPlaced = order.status === 'Placed' || order.status === 'Pending';
                                    
                                    return (
                                        <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-4 px-6 text-slate-900 font-medium whitespace-nowrap">#{order.token}</td>
                                            <td className="py-4 px-3 text-slate-700 whitespace-nowrap">{order.customerName}</td>
                                            <td className="py-4 px-3 text-slate-600 truncate max-w-[200px]" title={order.items}>{order.items}</td>
                                            <td className="py-4 px-3 text-slate-900 font-medium whitespace-nowrap">₹{order.amount?.toLocaleString() || 0}</td>
                                            <td className="py-4 px-6 text-right whitespace-nowrap">
                                                <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[13px] font-medium border
                                                    ${isCompleted ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200' : 
                                                      isInTransit ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                      isPreparing ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                      isPlaced ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                      'bg-gray-50 text-gray-700 border-gray-200'}
                                                `}>
                                                    {getOrderStatusLabel(order.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
