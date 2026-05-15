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
                className="text-[10px] sm:text-xs md:text-sm font-black tracking-tight sm:tracking-wide uppercase hover:underline flex flex-wrap items-center justify-center gap-x-2 gap-y-1 transition-all text-white"
            >

                <span className="shrink-0"> Late Night Food at IIM MUMBAI | Open till 3:30 AM</span>
                <span className="hidden sm:inline opacity-60">|</span>
                <span className="bg-white text-red-500 px-2 py-0.5 rounded text-[9px] font-black shrink-0">Order Now →</span>
            </Link>
        </div>
    );
}
