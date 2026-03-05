import Link from 'next/link';
import { Mail, Phone, MapPin, Instagram, Facebook, UtensilsCrossed, Heart } from 'lucide-react';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-[#0f1115] text-gray-300 mt-auto pt-20 pb-8 relative overflow-hidden">
            {/* Subtle decorative background blur */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-24 bg-red-500/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">

                    {/* Brand & Mission - Takes up more space on large screens */}
                    <div className="lg:col-span-5 space-y-6">
                        <Link href="/" className="inline-block">
                            <span className="text-3xl font-black tracking-tighter text-white flex items-center gap-2" style={{ fontFamily: 'var(--font-geist-sans, sans-serif)' }}>
                                <UtensilsCrossed className="text-red-500" size={28} />
                                aromas<span className="text-gray-400 font-medium tracking-tight">dhaba</span>
                            </span>
                        </Link>
                        <p className="text-gray-400 max-w-sm text-sm leading-relaxed font-medium">
                            Serving delicious, hot, and hygienic food right to your hostel. Craving midnight snacks or a full meal? We've got you covered.
                        </p>

                        {/* Social Links */}
                        <div className="flex items-center gap-4 pt-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-red-500 hover:text-white transition-all duration-300 border border-white/10">
                                <Instagram size={18} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-blue-500 hover:text-white transition-all duration-300 border border-white/10">
                                <Facebook size={18} />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="lg:col-span-2">
                        <h3 className="text-white font-bold mb-6 text-sm tracking-wider uppercase flex items-center gap-2">Explore <span className="w-8 h-px bg-white/10"></span></h3>
                        <ul className="space-y-4">
                            <li><Link href="/" className="text-sm font-medium text-gray-400 hover:text-white hover:translate-x-1 inline-block transition-all">Home</Link></li>
                            <li><Link href="/categories" className="text-sm font-medium text-gray-400 hover:text-white hover:translate-x-1 inline-block transition-all">Menu by Category</Link></li>
                            <li><Link href="/checkout" className="text-sm font-medium text-gray-400 hover:text-white hover:translate-x-1 inline-block transition-all">Your Cart</Link></li>
                            <li><Link href="/account" className="text-sm font-medium text-gray-400 hover:text-white hover:translate-x-1 inline-block transition-all">My Account</Link></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div className="lg:col-span-2">
                        <h3 className="text-white font-bold mb-6 text-sm tracking-wider uppercase flex items-center gap-2">Legal <span className="w-8 h-px bg-white/10"></span></h3>
                        <ul className="space-y-4">
                            <li><Link href="/legal/privacy-policy" className="text-sm font-medium text-gray-400 hover:text-white hover:translate-x-1 inline-block transition-all">Privacy Policy</Link></li>
                            <li><Link href="/legal/refund-policy" className="text-sm font-medium text-gray-400 hover:text-white hover:translate-x-1 inline-block transition-all">Refund Policy</Link></li>
                            <li><Link href="/legal/terms-and-conditions" className="text-sm font-medium text-gray-400 hover:text-white hover:translate-x-1 inline-block transition-all">Terms & Conditions</Link></li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="lg:col-span-3">
                        <h3 className="text-white font-bold mb-6 text-sm tracking-wider uppercase flex items-center gap-2">Reach Us <span className="w-8 h-px bg-white/10"></span></h3>
                        <div className="space-y-5">
                            <a href="tel:+919892820940" className="flex items-start gap-3 group">
                                <span className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-red-500/20 group-hover:border-red-500/30 transition-colors">
                                    <Phone size={14} className="text-red-400" />
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-500 font-medium mb-0.5">Call for orders</span>
                                    <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">+91 98928 20940</span>
                                </div>
                            </a>

                            <a href="mailto:aromasdhaba@gmail.com" className="flex items-start gap-3 group">
                                <span className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-red-500/20 group-hover:border-red-500/30 transition-colors">
                                    <Mail size={14} className="text-red-400" />
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-500 font-medium mb-0.5">Email us</span>
                                    <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">aromasdhaba@gmail.com</span>
                                </div>
                            </a>

                            <div className="flex items-start gap-3 group">
                                <span className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-red-500/20 group-hover:border-red-500/30 transition-colors">
                                    <MapPin size={14} className="text-red-400" />
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-500 font-medium mb-0.5">Location</span>
                                    <Link href="/legal/contact-us" className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors leading-relaxed">
                                        Near Hostel 1, Hostel Road, IIT Bombay<br />
                                        Mumbai, Maharashtra 400076
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5 flex-wrap justify-center">
                        &copy; {currentYear} Aromas Delight Catering Service. All rights reserved.
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white/5 py-1.5 px-3 rounded-full border border-white/5">
                        Made with <Heart size={12} className="text-red-500 fill-red-500" /> at <span className="text-gray-300 font-bold ml-1">IIT Bombay</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
