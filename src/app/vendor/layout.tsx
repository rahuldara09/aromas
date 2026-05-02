'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { VendorProvider, useVendor } from '@/contexts/VendorContext';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { auth } from '@/lib/firebase';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { VendorLoginModal } from '@/components/vendor/StepUpAuthModal';
import {
    Store,
    LayoutGrid,
    ShoppingCart,
    Archive,
    Settings,
    LogOut,
    Bell,
    Printer,
    Activity,
    Globe,
    ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { isOrderActiveStatus } from '@/lib/order-status';

function getStoredVendorEmail(): string | null {
    if (typeof window === 'undefined') return null;
    const email = localStorage.getItem('vendorEmail');
    const expiry = localStorage.getItem('vendorSessionExpiry');
    if (email && expiry && Date.now() < Number(expiry)) return email;
    localStorage.removeItem('vendorEmail');
    localStorage.removeItem('vendorSessionExpiry');
    return null;
}

export default function VendorLayout({ children }: { children: React.ReactNode }) {
    return (
        <VendorProvider>
            <Script src="/qz-tray.js" strategy="beforeInteractive" />
            <VendorLayoutInner>{children}</VendorLayoutInner>
        </VendorProvider>
    );
}

function VendorLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { isStoreOpen, toggleStore, unlockAudio, orders } = useVendor();
    const { isConnected: isPrinterConnected } = useThermalPrinter();

    const activeCount = orders.filter(o => isOrderActiveStatus(o.status)).length;
    useEffect(() => {
        document.title = activeCount > 0 ? `(${activeCount}) Aroma Ops` : 'Aroma Ops';
    }, [activeCount]);

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

    const [vendorEmail, setVendorEmail] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        setVendorEmail(getStoredVendorEmail());
    }, []);

    const handleLoginSuccess = (email: string) => setVendorEmail(email);

    const handleSignOut = async () => {
        localStorage.removeItem('vendorEmail');
        localStorage.removeItem('vendorSessionExpiry');
        await firebaseSignOut(auth);
        router.push('/');
    };

    if (!isMounted) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#F7F7F8]">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            </div>
        );
    }

    if (!vendorEmail) {
        return <VendorLoginModal onSuccess={handleLoginSuccess} onSignOut={handleSignOut} />;
    }

    const unreadCount = orders.filter(o => o.status === 'Placed' || o.status === 'Pending').length;
    const onlineNewOrders = orders
        .filter(o => (o.status === 'Placed' || o.status === 'Pending') && o.orderType !== 'pos')
        .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

    const todayDateStr = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.orderDate).toDateString() === todayDateStr);
    const todaysSales = todayOrders
        .filter(o => o.status !== 'Cancelled')
        .reduce((sum, o) => sum + o.grandTotal, 0);
    const todayOrderCount = todayOrders.length;

    const navItems = [
        { href: '/vendor', label: 'Dashboard', icon: <LayoutGrid size={14} />, active: pathname === '/vendor' },
        { href: '/vendor/orders', label: 'Orders', icon: <ShoppingCart size={14} />, active: pathname === '/vendor/orders', badge: unreadCount > 0 ? unreadCount : undefined },
        { href: '/vendor/menu', label: 'Inventory', icon: <Archive size={14} />, active: pathname === '/vendor/menu' },
        { href: '/vendor/analytics', label: 'Analytics', icon: <Activity size={14} />, active: pathname === '/vendor/analytics' },
        { href: '/vendor/settings', label: 'Settings', icon: <Settings size={14} />, active: pathname === '/vendor/settings' },
    ];

    return (
        <div className="vendor-pos-shell flex h-screen overflow-hidden font-sans text-gray-900" onClick={unlockAudio}>
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* ── TOP NAVBAR ── */}
                <nav className="vendor-topbar flex h-[58px] items-center px-5 gap-4 flex-shrink-0 z-20 w-full">

                    {/* Logo */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <div className="relative w-7 h-7 rounded-lg bg-[#E22718] flex items-center justify-center overflow-hidden border-t-[3px] border-[#F29D0A]">
                            <ShoppingBag size={13} className="text-white mt-0.5" />
                        </div>
                        <div className="leading-none">
                            <span className="font-bold text-[15px] text-gray-900 tracking-tight">Online Vyapar</span>
                            <p className="hidden sm:block text-[9px] font-semibold text-gray-500 tracking-widest mt-0.5 ">Ab Aapka Business Hoga Online.</p>
                        </div>
                    </div>

                    {/* Center nav */}
                    <div className="hidden lg:flex flex-1 justify-center">
                        <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1 border border-gray-200/70">
                            {navItems.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`relative flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold tracking-wide transition-all
                                        ${item.active
                                            ? 'bg-white text-indigo-700 shadow border border-indigo-100'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                                        }`}
                                >
                                    <span className={item.active ? 'text-indigo-500' : 'text-gray-500'}>
                                        {item.icon}
                                    </span>
                                    {item.label}
                                    {item.badge && (
                                        <span className="ml-0.5 min-w-4 h-4 bg-indigo-600 text-white text-[9px] font-semibold px-1 rounded-full leading-none flex items-center justify-center">
                                            {item.badge}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Right actions */}
                    <div className="ml-auto flex items-center gap-2 shrink-0">

                        {/* Revenue/Orders mini pill */}
                        <div className="hidden xl:flex items-center gap-4 bg-gray-50 border border-gray-100 rounded-xl px-4 py-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Revenue</span>
                                <span className="text-[13px] font-bold text-gray-900">₹{todaysSales.toLocaleString()}</span>
                            </div>
                            <div className="w-px h-3.5 bg-gray-200" />
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Orders</span>
                                <span className="text-[13px] font-bold text-gray-900">{todayOrderCount}</span>
                            </div>
                        </div>

                        {/* Visit site */}
                        <a
                            href="/"
                            target="_blank"
                            className="hidden xl:flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                            <Globe size={13} />
                            <span>Site</span>
                        </a>

                        {/* Store status */}
                        <button
                            onClick={toggleStore}
                            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors border
                                ${isStoreOpen
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${isStoreOpen ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                            {isStoreOpen ? 'Open' : 'Closed'}
                        </button>

                        {/* Printer */}
                        <button
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors
                                ${isPrinterConnected ? 'text-gray-500 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-50'}`}
                            title={isPrinterConnected ? 'Printer connected' : 'Printer offline'}
                        >
                            <Printer size={15} />
                        </button>

                        {/* Notifications */}
                        <div ref={notificationRef} className="relative">
                            <button
                                onClick={() => setNotificationsOpen(prev => !prev)}
                                className="relative w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                                <Bell size={15} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                                )}
                            </button>

                            {notificationsOpen && (
                                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-100 rounded-2xl shadow-lg shadow-gray-200/60 z-[100] overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                                        <p className="text-[12px] font-medium text-gray-900">Notifications</p>
                                        <button
                                            onClick={() => setSeenOrderIds(onlineNewOrders.map(o => o.id))}
                                            className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
                                        >
                                            Mark all read
                                        </button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {onlineNewOrders.length === 0 ? (
                                            <div className="py-8 text-center text-[12px] text-gray-400">No new orders</div>
                                        ) : onlineNewOrders.map(order => (
                                            <div key={order.id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                                                <p className="text-[13px] font-medium text-gray-900">
                                                    #{order.orderToken || order.id.slice(0, 6).toUpperCase()}
                                                </p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">
                                                    ₹{order.grandTotal} · {order.deliveryAddress?.name || 'Customer'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sign out */}
                        <button
                            onClick={handleSignOut}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            title="Sign out"
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                </nav>

                {/* Page content */}
                <div className="vendor-page-surface flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
