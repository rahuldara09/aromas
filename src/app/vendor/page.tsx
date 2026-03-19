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
                    title="Revenue"
                    value={`₹${todaySales.toLocaleString('en-IN')}`}
                    icon={<IndianRupee size={20} className="stroke-[2.5]" />}
                    trend="+12%"
                    trendUp={true}
                    iconBgClass="bg-[#e6efe1] text-emerald-700"
                    sparklineColor="#10b981"
                />
                <KPICard
                    title="Delivered Orders"
                    value={deliveredOrders.length}
                    icon={<PackageCheck size={20} className="stroke-[2.5]" />}
                    trend="+5%"
                    trendUp={true}
                    iconBgClass="bg-[#ecf2ff] text-blue-600"
                    sparklineColor="#3b82f6"
                />
                <KPICard
                    title="Active Orders"
                    value={activeOrders.length}
                    icon={<BarChart3 size={20} className="stroke-[2.5]" />}
                    trend="-6%"
                    trendUp={false}
                    iconBgClass="bg-[#fff4e5] text-amber-600"
                    sparklineColor="#f59e0b"
                />
                <KPICard
                    title="Avg Wait Time"
                    value={`${avgWaitTime} mins`}
                    icon={<Clock size={20} className="stroke-[2.5]" />}
                    trend={avgWaitTime > 15 ? "+3m" : "-1m"}
                    trendUp={avgWaitTime > 15 ? false : true}
                    iconBgClass="bg-[#e6efe1] text-emerald-700"
                    sparklineColor="#10b981"
                />
            </div>

            {/* ═══ MIDDLE ROW: CHARTS & ALERTS ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* 1. CHART WIDGET */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-5 sm:p-6 flex flex-col min-h-[380px]">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-[17px] font-extrabold text-gray-900 tracking-tight">Revenue & Orders over Time</h3>
                            <p className="text-[13px] text-gray-500 font-medium mt-1">Today's hourly performance</p>
                        </div>
                        <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
                            <button
                                onClick={() => setChartType('bar')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${chartType === 'bar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Bar
                            </button>
                            <button
                                onClick={() => setChartType('line')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${chartType === 'line' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Line
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 w-full h-[240px] sm:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'bar' ? (
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} dy={10} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} />
                                    <Tooltip
                                        cursor={{ fill: '#f9fafb' }}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}
                                    />
                                    <Bar yAxisId="left" dataKey="orders" name="Orders" fill="#cfdee2" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                    <Bar yAxisId="right" dataKey="revenue" name="Revenue (₹)" fill="#1a4a38" radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.9} />
                                </BarChart>
                            ) : (
                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} dy={10} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}
                                    />
                                    <Line yAxisId="left" type="monotone" dataKey="orders" name="Orders" stroke="#cfdee2" strokeWidth={3} dot={{ r: 4, fill: '#cfdee2', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                    <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#1a4a38" strokeWidth={3} dot={{ r: 4, fill: '#1a4a38', strokeWidth: 2, stroke: '#fff' }} opacity={0.9} />
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. CHECK DIRECT WEBSITE */}
                <div className="col-span-1 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-5 sm:p-6 flex flex-col justify-between min-h-[380px]">
                    <div>
                        <h3 className="text-[17px] font-extrabold text-gray-900 tracking-tight text-center mb-6">Check Direct Website</h3>
                        
                        {/* Mini Website Frame */}
                        <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-6 flex flex-col" style={{ height: '180px' }}>
                            <div className="bg-gray-100 px-3 py-1.5 flex items-center gap-1.5 border-b border-gray-200">
                                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                <div className="mx-auto bg-white border border-gray-200 rounded-md px-3 py-0.5 text-[8px] text-gray-400 font-mono">
                                    aroma-food-store.com
                                </div>
                            </div>
                            <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 p-3 relative overflow-hidden">
                                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[6px] text-white">1</div>
                                <div className="w-full h-10 bg-[#1a4a38] rounded flex items-center px-3 mb-2">
                                    <span className="text-white text-[10px] font-bold">Aroma Food Store</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="h-16 bg-white rounded shadow-sm"></div>
                                    <div className="h-16 bg-white rounded shadow-sm"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <button className="w-full py-3.5 bg-[#1a4a38] hover:bg-[#123628] text-white font-bold text-sm rounded-xl transition-colors shadow-sm">
                        Open Direct Website<br/>
                        <span className="text-xs font-normal opacity-90">(Aroma Food Store)</span>
                    </button>
                </div>

                {/* 3. STOCK STATUS (PEACH BLOCK) */}
                <div className="col-span-1 rounded-2xl border border-[#f4e2d2] bg-[#fff5ea] flex flex-col overflow-hidden relative min-h-[380px]">
                    <div className="px-6 py-5 flex items-center justify-between border-b border-[#f4e2d2]/50">
                        <h3 className="text-[17px] font-extrabold text-gray-900 tracking-tight">Stock Status</h3>
                        {lowStockProducts.length === 0 ? (
                            <span className="bg-[#e6efe1] text-emerald-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wide border border-emerald-200/50">
                                0 Items
                            </span>
                        ) : (
                            <span className="bg-red-100 text-red-700 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wide border border-red-200">
                                {lowStockProducts.length} Items Out
                            </span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                        {lowStockProducts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center px-6 pt-4 pb-12">
                                <div className="w-16 h-16 rounded-full bg-white border-2 border-[#1a4a38] flex items-center justify-center mb-5 shadow-sm">
                                    <CheckCircle2 size={32} className="text-[#1a4a38]" />
                                </div>
                                <h4 className="text-[17px] font-black text-gray-900 leading-tight mb-2">All {products.length || 0} menu items are<br/>in stock!</h4>
                                <p className="text-sm text-gray-600 mb-8">Manage inventory.</p>
                                
                                <div className="w-full space-y-3">
                                    <Link href="/vendor/menu" className="w-full block py-2.5 bg-white border border-[#1a4a38] text-[#1a4a38] hover:bg-[#1a4a38] hover:text-white font-bold text-sm rounded-lg transition-colors shadow-sm text-center">
                                        Inventory Manager
                                    </Link>
                                    <Link href="/vendor/menu" className="w-full block py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-sm rounded-lg transition-colors shadow-sm text-center">
                                        Set Low Stock Alerts
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            lowStockProducts.map(product => (
                                <div key={product.id} className="p-4 mx-2 my-2 bg-white flex items-center justify-between rounded-xl shadow-sm border border-rose-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-50 rounded-lg overflow-hidden grayscale opacity-80 flex-shrink-0">
                                            {product.imageURL ? <img src={product.imageURL} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">🍽</div>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 line-through decoration-rose-300">{product.name}</p>
                                            <p className="text-[11px] font-bold text-rose-500 mt-0.5">Out of stock</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleProduct(product)}
                                        className="text-[11px] font-extrabold text-[#1a4a38] bg-[#e6efe1] hover:bg-[#cbe6c1] px-2.5 py-1.5 rounded-lg transition-colors"
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
function KPICard({ 
    title, 
    value, 
    icon, 
    trend, 
    trendUp, 
    iconBgClass = "bg-[#e6efe1] text-emerald-700",
    sparklineColor = "#10b981"
}: { 
    title: string; 
    value: string | number; 
    icon: React.ReactNode; 
    trend?: string; 
    trendUp?: boolean; 
    iconBgClass?: string;
    sparklineColor?: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-5 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="text-[13px] font-bold text-gray-800">{title}</h4>
                    <p className="text-3xl font-black mt-1 tracking-tight text-gray-900">{value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBgClass}`}>
                    {icon}
                </div>
            </div>

            {/* Simulated Sparkline */}
            <div className="mt-4 mb-2 opacity-80" aria-hidden="true">
                <svg width="100%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none">
                    <path 
                        d={trendUp ? "M0,20 Q10,20 20,15 T40,10 T60,18 T80,5 T100,2" : "M0,5 Q10,5 20,10 T40,15 T60,8 T80,20 T100,22"} 
                        fill="none" 
                        stroke={sparklineColor} 
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </svg>
            </div>

            {trend && (
                <div className="flex items-center gap-1.5 mt-auto">
                    <span className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${trendUp ? 'bg-[#e6efe1] text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {trendUp ? <TrendingUp size={10} className="mr-1 stroke-[3]" /> : <TrendingDown size={10} className="mr-1 stroke-[3]" />}
                        {trend}
                    </span>
                    <span className="text-[10px] font-medium text-gray-400">vs yesterday</span>
                </div>
            )}
        </div>
    );
}
