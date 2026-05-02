'use client';

import Link from 'next/link';
import { Category } from '@/types';
import { useState } from 'react';
import CldImage from '@/components/products/CldImage';

// Fallback used when a category image URL is broken or missing
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80';

interface CategoryCardProps {
    category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
    const [imgError, setImgError] = useState(false);

    const showImage = !!(category.imageURL && !imgError);
    const imgSrc = category.imageURL || FALLBACK_IMAGE;

    return (
        <Link href={`/menu?category=${category.id}`}>
            <div className="relative overflow-hidden rounded-2xl aspect-[4/3] group cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-300">
                {/* Background image */}
                <CldImage
                    src={showImage ? imgSrc : FALLBACK_IMAGE}
                    alt={category.name}
                    width={400}
                    sizes="(max-width: 640px) 50vw, 400px"
                    className="transition-transform duration-500 group-hover:scale-110"
                    onError={() => setImgError(true)}
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                {/* Text */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-bold text-lg leading-tight drop-shadow-md">
                        {category.name}
                    </h3>
                    {category.productCount !== undefined && (
                        <p className="text-white/70 text-sm mt-0.5">{category.productCount} items</p>
                    )}
                </div>
            </div>
        </Link>
    );
}
