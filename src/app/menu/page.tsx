import { Suspense } from 'react';
import MenuContent from './MenuContent';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Menu | Student Favorites at IIM Mumbai',
    description: 'Explore the full menu of Aroma Dhaba at IIM Mumbai campus. North Indian, Chinese, Fast Food, and late-night specials.',
    keywords: ['aroma dhaba menu', 'iim ahmedabad food menu', 'late night menu iima', 'paneer paratha iima'],
};

export default function MenuPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
                    <p className="text-gray-500 text-sm">Loading menu...</p>
                </div>
            </div>
        }>
            <MenuContent />
        </Suspense>
    );
}
