import Header from '@/components/layout/Header';
import Image from 'next/image';
import { blogPosts, BlogPost } from '@/data/blogPosts';
import { notFound } from 'next/navigation';
import { Clock, User, ArrowLeft, Calendar, Share2, Facebook, Twitter, Instagram } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  
  if (!post) return { title: 'Post Not Found' };
  
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      images: [post.image],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  
  if (!post) notFound();

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      
      <main className="flex-grow pt-8 pb-24">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back Button */}
          <Link href="/blog" className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 font-black mb-12 transition-colors uppercase tracking-widest text-sm group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-12">
            <div className="flex items-center gap-3 text-red-600 font-black uppercase tracking-[0.2em] text-xs mb-6">
              <span className="w-10 h-[2px] bg-red-600/30"></span>
              {post.category}
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-8 leading-tight tracking-tight uppercase">
              {post.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-8 py-8 border-y border-gray-100 italic">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold shadow-sm">
                  {post.author[0]}
                </div>
                <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Author</span>
                    <span className="text-sm font-black text-gray-900">{post.author}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                  <Calendar size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Published</span>
                    <span className="text-sm font-black text-gray-900">{post.date}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 underline decoration-red-500/30 decoration-2">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                  <Clock size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Reading Time</span>
                    <span className="text-sm font-black text-gray-900">{post.readingTime}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Featured Image */}
          <div className="relative h-[400px] md:h-[600px] w-full rounded-[48px] overflow-hidden mb-16 shadow-2xl">
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover"
              priority
            />
          </div>

          {/* Content */}
          <div className="flex flex-col lg:flex-row gap-16 relative">
            <div className="lg:w-3/4">
                <div 
                    className="max-w-none text-gray-800 font-medium
                      [&>h3]:text-3xl [&>h3]:font-black [&>h3]:text-gray-900 [&>h3]:mt-12 [&>h3]:mb-6
                      [&>p]:text-lg [&>p]:leading-relaxed [&>p]:text-gray-600 [&>p]:my-6
                      [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-4 [&>ul]:my-8
                      [&>li]:text-lg [&>li]:text-gray-600 [&>li]:leading-relaxed
                      [&>strong]:text-gray-900 [&>strong]:font-black"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                />
                
                <div className="mt-16 pt-16 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-black uppercase tracking-widest text-gray-400">Share This:</span>
                        <div className="flex items-center gap-2">
                            <button className="w-10 h-10 rounded-full bg-gray-50 text-gray-500 hover:bg-black hover:text-white transition-all flex items-center justify-center shadow-sm">
                                <Facebook size={18} />
                            </button>
                            <button className="w-10 h-10 rounded-full bg-gray-50 text-gray-500 hover:bg-black hover:text-white transition-all flex items-center justify-center shadow-sm">
                                <Twitter size={18} />
                            </button>
                            <button className="w-10 h-10 rounded-full bg-gray-50 text-gray-500 hover:bg-black hover:text-white transition-all flex items-center justify-center shadow-sm">
                                <Instagram size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Sidebar */}
            <aside className="lg:w-1/4">
                <div className="sticky top-24 space-y-12">
                    <div className="bg-red-600 rounded-[32px] p-8 text-white shadow-xl shadow-red-600/30">
                        <h4 className="text-2xl font-black mb-4">Hungry?</h4>
                        <p className="text-red-100 text-sm mb-6 leading-relaxed font-medium">Order the best campus food directly to your hostel in minutes.</p>
                        <Link href="/menu" className="block w-full bg-white text-red-600 text-center py-4 rounded-2xl font-black shadow-lg hover:bg-gray-100 transition-colors">
                            ORDER NOW
                        </Link>
                    </div>

                    <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100">
                        <h4 className="text-xl font-black mb-6 uppercase tracking-wider text-gray-900">Recent Posts</h4>
                        <div className="space-y-6">
                            {blogPosts.filter(p => p.slug !== post.slug).slice(0, 2).map(p => (
                                <Link key={p.slug} href={`/blog/${p.slug}`} className="group block">
                                    <span className="text-xs font-bold text-red-600 uppercase mb-2 block">{p.category}</span>
                                    <h5 className="font-black text-gray-900 leading-tight group-hover:text-red-600 transition-colors uppercase tracking-tight">{p.title}</h5>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
