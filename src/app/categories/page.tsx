import Banner from '@/components/layout/Banner';
import Header from '@/components/layout/Header';
import CategoryCard from '@/components/products/CategoryCard';
import { getCategories } from '@/lib/firestore';
import type { Metadata } from 'next';
import { Flame } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Order Food in IIM Ahmedabad | Aroma Dhaba',
    description: 'Craving late-night food at IIM Ahmedabad? Order from Aroma Dhaba - your favorite campus canteen. Fast delivery of Parathas, Biryani, Chinese, and more.',
    keywords: ['order food iim ahmedabad', 'late night food iima', 'aroma dhaba iima', 'iim ahmedabad canteen'],
    alternates: {
        canonical: 'https://aromadhaba.in/categories',
    },
};

export default async function CategoriesPage() {
    const categories = await getCategories();

    return (
        <div className="min-h-screen bg-gray-50">
            <Banner />
            <Header />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Landing Section / Hero Lite */}
                <div className="mb-12 bg-red-600 rounded-3xl p-8 md:p-12 text-white shadow-xl shadow-red-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold mb-4 uppercase tracking-wider">
                            <Flame size={14} className="text-yellow-400" />
                            <span>Campus Favorite</span>
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">Late Night Food at IIM Ahmedabad</h2>
                        <p className="text-red-100 text-lg md:text-xl max-w-2xl font-medium">
                            Fresh, hot, and hygienic meals delivered right to your hostel.
                        </p>
                    </div>
                </div>

                <div className="mb-8">
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">What are you craving?</h1>
                    <p className="text-gray-500 mt-2 font-medium">Pick a category to explore our full menu</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                    {categories.map((cat) => (
                        <CategoryCard key={cat.id} category={cat} />
                    ))}
                </div>
            </main>
        </div>
    );
}
