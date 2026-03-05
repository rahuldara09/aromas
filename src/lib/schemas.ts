import { z } from 'zod';

// ─── Order Item Schema ────────────────────────────────────────────────────────
export const OrderItemSchema = z.object({
    productId: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    quantity: z.number().int().positive().max(20),
    price: z.number().positive().max(5000),
    imageURL: z.string().url().optional().or(z.literal('')),
    categoryId: z.string().min(1).max(100).optional(),
});

// ─── Delivery Address Schema ──────────────────────────────────────────────────
export const DeliveryAddressSchema = z.object({
    name: z.string().min(1).max(100),
    mobile: z.string().regex(/^\+91[0-9]{10}$/, 'Invalid mobile number'),
    hostelNumber: z.string().min(1).max(100),
    roomNumber: z.string().min(1).max(20),
    deliveryType: z.enum(['Delivery', 'Takeaway']),
});

// ─── Full Order Schema ────────────────────────────────────────────────────────
export const CreateOrderSchema = z.object({
    customerPhone: z.string().regex(/^\+91[0-9]{10}$/, 'Invalid Indian phone number'),
    items: z.array(OrderItemSchema).min(1, 'Order must have at least one item').max(30),
    itemTotal: z.number().positive().max(50000),
    dukanFee: z.number().min(0).max(1000),
    deliveryFee: z.number().min(0).max(500),
    grandTotal: z.number().positive().max(51500),
    deliveryAddress: DeliveryAddressSchema,
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
