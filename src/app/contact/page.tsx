import Header from '@/components/layout/Header';
import { Mail, Phone, MapPin, Clock, MessageSquare, Instagram, Facebook } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | Aroma Dhaba IIM Mumbai',
  description: 'Get in touch with Aroma Dhaba at IIM Mumbai campus. Order via phone, email us, or visit us. 24/7 student food support.',
};

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-grow">
        {/* Banner */}
        <div className="bg-red-600 py-20 text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight">Contact Us</h1>
            <p className="text-xl text-red-100 max-w-2xl mx-auto font-medium">
              We're always here to help with your cravings.
            </p>
          </div>
        </div>


        {/* Legal / Business Info Section */}
        <section className="py-16 bg-gray-50 border-t border-gray-100">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl font-black text-gray-900 mb-8 tracking-tight">Business Information</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Merchant Legal Entity Name</p>
                <p className="text-lg font-bold text-gray-900">AROMAS DELIGHT CATERING SERVICE</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Registered Address</p>
                  <p className="text-gray-700 leading-relaxed">
                    M/s Indian Institute of Management Mumbai<br />
                    Vihar Lake Road, Near The Residence Hotel<br />
                    NITIE Admin Block, Powai<br />
                    Mumbai, Maharashtra – 400087 (State Code: 27)
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Operational Address</p>
                  <p className="text-gray-700 leading-relaxed">
                    M/s Indian Institute of Management Mumbai<br />
                    Vihar Lake Road, Near The Residence Hotel<br />
                    NITIE Admin Block, Powai<br />
                    Mumbai, Maharashtra – 400087 (State Code: 27)
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Telephone No</p>
                  <a href="tel:+919892820940" className="text-lg font-bold text-gray-900 hover:text-red-600 transition-colors">9892820940</a>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">E-Mail ID</p>
                  <a href="mailto:aromasdhaba@gmail.com" className="text-lg font-bold text-red-600 hover:text-red-700 transition-colors">aromasdhaba@gmail.com</a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
