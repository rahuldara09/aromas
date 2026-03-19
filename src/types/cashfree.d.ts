declare module '@cashfreepayments/cashfree-js' {
    export function load(config: { mode: 'sandbox' | 'production' }): Promise<any>;
}
