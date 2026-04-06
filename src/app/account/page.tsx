'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Banner from '@/components/layout/Banner';
import Header from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { getUserOrders, getUserAddresses, updateUserAddress, updateUserProfileUnified } from '@/lib/firestore';
import { saveSessionPhone } from '@/lib/auth';
import { IIM_MUMBAI_HOSTELS } from '@/lib/hostels';
import { Order, Address, UserProfile, UserAddress } from '@/types';
import { ListOrdered, MapPin, LogOut, Filter, Pencil, Check, X, User, Calendar, Leaf, UtensilsCrossed, Plus, Home, Building, HelpCircle, Mail, Phone, Camera, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { load } from '@cashfreepayments/cashfree-js';

type SidebarTab = 'orders' | 'addresses' | 'profile';

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

// ── Shared UI Components ─────────────────────────────────────────────────────

const FloatingInput = ({ label, value, onChange, type = 'text', readOnly = false, icon: Icon }: any) => {
    const [focused, setFocused] = useState(false);
    const hasValue = value !== undefined && value !== null && value.toString().length > 0;

    return (
        <div className="relative">
            <div className={`
                flex items-center border rounded-xl transition-all duration-200 bg-white group
                ${focused ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100 hover:border-gray-200'}
                ${readOnly ? 'bg-gray-50 border-gray-50' : ''}
            `}>
                {Icon && (
                    <div className="pl-3">
                        <Icon size={16} className={focused ? 'text-red-500' : 'text-gray-400'} />
                    </div>
                )}
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    onFocus={() => !readOnly && setFocused(true)}
                    onBlur={() => setFocused(false)}
                    readOnly={readOnly}
                    className="w-full px-3 py-2.5 text-gray-900 bg-transparent focus:outline-none placeholder-transparent text-sm font-medium"
                    placeholder={label}
                />
            </div>
            <label className={`
                absolute left-3 transition-all duration-200 pointer-events-none px-1 bg-white
                ${(focused || hasValue) 
                    ? `-top-2 text-[10px] uppercase tracking-wider font-bold ${focused ? 'text-red-500' : 'text-gray-500'}` 
                    : `top-3 text-sm font-medium text-gray-400`}
                ${Icon ? 'ml-6' : ''}
            `}>
                {label}
            </label>
        </div>
    );
};

type AddressWithFields = Address & { hostel?: string; room?: string };

export default function AccountPage() {
    const router = useRouter();
    const { user, isLoggedIn, phoneNumber, userProfile, signOut, loading, openAuthModal } = useAuth();
    const [activeTab, setActiveTab] = useState<SidebarTab>('orders');
    const [orders, setOrders] = useState<Order[]>([]);
    const [addresses, setAddresses] = useState<AddressWithFields[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [cashfree, setCashfree] = useState<any>(null);

    // Default to profile if incomplete
    useEffect(() => {
        if (!loading && isLoggedIn && !phoneNumber) {
            setActiveTab('profile');
        }
    }, [loading, isLoggedIn, phoneNumber]);

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
    // Removed local calculation to use AuthContext.isLoggedIn

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
                <div className="md:hidden flex border-b border-gray-200 mb-4 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'orders' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'
                            }`}
                    >
                        <ListOrdered size={16} /> My Orders
                    </button>
                    <button
                        onClick={() => setActiveTab('addresses')}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'addresses' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'
                            }`}
                    >
                        <MapPin size={16} /> Addresses
                    </button>
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'profile' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'
                            }`}
                    >
                        <User size={16} /> My Profile
                    </button>
                    {isLoggedIn && (
                        <button
                            onClick={handleSignOut}
                            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 ml-auto"
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
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`w-full flex items-center gap-3 px-5 py-4 text-sm font-medium border-l-4 transition-all ${activeTab === 'profile'
                                    ? 'border-red-500 bg-red-50 text-red-600'
                                    : 'border-transparent text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <User size={18} />
                                My profile
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
                                            <div className="text-5xl mb-4 text-gray-100">👤</div>
                                            <p className="text-gray-800 font-semibold text-lg mb-1">Complete your profile</p>
                                            <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">Add your phone number to track orders and more</p>
                                            <button
                                                onClick={() => setActiveTab('profile')}
                                                className="bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 px-10 rounded-xl transition-all text-sm shadow-lg shadow-red-100"
                                            >
                                                Go to Profile →
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

                            {/* ── MY PROFILE ── */}
                            {activeTab === 'profile' && isLoggedIn && (
                                <ProfileTab user={user} userProfile={userProfile} onSignOut={handleSignOut} />
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}

function ProfileTab({ user, userProfile, onSignOut }: { user: any, userProfile: UserProfile | null, onSignOut: () => void }) {
    const { setUserProfile, setPhoneNumber } = useAuth();
    const [name, setName] = useState(userProfile?.name || '');
    const [email, setEmail] = useState(userProfile?.email || user?.email || '');
    const [phone, setPhone] = useState(userProfile?.phone || '');
    const [birthday, setBirthday] = useState(userProfile?.birthday || '');
    const [hostel, setHostel] = useState(userProfile?.lastHostel || '');
    const [hostelSearch, setHostelSearch] = useState(userProfile?.lastHostel || '');
    const [showHostelHints, setShowHostelHints] = useState(false);
    const [room, setRoom] = useState(userProfile?.lastRoom || '');
    const [pincode, setPincode] = useState(userProfile?.pincode || '400087');
    const [city, setCity] = useState(userProfile?.city || 'Mumbai');
    const [state, setState] = useState(userProfile?.state || 'Maharashtra');
    const [saving, setSaving] = useState(false);

    // Filtered hostels for the searchable dropdown
    const filteredHostels = IIM_MUMBAI_HOSTELS.filter(h => 
        h.toLowerCase().includes(hostelSearch.toLowerCase())
    );

    // Auto-fill logic for Pincode
    useEffect(() => {
        if (pincode === '400087') {
            setCity('Mumbai');
            setState('Maharashtra');
        }
    }, [pincode]);

    // Sync if userProfile changes
    useEffect(() => {
        if (userProfile) {
            setName(userProfile.name || '');
            setEmail(userProfile.email || user?.email || '');
            setPhone(userProfile.phone || '');
            setBirthday(userProfile.birthday || '');
            setHostel(userProfile.lastHostel || '');
            setHostelSearch(userProfile.lastHostel || '');
            setRoom(userProfile.lastRoom || '');
            setPincode(userProfile.pincode || '400087');
            setCity(userProfile.city || 'Mumbai');
            setState(userProfile.state || 'Maharashtra');
        }
    }, [userProfile, user]);

    const handleSave = async () => {
        if (!name.trim()) return toast.error('Name is mandatory');
        
        // Phone validation (10 digits)
        const purePhone = phone.replace(/\D/g, '');
        if (purePhone.length !== 10) return toast.error('Please enter a valid 10-digit phone number');
        
        if (!birthday) return toast.error('Birthday is mandatory');
        if (!hostel.trim()) return toast.error('Hostel name is mandatory');
        if (!room.trim()) return toast.error('Room number is mandatory');
        
        // Pincode validation (6 digits)
        const purePincode = pincode.toString().replace(/\D/g, '');
        if (purePincode.length !== 6) return toast.error('Please enter a valid 6-digit Pincode');
        
        if (!city.trim()) return toast.error('City is mandatory');
        if (!state.trim()) return toast.error('State is mandatory');
        
        setSaving(true);
        try {
            const updatedData = {
                name,
                email,
                birthday,
                lastHostel: hostel,
                lastRoom: room,
                pincode,
                city,
                state
            };
            
            // 1. Save to Firestore (Dual-Sync)
            await updateUserProfileUnified(email, phone, updatedData);
            
            
            // 2. Update local state immediately
            const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
            saveSessionPhone(formattedPhone);

            setUserProfile({
                ...userProfile,
                ...updatedData,
                phone: formattedPhone,
                totalOrders: userProfile?.totalOrders ?? 0
            });
            setPhoneNumber(formattedPhone);

            toast.success('Profile updated successfully! ✨');
        } catch (err) {
            toast.error('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-4 animate-in fade-in duration-500 max-w-5xl mx-auto overflow-hidden">
            {/* 1. Compact Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-lg font-bold text-gray-900">Complete Your Profile</h2>
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-bold px-6 py-2 rounded-xl text-sm transition-all"
                >
                    {saving ? 'Saving...' : 'SAVE PROFILE'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                {/* ROW 1: Basic Info */}
                <FloatingInput label="Full Name *" value={name} onChange={(e: any) => setName(e.target.value)} icon={User} />
                <FloatingInput label="Phone Number *" value={phone} onChange={(e: any) => setPhone(e.target.value)} icon={Phone} />
                <FloatingInput label="Email Address" value={email} readOnly={true} icon={Mail} />

                {/* ROW 2: DOB & Hostel & Room */}
                <FloatingInput label="Date of Birth *" value={birthday} onChange={(e: any) => setBirthday(e.target.value)} type="date" icon={Calendar} />
                
                {/* Searchable Hostel Input */}
                <div className="relative group">
                    <FloatingInput 
                        label="Hostel Name *" 
                        value={hostelSearch} 
                        onChange={(e: any) => {
                            setHostelSearch(e.target.value);
                            setHostel(e.target.value); 
                            setShowHostelHints(true);
                        }} 
                        icon={Building} 
                    />
                    {showHostelHints && hostelSearch.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto no-scrollbar py-1">
                            {filteredHostels.length > 0 ? (
                                filteredHostels.map(h => (
                                    <button 
                                        key={h} 
                                        className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-red-500 transition-colors"
                                        onClick={() => {
                                            setHostel(h);
                                            setHostelSearch(h);
                                            setShowHostelHints(false);
                                        }}
                                    >
                                        {h}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-2 text-[10px] text-gray-400 font-bold italic">
                                    Press Enter to add "{hostelSearch}"
                                </div>
                            )}
                        </div>
                    )}
                    {showHostelHints && (
                        <div className="fixed inset-0 z-0" onClick={() => setShowHostelHints(false)} />
                    )}
                </div>

                <FloatingInput label="Room No. *" value={room} onChange={(e: any) => setRoom(e.target.value)} icon={Home} />

                {/* ROW 3: Pincode & Location Detail */}
                <FloatingInput label="Pincode *" value={pincode} onChange={(e: any) => setPincode(e.target.value)} icon={MapPin} />
                <FloatingInput label="City *" value={city} onChange={(e: any) => setCity(e.target.value)} icon={Building} />
                <FloatingInput label="State *" value={state} onChange={(e: any) => setState(e.target.value)} icon={Filter} />
            </div>
            
            <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">
                 ⚡ Fast Deliveries for IIM Mumbai Campus
            </p>
        </div>
    );
}
