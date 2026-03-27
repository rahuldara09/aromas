import Header from '@/components/layout/Header';
import Image from 'next/image';
import { Heart, Utensils, Users, Award, Clock } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us | Aroma Dhaba IIM Ahmedabad',
  description: 'Learn about Aroma Dhaba - the favorite late-night food spot at IIM Ahmedabad campus. Serving quality food with love since our inception.',
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
              Fueling the dreams of IIM Ahmedabad students, one paratha at a time.
            </p>
          </div>
        </div>

        {/* Content Section */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center gap-16">
              <div className="flex-1">
                <div className="relative h-[500px] w-full rounded-3xl overflow-hidden shadow-2xl">
                  <Image
                    src="/images/hero_food.png"
                    alt="Aroma Dhaba Kitchen"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              
              <div className="flex-1 space-y-8">
                <h2 className="text-4xl font-black text-gray-900 leading-tight">Authentic Taste, <br /><span className="text-red-600">Late Night Convenience.</span></h2>
                <p className="text-gray-600 text-lg leading-relaxed font-medium">
                  Aroma Dhaba was born out of a simple observation: students at IIM Ahmedabad work hard, often late into the night, and they deserve food that is as dedicated to quality as they are to their studies.
                </p>
                <p className="text-gray-600 text-lg leading-relaxed font-medium">
                  We started with a small menu of North Indian classics and have grown into a campus favorite, known for our hot, fresh, and hygienic meals. Whether it's a quick break between case studies or a midnight celebration, we're here to serve.
                </p>
                
                <div className="grid grid-cols-2 gap-8 pt-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                      <Heart size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Made with Love</h4>
                      <p className="text-sm text-gray-500">Every dish is prepared with the utmost care.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                      <Utensils size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Fresh Ingredients</h4>
                      <p className="text-sm text-gray-500">Only the highest quality produce is used.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Our Values</h2>
              <p className="text-gray-600 text-lg">What drives us every single day.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 text-center">
                <div className="w-16 h-16 bg-red-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-600/20">
                  <Award size={32} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">Quality First</h3>
                <p className="text-gray-600 font-medium">We never compromise on the quality of our ingredients or our preparation methods.</p>
              </div>
              
              <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 text-center">
                <div className="w-16 h-16 bg-red-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-600/20">
                  <Clock size={32} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">24/7 Support</h3>
                <p className="text-gray-600 font-medium">We know campus life doesn't stop at 5 PM. Our kitchen is optimized for late-night service.</p>
              </div>
              
              <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 text-center">
                <div className="w-16 h-16 bg-red-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-600/20">
                  <Users size={32} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">Student Community</h3>
                <p className="text-gray-600 font-medium">We're proud to be a part of the vibrant IIM Ahmedabad campus culture.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
