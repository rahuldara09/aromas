import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/vendor/'],
    },
    sitemap: 'https://aromadhaba.in/sitemap.xml',
  };
}
