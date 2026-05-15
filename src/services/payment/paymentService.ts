import { PaymentProvider } from './paymentProvider';
// import { PayUProvider } from './providers/payuProvider';
import { CashfreeProvider } from './providers/cashfreeProvider';

class PaymentService {
    private provider: PaymentProvider;

    constructor() {
        // Force cashfree regardless of environment variable, 
        // as PayU has been deprecated/commented out.
        this.provider = new CashfreeProvider();
    }

    getProvider(): PaymentProvider {
        return this.provider;
    }
}

// Export a singleton instance
export const paymentService = new PaymentService().getProvider();
