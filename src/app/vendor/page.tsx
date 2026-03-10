'use client';

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
    LineChart,
    Line
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    IndianRupee,
    PackageCheck,
    BarChart3,
    Clock,
    AlertCircle,
    CheckCircle2,
    Activity
} from 'lucide-react';

export default function VendorDashboardHome() {
    const { orders, products } = useVendor();
    const { user, phoneNumber } = useAuth();
    const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

    // ─── DERIVED METRICS ───────────────────────────────────────────────
    const todayOrders = useMemo(() => {
        const todayStr = new Date().toDateString();
        return orders.filter(o => new Date(o.orderDate).toDateString() === todayStr);
    }, [orders]);

    const activeOrders = orders.filter(o => o.status === 'Placed' || o.status === 'Pending' || o.status === 'Preparing');
    const deliveredOrders = todayOrders.filter(o => o.status === 'Delivered' || o.status === 'Dispatched' || o.status === 'Completed');
    const todaySales = todayOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    const avgWaitTime = useMemo(() => {
        if (activeOrders.length === 0) return 0;
        const totalMins = activeOrders.reduce((sum, o) => {
            return sum + Math.floor((Date.now() - new Date(o.orderDate).getTime()) / 60000);
        }, 0);
        return Math.round(totalMins / activeOrders.length);
    }, [activeOrders]);

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

        // Filter to only show hours that have passed today (or from first order to last)
        const currentHour = new Date().getHours();
        const startHour = Math.max(0, currentHour - 9); // show last 10 hours max
        const endHour = currentHour;

        // For a more lively chart if empty, we could mock it, but let's stick to real data
        return hours.slice(startHour, endHour + 1);
    }, [todayOrders]);

    // ─── LOW STOCK & TOP ITEMS ─────────────────────────────────────────
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

    const topItems = useMemo(() => {
        const tally: Record<string, number> = {};
        todayOrders.forEach(o => {
            o.items.forEach(item => {
                tally[item.name] = (tally[item.name] || 0) + item.quantity;
            });
        });
        const sorted = Object.entries(tally).sort(([, a], [, b]) => b - a).slice(0, 4);
        const max = sorted.length ? sorted[0][1] : 1;
        return sorted.map(([name, count]) => ({ name, count, percentage: (count / max) * 100 }));
    }, [todayOrders]);

    // ─── RECENT ACTIVITY FEED ──────────────────────────────────────────
    const recentActivity = useMemo(() => {
        // Mocking a rich activity feed by combining actual orders
        return [...todayOrders]
            .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
            .slice(0, 6)
            .map(o => ({
                id: o.id,
                time: new Date(o.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                text: o.status === 'Placed' ? `New order #${o.id.slice(0, 4).toUpperCase()} received`
                    : o.status === 'Completed' ? `Order #${o.id.slice(0, 4).toUpperCase()} marked as ready`
                        : `Order #${o.id.slice(0, 4).toUpperCase()} is ${o.status.toLowerCase()}`,
                type: o.status === 'Placed' ? 'new' : o.status === 'Completed' ? 'success' : 'info'
            }));
    }, [todayOrders]);


    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 lg:space-y-8 pb-20">
            {/* ═══ TOP ROW: KPI CARDS ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <KPICard
                    title="Total Sales"
                    value={`₹${todaySales.toLocaleString('en-IN')}`}
                    icon={<IndianRupee className="text-emerald-500" size={24} />}
                    trend="+12%"
                    trendUp={true}
                />
                <KPICard
                    title="Delivered Orders"
                    value={deliveredOrders.length}
                    icon={<PackageCheck className="text-blue-500" size={24} />}
                    trend="+5%"
                    trendUp={true}
                />
                <KPICard
                    title="Active Orders"
                    value={activeOrders.length}
                    icon={<BarChart3 className="text-amber-500" size={24} />}
                />
                <KPICard
                    title="Avg Wait Time"
                    value={`${avgWaitTime} mins`}
                    icon={<Clock className={avgWaitTime > 15 ? "text-red-500" : "text-emerald-500"} size={24} />}
                    trend={avgWaitTime > 15 ? "+3m" : "-1m"}
                    trendUp={avgWaitTime > 15 ? false : true}
                    valueColor={avgWaitTime > 15 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
                />
            </div>

            {/* ═══ MIDDLE ROW: CHARTS & ALERTS ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Widget */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 sm:p-6 flex flex-col min-h-[280px] lg:min-h-[380px] transition-colors">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Revenue & Orders over Time</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">Today's hourly performance</p>
                        </div>
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg transition-colors">
                            <button
                                onClick={() => setChartType('bar')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${chartType === 'bar' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                Bar
                            </button>
                            <button
                                onClick={() => setChartType('line')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${chartType === 'line' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                Line
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 w-full h-[220px] sm:h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'bar' ? (
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 600 }} dy={10} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 600 }} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 600 }} />
                                    <Tooltip
                                        cursor={{ fill: '#f9fafb' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    />
                                    <Bar yAxisId="left" dataKey="orders" name="Orders" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar yAxisId="right" dataKey="revenue" name="Revenue (₹)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} opacity={0.6} />
                                </BarChart>
                            ) : (
                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 600 }} dy={10} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 600 }} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 600 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    />
                                    <Line yAxisId="left" type="monotone" dataKey="orders" name="Orders" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                    <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} opacity={0.6} />
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Low Stock Alerts */}
                <div className="bg-white rounded-2xl border border-rose-200 shadow-[0_4px_24px_-12px_rgba(225,29,72,0.15)] flex flex-col overflow-hidden relative min-h-[380px]">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 to-red-500" />
                    <div className="px-6 py-5 border-b border-rose-50 flex items-center justify-between bg-rose-50/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                                <AlertCircle size={20} className="animate-pulse" />
                            </div>
                            <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">Out of Stock</h3>
                        </div>
                        <span className="bg-rose-100 text-rose-700 font-black text-xs px-2.5 py-1 rounded-full">
                            {lowStockProducts.length} Items
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin divide-y divide-gray-50">
                        {lowStockProducts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-60 text-center p-6">
                                <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
                                <p className="font-bold text-gray-800">All items are in stock!</p>
                                <p className="text-xs text-gray-500 mt-1">Your inventory is looking healthy.</p>
                            </div>
                        ) : (
                            lowStockProducts.map(product => (
                                <div key={product.id} className="p-4 flex items-center justify-between hover:bg-gray-50 rounded-xl transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden grayscale opacity-60 flex-shrink-0">
                                            {product.imageURL ? <img src={product.imageURL} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">🍽</div>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 line-through decoration-rose-300">{product.name}</p>
                                            <p className="text-xs font-semibold text-rose-500 mt-0.5">Currently unavailable</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleProduct(product)}
                                        className="text-xs font-extrabold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors border border-emerald-100"
                                    >
                                        Mark In-Stock
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ BOTTOM ROW: PERFORMANCE ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Top Selling Items */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 transition-colors">
                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">Top Selling Items</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-6">Highest moving inventory today</p>

                    <div className="space-y-5">
                        {topItems.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center font-medium">No sales data yet today.</p>
                        ) : (
                            topItems.map((item, i) => (
                                <div key={item.name} className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-black flex items-center justify-center text-sm flex-shrink-0 transition-colors">
                                        #{i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm font-bold mb-1.5">
                                            <span className="text-gray-900 dark:text-gray-200">{item.name}</span>
                                            <span className="text-gray-600 dark:text-gray-400">{item.count} sold</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden transition-colors">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${item.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 flex flex-col h-full transition-colors">
                    <div className="flex items-center gap-2 mb-6 text-gray-900 dark:text-white">
                        <Activity size={20} className="text-blue-500 dark:text-blue-400" />
                        <h3 className="text-lg font-extrabold">Recent Activity</h3>
                    </div>

                    <div className="flex-1 relative">
                        {/* Timeline line */}
                        <div className="absolute left-3.5 top-3 bottom-3 w-px bg-gray-100 dark:bg-gray-800 transition-colors" />

                        <div className="space-y-6 relative z-10">
                            {recentActivity.length === 0 ? (
                                <p className="text-sm text-gray-400 dark:text-gray-500 py-4 pl-10 font-medium">No recent activity detected.</p>
                            ) : (
                                recentActivity.map((log, i) => (
                                    <div key={`${log.id}-${i}`} className="flex gap-4">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white dark:ring-gray-900 transition-colors ${log.type === 'new' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' :
                                            log.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' :
                                                'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                            }`}>
                                            <div className={`w-2 h-2 rounded-full ${log.type === 'new' ? 'bg-blue-500 dark:bg-blue-400' :
                                                log.type === 'success' ? 'bg-emerald-500 dark:bg-emerald-400' :
                                                    'bg-gray-400 dark:bg-gray-500'
                                                }`} />
                                        </div>
                                        <div className="bg-gray-50/50 dark:bg-gray-800/50 rounded-xl px-4 py-2 border border-gray-100 dark:border-gray-800 flex-1 transition-colors">
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{log.text}</p>
                                            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 mt-0.5 block">{log.time}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

// ─── UTILS ────────────────────────────────────────────────────────────────
function KPICard({ title, value, icon, trend, trendUp, valueColor = "text-gray-900 dark:text-white" }: { title: string, value: string | number, icon: React.ReactNode, trend?: string, trendUp?: boolean, valueColor?: string }) {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-[0_2px_12px_-6px_rgba(0,0,0,0.05)] p-5 hover:shadow-md dark:shadow-none transition-all relative overflow-hidden group">
            {/* Subtle brand border on top line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500/10 dark:via-red-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex justify-between items-start">
                <div>
                    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400">{title}</h4>
                    <p className={`text-3xl font-black mt-2 tracking-tight ${valueColor}`}>{value}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-600 dark:text-gray-300 transition-colors">
                    {icon}
                </div>
            </div>

            {trend && (
                <div className="mt-4 flex items-center gap-1.5 border-t border-gray-50 dark:border-gray-800 pt-3 transition-colors">
                    <span className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded-md ${trendUp ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'}`}>
                        {trendUp ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                        {trend}
                    </span>
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">vs yesterday</span>
                </div>
            )}
        </div>
    );
}
