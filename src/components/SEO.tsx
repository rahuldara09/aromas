'use client';

import Head from 'next/head';
import { usePathname } from 'next/navigation';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: 'website' | 'article' | 'restaurant';
  ogImage?: string;
  keywords?: string[];
  schema?: any;
}

const DEFAULT_TITLE = 'Aroma Dhaba | Late Night Food at IIM Ahmedabad';
const DEFAULT_DESCRIPTION = 'Order delicious, hot, and hygienic food from Aroma Dhaba, IIM Ahmedabad campus. Fast late-night delivery and daily canteen service for students.';
const SITE_URL = 'https://aromadhaba.in';

export default function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonical,
  ogType = 'website',
  ogImage = '/og-image.jpg',
  keywords = ['IIM Ahmedabad food', 'late night food IIMA', 'campus food delivery', 'Aroma Dhaba', 'IIMA canteen'],
  schema,
}: SEOProps) {
  const pathname = usePathname();
  const url = `${SITE_URL}${pathname}`;
  const canonicalUrl = canonical || url;

  const restaurantSchema = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    'name': 'Aroma Dhaba',
    'image': `${SITE_URL}/logo.png`,
    '@id': `${SITE_URL}`,
    'url': `${SITE_URL}`,
    'telephone': '+919892820940',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': 'IIM Ahmedabad campus, Vastrapur',
      'addressLocality': 'Ahmedabad',
      'postalCode': '380015',
      'addressRegion': 'Gujarat',
      'addressCountry': 'IN'
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': 23.0311,
      'longitude': 72.5312
    },
    'openingHoursSpecification': [
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        'opens': '11:00',
        'closes': '23:59'
      },
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        'opens': '00:00',
        'closes': '03:30'
      }
    ],
    'servesCuisine': 'North Indian, Chinese, Fast Food',
    'priceRange': '₹',
    'menu': `${SITE_URL}/menu`,
    'acceptsReservations': 'false'
  };

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': 'Aroma Dhaba',
    'description': DEFAULT_DESCRIPTION,
    'url': SITE_URL,
    'telephone': '+919892820940',
    'location': {
        '@type': 'Place',
        'name': 'IIM Ahmedabad campus'
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
      <meta property="og:image" content={`${SITE_URL}${ogImage}`} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SITE_URL}${ogImage}`} />

      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema || [restaurantSchema, localBusinessSchema]) }}
      />
    </>
  );
}
