import React from 'react';

export default function RefundPolicy() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">Return &amp; Refund Policy</h1>
            <p className="text-sm text-gray-400 font-medium mb-8">Last updated: 30 December 2024</p>

            <div className="prose prose-gray max-w-none text-gray-700 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <p>Thank you for ordering from <strong>Aromadhaba</strong>.</p>

                <p>
                    Due to the perishable nature of food items, we generally do not offer returns or refunds.
                    However, refunds or replacements may be provided in the following cases:
                </p>

                <ul className="list-disc pl-6 space-y-2">
                    <li>Incorrect item delivered</li>
                    <li>Order not delivered</li>
                </ul>

                <p>
                    To request a refund or replacement, please contact us within <strong>2 hours of delivery</strong> with relevant details.
                </p>

                <div className="pt-6 border-t border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Us</h2>
                    <p>If you have any questions about our Returns and Refunds Policy, please contact us:</p>
                    <ul className="list-disc pl-6 space-y-2 mt-3">
                        <li>Contact Details: <a href="tel:+919892820940" className="text-gray-900 font-semibold hover:text-red-600 transition-colors">+91-9892820940</a></li>
                        <li>Email: <a href="mailto:aromasdhaba@gmail.com" className="text-red-600 hover:underline">aromasdhaba@gmail.com</a></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
