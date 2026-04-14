'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { VendorProvider, useVendor } from '@/contexts/VendorContext';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { auth } from '@/lib/firebase';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { VendorLoginModal } from '@/components/vendor/StepUpAuthModal';
import {
    Store,
    LayoutGrid,
    ReceiptText,
    Archive,
    Menu as MenuIcon,
    Settings,
    LogOut,
    Bell,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Printer,
    MonitorOff,
    TrendingUp,
    Timer,
    Activity,
    Search,
    UtensilsCrossed,
    X as XIcon,
    Home,
    ShoppingCart,
    Wine,
    ClipboardList,
    Utensils,
    PanelLeftClose,
    Globe,
    ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { Order } from '@/types';

// ─── MAIN LAYOUT WRAPPER ─────────────────────────────────────────
export default function VendorLayout({ children }: { children: React.ReactNode }) {
    return (
        <VendorProvider>
            <Script src="/qz-tray.js" strategy="beforeInteractive" />
            <VendorLayoutInner>{children}</VendorLayoutInner>
        </VendorProvider>
    );
}

// ─── INNER LAYOUT (Has access to Context) ────────────────────────
function VendorLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { isStoreOpen, toggleStore, unlockAudio, orders } = useVendor();
    const { isConnected: isPrinterConnected } = useThermalPrinter();

    const activeCount = orders.filter(o => ['Placed', 'Pending', 'Preparing'].includes(o.status)).length;
    useEffect(() => {
        document.title = activeCount > 0 ? `(${activeCount}) Aroma Ops` : 'Aroma Ops';
    }, [activeCount]);

    const activeOrdersCount = activeCount;
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [seenOrderIds, setSeenOrderIds] = useState<string[]>([]);
    const notificationRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (!notificationRef.current) return;
            if (!notificationRef.current.contains(event.target as Node)) setNotificationsOpen(false);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    // ── DESKTOP SIDEBAR COLLAPSE STATE ─────────────────────────────────────
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // ── MOBILE DRAWER STATE ─────────────────────────────────────────────────
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    useEffect(() => { setMobileDrawerOpen(false); }, [pathname]);

    // ── VENDOR EMAIL SESSION ────────────────────────────────────────────────
    // We gate on sessionStorage.vendorEmail (set after OTP verification).
    // No client-login required — vendor portal is fully standalone.
    const [vendorEmail, setVendorEmail] = useState<string | null>(null);
    const [isCheckingSession, setIsCheckingSession] = useState(true);

    useEffect(() => {
        const email = localStorage.getItem('vendorEmail');
        const expiry = localStorage.getItem('vendorSessionExpiry');
        if (email && expiry && Date.now() < Number(expiry)) {
            setVendorEmail(email);
        } else {
            // Session expired or missing — clear stale data
            localStorage.removeItem('vendorEmail');
            localStorage.removeItem('vendorSessionExpiry');
        }
        setIsCheckingSession(false);
    }, []);

    const handleLoginSuccess = (email: string) => {
        setVendorEmail(email);
    };

    const handleSignOut = async () => {
        localStorage.removeItem('vendorEmail');
        localStorage.removeItem('vendorSessionExpiry');
        await firebaseSignOut(auth);
        router.push('/');
    };

    // Loading spinner while checking session
    if (isCheckingSession) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Show standalone email+OTP login if not authenticated
    if (!vendorEmail) {
        return (
            <VendorLoginModal
                onSuccess={handleLoginSuccess}
                onSignOut={handleSignOut}
            />
        );
    }

    const unreadCount = orders.filter(o => o.status === 'Placed' || o.status === 'Pending').length;
    const onlineNewOrders = orders
        .filter(o => (o.status === 'Placed' || o.status === 'Pending') && o.orderType !== 'pos')
        .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    const unseenOnlineCount = onlineNewOrders.filter(o => !seenOrderIds.includes(o.id)).length;
    const todayDateStr = new Date().toDateString();
    const todaysSales = orders
        .filter(o => o.status !== 'Cancelled' && new Date(o.orderDate).toDateString() === todayDateStr)
        .reduce((sum, o) => sum + o.grandTotal, 0);


    const navItems = [
        { href: '/vendor', icon: <LayoutGrid size={20} strokeWidth={2.5} />, label: 'Dashboard', active: pathname === '/vendor' },
        { href: '/vendor/orders', icon: <ShoppingCart size={20} strokeWidth={2.5} />, label: 'Orders', active: pathname === '/vendor/orders', badge: unreadCount > 0 ? unreadCount : undefined },
        { href: '/vendor/menu', icon: <Archive size={20} strokeWidth={2.5} />, label: 'Inventory', active: pathname === '/vendor/menu' },
        { href: '/vendor/analytics', icon: <Activity size={20} strokeWidth={2.5} />, label: 'Analytics', active: pathname === '/vendor/analytics' },
        { href: '/vendor/settings', icon: <Settings size={20} strokeWidth={2.5} />, label: 'Settings', active: pathname === '/vendor/settings' },
    ];

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-gray-900 transition-colors" onClick={unlockAudio}>

            {/* ═══ MOBILE DRAWER OVERLAY ═══ */}
            {mobileDrawerOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setMobileDrawerOpen(false)}
                />
            )}

            {/* ═══ MOBILE SLIDE-IN DRAWER ═══ */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#f7f8fc] border-r border-slate-200 shadow-[0_8px_30px_rgba(15,23,42,0.10)] flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Drawer Header */}
                <div className="h-24 flex items-center justify-between px-6">
                    <div className="flex items-center">
                        <span className="font-extrabold text-[28px] tracking-tight text-slate-900 leading-none lowercase">
                            aromas
                        </span>
                    </div>
                    <button
                        onClick={() => setMobileDrawerOpen(false)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
                    >
                        <XIcon size={18} />
                    </button>
                </div>

                {/* Store Toggle in drawer */}
                <div className="px-4 py-3 border-b border-slate-200/70">
                    <button onClick={(e) => { e.stopPropagation(); toggleStore(); }} className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-[12px] uppercase tracking-[0.08em] transition-colors ${isStoreOpen ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-indigo-600' : 'bg-slate-400'}`} />
                        {isStoreOpen ? 'Accepting Orders' : 'Store Closed'}
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {navItems.map(item => (
                        <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={item.active} badge={item.badge} collapsed={false} />
                    ))}
                </nav>

                {/* Sign Out */}
                <div className="p-4 mt-auto border-t border-slate-200/70">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-2.5 w-full text-[14px] font-medium text-slate-500 hover:text-slate-900 hover:bg-white/80 rounded-xl transition-colors"
                    >
                        <LogOut size={18} className="text-indigo-500" />
                        Logout
                    </button>
                </div>
            </aside>

            <aside className={`hidden lg:flex ${sidebarOpen ? 'w-64' : 'w-[76px]'} bg-[#f7f8fc] border-r border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.08)] flex-col flex-shrink-0 z-20 transition-all duration-300 ease-in-out`}>
                {/* Logo Area */}
                <div className="h-28 flex items-center px-5 min-w-0">
                    <div
                        className={`${!sidebarOpen ? 'hover:scale-105 cursor-pointer' : ''} transition-all duration-300`}
                        onClick={() => !sidebarOpen && setSidebarOpen(true)}
                        title={!sidebarOpen ? "Expand Sidebar" : ""}
                    >
                        <span className={`${sidebarOpen ? 'text-[28px]' : 'text-[18px]'} font-extrabold tracking-tight text-slate-900 leading-none lowercase`}>
                            aromas
                        </span>
                    </div>
                    {sidebarOpen && (
                        <>
                            <div className="flex-1" />
                            <button onClick={() => setSidebarOpen(false)} className="p-1.5 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-lg transition-colors" title="Collapse Sidebar">
                                <PanelLeftClose size={18} />
                            </button>
                        </>
                    )}
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-3 py-2 space-y-1">
                    {navItems.map(item => (
                        <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={item.active} badge={item.badge} collapsed={!sidebarOpen} />
                    ))}
                </nav>

                {/* Bottom Logout Section */}
                <div className="p-3 mt-auto border-t border-slate-200/70">
                    <button
                        onClick={handleSignOut}
                        className={`flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-2.5 w-full text-[14px] font-medium text-slate-500 hover:text-slate-900 hover:bg-white/80 rounded-xl transition-colors`}
                        title="Sign Out"
                    >
                        <LogOut size={18} className="text-indigo-500" />
                        {sidebarOpen && 'Logout'}
                    </button>
                </div>
            </aside>

            {/* ═══ MAIN CONTENT AREA ═══ */}
            <main className="flex-1 flex flex-col min-w-0 overflow-visible">

                {/* ── MOBILE HEADER ── */}
                <header className="lg:hidden h-14 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 flex items-center justify-between px-4 flex-shrink-0 z-10">
                    {/* Hamburger */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setMobileDrawerOpen(true); }}
                        className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Open menu"
                    >
                        <MenuIcon size={22} />
                    </button>

                    {/* Logo center */}
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-sm">
                            <Store size={15} />
                        </div>
                        <span className="font-extrabold text-[15px] tracking-tight">AROMA OPS</span>
                    </div>

                    {/* Right: Bell */}
                    <div className="flex items-center gap-1">
                        <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0 -right-0 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-sm border-2 border-white">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    </div>
                </header>

                {/* ── DESKTOP HEADER ── */}
                <header className="hidden lg:flex h-[62px] bg-white border-b border-slate-200 items-center justify-between px-5 xl:px-6 flex-shrink-0 z-10 w-full overflow-visible">
                    <div className="flex items-center flex-1 gap-3">
                        {/* Search Bar */}
                        <div className="relative flex items-center w-64 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200">
                            <Search size={14} className="text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search inventory..." 
                                className="bg-transparent border-none outline-none ml-2 text-[13px] w-full text-slate-700 placeholder:text-slate-400 font-medium" 
                            />
                        </div>

                        {/* Top Nav Links */}
                        <div className="hidden xl:flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider">
                            <div className="flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 min-w-[96px]">
                                <span className="text-[10px] text-gray-400 font-bold">SALES (TODAY)</span>
                                <span className="text-[#0f172a] text-[14px]">₹{todaysSales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 min-w-[96px]">
                                <span className="text-[10px] text-gray-400 font-bold">ACTIVE ORDERS</span>
                                <span className="text-[#0f172a] text-[14px]">{activeOrdersCount}</span>
                            </div>
                        </div>
                    </div>

                    <div ref={notificationRef} className="flex items-center gap-1.5 shrink-0 relative">
                        {/* Visit Site Button */}
                        <Link href="/" target="_blank" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                            <Globe size={13} className="text-slate-500" />
                            Visit Site
                            <ArrowUpRight size={13} className="text-slate-400 ml-0.5" />
                        </Link>

                        {/* Store Status Indicator */}
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                            isStoreOpen
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                            <span className="text-[12px] font-semibold tracking-wide">
                                {isStoreOpen ? 'Accepting orders' : 'Store closed'}
                            </span>
                        </div>

                        {/* Printer Status */}
                        <div className="flex items-center ml-1" title={isPrinterConnected ? 'Thermal Printer Connected' : 'QZ Tray Offline'}>
                            {isPrinterConnected ? (
                                <div className="p-1.5 text-emerald-500 bg-emerald-50 rounded-lg border border-emerald-100 transition-colors">
                                    <Printer size={16} />
                                </div>
                            ) : (
                                <div className="p-1.5 text-red-500 bg-red-50 rounded-lg border border-red-100 animate-pulse transition-colors relative">
                                    <MonitorOff size={16} />
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Notifications */}
                        <button
                            onClick={() => setNotificationsOpen(prev => !prev)}
                            className="relative p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
                        >
                            <Bell size={18} />
                            {unseenOnlineCount > 0 && (
                                <span className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-sm border-2 border-[#f8f9fc]">
                                    {unseenOnlineCount}
                                </span>
                            )}
                        </button>
                        {notificationsOpen && (
                            <div className="fixed top-[70px] right-5 w-[360px] bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.2)] p-3 z-[999]">
                                <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100">
                                    <p className="text-sm font-bold text-slate-900">Online order notifications</p>
                                    <button
                                        onClick={() => setSeenOrderIds(onlineNewOrders.map(o => o.id))}
                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                                    >
                                        Mark all seen
                                    </button>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto mt-2 space-y-2">
                                    {onlineNewOrders.length === 0 ? (
                                        <div className="py-6 text-center text-sm text-slate-500">No new online orders</div>
                                    ) : onlineNewOrders.map(order => {
                                        const isSeen = seenOrderIds.includes(order.id);
                                        return (
                                            <div key={order.id} className={`rounded-xl border px-3 py-2 ${isSeen ? 'bg-slate-50 border-slate-200' : 'bg-indigo-50/70 border-indigo-200 shadow-sm'}`}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">#{order.orderToken || order.id.slice(0, 6).toUpperCase()} · {order.deliveryAddress?.name || 'Guest'}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            ₹{order.grandTotal} · {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setSeenOrderIds(prev => prev.includes(order.id) ? prev.filter(id => id !== order.id) : [...prev, order.id]);
                                                        }}
                                                        className={`text-[11px] font-bold px-2 py-1 rounded-md ${isSeen ? 'bg-white border border-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}
                                                    >
                                                        {isSeen ? 'Seen' : 'Unseen'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

// ─── UTILS & SUB-COMPONENTS ──────────────────────────────────────
function NavItem({
    href, icon, label, active, badge, collapsed
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    active: boolean;
    badge?: number;
    collapsed: boolean;
}) {
    return (
        <Link
            href={href}
            title={collapsed ? label : undefined}
            className={`relative flex items-center ${
                collapsed ? 'justify-center px-0 mx-1.5' : 'gap-3 px-4 mx-0'
            } py-3 rounded-xl transition-all ${
                active
                    ? 'text-[#0b69c7] font-semibold bg-[#dbe8f6]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 font-medium'
            }`}
        >
            {/* Active left-border indicator */}
            {active && !collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[#4e6cf6]" />
            )}
            <span className={active ? 'text-[#0b69c7]' : 'text-slate-500'}>{icon}</span>
            {!collapsed && <span className="text-[15px] tracking-tight pl-1">{label}</span>}
            {!collapsed && badge && (
                <span className="ml-auto bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                    {badge}
                </span>
            )}
            {collapsed && badge && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full" />
            )}
        </Link>
    );
}

