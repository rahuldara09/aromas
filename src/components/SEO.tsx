import Head from 'next/head';
import { usePathname } from 'next/navigation';
import { SEO_CONFIG, getRestaurantSchema } from '@/lib/seo-config';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: 'website' | 'article' | 'restaurant';
  ogImage?: string;
  keywords?: string[];
  schema?: any;
}

export default function SEO({
  title = SEO_CONFIG.defaultTitle,
  description = SEO_CONFIG.defaultDescription,
  canonical,
  ogType = 'website',
  ogImage = '/og-image.jpg',
  keywords = SEO_CONFIG.keywords,
  schema,
}: SEOProps) {
  const pathname = usePathname();
  const url = `${SEO_CONFIG.siteUrl}${pathname}`;
  const canonicalUrl = canonical || url;

  const restaurantSchema = getRestaurantSchema();

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': 'Aroma Dhaba',
    'description': description,
    'url': SEO_CONFIG.siteUrl,
    'telephone': SEO_CONFIG.phone,
    'location': {
        '@type': 'Place',
        'name': `${SEO_CONFIG.campus} campus`
    }
  };

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="Aroma Dhaba" />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={`${SEO_CONFIG.siteUrl}${ogImage}`} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SEO_CONFIG.siteUrl}${ogImage}`} />

      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema || [restaurantSchema, localBusinessSchema]) }}
      />
    </>
  );
}
