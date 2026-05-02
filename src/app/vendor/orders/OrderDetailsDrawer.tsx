'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ClipboardList, Image as ImageIcon, Banknote, CheckCircle2, Clock, Truck, Package } from 'lucide-react';
import { Order, OrderItem } from '@/types';
import toast from 'react-hot-toast';
import { cldUrl, isCloudinaryUrl } from '@/lib/cloudinary';

interface OrderDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
    onAccept?: (order: Order) => Promise<void>;
    onReject?: (order: Order) => Promise<void>;
}

export default function OrderDetailsDrawer({ isOpen, onClose, order, onAccept, onReject }: OrderDetailsDrawerProps) {
    const [accepting, setAccepting] = useState(false);
    const [rejecting, setRejecting] = useState(false);

    if (!order) return null;

    const isPOS = order.orderType === 'pos';
    const displayToken = isPOS ? `POS-#${order.orderToken || order.id.slice(0, 6)}` : `#${order.id.slice(0, 8).toUpperCase()}`;
    const isDelivery = order.deliveryAddress?.deliveryType?.toLowerCase() === 'delivery';
    const isActionable = order.status === 'Placed' || order.status === 'Pending';
    const itemsCount = order.items.reduce((s, i) => s + i.quantity, 0);
    const currentStatus = order.status;
    const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);

    const toDate = (value: unknown): Date | null => {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'object' && value !== null && typeof (value as { toDate?: unknown }).toDate === 'function') {
            const dt = (value as { toDate: () => Date }).toDate();
            return Number.isNaN(dt.getTime()) ? null : dt;
        }
        const dt = new Date(value as string | number);
        return Number.isNaN(dt.getTime()) ? null : dt;
    };

    const stageTimes = {
        placed: toDate(order.timeline?.placed) ?? new Date(order.orderDate),
        accepted: toDate(order.timeline?.accepted),
        dispatched: toDate(order.timeline?.dispatched),
        completed: toDate(order.timeline?.completed),
    };

    const fmt = (d: Date | null) => {
        if (!d) return 'Pending';
        return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const durationBetween = (from: Date | null, to: Date | null) => {
        if (!from || !to) return null;
        const diff = to.getTime() - from.getTime();
        if (diff <= 0) return null;
        const mins = Math.floor(diff / 60000);
        const hrs = Math.floor(mins / 60);
        const rem = mins % 60;
        return hrs === 0 ? `${mins}m` : rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
    };

    const timelineSteps = [
        { key: 'placed', label: 'Order placed', icon: Package, time: stageTimes.placed, done: true },
        { key: 'accepted', label: 'Accepted by vendor', icon: CheckCircle2, time: stageTimes.accepted, done: ['Preparing', 'Completed', 'Dispatched', 'Delivered'].includes(currentStatus) || !!stageTimes.accepted },
        { key: 'dispatched', label: isDelivery ? 'Out for delivery' : 'Ready for pickup', icon: Truck, time: stageTimes.dispatched, done: ['Dispatched', 'Completed', 'Delivered'].includes(currentStatus) || !!stageTimes.dispatched },
        { key: 'completed', label: isDelivery ? 'Delivered' : 'Picked up', icon: CheckCircle2, time: stageTimes.completed, done: ['Completed', 'Delivered'].includes(currentStatus) || !!stageTimes.completed },
    ] as const;

    const handleAccept = async () => {
        if (!onAccept) return;
        setAccepting(true);
        try {
            await onAccept(order);
            onClose();
        } catch {
            // error handled by caller
        } finally {
            setAccepting(false);
        }
    };

    const handleReject = async () => {
        if (!onReject) return;
        setRejecting(true);
        try {
            await onReject(order);
            onClose();
        } catch {
            // error handled by caller
        } finally {
            setRejecting(false);
        }
    };

    const statusColor = (s: string) => {
        if (s === 'success') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (s === 'failed') return 'bg-red-50 text-red-700 border-red-200';
        if (s === 'refunded') return 'bg-purple-50 text-purple-700 border-purple-200';
        return 'bg-amber-50 text-amber-700 border-amber-200';
    };

    const dotColor = (s: string) => {
        if (s === 'success') return 'bg-emerald-500';
        if (s === 'failed') return 'bg-red-500';
        if (s === 'refunded') return 'bg-purple-500';
        return 'bg-amber-500';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[60]"
                    />

                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="fixed inset-0 sm:left-auto sm:right-0 sm:w-[480px] bg-white h-full shadow-2xl z-[70] flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-gray-900 px-5 pt-5 pb-4 shrink-0">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Order Details</p>
                                    <h2 className="text-[26px] font-black text-white tracking-tight leading-none">{displayToken}</h2>
                                </div>
                                <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors mt-1">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest ${order.payment_status === 'success' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                                    {order.payment_status === 'success' ? 'PAID' : 'COD'}
                                </span>
                                <span className="text-[11px] font-semibold text-gray-400">
                                    {new Date(order.orderDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-gray-600">·</span>
                                <span className="text-[11px] font-semibold text-gray-400">{itemsCount} items</span>
                                <span className="text-gray-600">·</span>
                                <span className="text-[13px] font-black text-white">₹{order.grandTotal}</span>
                            </div>
                        </div>

                        {/* Scrollable content */}
                        <div className={`flex-1 overflow-y-auto bg-gray-50 ${isActionable ? 'pb-28' : 'pb-6'}`}>

                            {/* Timeline */}
                            <div className="bg-white mx-3 mt-3 rounded-xl border border-gray-100 px-4 py-4">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Order Timeline</p>
                                <div className="relative pl-1">
                                    <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-gray-100" />
                                    {timelineSteps.map((step, idx) => {
                                        const nextStep = timelineSteps[idx + 1];
                                        const gap = nextStep ? durationBetween(step.time, nextStep.time) : null;
                                        const StepIcon = step.icon;
                                        return (
                                            <div key={step.key} className="relative pb-5 last:pb-0">
                                                <div className="flex gap-3.5 items-start">
                                                    <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                                                        <StepIcon size={10} className={step.done ? 'text-white' : 'text-gray-400'} />
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-[13px] font-bold leading-none ${step.done ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                                                        <p className="text-[11px] text-gray-500 mt-1">{fmt(step.time)}</p>
                                                        {gap && (
                                                            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
                                                                <Clock size={8} /> {gap}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Items */}
                            <div className="bg-white mx-3 mt-2 rounded-xl border border-gray-100 overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-50">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{itemsCount} Items</p>
                                </div>
                                {order.items.map((item: OrderItem, idx: number) => (
                                    <div key={idx} className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-50 last:border-0">
                                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                                            {item.imageURL ? (
                                                <img
                                                    src={isCloudinaryUrl(item.imageURL) ? cldUrl(item.imageURL, 80) : item.imageURL}
                                                    alt={item.name}
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <ImageIcon className="text-gray-300" size={18} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[14px] font-bold text-gray-900 leading-tight">{item.name}</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">₹{item.price} × {item.quantity}</p>
                                        </div>
                                        <p className="text-[14px] font-bold text-gray-900 shrink-0">₹{item.price * item.quantity}</p>
                                    </div>
                                ))}
                                {/* Totals */}
                                <div className="px-4 py-3 bg-gray-50 space-y-1.5">
                                    <div className="flex justify-between text-[12px] text-gray-500">
                                        <span>Subtotal</span><span>₹{subtotal}</span>
                                    </div>
                                    {order.dukanFee > 0 && (
                                        <div className="flex justify-between text-[12px] text-gray-500">
                                            <span>Platform fee</span><span>₹{order.dukanFee}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-[12px] text-gray-500">
                                        <span>Delivery</span>
                                        <span className="text-emerald-600 font-semibold">{order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}</span>
                                    </div>
                                    <div className="flex justify-between text-[14px] font-black text-gray-900 pt-1.5 border-t border-gray-200">
                                        <span>Grand Total</span><span>₹{order.grandTotal}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Customer */}
                            {order.deliveryAddress && !isPOS && (
                                <div className="bg-white mx-3 mt-2 rounded-xl border border-gray-100 px-4 py-4">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Deliver To</p>
                                    <p className="text-[15px] font-black text-gray-900">{order.deliveryAddress.name || 'Guest'}</p>
                                    {order.deliveryAddress.hostelNumber && (
                                        <p className="text-[13px] text-gray-600 mt-0.5">
                                            Hostel {order.deliveryAddress.hostelNumber}
                                            {order.deliveryAddress.roomNumber ? `, Room ${order.deliveryAddress.roomNumber}` : ''}
                                        </p>
                                    )}
                                    {(order.customerPhone || order.deliveryAddress.mobile) && (
                                        <p className="text-[13px] text-indigo-600 font-semibold mt-1">
                                            {order.customerPhone || order.deliveryAddress.mobile}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Payment */}
                            <div className="bg-white mx-3 mt-2 rounded-xl border border-gray-100 px-4 py-4">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Payment</p>
                                {isPOS ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                            <Banknote size={17} className="text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-[14px] font-bold text-gray-900">In-Store Payment</p>
                                            <p className="text-[11px] text-gray-500">{order.payment_provider === 'UPI' ? 'UPI' : 'Cash'} · POS</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[13px] text-gray-500">Status</span>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor(order.payment_status || '')}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor(order.payment_status || '')}`} />
                                                {order.payment_status?.toUpperCase() || 'PENDING'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[13px] text-gray-500">Provider</span>
                                            <span className="text-[13px] font-bold text-gray-900">{order.payment_provider?.toUpperCase() || 'ONLINE'}</span>
                                        </div>
                                        {order.payment_transaction_id && (
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[13px] text-gray-500 shrink-0">Txn ID</span>
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="text-[11px] font-mono text-gray-600 truncate">{order.payment_transaction_id}</span>
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText(order.payment_transaction_id || ''); toast.success('Copied!'); }}
                                                        className="text-gray-400 hover:text-indigo-600 shrink-0 transition-colors"
                                                    >
                                                        <ClipboardList size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Payment audit */}
                            {!isPOS && order.payment_details && (
                                <div className="bg-white mx-3 mt-2 mb-2 rounded-xl border border-gray-100 px-4 py-4">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Payment Audit</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                        {[
                                            { label: 'CF Payment ID', value: order.payment_details.cf_payment_id },
                                            { label: 'Bank Ref', value: order.payment_details.bank_reference },
                                            { label: 'Gateway', value: order.payment_details.payment_group },
                                            { label: 'Txn Time', value: order.payment_details.payment_time },
                                            { label: 'Method', value: typeof order.payment_details.payment_method === 'object' ? Object.keys(order.payment_details.payment_method)[0] : order.payment_details.payment_method },
                                        ].map((f, i) => f.value ? (
                                            <div key={i} className="flex flex-col">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</span>
                                                <span className="text-[12px] font-semibold text-gray-700 break-all leading-tight">{f.value}</span>
                                            </div>
                                        ) : null)}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Accept / Reject actions */}
                        {isActionable && (
                            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex gap-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] z-20">
                                <button
                                    onClick={handleReject}
                                    disabled={rejecting || accepting}
                                    className="flex-1 py-3.5 rounded-xl font-bold text-[14px] text-gray-700 border border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50 transition-colors"
                                >
                                    {rejecting ? 'Rejecting…' : 'Reject'}
                                </button>
                                <button
                                    onClick={handleAccept}
                                    disabled={accepting || rejecting}
                                    className="flex-[2] py-3.5 rounded-xl font-black text-[14px] text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2"
                                >
                                    {accepting ? (
                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Accepting…</>
                                    ) : (
                                        'Accept & Print'
                                    )}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
