import Header from '@/components/layout/Header';
import Banner from '@/components/layout/Banner';
import CategoryCard from '@/components/products/CategoryCard';
import { getCategories } from '@/lib/firestore';
import { Flame, Clock, ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aroma Dhaba | Late Night Food at IIM Ahmedabad',
  description: 'Order hot food in minutes, even at 1 AM. Aroma Dhaba is the favorite late-night food spot at IIM Ahmedabad campus. Fast delivery of Parathas, Biryani, and more.',
  alternates: {
    canonical: 'https://aromadhaba.in',
  },
};

export default async function HomePage() {
  const categories = await getCategories();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Banner />
      <Header />
      
      <main className="flex-grow">
        {/* Simplified Homepage - No Hero Section */}
        <section id="categories" className="py-10 md:py-14 container mx-auto px-4">
          <div className="mb-10">
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900 tracking-tight mb-3">
                What are you craving?
            </h1>
            <p className="text-sm md:text-base text-gray-500 font-medium max-w-2xl">
                Pick a category to explore our menu and order your favorites.
            </p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {categories.map((cat) => (
              <CategoryCard key={cat.id} category={cat} />
            ))}
          </div>
        </section>

        {/* Repositioned Why Choose Us */}
        <section className="py-20 bg-white border-t border-gray-100">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
                            <Clock size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-gray-900 mb-1 uppercase tracking-tight">Express Delivery</h4>
                            <p className="text-sm text-gray-500 font-medium">Within IIM A campus in under 30 minutes.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-gray-900 mb-1 uppercase tracking-tight">Hygienic Food</h4>
                            <p className="text-sm text-gray-500 font-medium">Quality ingredients, prepared with care.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
                            <Flame size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-gray-900 mb-1 uppercase tracking-tight">Always Hot</h4>
                            <p className="text-sm text-gray-500 font-medium">Insulated bags to keep your food fresh.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
      </main>
    </div>
  );
}
