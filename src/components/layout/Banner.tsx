'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Banner() {
    const pathname = usePathname();
    
    // Only show the banner on the homepage
    if (pathname !== '/') return null;

    return (
        <div className="bg-red-500 text-white text-center py-3 px-4 z-50">
            <Link 
                href="/menu" 
                className="text-xs md:text-sm font-black tracking-wide uppercase hover:underline flex items-center justify-center gap-1.5 transition-all text-white"
            >
                <span className="shrink-0">🔥 Late Night Food at IIM Mumbai</span>
                <span className="hidden sm:inline opacity-60">|</span>
                <span className="shrink-0">Open till 3:30 AM</span>
                <span className="hidden sm:inline opacity-60">|</span>
                <span className="bg-white text-red-500 px-2 py-0.5 rounded text-[10px] font-black shrink-0">Order Now →</span>
            </Link>
        </div>
    );
}
