'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import OrderSummaryPanel from '@/components/checkout/OrderSummaryPanel';
import PaymentFooter from '@/components/checkout/PaymentFooter';
import { useCartStore } from '@/store/cartStore';
import { useAuth } from '@/contexts/AuthContext';
import { createOrder, upsertUserProfile, getUserByPhone } from '@/lib/firestore';
import { listenToStoreStatus } from '@/lib/vendor';
import { IIM_MUMBAI_HOSTELS } from '@/lib/hostels';
import { load } from '@cashfreepayments/cashfree-js';
// import PayUForm from '@/components/checkout/PayUForm';
import toast from 'react-hot-toast';
import { Trash2, CreditCard, ChevronDown, CheckCircle2 } from 'lucide-react';
import EmptyCart from '@/components/cart/EmptyCart';

type Step = 1 | 2 | 3 | 4;

interface InfoData {
    name: string;
    hostelNumber: string;
    roomNumber: string;
    deliveryType: 'Delivery' | 'Takeaway';
}

export default function CheckoutPage() {
    const router = useRouter();
    const { user, openAuthModal, phoneNumber, userProfile, setUserProfile } = useAuth();
    const items = useCartStore((s) => s.items);
    const subtotal = useCartStore((s) => s.subtotal());
    const dukanFee = useCartStore((s) => s.dukanFee());
    const deliveryFee = useCartStore((s) => s.deliveryFee());
    const grandTotal = useCartStore((s) => s.grandTotal());
    const removeItem = useCartStore((s) => s.removeItem);
    const updateQuantity = useCartStore((s) => s.updateQuantity);
    const clearCart = useCartStore((s) => s.clearCart);

    const [step, setStep] = useState<Step>(1);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isStoreOpen, setIsStoreOpen] = useState(true);
    const [cashfree, setCashfree] = useState<any>(null);

    useEffect(() => {
        setIsMounted(true);
        const unsub = listenToStoreStatus(setIsStoreOpen);

        // Pre-load Cashfree SDK
        const initCashfree = async () => {
            try {
                const cf = await load({ 
                    mode: (process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT?.toLowerCase() || 'sandbox') as "sandbox" | "production"
                });
                setCashfree(cf);
                console.log('[Checkout] Cashfree SDK initialized');
            } catch (err) {
                console.warn('[Checkout] Failed to pre-load Cashfree SDK:', err);
            }
        };
        initCashfree();

        return () => unsub();
    }, []);

    // ─── Info form state ──────────────────────────────────────────────────────
    const [infoData, setInfoData] = useState<InfoData>({
        name: userProfile?.name ?? '',
        hostelNumber: userProfile?.lastHostel ?? '',
        roomNumber: userProfile?.lastRoom ?? '',
        deliveryType: 'Delivery',
    });

    // ─── Pre-fill from Firestore on mount ─────────────────────────────────────
    // If the user just logged in but userProfile isn't in context yet,
    // fetch their document directly by phone number (fast — no query needed).
    useEffect(() => {
        const loadProfile = async () => {
            if (!phoneNumber) return;

            // Fast path: context already has the profile
            if (userProfile) {
                setInfoData((prev) => ({
                    ...prev,
                    name: prev.name || userProfile.name,
                    hostelNumber: prev.hostelNumber || userProfile.lastHostel,
                    roomNumber: prev.roomNumber || userProfile.lastRoom,
                }));
                return;
            }

            // Slow path: fetch from Firestore by Phone Number
            try {
                const profile = await getUserByPhone(phoneNumber);
                if (profile) {
                    setUserProfile(profile);
                    setInfoData((prev) => ({
                        ...prev,
                        name: prev.name || profile.name,
                        hostelNumber: prev.hostelNumber || profile.lastHostel,
                        roomNumber: prev.roomNumber || profile.lastRoom,
                    }));
                    console.log('[Checkout] Pre-filled form from Firestore:', profile);
                }
            } catch (err) {
                console.warn('[Checkout] Could not load user profile:', err);
            }
        };
        loadProfile();
    }, [phoneNumber, userProfile, setUserProfile]);

    const infoValid =
        infoData.name.trim() !== '' &&
        infoData.hostelNumber !== '' &&
        infoData.roomNumber.trim() !== '';

    // ─── Step 1 → 2 ──────────────────────────────────────────────────────────
    const handleContinueFromCart = () => {
        if (items.length === 0) {
            toast.error('Your cart is empty!');
            return;
        }
        if (!user || !phoneNumber) {
            toast.error('You must log in with your phone number first!');
            openAuthModal();
            return;
        }
        setStep(2);
    };

    // ─── Step 2 → 3 ──────────────────────────────────────────────────────────
    const handleContinueFromAddress = () => setStep(3);

    // ─── Step 3 → 4: save address to Firestore users/{uid} ───────────────────
    const handleContinueFromInfo = async () => {
        if (!infoValid) {
            toast.error('Please fill in Name, Hostel, and Room Number');
            return;
        }

        // Save address to Firestore using phoneNumber as the Document ID
        if (phoneNumber) {
            try {
                await upsertUserProfile(
                    phoneNumber,
                    infoData.name.trim(),
                    infoData.hostelNumber,
                    infoData.roomNumber.trim(),
                    false
                );
                console.log('[Firestore] Address saved to users/', phoneNumber);
                toast.success('Address saved!');
            } catch (err) {
                console.warn('[Firestore] Address save failed (non-critical):', err);
                // Non-critical — still allow proceeding to payment
            }
        }
        setStep(4);
    };

    // ─── Step 4: Initiate Payment Session ───────
    const handlePlaceOrder = async () => {
        if (!user || !phoneNumber) {
            toast.error('You must log in with your phone number first!');
            openAuthModal();
            return;
        }
        setPaymentLoading(true);

        try {
            const orderItems = items.map((i) => ({
                productId: i.product.id,
                name: i.product.name,
                price: i.product.price,
                quantity: i.quantity,
                imageURL: i.product.imageURL ?? '',
            }));

            // POST to Payment API
            const token = await user.getIdToken();
            const res = await fetch('/api/payment/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    customerPhone: phoneNumber ? (phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`) : '',
                    customerEmail: user.email || '',
                    items: orderItems,
                    itemTotal: subtotal,
                    dukanFee,
                    deliveryFee,
                    grandTotal,
                    deliveryAddress: {
                        name: infoData.name.trim(),
                        mobile: phoneNumber ?? '',
                        hostelNumber: infoData.hostelNumber,
                        roomNumber: infoData.roomNumber.trim(),
                        deliveryType: infoData.deliveryType,
                    }
                })
            });

            const textData = await res.text();
            let data;
            try {
                data = JSON.parse(textData);
            } catch (e) {
                console.error('[Checkout] API returned non-JSON:', textData);
                throw new Error(`Server error (${res.status}). Make sure Vercel environment variables are correct!`);
            }

            if (!res.ok) {
                throw new Error(data.error || 'Failed to initiate payment');
            }

            // Update user profile in background
            upsertUserProfile(
                phoneNumber ?? '',
                infoData.name.trim(),
                infoData.hostelNumber,
                infoData.roomNumber.trim(),
                true // isPlacingOrder
            ).catch(err => console.error('[Checkout] Background profile update failed:', err));

            // Use Cashfree SDK to open the checkout integrated experience
            if (data.session?.payload?.payment_session_id) {
                const sessionId = data.session.payload.payment_session_id;
                console.log('[Checkout] Initiating Cashfree SDK redirect with Session ID:', sessionId);

                try {
                    const cfInstance = cashfree || await load({ 
                        mode: (process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT?.toLowerCase() || 'sandbox') as "sandbox" | "production"
                    });
                    
                    // Delay cart clearing until we're fairly certain the SDK is taking over
                    // Using _self forces a full page redirect instead of an in-app modal
                    await cfInstance.checkout({
                        paymentSessionId: sessionId,
                        redirectTarget: "_self", 
                    });
                    
                    // Clear cart after SDK is triggered
                    clearCart();
                } catch (sdkError) {
                    console.error('[Checkout] Cashfree SDK failure:', sdkError);
                    throw new Error('Payment gateway failed to initialize.');
                }
            } else {
                throw new Error('No payment session received');
            }

        } catch (error: any) {
            console.error('[Checkout] Payment initialization failed:', error);
            toast.error(error.message || 'Failed to start payment. Please try again.');
            setPaymentLoading(false);
        }
    };

    if (!isMounted) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col relative">
            {!isStoreOpen && (
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md text-center">
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                            ❌
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Store is Closed</h2>
                        <p className="text-gray-500 mb-6">Aroma Dhaba is currently not accepting new orders. Please try again later.</p>
                        <button onClick={() => router.push('/menu')} className="bg-red-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-red-600 transition-colors">
                            Return to Menu
                        </button>
                    </div>
                </div>
            )}

            <Header variant="checkout" checkoutStep={step} />

            <div className="flex-1 max-w-5xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-6 flex flex-col md:flex-row gap-4 sm:gap-6 items-start">
                {/* Left: Step content */}
                <div className="flex-1">

                    {/* ─── STEP 1: CART ─── */}
                    {step === 1 && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h1 className="text-xl font-bold text-gray-900">
                                    Shopping cart{' '}
                                    <span className="text-gray-500 font-normal text-base">
                                        ({items.length} {items.length === 1 ? 'Item' : 'Items'})
                                    </span>
                                </h1>
                                <p className="text-lg font-bold text-gray-900">Total ₹{grandTotal}</p>
                            </div>

                            {items.length === 0 ? (
                                <EmptyCart />
                            ) : (
                                <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50 shadow-sm overflow-hidden">
                                    {items.map((item) => (
                                        <div key={item.product.id} className="flex items-center gap-4 p-4">
                                            <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                                                {item.product.imageURL ? (
                                                    <img src={item.product.imageURL} alt={item.product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">🍽</div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900">{item.product.name}</p>
                                                <p className="text-gray-900 font-bold mt-1">₹{item.product.price}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-xs text-gray-500">Qty:</span>
                                                    <select
                                                        value={item.quantity}
                                                        onChange={(e) => updateQuantity(item.product.id, Number(e.target.value))}
                                                        className="border border-gray-200 rounded-lg text-sm py-1 px-2 focus:outline-none focus:ring-1 focus:ring-red-300"
                                                    >
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                                            <option key={n} value={n}>{n}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeItem(item.product.id)}
                                                className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors font-medium"
                                            >
                                                <Trash2 size={13} />
                                                REMOVE
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── STEP 2: ADDRESS CONFIRMATION ─── */}
                    {step === 2 && (
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 mb-6">Confirm delivery location</h1>
                            <div className="bg-white rounded-xl border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                                        <span className="text-red-500 text-lg">📍</span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 text-sm">IIM Mumbai Campus</p>
                                        <p className="text-xs text-gray-400">Powai, Mumbai — 400087</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                                    You'll enter your hostel and room details in the next step.
                                    {(userProfile || infoData.name) && (
                                        <span className="block mt-1 font-medium text-green-600">
                                            ✓ Your last delivery info is ready to pre-fill!
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ─── STEP 3: INFO (Name + Hostel Dropdown + Room) ─── */}
                    {step === 3 && (
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 mb-1">Fill delivery information</h1>
                            <p className="text-sm text-gray-400 mb-6">
                                {infoData.name
                                    ? '✓ Pre-filled from your last order — confirm or update below.'
                                    : 'Tell us where to deliver your order.'}
                            </p>
                            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Your Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={infoData.name}
                                        onChange={(e) => setInfoData((p) => ({ ...p, name: e.target.value }))}
                                        placeholder="Full name"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Hostel Dropdown — IIM Mumbai specific */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Hostel <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={infoData.hostelNumber}
                                                onChange={(e) => setInfoData((p) => ({ ...p, hostelNumber: e.target.value }))}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition bg-white"
                                            >
                                                <option value="">Select hostel</option>
                                                {IIM_MUMBAI_HOSTELS.map((h: string) => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Room Number */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Room Number <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={infoData.roomNumber}
                                            onChange={(e) => setInfoData((p) => ({ ...p, roomNumber: e.target.value.replace(/\D/g, '') }))}
                                            placeholder="e.g. 102"
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition"
                                        />
                                    </div>
                                </div>

                                {/* Delivery vs Takeaway */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Delivery type <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={infoData.deliveryType}
                                            onChange={(e) => setInfoData((p) => ({ ...p, deliveryType: e.target.value as 'Delivery' | 'Takeaway' }))}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition bg-white"
                                        >
                                            <option value="Delivery">Delivery</option>
                                            <option value="Takeaway">Takeaway</option>
                                        </select>
                                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>

                                {!infoValid && (
                                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                                        ⚠ Please fill in all required fields to continue.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── STEP 4: PLACE ORDER (Payment bypassed) ─── */}
                    {step === 4 && (
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 mb-6">Confirm & Place Order</h1>
                            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                <div className="p-6">
                                    {/* Order summary */}
                                    <h3 className="font-semibold text-gray-900 mb-4">Order Details</h3>

                                    {/* Delivery info */}
                                    <div className="mb-5 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 border border-gray-100 space-y-1.5">
                                        <p className="font-semibold text-gray-800 mb-1">📦 Delivery to</p>
                                        <p><span className="font-medium">Name:</span> {infoData.name}</p>
                                        <p><span className="font-medium">Hostel:</span> {infoData.hostelNumber}, Room {infoData.roomNumber}</p>
                                        <p><span className="font-medium">Type:</span> {infoData.deliveryType}</p>
                                        {phoneNumber && <p><span className="font-medium">Mobile:</span> {phoneNumber}</p>}
                                    </div>

                                    {/* Items recap */}
                                    <div className="border-t border-gray-100 pt-4 mb-5 space-y-2">
                                        {items.map((i) => (
                                            <div key={i.product.id} className="flex justify-between text-sm text-gray-700">
                                                <span>{i.product.name} × {i.quantity}</span>
                                                <span className="font-medium">₹{i.product.price * i.quantity}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Payment note */}
                                    <div className="p-4 bg-gray-100 rounded-xl flex items-start gap-4 mb-5">
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm text-lg">
                                            🔒
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm mb-1">Secure Payment</p>
                                            <p className="text-gray-500 font-medium leading-relaxed text-xs">
                                                You will be securely redirected to Cashfree Payments. Order is placed upon successful payment.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Place Order CTA */}
                                    <button
                                        onClick={handlePlaceOrder}
                                        disabled={paymentLoading || !isStoreOpen}
                                        className="w-full bg-gray-900 hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
                                    >
                                        {paymentLoading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                                Initiating Payment...
                                            </>
                                        ) : (
                                            <>
                                                <CreditCard size={18} />
                                                Proceed to Pay · ₹{grandTotal}
                                            </>
                                        )}
                                    </button>

                                    {/* Disabled second-click protection hint */}
                                    {paymentLoading && (
                                        <p className="text-center text-xs text-gray-400 mt-2">
                                            Saving your order to Firestore…
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Order Summary Panel */}
                <OrderSummaryPanel
                    subtotal={subtotal}
                    dukanFee={dukanFee}
                    deliveryFee={deliveryFee}
                    grandTotal={grandTotal}
                    showContinue={step < 4}
                    onContinue={
                        step === 1 ? handleContinueFromCart :
                            step === 2 ? handleContinueFromAddress :
                                step === 3 ? handleContinueFromInfo :
                                    undefined
                    }
                    continueLabel={step === 3 && !infoValid ? 'Fill All Fields' : 'Continue'}
                />
            </div>

            <PaymentFooter />
        </div>
    );
}
