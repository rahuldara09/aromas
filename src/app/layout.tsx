import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AuthModal from '@/components/auth/AuthModal';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import FooterWrapper from '@/components/layout/FooterWrapper';
import Script from 'next/script';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { Suspense } from 'react';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Aroma Dhaba | Late Night Food at IIM Ahmedabad',
    template: '%s | Aroma Dhaba',
  },
  description: 'Order delicious, hot, and hygienic food from Aroma Dhaba, IIM Ahmedabad campus. Fast late-night delivery and daily canteen service for students.',
  keywords: ['IIM Ahmedabad food', 'late night food IIMA', 'campus food delivery', 'Aroma Dhaba', 'IIMA canteen', 'best food IIM A'],
  metadataBase: new URL('https://aromadhaba.in'),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  verification: {
    google: 'REPLACE_WITH_YOUR_GOOGLE_SITE_VERIFICATION_CODE',
  },
  openGraph: {
    title: 'Aroma Dhaba | Late Night Food at IIM Ahmedabad',
    description: 'Order delicious food from Aroma Dhaba, IIM Ahmedabad. Fast late-night delivery to your hostel.',
    url: 'https://aromadhaba.in',
    siteName: 'Aroma Dhaba',
    locale: 'en_IN',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  'name': 'Aroma Dhaba',
  'image': 'https://aromadhaba.in/logo.png',
  '@id': 'https://aromadhaba.in',
  'url': 'https://aromadhaba.in',
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
  'menu': 'https://aromadhaba.in/menu',
  'acceptsReservations': 'false'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID || '';

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={geist.className}>
        <Script src="/cashfree.js" strategy="beforeInteractive" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {gaId && (
          <Suspense fallback={null}>
            <GoogleAnalytics gaId={gaId} />
          </Suspense>
        )}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <div className="flex flex-col min-h-screen">
              {children}
              <FooterWrapper />
            </div>
            <AuthModal />
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: {
                  background: '#1f2937',
                  color: '#fff',
                  borderRadius: '12px',
                  fontSize: '14px',
                },
              }}
            />
            <Analytics />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
