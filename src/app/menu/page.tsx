import { Suspense } from 'react';
import MenuContent from './MenuContent';

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
