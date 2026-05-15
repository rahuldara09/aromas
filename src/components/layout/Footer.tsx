import Link from 'next/link';
import { Mail, Phone, MapPin, Instagram, Facebook, UtensilsCrossed, Heart } from 'lucide-react';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-[#F8FAFC] text-slate-600 mt-auto pt-24 pb-12 border-t border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-20">

                    {/* Brand & Mission - Takes up more space on large screens */}
                    <div className="lg:col-span-5 space-y-7">
                        <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
                            <span className="text-3xl font-black tracking-tighter text-gray-900 flex items-center gap-2" style={{ fontFamily: 'var(--font-geist-sans, sans-serif)' }}>
                                <UtensilsCrossed className="text-red-500" size={30} />
                                aromas<span className="text-red-500 font-medium tracking-tight">dhaba</span>
                            </span>
                        </Link>
                        <p className="text-[#64748B] max-w-sm text-sm leading-relaxed font-semibold">
                            Serving the <strong className="text-gray-900">IIM Mumbai Campus</strong>. Aroma Dhaba IIM Mumbai delivers delicious, hot, and hygienic food right to your dorm.
                        </p>

                        {/* Social Links */}
                        <div className="flex items-center gap-4 pt-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all duration-300 border border-slate-200 shadow-sm">
                                <Instagram size={18} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition-all duration-300 border border-slate-200 shadow-sm">
                                <Facebook size={18} />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="lg:col-span-2">
                        <h3 className="text-gray-900 font-bold mb-7 text-sm tracking-wide capitalize flex items-center gap-2">Explore <span className="w-6 h-[2px] bg-red-500/10 hidden lg:block"></span></h3>
                        <ul className="space-y-4">
                             <li><Link href="/" className="text-sm font-semibold text-[#64748B] hover:text-red-500 hover:translate-x-1 inline-block transition-all">Home</Link></li>
                             <li><Link href="/about" className="text-sm font-semibold text-[#64748B] hover:text-red-500 hover:translate-x-1 inline-block transition-all">About Us</Link></li>
                             <li><Link href="/contact" className="text-sm font-semibold text-[#64748B] hover:text-red-500 hover:translate-x-1 inline-block transition-all">Contact Us</Link></li>
                             <li><Link href="/blog" className="text-sm font-semibold text-[#64748B] hover:text-red-500 hover:translate-x-1 inline-block transition-all">Campus Blog</Link></li>
                             <li><Link href="/account" className="text-sm font-semibold text-[#64748B] hover:text-red-500 hover:translate-x-1 inline-block transition-all">My Account</Link></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div className="lg:col-span-2">
                        <h3 className="text-gray-900 font-bold mb-7 text-sm tracking-wide capitalize flex items-center gap-2">Legal <span className="w-6 h-[2px] bg-red-500/10 hidden lg:block"></span></h3>
                        <ul className="space-y-4">
                            <li><Link href="/legal/privacy-policy" className="text-sm font-semibold text-[#64748B] hover:text-red-500 hover:translate-x-1 inline-block transition-all">Privacy Policy</Link></li>
                            <li><Link href="/legal/refund-policy" className="text-sm font-semibold text-[#64748B] hover:text-red-500 hover:translate-x-1 inline-block transition-all">Refund Policy</Link></li>
                            <li><Link href="/legal/terms-and-conditions" className="text-sm font-semibold text-[#64748B] hover:text-red-500 hover:translate-x-1 inline-block transition-all">Terms & Conditions</Link></li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="lg:col-span-3">
                        <h3 className="text-gray-900 font-bold mb-7 text-sm tracking-wide capitalize flex items-center gap-2">Reach Us <span className="w-6 h-[2px] bg-red-500/10 hidden lg:block"></span></h3>
                        <div className="space-y-6">
                            <a href="tel:+919892820940" className="flex items-start gap-4 group">
                                <span className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-red-50 group-hover:border-red-200 transition-colors shadow-sm">
                                    <Phone size={15} className="text-red-500" />
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight mb-0.5">Call for orders</span>
                                    <span className="text-sm font-bold text-gray-900 group-hover:text-red-500 transition-colors tracking-tight">+91 98928 20940</span>
                                </div>
                            </a>

                            <a href="mailto:aromasdhaba@gmail.com" className="flex items-start gap-4 group">
                                <span className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-red-50 group-hover:border-red-200 transition-colors shadow-sm">
                                    <Mail size={15} className="text-red-500" />
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight mb-0.5">Email us</span>
                                    <span className="text-sm font-bold text-gray-900 group-hover:text-red-500 transition-colors tracking-tight">aromasdhaba@gmail.com</span>
                                </div>
                            </a>

                            <div className="flex items-start gap-4 group">
                                <span className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-red-50 group-hover:border-red-200 transition-colors shadow-sm">
                                    <MapPin size={15} className="text-red-500" />
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight mb-0.5">Location</span>
                                    <Link href="/contact" className="text-sm font-semibold text-gray-900 group-hover:text-red-500 transition-colors leading-relaxed tracking-tight">
                                        NITIE Admin Block, IIM Mumbai<br />
                                        Powai, Mumbai – 400087
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Bottom Bar */}
                <div className="pt-10 border-t border-slate-200/60 flex flex-col items-center justify-center gap-6">
                    <p className="text-xs font-bold text-slate-400 text-center tracking-tight">
                        &copy; {currentYear} Aromas Delight Catering Service. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
