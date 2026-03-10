import { Order } from '@/types';

export interface PaymentSession {
    transactionId: string;
    paymentUrl: string;
    payload: Record<string, string>; // Fields for hidden form auto-submit (e.g. hash for PayU)
}

export interface PaymentVerification {
    success: boolean;
    orderId: string;
    transactionId: string;
    amount: number;
    currency: string;
    providerRawStatus: string; // The original status string from the provider
}

export interface PaymentProvider {
    /**
     * Initializes a payment session with the provider.
     * Returns a transactionId and payload to redirect/submit to the payment gateway.
     */
    createPaymentSession(order: Order): Promise<PaymentSession>;

    /**
     * Verifies the webhook or callback from the payment provider.
     * Validates signatures, hashes, amounts, and statuses.
     */
    verifyPayment(data: Record<string, any>): Promise<PaymentVerification>;

    /**
     * Optional: initiate a refund.
     */
    refundPayment?(paymentId: string): Promise<boolean>;
}
