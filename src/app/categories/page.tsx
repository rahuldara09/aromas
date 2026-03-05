import Banner from '@/components/layout/Banner';
import Header from '@/components/layout/Header';
import CategoryCard from '@/components/products/CategoryCard';
import { getCategories } from '@/lib/firestore';

export const metadata = {
    title: 'Categories | Aroma Dhaba',
};

export default async function CategoriesPage() {
    const categories = await getCategories();

    return (
        <div className="min-h-screen bg-gray-50">
            <Banner />
            <Header />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">What are you craving?</h1>
                    <p className="text-gray-500 mt-1">Pick a category to explore our menu</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {categories.map((cat) => (
                        <CategoryCard key={cat.id} category={cat} />
                    ))}
                </div>
            </main>
        </div>
    );
}
