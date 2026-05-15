'use client';

import { useEffect, useRef } from 'react';

interface PayUFormProps {
    paymentUrl: string;
    payload: Record<string, string>;
}

export default function PayUForm({ paymentUrl, payload }: PayUFormProps) {
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        // Automatically submit the form once mounted
        if (formRef.current) {
            formRef.current.submit();
        }
    }, []);

    return (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-600 font-medium">Redirecting to Secure Payment Gateway...</p>
            <p className="text-xs text-gray-400">Please do not refresh or close this page.</p>

            {/* Hidden PayU Form */}
            <form ref={formRef} action={paymentUrl} method="POST" className="hidden">
                {Object.entries(payload).map(([key, value]) => (
                    <input key={key} type="hidden" name={key} value={value} />
                ))}
            </form>
        </div>
    );
}
