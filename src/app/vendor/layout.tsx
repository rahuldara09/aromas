'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { VendorProvider, useVendor } from '@/contexts/VendorContext';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { saveSessionPhone } from '@/lib/auth';
import { StepUpAuthModal } from '@/components/vendor/StepUpAuthModal';
import {
    Store,
    LayoutDashboard,
    LayoutList,
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
    X as XIcon,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Order } from '@/types';

// ─── MAIN LAYOUT WRAPPER ─────────────────────────────────────────
export default function VendorLayout({ children }: { children: React.ReactNode }) {
    return (
        <VendorProvider>
            <VendorLayoutInner>{children}</VendorLayoutInner>
        </VendorProvider>
    );
}

// ─── INNER LAYOUT (Has access to Context) ────────────────────────
function VendorLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, signOut, loading: authLoading, phoneNumber, isLoggedIn } = useAuth();
    const { isStoreOpen, toggleStore, unlockAudio, orders } = useVendor();
    const { isConnected: isPrinterConnected } = useThermalPrinter();

    const activeCount = orders.filter(o => ['Placed', 'Pending', 'Preparing'].includes(o.status)).length;
    useEffect(() => {
        if (activeCount > 0) {
            document.title = `(${activeCount}) Aroma Ops`;
        } else {
            document.title = 'Aroma Ops';
        }
    }, [activeCount]);

    // ── DESKTOP SIDEBAR COLLAPSE STATE ────────────────────────────────────────
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // ── MOBILE DRAWER STATE ───────────────────────────────────────────────────
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

    // Close mobile drawer on route change
    useEffect(() => {
        setMobileDrawerOpen(false);
    }, [pathname]);

    // ── VENDOR ROLE CHECK ─────────────────────────────────────────────────────
    const [isVendor, setIsVendor] = useState<boolean | null>(null);
    const [vendorError, setVendorError] = useState<string | null>(null);
    const [isVendorVerified, setIsVendorVerified] = useState<boolean>(false);
    const [isCheckingSession, setIsCheckingSession] = useState(true);

    useEffect(() => {
        setIsVendorVerified(sessionStorage.getItem('isVendorVerified') === 'true');
        setIsCheckingSession(false);
    }, []);

    const handleStepUpSuccess = useCallback(() => {
        setIsVendorVerified(true);
    }, []);

    const handleSignOut = async () => {
        sessionStorage.removeItem('isVendorVerified');
        await signOut();
        router.push('/');
    };

    // Redirect unauthenticated users
    useEffect(() => {
        if (!authLoading && (!user || !phoneNumber)) {
            router.push('/');
        }
    }, [user, phoneNumber, authLoading, router]);

    useEffect(() => {
        if (authLoading || !user || !phoneNumber) return;
        
        const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
        getDoc(doc(db, 'vendors', formattedPhone)).then((snap) => {
            if (snap.exists() && snap.data().isVendor === true) {
                setIsVendor(true);
            } else {
                setVendorError(snap.exists()
                    ? 'Document found but isVendor field is not true.'
                    : `No vendor doc at vendors/${formattedPhone}. Create it in Firebase Console.`);
                setIsVendor(false);
            }
        }).catch((err: { code?: string; message?: string }) => {
            setVendorError(`Firestore error: ${err?.code ?? err?.message ?? 'permission-denied'}.`);
            setIsVendor(false);
        });
    }, [user, phoneNumber, authLoading]);

    // Loading spinner
    if (authLoading || isCheckingSession || !user || !phoneNumber || isVendor === null) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Show Step Up Modal if not verified
    if (!isVendorVerified) {
        return (
            <StepUpAuthModal 
                onSuccess={handleStepUpSuccess} 
                onSignOut={handleSignOut} 
                initialPhone={phoneNumber || ''} 
            />
        );
    }

    // ── NOT A VENDOR → error screen ──────────────────────────────────────────
    if (!isVendor) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-red-50 gap-6 p-8">
                <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-8 max-w-md w-full text-center space-y-5">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shadow shrink-0">
                            <Image src="/icon.png" alt="Aromas Logo" width={40} height={40} className="w-full h-full object-cover" />
                        </div>
                        <span className="font-extrabold text-xl tracking-tight text-gray-900">AROMA OPS</span>
                    </div>

                    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                        <span className="text-2xl">🔒</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
                    <p className="text-sm text-gray-500">
                        Your account is not registered as a vendor.
                    </p>

                    {vendorError && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
                            <p className="text-xs font-bold text-amber-700 mb-1">⚠ Debug Info</p>
                            <p className="text-xs text-amber-700 font-mono break-all">{vendorError}</p>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                        >
                            Retry After Creating Document
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const unreadCount = orders.filter(o => o.status === 'Placed' || o.status === 'Pending').length;
    const today = new Date().toDateString();
    const todaysSales = orders
        .filter(o => o.status !== 'Cancelled' && new Date(o.orderDate).toDateString() === today)
        .reduce((sum, o) => sum + o.grandTotal, 0);


    const navItems = [
        { href: '/vendor', icon: <LayoutDashboard size={20} />, label: 'Home', active: pathname === '/vendor' },
        { href: '/vendor/orders', icon: <LayoutList size={20} />, label: 'Orders', active: pathname === '/vendor/orders', badge: unreadCount > 0 ? unreadCount : undefined },
        { href: '/vendor/menu', icon: <MenuIcon size={20} />, label: 'Menu/Inventory', active: pathname === '/vendor/menu' },
        { href: '/vendor/settings', icon: <Settings size={20} />, label: 'Settings', active: pathname === '/vendor/settings' },
    ];

    return (
        <div className="flex h-screen bg-[#f5f5f7] overflow-hidden font-sans text-gray-900 transition-colors" onClick={unlockAudio}>

            {/* ═══ MOBILE DRAWER OVERLAY ═══ */}
            {mobileDrawerOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setMobileDrawerOpen(false)}
                />
            )}

            {/* ═══ MOBILE SLIDE-IN DRAWER ═══ */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200/60 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Drawer Header */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm shrink-0">
                            <Image src="/icon.png" alt="Aromas Logo" width={32} height={32} className="w-full h-full object-cover" />
                        </div>
                        <span className="font-extrabold text-[17px] tracking-tight text-gray-900">AROMA OPS</span>
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
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                        <span className={`text-sm font-extrabold ${isStoreOpen ? 'text-red-600' : 'text-gray-400'}`}>
                            {isStoreOpen ? 'Accepting Orders' : 'Store Closed'}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleStore(); }}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none shadow-inner ${isStoreOpen ? 'bg-red-500' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isStoreOpen ? 'translate-x-[26px]' : 'translate-x-[4px]'}`} />
                        </button>
                    </div>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-2 py-4 space-y-1">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`relative flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${item.active
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'
                                }`}
                        >
                            <span className={item.active ? 'text-red-600' : 'text-gray-400'}>{item.icon}</span>
                            {item.label}
                            {item.badge && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                                    {item.badge}
                                </span>
                            )}
                            {item.active && <span className="absolute left-0 w-1.5 h-8 bg-red-500 rounded-r-full" />}
                        </Link>
                    ))}
                </nav>

                {/* Sign Out */}
                <div className="p-3 border-t border-gray-100">
                    <button
                        onClick={async (e) => { e.stopPropagation(); sessionStorage.removeItem('isVendorVerified'); await signOut(); router.push('/'); }}
                        className="flex items-center gap-3 px-4 py-3 w-full text-sm font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-colors"
                    >
                        <LogOut size={20} />
                        Sign Out
                    </button>
                </div>
            </aside>

            <aside className={`hidden lg:flex ${sidebarOpen ? 'w-56' : 'w-20'} bg-white/80 backdrop-blur-xl border-r border-gray-200/60 flex-col flex-shrink-0 z-20 transition-all duration-300 ease-in-out`}>
                {/* Logo Area */}
                <div className="h-20 flex items-center px-6 border-b border-gray-100 min-w-0">
                    <div className="w-8 h-8 bg-red-500 text-white rounded-xl flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                        a
                    </div>
                    {sidebarOpen && (
                        <span className="ml-3 font-extrabold text-[17px] tracking-tight text-gray-900 whitespace-nowrap overflow-hidden">
                            AROMA OPS
                        </span>
                    )}
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-2 py-6 space-y-1.5">
                    {navItems.map(item => (
                        <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={item.active} badge={item.badge} collapsed={!sidebarOpen} />
                    ))}
                </nav>

                {/* Collapse Toggle + Logout */}
                <div className="p-4 border-t border-gray-100 space-y-2 mt-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); setSidebarOpen(v => !v); }}
                        className="flex items-center justify-center w-full p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <button
                        onClick={async (e) => { e.stopPropagation(); sessionStorage.removeItem('isVendorVerified'); await signOut(); router.push('/'); }}
                        className={`flex items-center ${sidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2.5 w-full text-sm font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors`}
                        title="Sign Out"
                    >
                        <LogOut size={20} />
                        {sidebarOpen && 'Sign Out'}
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

                    {/* Right: Bell + Avatar */}
                    <div className="flex items-center gap-1">
                        <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                            <Bell size={20} />
                            {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />}
                        </button>
                        <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 font-bold flex items-center justify-center text-sm ring-1 ring-red-200">
                            AV
                        </div>
                    </div>
                </header>

                {/* ── DESKTOP HEADER ── */}
                <header className="hidden lg:flex h-16 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 items-center justify-between px-8 flex-shrink-0 z-10 w-full overflow-hidden">
                    <div className="flex items-center gap-8 xl:gap-12">
                        <h1 className="text-lg font-bold tracking-tight text-gray-800 whitespace-nowrap">
                            Hello, <span className="text-gray-900 font-extrabold">Aroma Vendor</span>
                        </h1>

                        {/* HUD METRICS */}
                        <div className="hidden xl:flex items-center gap-6 pl-8 border-l border-gray-200/60 h-10">
                            <div className="flex items-center gap-2.5 text-gray-600">
                                <div className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
                                    <TrendingUp size={14} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-semibold text-gray-400 tracking-wider uppercase leading-none mb-0.5">Sales</span>
                                    <span className="text-sm font-extrabold text-gray-900 leading-none">₹{todaysSales.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="w-px h-5 bg-gray-200/60" />
                            <div className="flex items-center gap-2.5 text-gray-600">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                                    <Activity size={14} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-semibold text-gray-400 tracking-wider uppercase leading-none mb-0.5">Active</span>
                                    <span className="text-sm font-extrabold text-gray-900 leading-none">{activeCount}</span>
                                </div>
                            </div>
                            <div className="w-px h-5 bg-gray-200/60" />
                            <div className="flex items-center gap-2.5 text-gray-600">
                                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                                    <Timer size={14} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-semibold text-gray-400 tracking-wider uppercase leading-none mb-0.5">Prep</span>
                                    <span className="text-sm font-extrabold text-gray-900 leading-none">12m</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 xl:gap-4">
                        {/* Store Toggle */}
                        <div className={`flex items-center gap-3 px-4 py-2 ${isStoreOpen ? 'bg-red-50' : 'bg-gray-100'} rounded-full transition-colors`}>
                            <span className={`text-sm font-extrabold ${isStoreOpen ? 'text-red-600' : 'text-gray-500'}`}>
                                {isStoreOpen ? 'Accepting Orders' : 'Store Closed'}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleStore(); }}
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none shadow-sm ${isStoreOpen ? 'bg-red-500' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isStoreOpen ? 'translate-x-[26px]' : 'translate-x-[4px]'}`} />
                            </button>
                        </div>

                        {/* Printer Status */}
                        <div className="flex items-center" title={isPrinterConnected ? 'Thermal Printer Connected' : 'QZ Tray Offline / Disconnected'}>
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
                            {unreadCount > 0 && <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />}
                        </button>

                        {/* Avatar */}
                        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 p-1.5 rounded-xl transition-all">
                            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 font-bold flex items-center justify-center text-sm ring-1 ring-red-200">
                                AV
                            </div>
                            <ChevronDown size={14} className="text-gray-400 mr-1" />
                        </div>
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
            className={`relative flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3.5 rounded-2xl transition-all ${active
                ? 'bg-red-50 text-red-700 font-bold'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'
                }`}
        >
            <span className={active ? 'text-red-600' : 'text-gray-400'}>{icon}</span>
            {!collapsed && label}
            {!collapsed && badge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                    {badge}
                </span>
            )}
            {collapsed && badge && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
            {active && !collapsed && <span className="absolute left-0 w-1.5 h-8 bg-red-500 rounded-r-full" />}
        </Link>
    );
}

