'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { VendorProvider, useVendor } from '@/contexts/VendorContext';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import Script from 'next/script';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
    Store,
    LayoutDashboard,
    LayoutList,
    Menu as MenuIcon,
    Settings,
    LogOut,
    Bell,
    ChevronDown,
    MapPin,
    Clock,
    Printer,
    MonitorOff,
    TrendingUp,
    Timer,
    Activity
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
    const { user, signOut, loading: authLoading, phoneNumber } = useAuth();
    const { isStoreOpen, toggleStore, unlockAudio, orders } = useVendor();
    const { isConnected: isPrinterConnected } = useThermalPrinter();

    // ── VENDOR ROLE CHECK ─────────────────────────────────────────────────────
    // null = still checking, false = not a vendor, true = confirmed vendor
    const [isVendor, setIsVendor] = useState<boolean | null>(null);
    const [vendorError, setVendorError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return;
        if (!user || !phoneNumber) {
            setIsVendor(false);
            return;
        }
        // Format phone to match Firestore document ID: +91XXXXXXXXXX
        const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
        // Fetch vendors/{phoneNumber} document to confirm role
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
            setVendorError(`Firestore error: ${err?.code ?? err?.message ?? 'permission-denied'}. Go to Firebase Console → Firestore → Rules and deploy the rules file.`);
            setIsVendor(false);
        });
    }, [user, phoneNumber, authLoading, router]);

    // Show spinner while auth is loading OR while vendor check is pending
    if (authLoading || isVendor === null) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Not a vendor — show access denied with UID so the owner can set up the vendors doc
    if (!isVendor) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gray-50 gap-6 p-8">
                <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-md w-full text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                        <span className="text-2xl">🔒</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Vendor Access Required</h2>
                    <p className="text-sm text-gray-500">
                        {user
                            ? 'Your account is not registered as a vendor. To grant access, create this document in Firebase Firestore:'
                            : 'Please sign in to access the vendor dashboard.'}
                    </p>
                    {vendorError && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
                            <p className="text-xs font-bold text-amber-700 mb-1">⚠ Debug Info</p>
                            <p className="text-xs text-amber-700 font-mono break-all">{vendorError}</p>
                        </div>
                    )}
                    {(user || phoneNumber) && (
                        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Firestore Setup</p>
                            <div className="space-y-1">
                                <p className="text-xs text-gray-500">Collection: <code className="bg-gray-200 px-1 rounded">vendors</code></p>
                                <p className="text-xs text-gray-500">Document ID (your phone number):</p>
                                <code className="block bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-red-600 break-all select-all">
                                    {phoneNumber
                                        ? (phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`)
                                        : 'Sign in first to see your phone number'}
                                </code>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-gray-500">Document fields:</p>
                                <code className="block bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 whitespace-pre">{`{ "isVendor": true }`}</code>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                    >
                        Retry After Creating Document
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        ← Back to Store
                    </button>
                </div>
            </div>
        );
    }

    const unreadCount = orders.filter(o => o.status === 'Placed' || o.status === 'Pending').length;

    // HUD Metrics
    const today = new Date().toDateString();
    const activeCount = orders.filter(o => ['Placed', 'Pending', 'Preparing'].includes(o.status)).length;
    const todaysSales = orders
        .filter(o => o.status !== 'Cancelled' && new Date(o.orderDate).toDateString() === today)
        .reduce((sum, o) => sum + o.grandTotal, 0);

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors" onClick={unlockAudio}>
            {/* QZ Tray: loaded from npm package (qz-tray) — NOT from CDN */}
            {/* import qz from 'qz-tray' is done in useThermalPrinter hook */}


            {/* ═══ LEFT SIDEBAR ═══ */}
            <aside className="w-48 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col flex-shrink-0 z-20 transition-colors">
                {/* Logo Area */}
                <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center shadow-sm">
                        <Store size={18} />
                    </div>
                    <span className="ml-3 font-extrabold text-[17px] tracking-tight dark:text-gray-100">AROMA OPS</span>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-3 py-6 space-y-1.5">
                    <NavItem href="/vendor" icon={<LayoutDashboard size={20} />} label="Home" active={pathname === '/vendor'} />
                    <NavItem href="/vendor/orders" icon={<LayoutList size={20} />} label="Orders" active={pathname === '/vendor/orders'} badge={unreadCount > 0 ? unreadCount : undefined} />
                    <NavItem href="/vendor/menu" icon={<MenuIcon size={20} />} label="Menu/Inventory" active={pathname === '/vendor/menu'} />
                    <NavItem href="/vendor/settings" icon={<Settings size={20} />} label="Settings" active={pathname === '/vendor/settings'} />
                </nav>

                {/* Bottom Logout */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 transition-colors">
                    <button
                        onClick={async () => { await signOut(); router.push('/'); }}
                        className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors"
                    >
                        <LogOut size={20} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ═══ MAIN CONTENT AREA ═══ */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 flex-shrink-0 z-10 w-full overflow-hidden transition-colors">
                    <div className="flex items-center gap-6 xl:gap-10">
                        <h1 className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100 whitespace-nowrap">
                            Hello, <span className="text-gray-900 dark:text-white font-extrabold">Aroma Vendor</span>
                        </h1>

                        {/* ELITE HUD METRICS */}
                        <div className="hidden lg:flex items-center gap-6 h-8 pl-6 border-l border-gray-200 dark:border-gray-800 transition-colors">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <TrendingUp size={16} className="text-emerald-500" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase leading-none">Today's Sales</span>
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
                                onClick={toggleStore}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-inner ${isStoreOpen ? 'bg-emerald-500' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isStoreOpen ? 'translate-x-[22px]' : 'translate-x-[4px]'}`} />
                            </button>
                        </div>

                        {/* Printer Status */}
                        <div className="flex items-center" title={isPrinterConnected ? "Thermal Printer Connected" : "QZ Tray Offline / Disconnected"}>
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
function NavItem({ href, icon, label, active, badge }: { href: string; icon: React.ReactNode; label: string; active: boolean; badge?: number }) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active
                ? 'bg-red-50 text-red-600 font-bold'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-semibold'
                }`}
        >
            <span className={active ? 'text-red-500' : 'text-gray-400 group-hover:text-gray-500'}>{icon}</span>
            {label}
            {badge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                    {badge}
                </span>
            )}
            {active && <span className="absolute left-0 w-1 h-8 bg-red-500 rounded-r-full" />}
        </Link>
    );
}
