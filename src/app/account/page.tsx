'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Banner from '@/components/layout/Banner';
import Header from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { getUserOrders, getUserAddresses, updateUserAddress } from '@/lib/firestore';
import { IIM_MUMBAI_HOSTELS } from '@/lib/hostels';
import { Order, Address } from '@/types';
import { ListOrdered, MapPin, LogOut, Filter, Pencil, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { load } from '@cashfreepayments/cashfree-js';

type SidebarTab = 'orders' | 'addresses';

const STATUS_COLORS: Record<string, string> = {
    Delivered: 'text-green-600',
    Paid: 'text-blue-600',
    Placed: 'text-green-600',
    Pending: 'text-yellow-600',
    Cancelled: 'text-red-500',
    pending_payment: 'text-amber-600',
    failed: 'text-red-500',
};

const STATUS_DOT: Record<string, string> = {
    Delivered: 'bg-green-500',
    Placed: 'bg-green-500',
    Paid: 'bg-blue-500',
    Pending: 'bg-yellow-500',
    Cancelled: 'bg-red-400',
    pending_payment: 'bg-amber-500',
    failed: 'bg-red-400',
};

/** Human-readable labels for raw status codes */
const STATUS_LABEL: Record<string, string> = {
    pending_payment: 'Payment Pending',
    failed: 'Failed',
};

function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(new Date(date));
}

type AddressWithFields = Address & { hostel?: string; room?: string };

export default function AccountPage() {
    const router = useRouter();
    const { user, phoneNumber, userProfile, signOut, loading, openAuthModal } = useAuth();
    const [activeTab, setActiveTab] = useState<SidebarTab>('orders');
    const [orders, setOrders] = useState<Order[]>([]);
    const [addresses, setAddresses] = useState<AddressWithFields[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [cashfree, setCashfree] = useState<any>(null);

    // Pre-load Cashfree SDK on mount
    useEffect(() => {
        const initCashfree = async () => {
            try {
                const cf = await load({ 
                    mode: (process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT?.toLowerCase() || 'sandbox') as "sandbox" | "production"
                });
                setCashfree(cf);
                console.log('[Account] Cashfree SDK initialized');
            } catch (err) {
                console.warn('[Account] Failed to pre-load Cashfree SDK:', err);
            }
        };
        initCashfree();
    }, []);

    // ── Edit address state ───────────────────────────────────────────────────
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editHostel, setEditHostel] = useState('');
    const [editRoom, setEditRoom] = useState('');
    const [saving, setSaving] = useState(false);

    // No longer redirect — we show a login prompt inline instead

    // Load orders / addresses based on Phone Number (not UID)
    useEffect(() => {
        if (!phoneNumber) return;
        setDataLoading(true);
        const loader =
            activeTab === 'orders'
                ? getUserOrders(phoneNumber)
                : getUserAddresses(phoneNumber);

        loader
            .then((data: Order[] | AddressWithFields[]) => {
                if (activeTab === 'orders') setOrders(data as Order[]);
                else setAddresses(data as AddressWithFields[]);
            })
            .catch(() => { })
            .finally(() => setDataLoading(false));
    }, [phoneNumber, activeTab]);

    const openEdit = (addr: AddressWithFields) => {
        setEditName(addr.name);
        setEditHostel(addr.hostel ?? '');
        setEditRoom(addr.room ?? '');
        setIsEditing(true);
    };

    const cancelEdit = () => setIsEditing(false);

    const saveEdit = async () => {
        if (!phoneNumber) return;
        if (!editName.trim() || !editHostel || !editRoom.trim()) {
            toast.error('Please fill in all fields');
            return;
        }
        setSaving(true);
        try {
            await updateUserAddress(phoneNumber, editName.trim(), editHostel, editRoom.trim());
            // Refresh addresses
            const updated = await getUserAddresses(phoneNumber);
            setAddresses(updated as AddressWithFields[]);
            setIsEditing(false);
            toast.success('Address updated! ✅');
        } catch {
            toast.error('Failed to update address');
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        toast.success('Signed out successfully');
        router.push('/');
    };

    const handleRetryPayment = async (orderId: string) => {
        const loadingToast = toast.loading('Initiating payment...');
        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/payment/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ orderId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to initiate payment');

            if (data.session?.payload?.payment_session_id) {
                const sessionId = data.session.payload.payment_session_id;
                console.log('[Account] Initiating Cashfree SDK redirect with Session ID:', sessionId);

                try {
                    const cfInstance = cashfree || await load({ 
                        mode: (process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT?.toLowerCase() || 'sandbox') as "sandbox" | "production"
                    });
                    
                    // Using _self forces a full page redirect instead of an in-app modal
                    await cfInstance.checkout({
                        paymentSessionId: sessionId,
                        redirectTarget: "_self", 
                    });
                    toast.dismiss(loadingToast);
                } catch (sdkError) {
                    console.error('[Account] SDK failure:', sdkError);
                    throw new Error('Payment gateway failed to initialize.');
                }
            } else {
                throw new Error('No payment session received');
            }
        } catch (err: any) {
            console.error('[Account] Retry payment failed:', err);
            toast.error(err.message || 'Failed to retry payment');
            toast.dismiss(loadingToast);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-8 h-8 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
            </div>
        );
    }

    // isLoggedIn: just Firebase auth — phone comes later from profile
    const isLoggedIn = !!user;

    return (
        <div className="min-h-screen bg-gray-50">
            <Banner />
            <Header />
            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            {isLoggedIn && userProfile?.name
                                ? `Hello, ${userProfile.name} 👋`
                                : 'My Account'}
                        </h1>
                        {isLoggedIn && <p className="text-gray-400 text-xs mt-0.5">{userProfile?.email ?? phoneNumber ?? ''}</p>}
                    </div>
                </div>

                {/* ── MOBILE: horizontal tab bar ───────────────────────────── */}
                <div className="md:hidden flex border-b border-gray-200 mb-4">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'orders' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'
                            }`}
                    >
                        <ListOrdered size={16} /> My Orders
                    </button>
                    <button
                        onClick={() => setActiveTab('addresses')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'addresses' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'
                            }`}
                    >
                        <MapPin size={16} /> Addresses
                    </button>
                    {isLoggedIn && (
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 ml-auto"
                        >
                            <LogOut size={16} /> Sign out
                        </button>
                    )}
                </div>

                {/* ── DESKTOP + MOBILE content layout ─────────────────────── */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Sidebar — DESKTOP only */}
                    <aside className="hidden md:block w-60 flex-shrink-0">
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <button
                                onClick={() => setActiveTab('orders')}
                                className={`w-full flex items-center gap-3 px-5 py-4 text-sm font-medium border-l-4 transition-all ${activeTab === 'orders'
                                    ? 'border-red-500 bg-red-50 text-red-600'
                                    : 'border-transparent text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <ListOrdered size={18} />
                                My orders
                            </button>
                            <button
                                onClick={() => setActiveTab('addresses')}
                                className={`w-full flex items-center gap-3 px-5 py-4 text-sm font-medium border-l-4 transition-all ${activeTab === 'addresses'
                                    ? 'border-red-500 bg-red-50 text-red-600'
                                    : 'border-transparent text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <MapPin size={18} />
                                My addresses
                            </button>
                            {isLoggedIn && (
                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 border-l-4 border-transparent transition-all"
                                >
                                    <LogOut size={18} />
                                    Sign out
                                </button>
                            )}
                        </div>
                    </aside>

                    {/* Content */}
                    <main className="flex-1 min-w-0">
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm min-h-72">

                            {/* ── MY ORDERS ── */}
                            {activeTab === 'orders' && (
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-5">
                                        <p className="text-sm font-medium text-gray-600">Showing all orders</p>
                                        <button className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
                                            <Filter size={14} />
                                            FILTER
                                        </button>
                                    </div>

                                    {!isLoggedIn ? (
                                        <div className="text-center py-16">
                                            <div className="text-5xl mb-4">🔒</div>
                                            <p className="text-gray-800 font-semibold text-lg mb-1">Please log in</p>
                                            <p className="text-gray-400 text-sm mb-6">Sign in with your email to view your orders</p>
                                            <button
                                                onClick={openAuthModal}
                                                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-xl transition-colors text-sm"
                                            >
                                                Log in →
                                            </button>
                                        </div>
                                    ) : !phoneNumber ? (
                                        <div className="text-center py-16">
                                            <div className="text-5xl mb-4">👤</div>
                                            <p className="text-gray-800 font-semibold text-lg mb-1">Complete your profile</p>
                                            <p className="text-gray-400 text-sm mb-6">Add your name, phone &amp; hostel to place and track orders</p>
                                            <button
                                                onClick={openAuthModal}
                                                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-xl transition-colors text-sm"
                                            >
                                                Complete Profile →
                                            </button>
                                        </div>
                                    ) : dataLoading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="w-8 h-8 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
                                        </div>
                                    ) : orders.length === 0 ? (
                                        <div className="text-center py-16">
                                            <div className="text-4xl mb-3">📦</div>
                                            <p className="text-gray-500 font-medium">No orders yet</p>
                                            <button
                                                onClick={() => router.push('/categories')}
                                                className="mt-4 text-red-500 font-semibold text-sm hover:text-red-600"
                                            >
                                                Order something now →
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {orders.map((order) => {
                                                const isActive = ['Placed', 'Pending', 'Preparing'].includes(order.status);
                                                return (
                                                    <div
                                                        key={order.id}
                                                        onClick={() => router.push(`/order/${order.id}`)}
                                                        className="border border-gray-100 rounded-xl p-4 hover:border-red-200 hover:shadow-sm transition-all cursor-pointer group"
                                                    >
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="w-9 h-9 rounded overflow-hidden bg-orange-100 flex-shrink-0">
                                                                <img
                                                                    src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=80&q=80"
                                                                    alt="Aroma Dhaba"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                            <span className="text-sm font-semibold text-red-500">
                                                                Aroma Dhaba, IIM Mumbai
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-700">
                                                                    Order #{order.orderToken ?? order.id.slice(-7).toUpperCase()}
                                                                </p>
                                                                <p className="text-xs text-gray-400 mt-0.5">
                                                                    {order.items.reduce((s, i) => s + i.quantity, 0)} items &nbsp;·&nbsp;
                                                                    {formatDate(order.orderDate)}
                                                                </p>
                                                            </div>
                                                            <p className="text-base font-bold text-gray-900">₹{order.grandTotal}</p>
                                                        </div>
                                                        <div className="mt-3 flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className={`w-2 h-2 rounded-full ${STATUS_DOT[order.status] ?? 'bg-gray-400'}`} />
                                                                <span className={`text-sm font-medium ${STATUS_COLORS[order.status] ?? 'text-gray-600'}`}>
                                                                    {STATUS_LABEL[order.status] ?? order.status}
                                                                </span>
                                                            </div>
                                                            {isActive && (
                                                                <span className="text-xs font-bold text-red-500 group-hover:underline">
                                                                    Track →
                                                                </span>
                                                            )}
                                                            {order.status === 'pending_payment' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRetryPayment(order.id);
                                                                    }}
                                                                    className="bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                                                >
                                                                    PAY NOW
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── MY ADDRESSES ── */}
                            {activeTab === 'addresses' && (
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-5">
                                        <p className="text-sm font-medium text-gray-600">Saved addresses</p>
                                    </div>

                                    {dataLoading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="w-8 h-8 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
                                        </div>
                                    ) : addresses.length === 0 ? (
                                        <div className="text-center py-16">
                                            <div className="text-4xl mb-3">📍</div>
                                            <p className="text-gray-500 font-medium">No saved addresses</p>
                                            <p className="text-xs text-gray-400 mt-1">Your hostel & room are saved when you place an order</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {addresses.map((addr) => (
                                                <div key={addr.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                                    {/* ── View mode ── */}
                                                    {!isEditing ? (
                                                        <div className="p-5">
                                                            <div className="flex items-start justify-between">
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <MapPin size={15} className="text-red-400 flex-shrink-0" />
                                                                        <p className="font-semibold text-gray-900">{addr.name}</p>
                                                                    </div>
                                                                    <p className="text-sm text-gray-500 pl-6">{addr.mobile}</p>
                                                                    <p className="text-sm font-medium text-gray-700 pl-6 mt-1">
                                                                        {addr.hostelDetails}
                                                                    </p>
                                                                    <p className="text-xs text-gray-400 pl-6">{addr.city} — {addr.pincode}</p>
                                                                </div>
                                                                <button
                                                                    onClick={() => openEdit(addr)}
                                                                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1.5 transition-all font-medium"
                                                                >
                                                                    <Pencil size={13} />
                                                                    Edit
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* ── Edit mode ── */
                                                        <div className="p-5 bg-gray-50">
                                                            <p className="text-sm font-semibold text-gray-800 mb-4">Edit Delivery Address</p>
                                                            <div className="space-y-3">
                                                                {/* Name */}
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                                                                    <input
                                                                        type="text"
                                                                        value={editName}
                                                                        onChange={(e) => setEditName(e.target.value)}
                                                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition bg-white"
                                                                        placeholder="Your name"
                                                                    />
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    {/* Hostel */}
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-gray-600 mb-1">Hostel <span className="text-red-500">*</span></label>
                                                                        <select
                                                                            value={editHostel}
                                                                            onChange={(e) => setEditHostel(e.target.value)}
                                                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition bg-white"
                                                                        >
                                                                            <option value="">Select hostel</option>
                                                                            {IIM_MUMBAI_HOSTELS.map((h: string) => (
                                                                                <option key={h} value={h}>{h}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    {/* Room */}
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-gray-600 mb-1">Room No. <span className="text-red-500">*</span></label>
                                                                        <input
                                                                            type="text"
                                                                            value={editRoom}
                                                                            onChange={(e) => setEditRoom(e.target.value.replace(/\D/g, ''))}
                                                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition bg-white"
                                                                            placeholder="e.g. 102"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {/* Action buttons */}
                                                                <div className="flex gap-2 pt-1">
                                                                    <button
                                                                        onClick={saveEdit}
                                                                        disabled={saving}
                                                                        className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                                                                    >
                                                                        {saving
                                                                            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                                            : <Check size={14} />
                                                                        }
                                                                        {saving ? 'Saving...' : 'Save Changes'}
                                                                    </button>
                                                                    <button
                                                                        onClick={cancelEdit}
                                                                        disabled={saving}
                                                                        className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                                                                    >
                                                                        <X size={14} />
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
