'use client';

import { useState, useRef, useEffect } from 'react';
import { cldUrl, cldBlur, cldSrcSet, isCloudinaryUrl } from '@/lib/cloudinary';

interface CldImageProps {
    src: string;
    alt: string;
    width: number;
    sizes?: string;
    className?: string;
    onError?: () => void;
}

export default function CldImage({ src, alt, width, sizes, className, onError }: CldImageProps) {
    const [loaded, setLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Handle images already in browser cache — onLoad won't fire for them
    useEffect(() => {
        if (imgRef.current?.complete) setLoaded(true);
    }, []);

    const isCld = isCloudinaryUrl(src);
    const mainSrc = isCld ? cldUrl(src, width) : src;
    const blurSrc = isCld ? cldBlur(src) : undefined;
    const srcSet = isCld ? cldSrcSet(src, [200, 300, 400, 600]) : undefined;

    return (
        <span className="relative block w-full h-full">
            {blurSrc && !loaded && (
                <img
                    src={blurSrc}
                    aria-hidden="true"
                    className={`absolute inset-0 w-full h-full object-cover scale-110 ${className ?? ''}`}
                />
            )}
            <img
                ref={imgRef}
                src={mainSrc}
                srcSet={srcSet}
                sizes={sizes ?? `${width}px`}
                alt={alt}
                loading="lazy"
                decoding="async"
                className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
                onLoad={() => setLoaded(true)}
                onError={onError}
            />
        </span>
    );
}
