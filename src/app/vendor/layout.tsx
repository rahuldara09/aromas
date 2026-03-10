'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { VendorProvider, useVendor } from '@/contexts/VendorContext';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { saveSessionPhone } from '@/lib/auth';
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

    useEffect(() => {
        if (authLoading) return;
        if (!user || !phoneNumber) {
            setIsVendor(false);
            return;
        }
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
    }, [user, phoneNumber, authLoading, router]);

    // Loading spinner
    if (authLoading || (isLoggedIn && isVendor === null)) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // ── NOT A VENDOR → error screen ──────────────────────────────────────────
    if (!isVendor) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-red-50 gap-6 p-8">
                <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-8 max-w-md w-full text-center space-y-5">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shadow">
                            <Store size={20} />
                        </div>
                        <span className="font-extrabold text-xl tracking-tight text-gray-900">AROMA OPS</span>
                    </div>

                    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                        <span className="text-2xl">🔒</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Vendor Access Required</h2>
                    <p className="text-sm text-gray-500">
                        {user
                            ? 'Your account is not registered as a vendor.'
                            : 'Sign in with your registered phone number to access the vendor portal.'}
                    </p>

                    {vendorError && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
                            <p className="text-xs font-bold text-amber-700 mb-1">⚠ Debug Info</p>
                            <p className="text-xs text-amber-700 font-mono break-all">{vendorError}</p>
                        </div>
                    )}

                    {!user ? (
                        <VendorLoginForm />
                    ) : (
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                            >
                                Retry After Creating Document
                            </button>
                            <button
                                onClick={async () => { await signOut(); router.push('/'); }}
                                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const unreadCount = orders.filter(o => o.status === 'Placed' || o.status === 'Pending').length;
    const today = new Date().toDateString();
    const activeCount = orders.filter(o => ['Placed', 'Pending', 'Preparing'].includes(o.status)).length;
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
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors" onClick={unlockAudio}>

            {/* ═══ MOBILE DRAWER OVERLAY ═══ */}
            {mobileDrawerOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setMobileDrawerOpen(false)}
                />
            )}

            {/* ═══ MOBILE SLIDE-IN DRAWER ═══ */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Drawer Header */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center shadow-sm">
                            <Store size={18} />
                        </div>
                        <span className="font-extrabold text-[17px] tracking-tight dark:text-gray-100">AROMA OPS</span>
                    </div>
                    <button
                        onClick={() => setMobileDrawerOpen(false)}
                        className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        <XIcon size={18} />
                    </button>
                </div>

                {/* Store Toggle in drawer */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <span className={`text-sm font-extrabold ${isStoreOpen ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {isStoreOpen ? 'Accepting Orders' : 'Store Closed'}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleStore(); }}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none shadow-inner ${isStoreOpen ? 'bg-emerald-500' : 'bg-gray-300'}`}
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
                            className={`relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${item.active
                                ? 'bg-red-50 text-red-600 font-bold'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-semibold'
                                }`}
                        >
                            <span className={item.active ? 'text-red-500' : 'text-gray-400'}>{item.icon}</span>
                            {item.label}
                            {item.badge && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                                    {item.badge}
                                </span>
                            )}
                            {item.active && <span className="absolute left-0 w-1 h-8 bg-red-500 rounded-r-full" />}
                        </Link>
                    ))}
                </nav>

                {/* Sign Out */}
                <div className="p-3 border-t border-gray-100 dark:border-gray-800">
                    <button
                        onClick={async (e) => { e.stopPropagation(); await signOut(); router.push('/'); }}
                        className="flex items-center gap-3 px-4 py-3 w-full text-sm font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                        <LogOut size={20} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ═══ DESKTOP SIDEBAR ═══ */}
            <aside className={`hidden lg:flex ${sidebarOpen ? 'w-48' : 'w-16'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-col flex-shrink-0 z-20 transition-all duration-300 ease-in-out overflow-hidden`}>
                {/* Logo Area */}
                <div className="h-16 flex items-center px-4 border-b border-gray-100 dark:border-gray-800 transition-colors min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                        <Store size={18} />
                    </div>
                    {sidebarOpen && (
                        <span className="ml-3 font-extrabold text-[17px] tracking-tight dark:text-gray-100 whitespace-nowrap overflow-hidden">
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
                <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); setSidebarOpen(v => !v); }}
                        className="flex items-center justify-center w-full p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <button
                        onClick={async (e) => { e.stopPropagation(); await signOut(); router.push('/'); }}
                        className={`flex items-center ${sidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2.5 w-full text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors`}
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
                <header className="lg:hidden h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 flex-shrink-0 z-10">
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
                        <div className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center shadow-sm">
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
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-sm">
                            AV
                        </div>
                    </div>
                </header>

                {/* ── DESKTOP HEADER ── */}
                <header className="hidden lg:flex h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 items-center justify-between px-6 flex-shrink-0 z-10 w-full overflow-hidden transition-colors">
                    <div className="flex items-center gap-6 xl:gap-10">
                        <h1 className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100 whitespace-nowrap">
                            Hello, <span className="text-gray-900 dark:text-white font-extrabold">Aroma Vendor</span>
                        </h1>

                        {/* HUD METRICS */}
                        <div className="hidden xl:flex items-center gap-6 h-8 pl-6 border-l border-gray-200 dark:border-gray-800 transition-colors">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <TrendingUp size={16} className="text-emerald-500" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase leading-none">Today&apos;s Sales</span>
                                    <span className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight">₹{todaysSales.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <Activity size={16} className="text-blue-500 dark:text-blue-400" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase leading-none">Active Orders</span>
                                    <span className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight">{activeCount}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <Timer size={16} className="text-amber-500 dark:text-amber-400" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase leading-none">Avg Prep Time</span>
                                    <span className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight">12m</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 xl:gap-6">
                        {/* Store Toggle */}
                        <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-full transition-colors">
                            <span className={`text-sm font-extrabold ${isStoreOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {isStoreOpen ? 'Accepting Orders' : 'Store Closed'}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleStore(); }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-inner ${isStoreOpen ? 'bg-emerald-500' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isStoreOpen ? 'translate-x-[22px]' : 'translate-x-[4px]'}`} />
                            </button>
                        </div>

                        {/* Printer Status */}
                        <div className="flex items-center" title={isPrinterConnected ? 'Thermal Printer Connected' : 'QZ Tray Offline / Disconnected'}>
                            {isPrinterConnected ? (
                                <div className="p-2 text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-full transition-colors">
                                    <Printer size={18} />
                                </div>
                            ) : (
                                <div className="p-2 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-full animate-pulse transition-colors">
                                    <MonitorOff size={18} />
                                </div>
                            )}
                        </div>

                        {/* Notifications */}
                        <button className="relative p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            <Bell size={22} />
                            {unreadCount > 0 && <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900" />}
                        </button>

                        {/* Avatar */}
                        <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1.5 pr-2 rounded-full border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-sm">
                                AV
                            </div>
                            <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />
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
            className={`relative flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${active
                ? 'bg-red-50 text-red-600 font-bold'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-semibold'
                }`}
        >
            <span className={active ? 'text-red-500' : 'text-gray-400'}>{icon}</span>
            {!collapsed && label}
            {!collapsed && badge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                    {badge}
                </span>
            )}
            {collapsed && badge && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
            {active && !collapsed && <span className="absolute left-0 w-1 h-8 bg-red-500 rounded-r-full" />}
        </Link>
    );
}

function VendorLoginForm() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const pseudoEmail = `${phone}@super.aromadhaba.com`;
            await signInWithEmailAndPassword(auth, pseudoEmail, password);
            saveSessionPhone(`+91${phone}`); // Important for the API routes
            window.location.reload(); // Force reload to re-read context
        } catch (err: any) {
            setError(err.message || 'Invalid credentials');
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleLogin} className="flex flex-col gap-4 text-left">
            {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-200">{error}</div>}

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Phone Number</label>
                <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9001565305"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 placeholder:text-gray-400 text-gray-900"
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 placeholder:text-gray-400 text-gray-900"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-gray-900 hover:bg-black text-white font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center disabled:opacity-50"
            >
                {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sign In as Admin'}
            </button>
        </form>
    );
}
