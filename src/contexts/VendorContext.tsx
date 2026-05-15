'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    listenToLiveOrders,
    listenToStoreStatus,
    toggleStoreStatus,
    listenToProducts,
    listenToPosProducts,
    updateOrderStatus,
    listenToSettlementLock,
} from '@/lib/vendor';
import { Order, Product, Settlement } from '@/types';
import toast from 'react-hot-toast';
import { Bell } from 'lucide-react';

const AUDIO_NEW_ORDER = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';
const AUDIO_CANCEL = 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3';
const AUDIO_RED_ZONE = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';
const AUDIO_DISPATCH = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

interface VendorContextValue {
    orders: Order[];
    products: Product[];
    posProducts: Product[];
    isStoreOpen: boolean;
    toggleStore: () => Promise<void>;
    unlockAudio: () => void;
    playDispatchSound: () => void;
    // Settlement
    currentSettlement: Settlement | null;
    settlementLocked: boolean;
    isOnlineOrdersLocked: boolean;
    refreshSettlement: () => Promise<void>;
}

const VendorContext = createContext<VendorContextValue | null>(null);

export function VendorProvider({ children }: { children: React.ReactNode }) {
    const { user, phoneNumber } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [posProducts, setPosProducts] = useState<Product[]>([]);
    const [isStoreOpen, setIsStoreOpen] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    // Settlement — fetched via API (avoids Firestore client permission issues)
    const [currentSettlement, setCurrentSettlement] = useState<Settlement | null>(null);
    const [settlementLocked, setSettlementLocked] = useState(false);

    // isOnlineOrdersLocked is driven by the real-time settlementLocked field on storeSettings
    const isOnlineOrdersLocked = settlementLocked;

    // Audio Refs
    const audioNewRef = useRef<HTMLAudioElement | null>(null);
    const audioCancelRef = useRef<HTMLAudioElement | null>(null);
    const audioRedRef = useRef<HTMLAudioElement | null>(null);
    const audioDispatchRef = useRef<HTMLAudioElement | null>(null);
    const audioUnlocked = useRef(false);
    const redAlertedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (typeof window !== 'undefined') {
            audioNewRef.current = new Audio(AUDIO_NEW_ORDER);
            audioCancelRef.current = new Audio(AUDIO_CANCEL);
            audioRedRef.current = new Audio(AUDIO_RED_ZONE);
            audioDispatchRef.current = new Audio(AUDIO_DISPATCH);
            audioNewRef.current.volume = 0.7;
            audioCancelRef.current.volume = 0.5;
            if (audioRedRef.current) audioRedRef.current.volume = 0.4;
            if (audioDispatchRef.current) audioDispatchRef.current.volume = 0.6;
        }
    }, []);

    const unlockAudio = useCallback(() => {
        if (audioUnlocked.current) return;
        [audioNewRef, audioCancelRef, audioRedRef, audioDispatchRef].forEach((ref) => {
            if (ref.current) {
                ref.current.play().then(() => ref.current!.pause()).catch(() => { });
                ref.current.currentTime = 0;
            }
        });
        audioUnlocked.current = true;
    }, []);

    const playDispatchSound = useCallback(() => {
        if (audioDispatchRef.current) {
            audioDispatchRef.current.currentTime = 0;
            audioDispatchRef.current.play().catch(() => { });
        }
    }, []);

    // Fetch today's settlement details from the API (server-side admin SDK — no Firestore rules issue)
    const refreshSettlement = useCallback(async () => {
        if (!user) return;
        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/settlements', {
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    'x-vendor-phone': phoneNumber ?? '',
                },
            });
            if (!res.ok) return;
            const json = await res.json();
            if (!json.settlement) { setCurrentSettlement(null); return; }
            const s = json.settlement;
            setCurrentSettlement({
                ...s,
                period_start: s.period_start ? new Date(s.period_start) : new Date(),
                period_end: s.period_end ? new Date(s.period_end) : new Date(),
                paid_at: s.paid_at ? new Date(s.paid_at) : undefined,
                verified_at: s.verified_at ? new Date(s.verified_at) : undefined,
                created_at: s.created_at ? new Date(s.created_at) : new Date(),
                updated_at: s.updated_at ? new Date(s.updated_at) : new Date(),
            } as Settlement);
        } catch {
            // silently ignore — not critical for dashboard operation
        }
    }, [user, phoneNumber]);

    // Ref so the orders listener can read current lock state without stale closure
    const isLockedRef = useRef(false);
    useEffect(() => { isLockedRef.current = isOnlineOrdersLocked; }, [isOnlineOrdersLocked]);

    useEffect(() => {
        if (!user) return;

        const unsubStore = listenToStoreStatus((isOpen) => setIsStoreOpen(isOpen));
        const unsubProducts = listenToProducts((data) => setProducts(data));
        const unsubPosProducts = listenToPosProducts((data) => setPosProducts(data));

        // settlementLocked lives in settings/storeSettings — vendor already has access to this doc
        const unsubSettlementLock = listenToSettlementLock((locked) => {
            setSettlementLocked(locked);
            // Re-fetch settlement details whenever the lock state changes
            if (user) refreshSettlement();
        });

        // Fetch settlement details once on mount
        refreshSettlement();

        const unsubOrders = listenToLiveOrders((newOrders) => {
            setOrders((prev) => {
                if (!initialLoad) {
                    const prevPlacedIds = new Set(prev.filter(o => o.status === 'Placed' || o.status === 'Pending').map(o => o.id));
                    const freshOrders = newOrders.filter(o =>
                        (o.status === 'Placed' || o.status === 'Pending') &&
                        !prevPlacedIds.has(o.id)
                    );

                    if (freshOrders.length > 0) {
                        const freshOnline = freshOrders.filter(o => o.orderType !== 'pos');
                        const freshPOS = freshOrders.filter(o => o.orderType === 'pos');

                        // Only alert for online orders when not locked; always alert for POS
                        if ((freshOnline.length > 0 && !isLockedRef.current) || freshPOS.length > 0) {
                            audioNewRef.current?.play().catch(() => { });
                        }

                        const fo = freshOrders[0];
                        const hostel = fo.deliveryAddress?.hostelNumber || '';
                        const suppressToast = isLockedRef.current && fo.orderType !== 'pos';

                        if (!suppressToast) {
                            setTimeout(() => {
                                toast(
                                    (t) => (
                                        <div
                                            className="flex items-center gap-3 cursor-pointer"
                                            onClick={() => toast.dismiss(t.id)}
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                                                <Bell size={16} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">New Order Arrived</p>
                                                <p className="text-xs text-gray-500">{hostel} · ₹{fo.grandTotal}</p>
                                            </div>
                                        </div>
                                    ),
                                    {
                                        duration: 4000,
                                        style: {
                                            background: '#fff',
                                            border: '1px solid #e5e7eb',
                                            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                                            borderRadius: '14px',
                                            padding: '12px 16px',
                                        },
                                        position: 'top-right',
                                    }
                                );
                            }, 0);
                        }
                    }

                    const prevCancelledIds = new Set(prev.filter(o => o.status === 'Cancelled').map(o => o.id));
                    const newCancels = newOrders.filter(o => o.status === 'Cancelled' && !prevCancelledIds.has(o.id));
                    if (newCancels.length > 0) {
                        audioCancelRef.current?.play().catch(() => { });
                        setTimeout(() => {
                            toast.error('⚠️ Order Cancelled', { style: { borderRadius: '14px', fontWeight: 700 } });
                        }, 0);
                    }
                }
                return newOrders;
            });
            setInitialLoad(false);
        });

        return () => {
            unsubStore();
            unsubProducts();
            unsubPosProducts();
            unsubOrders();
            unsubSettlementLock();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, initialLoad]);

    useEffect(() => {
        const interval = setInterval(() => {
            orders.forEach((o) => {
                const mins = Math.floor((Date.now() - new Date(o.orderDate).getTime()) / 60000);
                if (
                    (o.status === 'Placed' || o.status === 'Pending' || o.status === 'Preparing' || o.status === 'Dispatched') &&
                    mins >= 20 &&
                    !redAlertedRef.current.has(o.id)
                ) {
                    redAlertedRef.current.add(o.id);
                    audioRedRef.current?.play().catch(() => { });
                }
            });
        }, 30_000);
        return () => clearInterval(interval);
    }, [orders]);

    const toggleStore = async () => {
        unlockAudio();
        const newVal = !isStoreOpen;
        setIsStoreOpen(newVal);
        try {
            const idToken = await user!.getIdToken();
            await toggleStoreStatus(newVal, idToken, phoneNumber ?? '');
            toast.success(newVal ? 'Store is OPEN' : 'Store is CLOSED', { style: { borderRadius: '14px', fontWeight: 600 } });
        } catch (error: unknown) {
            setIsStoreOpen(!newVal);
            toast.error(error instanceof Error ? error.message : 'Failed to toggle store');
        }
    };

    return (
        <VendorContext.Provider value={{
            orders,
            products,
            posProducts,
            isStoreOpen,
            toggleStore,
            unlockAudio,
            playDispatchSound,
            currentSettlement,
            settlementLocked,
            isOnlineOrdersLocked,
            refreshSettlement,
        }}>
            {children}
            <audio preload="auto" src={AUDIO_NEW_ORDER} className="hidden" />
            <audio preload="auto" src={AUDIO_CANCEL} className="hidden" />
            <audio preload="auto" src={AUDIO_RED_ZONE} className="hidden" />
            <audio preload="auto" src={AUDIO_DISPATCH} className="hidden" />
        </VendorContext.Provider>
    );
}

export function useVendor() {
    const ctx = useContext(VendorContext);
    if (!ctx) throw new Error('useVendor must be used within VendorProvider');
    return ctx;
}
