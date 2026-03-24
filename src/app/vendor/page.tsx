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
    ArrowRight
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

    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-5 h-full flex flex-col overflow-hidden w-full">
            {/* ── HEADER ── */}
            <div className="shrink-0 flex items-end justify-between">
                <div>
                    <h2 className="text-[32px] font-extrabold text-[#111827] tracking-tight leading-none mb-1.5">
                        {greeting}, Satish
                    </h2>
                    <p className="text-[14px] text-gray-500 font-medium">
                        Here's the pulse of your kitchen for {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}.
                    </p>
                </div>
            </div>

            {/* ═══ KPI CARDS ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 shrink-0">
                {/* Revenue Card */}
                <div className="bg-white rounded-[16px] border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6 relative overflow-hidden flex flex-col min-h-[140px] justify-between">
                    <svg className="absolute right-0 bottom-0 w-[60%] h-full text-gray-200 opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d="M0,80 Q25,100 50,60 T100,20 L100,100 L0,100 Z" fill="none" stroke="currentColor" strokeWidth="4" />
                    </svg>
                    <div className="relative z-10">
                        <h4 className="text-[11px] font-extrabold text-gray-500 uppercase tracking-widest mb-3">Today's Revenue</h4>
                        <div className="flex items-end gap-3">
                            <p className="text-[38px] font-black tracking-tight text-[#111827] leading-none">₹{todaySales.toFixed(2)}</p>
                            <span className="bg-[#ecfdf5] text-[#059669] text-[10px] font-extrabold px-2 py-1 rounded mb-1">~12.5%</span>
                        </div>
                    </div>
                </div>

                {/* Orders Card */}
                <div className="bg-white rounded-[16px] border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6 flex flex-col min-h-[140px] justify-between relative overflow-hidden">
                    <div className="flex flex-col mb-2">
                        <h4 className="text-[11px] font-extrabold text-gray-500 uppercase tracking-widest mb-3">Orders Today</h4>
                        <div className="flex items-end gap-3">
                            <p className="text-[38px] font-black tracking-tight text-[#111827] leading-none">{todayOrders.length}</p>
                            <p className="text-[12px] font-bold text-gray-500 mb-1"><span className="text-gray-900">+12</span> vs yesterday</p>
                        </div>
                    </div>
                    
                    {/* Breakdown */}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100/60">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#9B1B30]">POS / Walk-in:</span>
                            <span className="text-[14px] font-black text-gray-900 leading-none">{todayOrders.filter(o => o.orderType === 'pos').length}</span>
                        </div>
                        <div className="w-px h-5 bg-gray-200"></div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Online:</span>
                            <span className="text-[14px] font-black text-gray-900 leading-none">{todayOrders.filter(o => o.orderType !== 'pos').length}</span>
                        </div>
                    </div>
                </div>

                {/* Delivered Card */}
                <div className="bg-white rounded-[16px] border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6 flex flex-col min-h-[140px] justify-between">
                    <div>
                        <h4 className="text-[11px] font-extrabold text-gray-500 uppercase tracking-widest mb-3">Delivered</h4>
                        <p className="text-[38px] font-black tracking-tight text-[#111827] leading-none">{deliveredOrders.length}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-4 w-full">
                        <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-gray-600 h-full rounded-full transition-all duration-1000" style={{ width: `${todayOrders.length > 0 ? (deliveredOrders.length / todayOrders.length) * 100 : 0}%` }}></div>
                        </div>
                        <span className="text-[11px] font-bold text-gray-600 w-8 text-right w-fit">{todayOrders.length > 0 ? Math.round((deliveredOrders.length / todayOrders.length) * 100) : 0}%</span>
                    </div>
                </div>
            </div>

            {/* ═══ MAIN GRID ═══ */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 pb-2">
                
                {/* Chart Area */}
                <div className="lg:col-span-8 bg-[#f5f5f5] rounded-[16px] p-6 flex flex-col min-h-0 relative">
                    <div className="flex items-center justify-between mb-6 shrink-0">
                        <h3 className="text-[17px] font-extrabold text-[#111827]">Revenue & Orders</h3>
                        <div className="flex bg-[#e5e5e5] p-1 rounded-xl shadow-inner border border-gray-200/50">
                            <button className="px-5 py-1.5 text-[11px] font-extrabold rounded-lg bg-white text-[#111827] shadow-sm tracking-wider uppercase">
                                Area
                            </button>
                            <button className="px-5 py-1.5 text-[11px] font-extrabold rounded-lg text-gray-500 hover:text-gray-700 tracking-wider uppercase">
                                Bar
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 w-full relative min-h-0 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#475569" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#e2e8f0" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="transparent" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 800 }} dy={10} />
                                <YAxis yAxisId="revenue" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} tickFormatter={(val) => `₹${val}`} width={40} />
                                <YAxis yAxisId="orders" axisLine={false} tickLine={false} tick={false} width={0} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px -5px rgba(0,0,0,0.1)', fontSize: 13, fontWeight: 700 }}
                                    formatter={(value, name) => {
                                        if (name === 'Revenue (₹)' && typeof value === 'number') return [`₹${value.toFixed(2)}`, name];
                                        return [value, name];
                                    }}
                                />
                                {/* Orders inside area chart */}
                                <Bar yAxisId="orders" dataKey="orders" name="Orders" fill="#df8e8e" barSize={4} radius={[2, 2, 0, 0]} />
                                <Area yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue (₹)" fill="url(#revenueGrad)" stroke="#4b5563" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#4b5563', stroke: '#fff', strokeWidth: 2 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right Column: Visit Site & Top Sellers */}
                <div className="lg:col-span-4 flex flex-col gap-5 relative min-h-0 pr-1">
                    {/* Visit Site */}
                    {/* Visit Site styled as Insights Card */}
                    <div className="bg-[#4638d9] rounded-[16px] p-6 flex flex-col justify-between relative overflow-hidden flex-shrink-0 cursor-pointer hover:bg-[#3f32c3] transition-colors min-h-[160px] shadow-[0_4px_12px_-4px_rgba(70,56,217,0.4)] group" onClick={(e) => { e.stopPropagation(); window.open('/', '_blank'); }}>
                        {/* Decorative background stars */}
                        <div className="absolute -bottom-16 -right-12 opacity-[0.08] transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
                            <svg width="200" height="200" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                            </svg>
                        </div>
                        <div className="absolute top-4 -right-4 opacity-[0.05] rotate-45 transform group-hover:rotate-90 transition-transform duration-700">
                            <svg width="100" height="100" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                            </svg>
                        </div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center gap-2.5 mb-5">
                                <Globe size={14} className="text-white" />
                                <span className="text-[12px] font-black text-white uppercase tracking-widest">Your Website</span>
                            </div>
                            <p className="text-[17px] font-bold text-white/95 leading-snug mb-6">
                                See exactly how your menu looks to your customers right now.
                            </p>
                            
                            <div className="mt-auto flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
                                <span className="text-[12px] font-black uppercase tracking-widest leading-none mt-0.5">Open Website</span>
                                <ArrowRight size={13} strokeWidth={3} />
                            </div>
                        </div>
                    </div>

                    {/* Top Sellers */}
                    <div className="bg-white rounded-[16px] p-6 flex-1 flex flex-col min-h-0 relative border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h4 className="text-[13px] font-extrabold text-[#111827]">Top Sellers</h4>
                            <span className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest cursor-pointer hover:text-gray-900 transition-colors">VIEW ALL</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-5 pr-1 no-scrollbar">
                            {topItems.length === 0 ? (
                                <p className="text-[13px] text-gray-400 font-medium text-center py-6">No sales data yet.</p>
                            ) : (
                                topItems.map((item, i) => {
                                    const productDetail = products.find(p => p.name === item.name);
                                    const estRevenue = (productDetail?.price || 0) * item.count;
                                    return (
                                        <div key={item.name} className="flex items-center gap-4 group">
                                            <div className="w-[48px] h-[48px] rounded-[10px] bg-slate-100 overflow-hidden flex-shrink-0 shadow-sm border border-gray-200/50">
                                                {productDetail?.imageURL ? (
                                                    <img src={productDetail.imageURL} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">🍽</div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                                                <div>
                                                    <h5 className="text-[13px] font-extrabold text-[#111827] group-hover:text-blue-600 transition-colors leading-tight mb-1 truncate">{item.name}</h5>
                                                    <p className="text-[11px] font-medium text-gray-400">{item.count} units sold</p>
                                                </div>
                                                <div className="text-[14px] font-bold text-gray-600">
                                                    ₹{estRevenue.toFixed(0)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

// Keeping the KPICard function for reference but it's not used in this layout
function KPICard() { return null; }
