'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { listenToOrder } from '@/lib/firestore';
import { Order, OrderStatus } from '@/types';
import {
    CheckCircle2,
    ChefHat,
    Package,
    Clock,
    RotateCw,
    MapPin,
    Receipt,
    ArrowLeft,
    XCircle
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getProgressStep(status: OrderStatus): number {
    switch (status) {
        case 'Placed':
        case 'Pending':
        case 'success':
            return 1;
        case 'Preparing':
        case 'payment_processing':
            return 2;
        case 'Completed':
        case 'Dispatched':
        case 'Delivered':
            return 3;
        case 'Cancelled':
            return -1;
        default:
            return 1;
    }
}

function formatReadyTime(date: Date): string {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatElapsed(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressStep({ step, label, icon, current, done }: {
    step: number;
    label: string;
    icon: React.ReactNode;
    current: boolean;
    done: boolean;
}) {
    return (
        <div className="flex flex-col items-center gap-2 relative z-10">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${done ? 'bg-red-500 text-white shadow-lg shadow-red-200' :
                current ? 'bg-red-50 border-2 border-red-400 text-red-500 shadow-md' :
                    'bg-gray-100 text-gray-400'
                }`}>
                {done ? <CheckCircle2 size={22} /> : icon}
            </div>
            <span className={`text-xs font-bold whitespace-nowrap transition-colors ${current ? 'text-red-500' : done ? 'text-gray-700' : 'text-gray-400'
                }`}>
                {step}. {label}
            </span>
            {current && (
                <span className="absolute -bottom-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" />
            )}
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function OrderTrackingPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const router = useRouter();
    const [searchParams] = useState(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''));
    const errorParam = searchParams.get('error');

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [elapsedSecs, setElapsedSecs] = useState(0);

    // Real-time Firestore listener
    useEffect(() => {
        if (!orderId) return;
        setLoading(true);
        const unsub = listenToOrder(orderId, (o) => {
            setOrder(o);
            setLoading(false);
            setLastUpdated(new Date());
            setElapsedSecs(0);
        });
        return () => unsub();
    }, [orderId]);

    // Tick elapsed seconds since last update
    useEffect(() => {
        const interval = setInterval(() => setElapsedSecs(s => s + 1), 1000);
        return () => clearInterval(interval);
    }, [lastUpdated]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-3 border-red-300 border-t-red-500 rounded-full animate-spin mx-auto mb-4" style={{ borderWidth: 3 }} />
                    <p className="text-gray-500 font-medium">Loading your order...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">😕</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Order not found</h2>
                    <p className="text-gray-500 mb-6">We couldn&apos;t find details for this order.</p>
                    <button
                        onClick={() => router.push('/menu')}
                        className="bg-red-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-red-600 transition-colors"
                    >
                        Back to Menu
                    </button>
                </div>
            </div>
        );
    }

    const progressStep = getProgressStep(order.status);
    const isCancelled = order.status === 'Cancelled' || order.status === 'failed';
    const isDelivered = progressStep === 3;
    const etaMinutes = order.etaMinutes ?? 15;
    const expectedReadyTime = order.expectedReadyTime ? new Date(order.expectedReadyTime) : new Date(new Date(order.orderDate).getTime() + etaMinutes * 60000);
    const orderToken = order.orderToken ?? '---';

    // Payment states
    const isPaymentPending = order.payment_status === 'pending' || order.payment_status === 'processing' || order.status === 'pending_payment' || order.status === 'payment_processing';
    const isPaymentFailed = order.payment_status === 'failed' || order.status === 'failed' || errorParam;
    const isPaymentSuccess = order.payment_status === 'success' || order.status === 'success';

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Bar */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                    <button
                        onClick={() => router.push('/menu')}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Order Tracking</p>
                        <p className="text-sm font-bold text-gray-800">Order #{orderToken}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                        <Clock size={12} />
                        <span>Updated {formatElapsed(elapsedSecs)} ago</span>
                    </div>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

                {/* ── Hero Block ─────────────────────────────────────────── */}
                <div className={`rounded-2xl p-8 text-center shadow-sm border transition-all ${isCancelled
                    ? 'bg-red-50 border-red-100'
                    : isDelivered
                        ? 'bg-emerald-50 border-emerald-100'
                        : 'bg-white border-gray-100'
                    }`}>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Your Order</p>
                    <div className={`text-8xl font-black tracking-tighter mb-1 ${isCancelled ? 'text-red-400' : isDelivered ? 'text-emerald-500' : 'text-gray-900'
                        }`}>
                        #{orderToken}
                    </div>

                    {isCancelled ? (
                        <div className="mt-4">
                            <p className="text-xl font-bold text-red-500">{isPaymentFailed ? 'Payment Failed' : 'Order Cancelled'}</p>
                            <p className="text-sm text-gray-500 mt-1">
                                {isPaymentFailed
                                    ? (errorParam === 'amount_mismatch' ? 'Amount verification failed. Transaction cancelled.' : 'Your transaction could not be completed.')
                                    : 'This order was cancelled.'}
                            </p>
                            {isPaymentFailed && (
                                <button onClick={() => router.push('/checkout')} className="mt-4 py-2 px-6 bg-red-500 text-white font-bold rounded-xl shadow-sm hover:bg-red-600 transition-colors">
                                    Try Payment Again
                                </button>
                            )}
                        </div>
                    ) : isPaymentPending ? (
                        <div className="mt-4">
                            <div className="flex justify-center mb-3">
                                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center animate-pulse">
                                    <Clock size={24} />
                                </div>
                            </div>
                            <p className="text-xl font-bold text-gray-900">Payment Processing</p>
                            <p className="text-sm text-gray-500 mt-1">Please wait while we confirm your payment.<br />This screen will update automatically.</p>
                        </div>
                    ) : isDelivered ? (
                        <div className="mt-4">
                            <p className="text-xl font-bold text-emerald-600">Delivered! 🎉</p>
                            <p className="text-sm text-gray-500 mt-1">Your order has been delivered. Enjoy!</p>
                        </div>
                    ) : (
                        <div className="mt-4">
                            {isPaymentSuccess && progressStep === 1 && (
                                <p className="text-sm font-bold text-emerald-500 mb-2 bg-emerald-50 rounded-lg inline-block px-3 py-1">Payment Successful</p>
                            )}
                            <p className="text-2xl font-extrabold text-gray-900">
                                {progressStep === 1 ? '🎉 Order Confirmed!' : '🍳 Being Prepared'}
                            </p>
                            <div className="mt-3 inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 rounded-full px-5 py-2.5">
                                <Clock size={16} />
                                <span className="font-bold text-sm">
                                    Est. wait: <span className="text-lg font-black">{etaMinutes} min</span>
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-3 font-medium">
                                Ready by approx. <span className="font-bold text-gray-800">{formatReadyTime(expectedReadyTime)}</span>
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Live Progress Bar ───────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Live Status</p>
                    <div className="relative flex items-start justify-between">
                        {/* Connector line */}
                        <div className="absolute top-6 left-[calc(16.67%)] right-[calc(16.67%)] h-0.5 bg-gray-100 z-0" />
                        {/* Filled connector */}
                        <div
                            className={`absolute top-6 left-[calc(16.67%)] h-0.5 z-0 bg-red-400 transition-all duration-700`}
                            style={{ width: progressStep >= 2 ? '33.33%' : '0%' }}
                        />
                        <div
                            className={`absolute top-6 left-1/2 h-0.5 z-0 bg-red-400 transition-all duration-700`}
                            style={{ width: progressStep >= 3 ? '33.33%' : '0%' }}
                        />

                        <ProgressStep
                            step={1}
                            label="Placed"
                            icon={<Receipt size={18} />}
                            current={progressStep === 1}
                            done={progressStep > 1}
                        />
                        <ProgressStep
                            step={2}
                            label="Preparing"
                            icon={<ChefHat size={18} />}
                            current={progressStep === 2}
                            done={progressStep > 2}
                        />
                        <ProgressStep
                            step={3}
                            label="Ready"
                            icon={<Package size={18} />}
                            current={progressStep === 3 && !isDelivered}
                            done={isDelivered}
                        />
                    </div>

                    {/* Status label */}
                    <div className="mt-6 text-center">
                        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${isCancelled ? 'bg-red-50 text-red-600 border-red-100' :
                            isDelivered ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                progressStep === 2 ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse' :
                                    'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                            <span className="w-2 h-2 rounded-full bg-current" />
                            {order.status}
                        </span>
                    </div>
                </div>

                {/* ── Delivery Info ────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin size={16} className="text-red-400" />
                        <p className="text-sm font-bold text-gray-700">
                            {order.deliveryAddress.deliveryType === 'Takeaway' ? 'Takeaway' : 'Delivery Info'}
                        </p>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                        <p><span className="font-semibold text-gray-800">{order.deliveryAddress.name}</span></p>
                        {order.deliveryAddress.deliveryType !== 'Takeaway' && (
                            <p className="text-gray-500">{order.deliveryAddress.hostelNumber} · Room {order.deliveryAddress.roomNumber}</p>
                        )}
                        <p className="text-gray-500 capitalize">{order.deliveryAddress.deliveryType}</p>
                    </div>
                </div>

                {/* ── Order Summary ────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50">
                        <p className="text-sm font-bold text-gray-700">Receipt</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-black flex items-center justify-center">
                                        {item.quantity}
                                    </span>
                                    <span className="text-sm font-medium text-gray-800">{item.name}</span>
                                </div>
                                <span className="text-sm font-bold text-gray-900">₹{item.price * item.quantity}</span>
                            </div>
                        ))}
                    </div>
                    <div className="px-5 py-4 bg-gray-50 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-500">Total Paid</span>
                        <span className="text-lg font-black text-gray-900">₹{order.grandTotal}</span>
                    </div>
                </div>

                {/* ── Refresh Button ───────────────────────────────────────── */}
                <button
                    onClick={() => setElapsedSecs(0)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500 font-bold text-sm transition-colors"
                >
                    <RotateCw size={16} />
                    Refresh Status
                </button>

                <p className="text-center text-xs text-gray-400 font-medium pb-8">
                    This page auto-updates in real-time — no page reload needed.
                </p>
            </div>
        </div>
    );
}
