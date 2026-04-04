'use client';

import { useVendor } from '@/contexts/VendorContext';
import { Settings as SettingsIcon, User, BellRing, Store, Moon, Sun, Clock, Timer, Palette, Volume2, Mail, Smartphone, ChevronDown, Printer, Download, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import PrinterSetupGuide from '@/components/vendor/PrinterSetupGuide';

export default function VendorSettings() {
    const { isStoreOpen, toggleStore } = useVendor();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const { isConnected } = useThermalPrinter();
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
            <div className="mb-8">
                <h2 className="text-[28px] font-extrabold text-[#111827] tracking-tight dark:text-white">System Configuration</h2>
                <p className="text-[15px] text-gray-500 font-medium mt-1 dark:text-gray-400">Manage your digital storefront environment and operational alerts.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Store Operations */}
                <div className="bg-white dark:bg-gray-900 rounded-[16px] shadow-sm flex flex-col h-full border border-gray-100 dark:border-gray-800">
                    <div className="p-6 pb-4">
                        <div className="w-10 h-10 bg-pink-50 dark:bg-pink-900/30 rounded-[12px] flex items-center justify-center mb-4">
                            <Store size={18} className="text-[#9B1B30] dark:text-pink-300" />
                        </div>
                        <h3 className="text-[17px] font-extrabold text-[#111827] dark:text-white leading-none">Store Operations</h3>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-2">Global toggle for customer availability</p>
                    </div>
                    <div className="p-6 pt-0 space-y-4">
                        <div className="flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-50 dark:border-indigo-900/40">
                            <div>
                                <h4 className="font-extrabold text-[#111827] dark:text-white text-sm">Accepting Orders</h4>
                                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">Instantly show/hide your menu.</p>
                            </div>
                            <button
                                onClick={toggleStore}
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${isStoreOpen ? 'bg-[#9B1B30]' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                                <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${isStoreOpen ? 'translate-x-[24px]' : 'translate-x-[2px]'}`} />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="border border-gray-100 dark:border-gray-800 p-4 rounded-xl">
                                <Clock size={16} className="text-[#d92d20] mb-3" />
                                <h4 className="font-extrabold text-[#111827] dark:text-white text-xs">Shutdown</h4>
                                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-1">Closing times.</p>
                            </div>
                            <div className="border border-gray-100 dark:border-gray-800 p-4 rounded-xl">
                                <Timer size={16} className="text-[#d92d20] mb-3" />
                                <h4 className="font-extrabold text-[#111827] dark:text-white text-xs">Prep Time</h4>
                                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-1">Lead times.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Appearance */}
                <div className="bg-white dark:bg-gray-900 rounded-[16px] shadow-sm flex flex-col h-full border border-gray-100 dark:border-gray-800">
                    <div className="p-6 pb-4">
                        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-[12px] flex items-center justify-center mb-4">
                            <Palette size={18} className="text-[#d92d20]" />
                        </div>
                        <h3 className="text-[17px] font-extrabold text-[#111827] dark:text-white leading-none">Appearance</h3>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-2">Visual dashboard personalization</p>
                    </div>
                    <div className="p-6 pt-0 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-extrabold text-[#111827] dark:text-white text-sm">Dark Theme</h4>
                                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">Low-light interface.</p>
                            </div>
                            <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${theme === 'dark' ? 'bg-[#9B1B30]' : 'bg-[#e2e8f0] dark:bg-gray-700'}`}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                            </button>
                        </div>
                        <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                            <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-4">Color Accent</h4>
                            <div className="flex gap-4 items-center">
                                <span className="w-6 h-6 rounded-full bg-[#d92d20] ring-4 ring-offset-2 ring-red-50 dark:ring-red-900/30 border border-white dark:border-gray-900 cursor-pointer shadow-sm hover:scale-110 transition-transform"></span>
                                <span className="w-5 h-5 rounded-full bg-violet-600 cursor-pointer hover:scale-110 shadow-sm transition-transform"></span>
                                <span className="w-5 h-5 rounded-full bg-[#9B1B30] cursor-pointer hover:scale-110 shadow-sm transition-transform"></span>
                                <span className="w-5 h-5 rounded-full bg-slate-800 cursor-pointer hover:scale-110 shadow-sm transition-transform"></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Printer Configuration */}
                <div className="bg-white dark:bg-gray-900 rounded-[16px] shadow-sm flex flex-col h-full border border-gray-100 dark:border-gray-800 lg:col-span-1">
                    <div className="p-6 pb-4">
                        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-[12px] flex items-center justify-center mb-4">
                            <Printer size={18} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-[17px] font-extrabold text-[#111827] dark:text-white leading-none">Printer Config</h3>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1.5">Direct thermal management</p>
                            </div>
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isConnected ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                                {isConnected ? 'Connected' : 'Offline'}
                            </div>
                        </div>
                    </div>
                    <div className="p-6 pt-0 space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3 mb-2">
                                <Zap size={14} className="text-amber-500" />
                                <h4 className="font-extrabold text-[#111827] dark:text-white text-[13px]">Universal Printing</h4>
                            </div>
                            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                                Zomato-style printing for Mac & Windows. Manual setup available for advanced users.
                            </p>
                            
                            <div className="space-y-2">
                                {!isConnected ? (
                                    <button 
                                        onClick={() => setShowGuide(true)}
                                        className="w-full flex items-center justify-center gap-2 bg-[#9B1B30] text-white py-2.5 rounded-lg text-xs font-black shadow-md hover:bg-[#801628] transition-all transform active:scale-[0.98] text-center"
                                    >
                                        <Download size={14} /> Download & Setup
                                    </button>
                                ) : (
                                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck size={14} className="text-emerald-500" />
                                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Service Active</span>
                                        </div>
                                        <span 
                                            onClick={() => window.location.reload()}
                                            className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 cursor-pointer hover:underline"
                                        >
                                            Re-ping
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between px-1">
                            <span 
                                onClick={() => setShowGuide(true)}
                                className="text-[11px] font-extrabold text-gray-400 flex items-center gap-1.5 cursor-pointer hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                <ExternalLink size={12}/> Setup Guide & Core
                            </span>
                            <span className="text-[11px] font-extrabold text-[#9B1B30] dark:text-red-400 cursor-pointer">Troubleshoot</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <PrinterSetupGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />

            {/* Bottom section: Notifications */}
            <div className="bg-white dark:bg-gray-900 rounded-[16px] border border-gray-100 dark:border-gray-800 shadow-sm mt-8 p-6">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4 border-b border-transparent">
                        <div className="w-10 h-10 bg-[#f3e8ff] dark:bg-purple-900/30 rounded-[12px] flex items-center justify-center shrink-0">
                            <BellRing size={18} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex flex-col justify-center">
                            <h3 className="text-[17px] font-extrabold text-[#111827] dark:text-white leading-none mb-1">Notifications</h3>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 leading-none">Configure order and system alerts.</p>
                        </div>
                    </div>
                    <button className="bg-[#f1f5f9] dark:bg-gray-800 text-[#1e293b] dark:text-gray-200 px-4 py-2 rounded-lg text-xs font-extrabold shadow-sm hover:bg-[#e2e8f0] dark:hover:bg-gray-700 transition-colors">
                        Reset Alerts
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-[#111827] dark:text-white text-sm flex items-center gap-2"><Volume2 size={14}/> Audio Alerts</h4>
                            <div className="bg-[#d92d20] w-9 h-5 rounded-[10px] relative shadow-inner cursor-pointer transition-colors">
                                <span className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"></span>
                            </div>
                        </div>
                        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed pr-4">Play a chime for every incoming order.</p>
                        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                            <h5 className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">Volume</h5>
                            <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full mt-2">
                                <div className="bg-[#94a3b8] dark:bg-gray-500 w-2/3 h-full rounded-full"></div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-[#111827] dark:text-white text-sm flex items-center gap-2"><Mail size={14}/> Email Summaries</h4>
                            <div className="bg-[#e2e8f0] dark:bg-gray-700 w-9 h-5 rounded-[10px] relative shadow-inner cursor-pointer transition-colors">
                                <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"></span>
                            </div>
                        </div>
                        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed pr-4">Receive a daily performance summary.</p>
                        <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-800 mt-2 cursor-pointer hover:border-gray-200 transition-colors">
                            Daily at 10:00 PM <ChevronDown size={14} className="text-gray-400" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-[#111827] dark:text-white text-sm flex items-center gap-2"><Smartphone size={14}/> SMS Critical</h4>
                            <div className="bg-[#d92d20] w-9 h-5 rounded-[10px] relative shadow-inner cursor-pointer transition-colors">
                                <span className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"></span>
                            </div>
                        </div>
                        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed pr-4">Immediate text alerts for critical failures.</p>
                        <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-[11px] font-extrabold text-[#334155] dark:text-gray-300 border border-gray-100 dark:border-gray-800 mt-2">
                            +1 (555) ••• ••89 
                            <span className="text-[#d92d20] dark:text-red-400 text-[10px] font-black uppercase cursor-pointer hover:underline tracking-wide">Change</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex flex-col md:flex-row gap-4 items-center justify-between text-[10px] font-bold text-gray-400 dark:text-gray-500 px-2">
                <div className="flex gap-6">
                    <span className="cursor-pointer hover:text-gray-600 transition-colors">Privacy Policy</span>
                    <span className="cursor-pointer hover:text-gray-600 transition-colors">Terms of Service</span>
                    <span className="cursor-pointer hover:text-gray-600 transition-colors">Vendor Guidelines</span>
                </div>
                <span>Aroma Slate v2.4.0 • Built with precision for the IIM Mumbai Campus</span>
            </div>
        </div>
    );
}
