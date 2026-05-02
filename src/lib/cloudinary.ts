const CLOUDINARY_BASE = /^https?:\/\/res\.cloudinary\.com\//;

function injectParams(url: string, params: string): string {
    if (!url || !CLOUDINARY_BASE.test(url)) return url;
    return url.replace('/upload/', `/upload/${params}/`);
}

export function cldUrl(url: string, width: number): string {
    return injectParams(url, `f_auto,q_auto,w_${width}`);
}

export function cldBlur(url: string): string {
    return injectParams(url, 'w_20,e_blur:1000,q_1,f_auto');
}

export function cldSrcSet(url: string, sizes: number[]): string {
    return sizes.map(w => `${injectParams(url, `f_auto,q_auto,w_${w}`)} ${w}w`).join(', ');
}

export function isCloudinaryUrl(url: string): boolean {
    return CLOUDINARY_BASE.test(url);
}
