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

        {/* Contact Info Section */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              <div className="space-y-12">
                <div>
                  <h2 className="text-4xl font-black text-gray-900 mb-6">Get in Touch</h2>
                  <p className="text-gray-600 text-lg leading-relaxed font-medium">
                    Have a question about our menu, delivery times, or bulk orders for your campus events? We're just a call or message away.
                  </p>
                </div>
                
                <div className="space-y-8">
                  <div className="flex items-start gap-6 group">
                    <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-all shadow-sm">
                      <Phone size={28} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-1">Phone</h4>
                      <p className="text-gray-600 font-medium mb-1">Call for instant orders</p>
                      <a href="tel:+919892820940" className="text-red-600 text-lg font-black hover:underline">+91 98928 20940</a>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-6 group">
                    <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-all shadow-sm">
                      <Mail size={28} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-1">Email</h4>
                      <p className="text-gray-600 font-medium mb-1">For feedback and events</p>
                      <a href="mailto:aromasdhaba@gmail.com" className="text-red-600 text-lg font-black hover:underline uppercase">aromasdhaba@gmail.com</a>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-6 group">
                    <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-all shadow-sm">
                      <MapPin size={28} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-1">Location</h4>
                      <p className="text-gray-600 font-medium leading-relaxed">
                        IIM Mumbai Campus, Powai<br />
                        Mumbai, Maharashtra 400087
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-8">
                    <h4 className="text-xl font-black text-gray-900 mb-6">Follow Us</h4>
                    <div className="flex items-center gap-4">
                        <a href="#" className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-black hover:text-white transition-all duration-300">
                            <Instagram size={24} />
                        </a>
                        <a href="#" className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-blue-600 hover:text-white transition-all duration-300">
                            <Facebook size={24} />
                        </a>
                    </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-[40px] p-8 md:p-12 border border-gray-100 shadow-xl shadow-gray-200/50">
                <div className="mb-10 text-center">
                    <div className="w-20 h-20 bg-red-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-600/20">
                        <Clock size={40} />
                    </div>
                    <h3 className="text-3xl font-black text-gray-900 mb-2">Operating Hours</h3>
                    <p className="text-gray-500 font-medium">Serving you 24/7 on campus</p>
                </div>
                
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-white rounded-2xl shadow-sm">
                        <span className="font-bold text-gray-700 text-lg uppercase tracking-wide">Daily Canteen</span>
                        <span className="font-black text-red-600 text-lg italic">11:00 AM - 11:30 PM</span>
                    </div>
                    <div className="flex items-center justify-between p-6 bg-red-600 text-white rounded-2xl shadow-lg transform scale-105">
                        <div className="flex flex-col">
                            <span className="font-bold text-red-100 text-sm uppercase tracking-widest">Late Night</span>
                            <span className="font-black text-2xl">Midnight Dhaba</span>
                        </div>
                        <span className="font-black text-xl bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm">11:30 PM - 03:30 AM</span>
                    </div>
                </div>
                
                <div className="mt-12 p-8 bg-black rounded-3xl text-center text-white">
                    <MessageSquare size={32} className="mx-auto mb-4 text-red-500" />
                    <h4 className="text-xl font-bold mb-2">Bulk Orders?</h4>
                    <p className="text-gray-400 text-sm mb-6">Planning a hostel party or a club event? We offer special discounts for bulk orders.</p>
                    <a href="tel:+919892820940" className="block w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black transition-all">
                        Inquire Now
                    </a>
                </div>
              </div>
            </div>
          </div>
        </section>

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
                    Near Hostel 15<br />
                    IIM Mumbai Campus, Powai<br />
                    Mumbai, Maharashtra<br />
                    PIN: 400087
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Operational Address</p>
                  <p className="text-gray-700 leading-relaxed">
                    Near Hostel 15<br />
                    IIM Mumbai Campus, Powai<br />
                    Mumbai, Maharashtra<br />
                    PIN: 400087
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
