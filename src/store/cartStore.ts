import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, Product } from '@/types';

const DUKAN_FEE = 0;

interface CartStore {
    items: CartItem[];
    addItem: (product: Product) => void;
    removeItem: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    totalItems: () => number;
    subtotal: () => number;
    dukanFee: () => number;
    deliveryFee: () => number;
    grandTotal: () => number;
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],

            addItem: (product: Product) => {
                set((state) => {
                    const existing = state.items.find((i) => i.product.id === product.id);
                    if (existing) {
                        return {
                            items: state.items.map((i) =>
                                i.product.id === product.id
                                    ? { ...i, quantity: i.quantity + 1 }
                                    : i
                            ),
                        };
                    }
                    return { items: [...state.items, { product, quantity: 1 }] };
                });
            },

            removeItem: (productId: string) => {
                set((state) => ({
                    items: state.items.filter((i) => i.product.id !== productId),
                }));
            },

            updateQuantity: (productId: string, quantity: number) => {
                if (quantity <= 0) {
                    get().removeItem(productId);
                    return;
                }
                set((state) => ({
                    items: state.items.map((i) =>
                        i.product.id === productId ? { ...i, quantity } : i
                    ),
                }));
            },

            clearCart: () => set({ items: [] }),

            totalItems: () =>
                get().items.reduce((sum, i) => sum + i.quantity, 0),

            subtotal: () =>
                get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),

            dukanFee: () => (get().items.length > 0 ? DUKAN_FEE : 0),

            deliveryFee: () => 0, // Free delivery

            grandTotal: () =>
                get().subtotal() + get().dukanFee() + get().deliveryFee(),
        }),
        {
            name: 'aromas-cart-storage',
        }
    )
);
