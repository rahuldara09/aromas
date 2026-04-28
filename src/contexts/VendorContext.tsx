'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    listenToLiveOrders,
    listenToStoreStatus,
    toggleStoreStatus,
    listenToProducts,
    updateOrderStatus
} from '@/lib/vendor';
import { Order, Product } from '@/types';
import toast from 'react-hot-toast';
import { Bell } from 'lucide-react';

const AUDIO_NEW_ORDER = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';
const AUDIO_CANCEL = 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3';
const AUDIO_RED_ZONE = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';
const AUDIO_DISPATCH = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

interface VendorContextValue {
    orders: Order[];
    products: Product[];
    isStoreOpen: boolean;
    toggleStore: () => Promise<void>;
    unlockAudio: () => void;
    playDispatchSound: () => void;
}

const VendorContext = createContext<VendorContextValue | null>(null);

export function VendorProvider({ children }: { children: React.ReactNode }) {
    const { user, phoneNumber } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isStoreOpen, setIsStoreOpen] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

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

    useEffect(() => {
        if (!user) return;

        const unsubStore = listenToStoreStatus((isOpen) => setIsStoreOpen(isOpen));
        const unsubProducts = listenToProducts((data) => setProducts(data));

        const unsubOrders = listenToLiveOrders((newOrders) => {
            setOrders((prev) => {
                if (!initialLoad) {
                    const prevPlacedIds = new Set(prev.filter(o => o.status === 'Placed' || o.status === 'Pending').map(o => o.id));
                    const freshOrders = newOrders.filter(o => (o.status === 'Placed' || o.status === 'Pending') && !prevPlacedIds.has(o.id));

                    if (freshOrders.length > 0) {
                        audioNewRef.current?.play().catch(() => { });
                        const fo = freshOrders[0];
                        const hostel = fo.deliveryAddress?.hostelNumber || '';

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

        return () => { unsubStore(); unsubProducts(); unsubOrders(); };
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
        <VendorContext.Provider value={{ orders, products, isStoreOpen, toggleStore, unlockAudio, playDispatchSound }}>
            {children}
            {/* Hidden audio for preloading */}
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
