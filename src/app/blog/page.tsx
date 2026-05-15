import Header from '@/components/layout/Header';
import Link from 'next/link';
import Image from 'next/image';
import { blogPosts } from '@/data/blogPosts';
import { Clock, User, ArrowRight, Calendar } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | Aroma Dhaba IIM Mumbai',
  description: 'Read the latest stories, guides, and food reviews from Aroma Dhaba, the favorite late-night food spot at IIM Mumbai.',
};

export default function BlogIndexPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-grow bg-gray-50 pb-24">
        {/* Banner */}
        <div className="bg-red-600 py-20 text-white mb-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight text-white shadow-sm">The Aroma Blog</h1>
            <p className="text-xl text-red-100 max-w-2xl mx-auto font-medium">
              Stories, guides, and midnight fuel from IIM Mumbai.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {blogPosts.map((post) => (
              <article key={post.slug} className="bg-white rounded-[32px] overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 flex flex-col border border-gray-100 h-full">
                <Link href={`/blog/${post.slug}`} className="relative h-64 w-full block group overflow-hidden">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                    {post.category}
                  </div>
                </Link>
                
                <div className="p-8 flex-grow flex flex-col">
                  <div className="flex items-center gap-4 text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-red-500" /> {post.date}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="flex items-center gap-1.5"><Clock size={14} className="text-red-500" /> {post.readingTime}</span>
                  </div>
                  
                  <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight group-hover:text-red-600 transition-colors">
                    <Link href={`/blog/${post.slug}`}>
                      {post.title}
                    </Link>
                  </h2>
                  
                  <p className="text-gray-600 mb-8 font-medium leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                  
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-xs shadow-sm">
                        {post.author[0]}
                      </div>
                      <span className="text-sm font-bold text-gray-900">{post.author}</span>
                    </div>
                    
                    <Link href={`/blog/${post.slug}`} className="text-red-600 font-black flex items-center gap-1 hover:gap-2 transition-all group">
                      READ MORE <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
