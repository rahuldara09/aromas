'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
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
        const email = sessionStorage.getItem('vendorEmail');
        setVendorEmail(email);
        setIsCheckingSession(false);
    }, []);

    const handleLoginSuccess = (email: string) => {
        setVendorEmail(email);
    };

    const handleSignOut = async () => {
        sessionStorage.removeItem('isVendorVerified');
        sessionStorage.removeItem('vendorEmail');
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
        <div className="flex h-screen bg-[#f8f9fc] overflow-hidden font-sans text-gray-900 transition-colors" onClick={unlockAudio}>

            {/* ═══ MOBILE DRAWER OVERLAY ═══ */}
            {mobileDrawerOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setMobileDrawerOpen(false)}
                />
            )}

            {/* ═══ MOBILE SLIDE-IN DRAWER ═══ */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#fafafa] border-r border-gray-100 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Drawer Header */}
                <div className="h-24 flex items-center justify-between px-6 border-b border-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 shadow-sm overflow-hidden bg-white border border-gray-100">
                            <Image src="/favicon.png" alt="Aromas Logo" width={40} height={40} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col justify-center whitespace-nowrap overflow-hidden text-left">
                            <span className="font-bold text-[18px] tracking-tight text-slate-900 leading-none mb-1">
                                Aromas
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase leading-none">
                                VENDOR DASHBOARD
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => setMobileDrawerOpen(false)}
                        className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        <XIcon size={18} />
                    </button>
                </div>

                {/* Store Toggle in drawer */}
                <div className="px-4 py-3 border-b border-gray-100">
                    <button onClick={(e) => { e.stopPropagation(); toggleStore(); }} className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-extrabold text-[12px] uppercase tracking-wider transition-colors border ${isStoreOpen ? 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-red-600' : 'bg-gray-400'}`} />
                        {isStoreOpen ? 'Accepting Orders' : 'Store Closed'}
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-3 py-6 space-y-2">
                    {navItems.map(item => (
                        <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={item.active} badge={item.badge} collapsed={false} />
                    ))}
                </nav>

                {/* Sign Out */}
                <div className="p-4 space-y-4 mt-auto mb-4 border-t border-gray-100">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-2.5 w-full text-[15px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                        <LogOut size={20} className="text-[#d92d20]" />
                        Logout
                    </button>

                    <div className="flex items-center gap-3 px-4 py-2 mt-2">
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-gray-200 bg-gray-100">
                            {/* Generic Chef Picture Placeholder */}
                            <img src="https://images.unsplash.com/photo-1583394838336-acd977736f90?w=100&h=100&fit=crop" alt="Marcus Vane" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-bold text-[14px] text-slate-900 truncate">Marcus Vane</span>
                            <span className="text-[12px] text-slate-500 truncate">Executive Chef</span>
                        </div>
                    </div>
                </div>
            </aside>

            <aside className={`hidden lg:flex ${sidebarOpen ? 'w-64' : 'w-20'} bg-[#fafafa] border-r border-gray-100 flex-col flex-shrink-0 z-20 transition-all duration-300 ease-in-out`}>
                {/* Logo Area */}
                <div className="h-28 flex items-center px-6 min-w-0 border-b border-transparent">
                    <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 shadow-sm transition-all duration-300 overflow-hidden bg-white border border-gray-100 ${!sidebarOpen ? 'hover:scale-105 cursor-pointer' : ''}`} onClick={() => !sidebarOpen && setSidebarOpen(true)} title={!sidebarOpen ? "Expand Sidebar" : ""}>
                        <Image src="/favicon.png" alt="Aromas Logo" width={40} height={40} className="w-full h-full object-cover" />
                    </div>
                    {sidebarOpen && (
                        <>
                            <div className="ml-3 flex flex-col justify-center whitespace-nowrap overflow-hidden text-left flex-1">
                                <span className="font-bold text-[18px] tracking-tight text-slate-900 leading-none mb-1">
                                    Aromas
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase leading-none">
                                    VENDOR DASHBOARD
                                </span>
                            </div>
                            <button onClick={() => setSidebarOpen(false)} className="p-1.5 -mr-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors bg-white border border-transparent hover:border-slate-200" title="Collapse Sidebar">
                                <PanelLeftClose size={18} />
                            </button>
                        </>
                    )}
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-3 py-6 space-y-2">
                    {navItems.map(item => (
                        <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={item.active} badge={item.badge} collapsed={!sidebarOpen} />
                    ))}
                </nav>

                {/* Bottom Logout Profile Section */}
                <div className="p-4 space-y-4 mt-auto mb-4">
                    <button
                        onClick={handleSignOut}
                        className={`flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-2.5 w-full text-[15px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors`}
                        title="Sign Out"
                    >
                        <LogOut size={20} className="text-[#d92d20]" />
                        {sidebarOpen && 'Logout'}
                    </button>
                    </div>
            </aside>

            {/* ═══ MAIN CONTENT AREA ═══ */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

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
                <header className="hidden lg:flex h-16 bg-[#f8f9fc] items-center justify-between px-8 flex-shrink-0 z-10 w-full overflow-hidden">
                    <div className="flex items-center flex-1 gap-8">
                        {/* Search Bar */}
                        <div className="relative flex items-center w-72 bg-indigo-50/50 rounded-lg px-4 py-2 border border-indigo-50/50">
                            <Search size={16} className="text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Search inventory..." 
                                className="bg-transparent border-none outline-none ml-2 text-sm w-full text-gray-600 placeholder:text-gray-400 font-medium" 
                            />
                        </div>

                        {/* Top Nav Links */}
                        <div className="hidden xl:flex items-center gap-6 text-[12px] font-extrabold uppercase tracking-wider">
                            <div className="flex flex-col items-start gap-0.5">
                                <span className="text-[10px] text-gray-400 font-bold">SALES (TODAY)</span>
                                <span className="text-[#0f172a] text-[15px]">₹{todaysSales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="w-px h-8 bg-gray-200"></div>
                            <div className="flex flex-col items-start gap-0.5">
                                <span className="text-[10px] text-gray-400 font-bold">ACTIVE ORDERS</span>
                                <span className="text-[#0f172a] text-[15px]">{activeOrdersCount}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-5 xl:gap-6 shrink-0">
                        {/* Store Status Indicator */}
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${isStoreOpen ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`}></div>
                            <span className={`text-[12px] font-black uppercase tracking-widest ${isStoreOpen ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isStoreOpen ? 'Accepting Orders' : 'Store Closed'}
                            </span>
                        </div>

                        {/* Printer Status */}
                        <div className="flex items-center" title={isPrinterConnected ? 'Thermal Printer Connected' : 'QZ Tray Offline'}>
                            {isPrinterConnected ? (
                                <div className="p-2 text-emerald-500 bg-emerald-50 rounded-xl transition-colors">
                                    <Printer size={18} />
                                </div>
                            ) : (
                                <div className="p-2 text-red-500 bg-red-50 rounded-xl animate-pulse transition-colors relative">
                                    <MonitorOff size={18} />
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Notifications */}
                        <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors">
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-sm border-2 border-[#f8f9fc]">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
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
            className={`relative flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 mx-2 rounded-[12px] transition-all ${active
                ? 'bg-[#f1f5f9] text-slate-900 font-bold'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
        >
            <span className={active ? 'text-slate-900' : 'text-slate-500'}>{icon}</span>
            {!collapsed && <span className="text-[15px] tracking-normal">{label}</span>}
            {!collapsed && badge && (
                <span className="ml-auto bg-slate-200 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                    {badge}
                </span>
            )}
            {collapsed && badge && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#9B1B30] rounded-full" />
            )}
        </Link>
    );
}

