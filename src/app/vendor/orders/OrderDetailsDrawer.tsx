'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MoreHorizontal, ClipboardList, Truck, Package, RotateCcw, Image as ImageIcon, Banknote } from 'lucide-react';
import { Order, OrderItem } from '@/types';
import toast from 'react-hot-toast';

interface OrderDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
}

export default function OrderDetailsDrawer({ isOpen, onClose, order }: OrderDetailsDrawerProps) {
    if (!order) return null;

    const isPOS = order.orderType === 'pos';
    const displayToken = isPOS ? `POS-#${order.orderToken || order.id.slice(0, 6)}` : order.id.slice(0, 8).toUpperCase();
    
    // Delivery vs Walk-in info
    const isDelivery = order.deliveryAddress?.deliveryType?.toLowerCase() === 'delivery';

    // Timeline helpers
    const getTimeString = (step: 'placed' | 'accepted' | 'preparing' | 'dispatched' | 'completed' | 'cancelled') => {
        // @ts-ignore dynamic index
        const t = order.timeline?.[step];
        if (!t) return null;
        const d = typeof (t as any).toDate === 'function' ? (t as any).toDate() : new Date(t as any);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const isActionable = order.status === 'Placed' || order.status === 'Pending';
    const itemsCount = order.items.reduce((s, i) => s + i.quantity, 0);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Dark Backdrop (desktop) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] hidden sm:block"
                    />

                    {/* Drawer Container */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                        className="fixed inset-0 sm:left-auto sm:right-0 sm:w-[500px] bg-[#f7f7f7] h-full shadow-2xl z-[70] flex flex-col sm:border-l sm:border-gray-200"
                    >
                        {/* Top Green Banner */}
                        <div className="bg-[#488e14] text-white py-2 text-center text-xs font-semibold tracking-wide shadow-sm z-20 shrink-0">
                            😋 Fresh Food Delivered To Your Hostel! 😋
                        </div>

                        {/* White Navigation Header */}
                        <div className="bg-white px-4 py-3 flex items-center justify-between shadow-sm z-20 shrink-0 sticky top-0">
                            <div className="flex items-center gap-3">
                                <button onClick={onClose} className="text-gray-700 hover:bg-gray-100 p-1 rounded-md transition-colors">
                                    <ArrowLeft size={24} strokeWidth={2} />
                                </button>
                                <h2 className="text-[17px] font-semibold text-gray-900 tracking-tight">Order #{displayToken}</h2>
                            </div>
                            <button className="text-gray-700 hover:bg-gray-100 p-1 rounded-md transition-colors">
                                <MoreHorizontal size={24} />
                            </button>
                        </div>

                        {/* Content Scrollable Area */}
                        <div className="flex-1 overflow-y-auto w-full bg-white pb-safe">
                            
                            {/* Store Header Info */}
                            <div className="px-4 py-4 flex gap-4 border-b border-gray-100">
                                <div className="w-12 h-12 bg-white border border-gray-200 shadow-sm flex items-center justify-center rounded-sm shrink-0">
                                    <img src="/logo.png" alt="Aroma" className="w-8 h-8 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<span class="font-bold text-gray-400 text-xs">AROMA</span>'; }} />
                                </div>
                                <div className="flex flex-col justify-center">
                                    <h3 className="text-[15px] font-medium text-[#d92c59]">Aroma Dhaba</h3>
                                    <p className="text-[13px] text-gray-500 mt-0.5">
                                        {new Date(order.orderDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | {itemsCount} Items | ₹{order.grandTotal}
                                    </p>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="px-4 py-6 border-b border-gray-100 relative">
                                <div className="absolute left-[33px] top-10 bottom-12 w-[2px] bg-gray-200 z-0" />

                                {/* Step 1: Confirmed */}
                                <div className="flex gap-4 relative z-10 mb-8">
                                    <div className="bg-white p-1">
                                        <ClipboardList size={22} className="text-gray-400" strokeWidth={1.5} />
                                    </div>
                                    <div className="flex-1 flex justify-between items-start pt-0.5">
                                        <div className="flex flex-col">
                                            <span className="text-[15px] font-medium text-gray-900">Order Confirmed</span>
                                            {getTimeString('accepted') && <span className="text-[13px] text-gray-500">{getTimeString('accepted')}</span>}
                                        </div>
                                        {order.status !== 'Pending' && order.status !== 'Cancelled' && (
                                            <span className="px-2 py-0.5 bg-[#2eaa25] text-white text-[10px] font-bold rounded">DONE</span>
                                        )}
                                    </div>
                                </div>

                                {/* Step 2: Preparing/Shipped */}
                                {(order.status === 'Dispatched' || order.status === 'Completed' || order.status === 'Delivered') && (
                                    <div className="flex gap-4 relative z-10 mb-8">
                                        <div className="bg-white p-1">
                                            <Truck size={22} className="text-gray-400" strokeWidth={1.5} />
                                        </div>
                                        <div className="flex-1 flex justify-between items-start pt-0.5">
                                            <div className="flex flex-col">
                                                <span className="text-[15px] font-medium text-gray-900">Order Dispatched</span>
                                                {getTimeString('dispatched') && <span className="text-[13px] text-gray-500">{getTimeString('dispatched')}</span>}
                                            </div>
                                            <span className="px-2 py-0.5 bg-[#2eaa25] text-white text-[10px] font-bold rounded">DONE</span>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Delivered */}
                                <div className="flex gap-4 relative z-10">
                                    <div className="bg-white p-1">
                                        <Package size={22} className={order.status === 'Completed' || order.status === 'Delivered' ? "text-[#d92c59]" : "text-gray-400"} strokeWidth={1.5} />
                                    </div>
                                    <div className="flex-1 flex justify-between items-start pt-0.5">
                                        <div className="flex flex-col pr-8">
                                            <span className={`text-[15px] font-medium ${order.status === 'Completed' || order.status === 'Delivered' ? 'text-[#d92c59]' : 'text-gray-900'}`}>{isDelivery ? 'To Be Delivered' : 'Ready For Pickup'}</span>
                                            <span className="text-[13px] text-gray-500 mt-1 leading-relaxed">
                                                {order.status === 'Completed' || order.status === 'Delivered' 
                                                    ? `Delivered on ${getTimeString('completed') || 'time'}.`
                                                    : `Your order is expected to be ${isDelivery ? 'delivered' : 'ready'} soon.`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Wrapper */}
                            <div className="bg-gray-50/50">
                                {/* Items Header */}
                                <div className="px-4 pt-6 pb-2 border-b border-gray-100 bg-white">
                                    <span className="text-[13px] text-gray-500 font-medium tracking-wide uppercase">{itemsCount} ITEMS</span>
                                </div>

                                {/* Items List */}
                                <div className="bg-white border-b border-gray-100">
                                    {order.items.map((item: OrderItem, idx: number) => (
                                        <div key={idx} className="px-4 py-4 flex items-start gap-4 border-b border-gray-50 last:border-b-0">
                                            {/* Item Image */}
                                            <div className="w-14 h-14 bg-gray-50 border border-gray-200 rounded-md overflow-hidden shrink-0 flex items-center justify-center">
                                                {item.imageURL ? (
                                                    <img src={item.imageURL} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <ImageIcon className="text-gray-300" size={24} />
                                                )}
                                            </div>
                                            
                                            {/* Item Info */}
                                            <div className="flex-1 flex justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[15px] text-gray-800 leading-tight">{item.name}</span>
                                                    <span className="text-[13px] text-gray-500 mt-0.5">per piece</span>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <div className="flex items-center justify-center border border-[#d92c59] bg-pink-50 text-[#d92c59] text-xs font-semibold px-2 py-0.5 rounded-sm">
                                                            {item.quantity}
                                                        </div>
                                                        <span className="text-[13px] text-gray-600">x ₹{item.price}</span>
                                                    </div>
                                                </div>
                                                <span className="text-[15px] text-gray-800 self-end mb-0.5">₹{item.price * item.quantity}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Bill Details */}
                                <div className="bg-white border-b border-gray-100 px-4 py-4 pb-6 space-y-3">
                                    <div className="flex justify-between items-center text-[14px]">
                                        <span className="text-gray-600">Item MRP</span>
                                        <span className="text-gray-900">₹{order.itemTotal}</span>
                                    </div>
                                    {order.dukanFee > 0 && (
                                        <div className="flex justify-between items-center text-[14px]">
                                            <span className="text-gray-600">Platform Fee</span>
                                            <span className="text-gray-900">₹{order.dukanFee}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-[14px]">
                                        <span className="text-gray-600">Delivery</span>
                                        <span className="text-[#2eaa25] font-medium">{order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-3 mt-1 border-t border-gray-100">
                                        <span className="text-[15px] font-bold text-gray-900">Grand total</span>
                                        <span className="text-[15px] font-bold text-gray-900">₹{order.grandTotal}</span>
                                    </div>
                                </div>

                                {/* Payment Details */}
                                <div className="bg-white border-b border-gray-100 px-4 py-5">
                                    <span className="block text-[13px] text-gray-500 font-medium tracking-wide uppercase mb-4">PAYMENT DETAILS</span>
                                    
                                    {isPOS ? (
                                        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                                            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                <Banknote size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[14px] font-bold text-gray-900">In-Store Payment</p>
                                                <p className="text-[12px] text-gray-500 font-medium mt-0.5">{order.payment_provider === 'UPI' ? 'UPI' : 'Cash'} · POS Order</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {/* Status Badge */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[13px] text-gray-500 font-medium">Status</span>
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                                                    order.payment_status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                    order.payment_status === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                    order.payment_status === 'refunded' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                                    'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        order.payment_status === 'success' ? 'bg-emerald-500' :
                                                        order.payment_status === 'failed' ? 'bg-red-500' :
                                                        order.payment_status === 'refunded' ? 'bg-purple-500' :
                                                        'bg-amber-500'
                                                    }`} />
                                                    {order.payment_status?.toUpperCase() || 'PENDING'}
                                                </span>
                                            </div>

                                            {/* Provider */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[13px] text-gray-500 font-medium">Provider</span>
                                                <span className="text-[13px] font-bold text-gray-900">{order.payment_provider?.toUpperCase() || 'ONLINE'}</span>
                                            </div>

                                            {/* Amount */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[13px] text-gray-500 font-medium">Amount</span>
                                                <span className="text-[13px] font-bold text-gray-900">₹{order.payment_amount || order.grandTotal}</span>
                                            </div>

                                            {/* Transaction ID */}
                                            {order.payment_transaction_id && (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[13px] text-gray-500 font-medium shrink-0">Txn ID</span>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-[12px] font-mono text-gray-600 truncate">{order.payment_transaction_id}</span>
                                                        <button
                                                            onClick={() => { navigator.clipboard.writeText(order.payment_transaction_id || ''); toast.success('Copied!'); }}
                                                            className="text-gray-400 hover:text-gray-700 transition-colors shrink-0 p-1 rounded hover:bg-gray-100"
                                                            title="Copy Transaction ID"
                                                        >
                                                            <ClipboardList size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Verified At */}
                                            {order.payment_verified_at && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[13px] text-gray-500 font-medium">Verified</span>
                                                    <span className="text-[12px] text-gray-600">{new Date(order.payment_verified_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Your Details */}
                                <div className="bg-white px-4 py-6 border-b border-gray-100 mb-16">
                                    <span className="block text-[13px] text-gray-500 font-medium tracking-wide uppercase mb-4">YOUR DETAILS</span>
                                    
                                    <div className="grid grid-cols-[100px_1fr] gap-y-3 text-[14px]">
                                        <span className="text-gray-900 font-medium">Name:</span>
                                        <span className="text-gray-600 uppercase">{order.deliveryAddress?.name || (isPOS ? 'GUEST' : 'UNKNOWN')}</span>

                                        <span className="text-gray-900 font-medium">Mobile:</span>
                                        <span className="text-gray-600">{order.deliveryAddress?.mobile || order.customerPhone || 'N/A'}</span>

                                        <span className="text-gray-900 font-medium">Address:</span>
                                        <span className="text-gray-600">{isPOS ? 'WALK-IN' : order.deliveryAddress?.hostelNumber ? `HOSTEL ${order.deliveryAddress.hostelNumber}` : 'N/A'}</span>

                                        <span className="text-gray-900 font-medium">City:</span>
                                        <span className="text-gray-600">Mumbai</span>

                                        <span className="text-gray-900 font-medium">State:</span>
                                        <span className="text-gray-600">Maharashtra</span>

                                        <span className="text-gray-900 font-medium">Pin Code:</span>
                                        <span className="text-gray-600">400076</span>

                                        <span className="text-gray-900 font-medium">Payment:</span>
                                        <span className="text-gray-600">{order.payment_provider ? `${order.payment_provider.toUpperCase()} (${order.payment_status?.toUpperCase()})` : (isPOS ? 'In-store Payment' : 'Online Payment')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sticky Action Bottom Bar (For pending orders) */}
                        {isActionable && (
                            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe flex gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20">
                                <button className="flex-1 py-3.5 rounded bg-white text-gray-700 font-medium text-[15px] border border-gray-300 hover:bg-gray-50 transition-colors">
                                    Reject Order
                                </button>
                                <button className="flex-[2] py-3.5 rounded bg-[#488e14] text-white font-medium text-[15px] hover:bg-[#3d7a11] transition-colors shadow-sm">
                                    Accept Order
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
