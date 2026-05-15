'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

export default function FooterWrapper() {
  const pathname = usePathname();
  
  // Don't show footer on vendor routes
  if (pathname?.startsWith('/vendor')) {
    return null;
  }
  
  return <Footer />;
}
