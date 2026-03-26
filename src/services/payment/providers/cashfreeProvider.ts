import { PaymentProvider, PaymentSession, PaymentVerification } from '../paymentProvider';
import { Order } from '@/types';
import crypto from 'crypto';

export class CashfreeProvider implements PaymentProvider {
    private appId: string;
    private secretKey: string;
    private baseUrl: string;
    private environment: string;

    constructor() {        this.appId = process.env.CASHFREE_APP_ID || '';
        this.secretKey = process.env.CASHFREE_SECRET_KEY || '';
        this.environment = (process.env.CASHFREE_ENVIRONMENT || 'SANDBOX').toUpperCase();
        
        this.baseUrl = this.environment === 'PRODUCTION' 
            ? 'https://api.cashfree.com/pg/orders' 
            : 'https://sandbox.cashfree.com/pg/orders';
    }

    async createPaymentSession(order: Order, baseUrl?: string): Promise<PaymentSession> {
        // Order ID must be alphanumeric and unique
        const orderId = `order_${order.id}_${Date.now()}`.slice(0, 45);

        const customerPhone = order.customerPhone || order.deliveryAddress?.mobile || '9999999999';
        const customerName = order.deliveryAddress?.name || 'Customer';

        const payload = {
            order_id: orderId,
            order_amount: order.grandTotal,
            order_currency: 'INR',
            customer_details: {
                customer_id: order.userId || 'guest_user',
                customer_phone: customerPhone.replace(/\D/g, '').slice(-10), // 10 digit phone
                customer_name: customerName,
                customer_email: 'customer@aromadhaba.com'
            },
            order_meta: {
                return_url: `${baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/order/${order.id}?order_id={order_id}`,
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

        // For Orders API, we get payment_session_id
        // Hosted URL can be constructed if needed for direct redirect, but SDK is better
        const hostedUrl = this.environment === 'PRODUCTION' 
            ? `https://payments.cashfree.com/order/${data.order_id}`
            : `https://payments-test.cashfree.com/order/${data.order_id}`;

        return {
            transactionId: orderId, 
            paymentUrl: hostedUrl, // Redirect URL for hosted checkout
            payload: {
                order_id: data.order_id || '',
                payment_session_id: data.payment_session_id || '',
                cf_order_id: String(data.cf_order_id || '')
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

        // Parse the webhook payload safely
        const parsedBody = JSON.parse(rawBody);
        const webhookData = parsedBody.data;

        // Determine if it's an Order webhook or a Link webhook
        // We use Link webhooks so data.link and data.payment will be present
        const orderIdObj = webhookData.order || webhookData.link;
        const paymentObj = webhookData.payment;

        // Ensure we handle PAYMENT_SUCCESS_WEBHOOK or PAYMENT_FAILED_WEBHOOK
        const isSuccess = parsedBody.type === 'PAYMENT_SUCCESS_WEBHOOK' && paymentObj.payment_status === 'SUCCESS';
        
        // Recover our internal order ID from link_notes (or order_tags)
        const internalOrderId = orderIdObj.link_notes?.internal_order_id || orderIdObj.order_tags?.internal_order_id;

        const returnedId = orderIdObj.link_id || orderIdObj.order_id || '';
        const fallbackOrderId = returnedId.includes('_') ? returnedId.split('_')[1] : returnedId;

        return {
            success: isSuccess,
            orderId: internalOrderId || fallbackOrderId, 
            transactionId: paymentObj.cf_payment_id ? String(paymentObj.cf_payment_id) : returnedId,
            amount: parseFloat(paymentObj.payment_amount || orderIdObj.link_amount || orderIdObj.order_amount),
            currency: paymentObj.payment_currency || 'INR',
            providerRawStatus: paymentObj.payment_status || parsedBody.type,
        };
    }
}
