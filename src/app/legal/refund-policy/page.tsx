import React from 'react';

export default function RefundPolicy() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-8">Refund Policy</h1>

            <div className="prose prose-gray max-w-none text-gray-700 space-y-6">
                <p className="font-semibold">Our Return and Refund Policy was last updated 30 December 2024</p>

                <p>Thank you for shopping at aromadhaba.com.</p>

                <p className="text-xl font-medium text-gray-900">We do not offer any kind of refunds and returns.</p>

                <h2 className="text-2xl font-bold text-gray-900 mt-10">Shipping Policy</h2>
                <p>We usually ship the product as soon as we receive the order. That order might take 1-2 hours to get delivered at your doorstep.</p>

                <h2 className="text-2xl font-bold text-gray-900 mt-10">Contact Us</h2>
                <p>If you have any questions about our Returns and Refunds Policy, please contact us:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Contact Details: +91-9892820940</li>
                    <li>Email: <a href="mailto:aromasdhaba@gmail.com" className="text-red-600 hover:underline">aromasdhaba@gmail.com</a></li>
                </ul>
            </div>
        </div>
    );
}
