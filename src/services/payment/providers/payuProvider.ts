import { PaymentProvider, PaymentSession, PaymentVerification } from '../paymentProvider';
import { Order } from '@/types';
import crypto from 'crypto';

export class PayUProvider implements PaymentProvider {
    private key: string;
    private salt: string;
    private baseUrl: string;
    private successUrl: string;
    private failureUrl: string;

    constructor() {
        this.key = process.env.PAYU_KEY || '';
        this.salt = process.env.PAYU_SALT || '';
        const env = process.env.PAYU_ENV || 'sandbox';

        this.baseUrl = env === 'production'
            ? 'https://secure.payu.in/_payment'
            : 'https://test.payu.in/_payment';

        this.successUrl = process.env.PAYU_SUCCESS_URL || 'http://localhost:3000/api/payment/webhook';
        this.failureUrl = process.env.PAYU_FAILURE_URL || 'http://localhost:3000/api/payment/webhook';
    }

    private generateHash(data: Record<string, string>): string {
        // PayU Hash Sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
        const hashString = `${this.key}|${data.txnid || ''}|${data.amount || ''}|${data.productinfo || ''}|${data.firstname || ''}|${data.email || ''}|${data.udf1 || ''}|${data.udf2 || ''}|${data.udf3 || ''}|${data.udf4 || ''}|${data.udf5 || ''}||||||${this.salt}`;
        return crypto.createHash('sha512').update(hashString).digest('hex');
    }

    private verifyHash(data: Record<string, string>): boolean {
        // Reverse hash for verification: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
        const expectedHash = crypto.createHash('sha512')
            .update(`${this.salt}|${data.status || ''}||||||${data.udf5 || ''}|${data.udf4 || ''}|${data.udf3 || ''}|${data.udf2 || ''}|${data.udf1 || ''}|${data.email || ''}|${data.firstname || ''}|${data.productinfo || ''}|${data.amount || ''}|${data.txnid || ''}|${this.key}`)
            .digest('hex');

        return expectedHash === data.hash;
    }

    async createPaymentSession(order: Order): Promise<PaymentSession> {
        // Generate a unique transaction ID. Max 25 chars.
        const txnid = `TXN_${order.id}_${Date.now()}`.slice(0, 25);

        const payload: Record<string, string> = {
            key: this.key,
            txnid: txnid,
            amount: order.grandTotal.toFixed(2),
            productinfo: `Order ${order.id}`,
            firstname: order.deliveryAddress.name.split(' ')[0] || 'Customer',
            email: 'customer@aromadhaba.com', // Dummy email if not collected
            phone: order.customerPhone || '0000000000',
            surl: this.successUrl,
            furl: this.failureUrl,
            // Pass orderId in udf1 or directly verify if needed, but we embed it in txnid or use state.
            udf1: order.id,
        };

        const hash = this.generateHash(payload);
        payload.hash = hash;

        return {
            transactionId: txnid,
            paymentUrl: this.baseUrl,
            payload
        };
    }

    async verifyPayment(data: Record<string, any>): Promise<PaymentVerification> {
        if (!this.verifyHash(data)) {
            throw new Error('Invalid payment signature/hash.');
        }

        const isSuccess = data.status === 'success';

        // Extract order ID. We stored it in udf1 or could parse from txnid.
        const orderId = data.udf1;

        return {
            success: isSuccess,
            orderId: orderId,
            transactionId: data.txnid,
            amount: parseFloat(data.amount),
            currency: 'INR',
            providerRawStatus: data.status,
        };
    }
}
