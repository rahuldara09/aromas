import Header from '@/components/layout/Header';
import CategoryCard from '@/components/products/CategoryCard';
import { getCategories } from '@/lib/firestore';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Order Food in IIM Mumbai | Aroma Dhaba',
    description: 'Craving late-night food at IIM Mumbai? Order from Aroma Dhaba - your favorite campus canteen. Fast delivery of Parathas, Biryani, Chinese, and more.',
    keywords: ['order food iim ahmedabad', 'late night food iima', 'aroma dhaba iima', 'iim ahmedabad canteen'],
    alternates: {
        canonical: 'https://aromadhaba.in/categories',
    },
};

export default async function CategoriesPage() {
    const categories = await getCategories();

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

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
