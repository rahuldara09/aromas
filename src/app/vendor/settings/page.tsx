'use client';

import { useVendor } from '@/contexts/VendorContext';
import { Settings as SettingsIcon, User, BellRing, Shield, Store, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function VendorSettings() {
    const { isStoreOpen, toggleStore } = useVendor();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 pb-20">
            <div>
                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight dark:text-white">Settings</h2>
                <p className="text-sm text-gray-500 font-medium mt-1 dark:text-gray-400">Manage your store preferences and account details</p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Moon size={20} className="text-indigo-500" />
                        Appearance
                    </h3>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">Dark Theme</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Switch the entire platform to a low-light interface.</p>
                        </div>
                        {mounted && (
                            <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none shadow-inner ${theme === 'dark' ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-[26px]' : 'translate-x-[4px]'}`}>
                                    {theme === 'dark' ? <Moon size={12} className="text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /> : <Sun size={12} className="text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Store size={20} className="text-red-500" />
                        Store Operations
                    </h3>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">Accepting Orders</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Master switch to turn off your outlet on the consumer app.</p>
                        </div>
                        <button
                            onClick={toggleStore}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none shadow-inner ${isStoreOpen ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isStoreOpen ? 'translate-x-[26px]' : 'translate-x-[4px]'}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden opacity-70">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BellRing size={20} className="text-gray-500" />
                        Notifications
                    </h3>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Audio settings and alerts are automatically managed by the browser session. Ensure your volume is up for Kitchen Yell mode.</p>
                </div>
            </div>

        </div>
    );
}
