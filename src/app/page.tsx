import Link from 'next/link';
import Header from '@/components/layout/Header';
import Banner from '@/components/layout/Banner';
import CategoryCard from '@/components/products/CategoryCard';
import { getCategories } from '@/lib/firestore';
import { Flame, Clock, ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';
import { SEO_CONFIG } from '@/lib/seo-config';

export const metadata: Metadata = {
  title: SEO_CONFIG.defaultTitle,
  description: SEO_CONFIG.defaultDescription,
  alternates: {
    canonical: SEO_CONFIG.siteUrl,
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
        <section id="categories" className="pt-6 pb-12 md:pt-8 md:pb-16 container mx-auto px-4 overflow-x-hidden">
          <div className="mb-8 text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tighter mb-3 leading-tight">
                Aroma Dhaba - IIM Mumbai
            </h1>
            <h2 className="sr-only">
              {SEO_CONFIG.categories.join(' · ')}
            </h2>
            <p className="text-sm md:text-lg text-gray-600 font-bold max-w-2xl mx-auto md:mx-0 mb-8">
                From North Indian to Chinese and Fast Food—Aroma Dhaba sorts your midnight cravings fast.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <Link href="/categories" className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-xl transition-all text-sm shadow-lg shadow-red-500/20 text-center">
                    Explore Categories
                </Link>
                <Link href="/about" className="w-full sm:w-auto bg-white border border-gray-200 hover:border-red-200 text-gray-700 font-bold py-3 px-8 rounded-xl transition-all text-sm shadow-sm text-center">
                    About Us
                </Link>
            </div>
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
                            <p className="text-sm text-gray-500 font-medium">Within <strong>IIM Mumbai campus</strong> in under 30 minutes.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-gray-900 mb-1 uppercase tracking-tight">Hygienic Food</h4>
                            <p className="text-sm text-gray-500 font-medium">Quality ingredients, prepared with care at <strong>IIM Mumbai</strong>.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
                            <Flame size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-gray-900 mb-1 uppercase tracking-tight">Always Hot</h4>
                            <p className="text-sm text-gray-500 font-medium">Insulated bags to keep your food fresh for <strong>IIM Mumbai students</strong>.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
      </main>
    </div>
  );
}
