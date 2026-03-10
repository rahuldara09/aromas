import { PaymentProvider } from './paymentProvider';
import { PayUProvider } from './providers/payuProvider';

class PaymentService {
    private provider: PaymentProvider;

    constructor() {
        const providerName = process.env.PAYMENT_PROVIDER || 'payu';

        switch (providerName.toLowerCase()) {
            case 'payu':
                this.provider = new PayUProvider();
                break;
            // Add other providers here later (e.g. stripe, razorpay)
            // case 'razorpay':
            //     this.provider = new RazorpayProvider();
            //     break;
            default:
                throw new Error(`Unsupported payment provider: ${providerName}`);
        }
    }

    getProvider(): PaymentProvider {
        return this.provider;
    }
}

// Export a singleton instance
export const paymentService = new PaymentService().getProvider();
