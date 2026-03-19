import { PaymentProvider, PaymentSession, PaymentVerification } from '../paymentProvider';
import { Order } from '@/types';
import crypto from 'crypto';

export class CashfreeProvider implements PaymentProvider {
    private appId: string;
    private secretKey: string;
    private baseUrl: string;
    private environment: string;

    constructor() {
        this.appId = process.env.CASHFREE_APP_ID || '';
        this.secretKey = process.env.CASHFREE_SECRET_KEY || '';
        this.environment = (process.env.CASHFREE_ENVIRONMENT || 'SANDBOX').toUpperCase();
        
        this.baseUrl = this.environment === 'PRODUCTION' 
            ? 'https://api.cashfree.com/pg/orders' 
            : 'https://sandbox.cashfree.com/pg/orders';
    }

    async createPaymentSession(order: Order, baseUrl?: string): Promise<PaymentSession> {
        // Cashfree Order ID must be alphanumeric and between 3 and 40 characters
        const orderId = `CF_${order.id}_${Date.now()}`.slice(0, 40);

        const customerPhone = order.customerPhone || order.deliveryAddress?.mobile || '9999999999';
        const customerName = order.deliveryAddress?.name || 'Customer';

        const payload = {
            order_id: orderId,
            order_amount: order.grandTotal,
            order_currency: 'INR',
            customer_details: {
                customer_id: order.userId || 'guest',
                customer_name: customerName,
                customer_email: 'customer@aromadhaba.com', 
                customer_phone: customerPhone.replace(/\D/g, '').slice(-10) // 10 digit phone
            },
            order_meta: {
                // Determine absolute base URL for callbacks depending on environment
                return_url: `${baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/order/${order.id}?cf_id={order_id}`,
                notify_url: `${baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/payment/webhook`
            },
            order_tags: {
                internal_order_id: order.id
            }
        };

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-version': '2023-08-01',
                'x-client-id': this.appId,
                'x-client-secret': this.secretKey,
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Cashfree] Create Order Error:', data);
            throw new Error(`Cashfree order creation failed: ${data.message || response.statusText}`);
        }

        return {
            transactionId: orderId, // Our generated order ID for Cashfree
            paymentUrl: data.payment_session_id, // For Cashfree, the paymentUrl field will carry the session ID
            payload: {
                payment_session_id: data.payment_session_id,
                order_id: data.order_id
            }
        };
    }

    async verifyPayment(data: Record<string, any>): Promise<PaymentVerification> {
        // data should contain the rawBody, signature, and timestamp passed from the webhook route
        const { rawBody, signature, timestamp } = data;

        if (!signature || !timestamp || !rawBody) {
             throw new Error('Missing webhook signature components');
        }

        // Verify Signature
        const signatureData = timestamp + rawBody;
        const expectedSignature = crypto
            .createHmac('sha256', this.secretKey)
            .update(signatureData)
            .digest('base64');

        if (signature !== expectedSignature) {
            throw new Error('Invalid Cashfree webhook signature');
        }

        const parsedBody = JSON.parse(rawBody);
        const webhookData = parsedBody.data;
        const orderIdObj = webhookData.order;
        const paymentObj = webhookData.payment;

        // Ensure we handle only PAYMENT_SUCCESS or PAYMENT_FAILED events
        // (Cashfree sends 'PAYMENT_SUCCESS_WEBHOOK' etc.)
        const isSuccess = parsedBody.type === 'PAYMENT_SUCCESS_WEBHOOK' && paymentObj.payment_status === 'SUCCESS';
        
        // Recover our internal order ID from order_tags
        const internalOrderId = orderIdObj.order_tags?.internal_order_id;

        return {
            success: isSuccess,
            orderId: internalOrderId || orderIdObj.order_id.split('_')[1], // fallback to string split
            transactionId: paymentObj.cf_payment_id ? String(paymentObj.cf_payment_id) : orderIdObj.order_id,
            amount: parseFloat(paymentObj.payment_amount || orderIdObj.order_amount),
            currency: paymentObj.payment_currency || 'INR',
            providerRawStatus: paymentObj.payment_status || parsedBody.type,
        };
    }
}
