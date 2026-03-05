import Link from 'next/link';
import { Category } from '@/types';

interface CategoryCardProps {
    category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
    return (
        <Link href={`/menu?category=${category.id}`}>
            <div className="relative overflow-hidden rounded-2xl aspect-[4/3] group cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-300">
                {/* Background image */}
                {category.imageURL ? (
                    <img
                        src={category.imageURL}
                        alt={category.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-200 to-red-300" />
                )}

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
