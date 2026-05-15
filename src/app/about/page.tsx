import Header from '@/components/layout/Header';
import Image from 'next/image';
import { Heart, Utensils } from 'lucide-react';
import type { Metadata } from 'next';
import ReviewsSlider from '@/components/products/ReviewsSlider';

export const metadata: Metadata = {
  title: 'About Us | Aroma Dhaba IIM Mumbai',
  description: 'Learn about Aroma Dhaba - the favorite late-night food spot at IIM Mumbai campus. Serving quality food with love since our inception.',
};

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-grow">
        {/* Banner */}
        <div className="bg-red-600 py-20 text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight">Our Story</h1>
            <p className="text-xl text-red-100 max-w-2xl mx-auto font-medium">
              Fueling the dreams of IIM Mumbai students, one paratha at a time.
            </p>
          </div>
        </div>

        {/* Content Section */}
        <section className="py-28">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <div className="space-y-12">
              <h2 className="text-4xl md:text-6xl font-black text-gray-900 leading-tight">Authentic Taste, <br /><span className="text-red-600 italic">Late Night Convenience.</span></h2>

              <div className="space-y-8">
                <p className="text-gray-600 text-xl leading-relaxed font-medium">
                  Aroma Dhaba was born out of a simple observation: students at IIM Mumbai work hard, often late into the night, and they deserve food that is as dedicated to quality as they are to their studies.
                </p>
                <p className="text-gray-600 text-xl leading-relaxed font-medium">

                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-12 items-center justify-center max-w-2xl mx-auto">
                <div className="flex flex-col items-center gap-4 group">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-110 group-hover:bg-red-600 group-hover:text-white group-hover:shadow-red-600/20">
                    <Heart size={32} />
                  </div>
                  <div className="text-center">
                    <h4 className="text-xl font-black text-gray-900 mb-1">Made with Love</h4>
                    <p className="text-sm text-gray-500 font-medium">Every dish is prepared with the utmost care.</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 group">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-110 group-hover:bg-red-600 group-hover:text-white group-hover:shadow-red-600/20">
                    <Utensils size={32} />
                  </div>
                  <div className="text-center">
                    <h4 className="text-xl font-black text-gray-900 mb-1">Fresh Ingredients</h4>
                    <p className="text-sm text-gray-500 font-medium">Only the highest quality produce is used.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* Google Reviews Slider */}
        <ReviewsSlider />
      </main>
    </div>
  );
}
