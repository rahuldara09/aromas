'use client';

import { useVendor } from '@/contexts/VendorContext';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import PrinterSetupGuide from '@/components/vendor/PrinterSetupGuide';
import { useAuth } from '@/contexts/AuthContext';
import { listenToGSTSettings, updateGSTSettings } from '@/lib/vendor';
import { GSTSettings } from '@/types';
import {
    Store, Printer, Bell, Palette,
    ChevronDown, Download, ExternalLink, ShieldCheck, Zap, Activity, Clock, Timer, Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';

type Section = 'General' | 'Hardware' | 'Notifications' | 'Appearance' | 'Pricing';

function Toggle({ checked, onChange, accent = 'gray' }: { checked: boolean; onChange: () => void; accent?: string }) {
    return (
        <button
            onClick={onChange}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none
                ${checked ? 'bg-indigo-600' : 'bg-gray-200'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
                ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
    );
}

function SettingRow({ label, description, children }: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
            <div className="flex-1 mr-6">
                <p className="text-[14px] font-semibold text-gray-900">{label}</p>
                {description && <p className="text-[12px] text-gray-400 mt-0.5">{description}</p>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

export default function VendorSettings() {
    const { isStoreOpen, toggleStore } = useVendor();
    const { user, phoneNumber } = useAuth();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const { isConnected } = useThermalPrinter();
    const [showGuide, setShowGuide] = useState(false);
    const [activeSection, setActiveSection] = useState<Section>('General');

    const [gst, setGst] = useState<GSTSettings>({ gstEnabled: false, gstType: 'included', gstPercentage: 5 });
    const [gstSaving, setGstSaving] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        const unsub = listenToGSTSettings(setGst);
        return () => unsub();
    }, []);
    if (!mounted) return null;

    const saveGST = async () => {
        if (!user) return;
        setGstSaving(true);
        try {
            const idToken = await user.getIdToken();
            await updateGSTSettings(gst, idToken, phoneNumber ?? '');
            toast.success('GST settings saved', { style: { borderRadius: '14px', fontWeight: 600 } });
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save GST settings');
        } finally {
            setGstSaving(false);
        }
    };

    const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
        { id: 'General', label: 'General', icon: <Store size={14} /> },
        { id: 'Pricing', label: 'Pricing & GST', icon: <Receipt size={14} /> },
        { id: 'Hardware', label: 'Hardware', icon: <Printer size={14} /> },
        { id: 'Notifications', label: 'Notifications', icon: <Bell size={14} /> },
        { id: 'Appearance', label: 'Appearance', icon: <Palette size={14} /> },
    ];

    return (
        <div className="vendor-workspace h-full overflow-y-auto p-5 pb-10">

            {/* ── HEADER ── */}
            <div className="mb-6">
                <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Settings</h1>
                <p className="text-[13px] text-gray-500 mt-0.5">Operational preferences & system configuration</p>
            </div>

            {/* ── LAYOUT ── */}
            <div className="flex gap-8">

                {/* Left sidebar */}
                <div className="w-44 shrink-0">
                    <nav className="space-y-0.5">
                        {sections.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setActiveSection(s.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-colors text-left
                                    ${activeSection === s.id
                                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                            >
                                <span className={activeSection === s.id ? 'text-indigo-500' : 'text-gray-400'}>
                                    {s.icon}
                                </span>
                                {s.label}
                            </button>
                        ))}
                    </nav>

                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <Activity size={11} className="text-emerald-500" />
                            <span>v2.4.0</span>
                        </div>
                        <p className="text-[10px] text-gray-300 mt-1">IIM Mumbai Campus</p>
                    </div>
                </div>

                {/* Right content */}
                <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

                        {/* GENERAL */}
                        {activeSection === 'General' && (
                            <div className="px-6 py-2">
                                <div className="py-4 border-b border-gray-100">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Store operations</p>
                                    <SettingRow
                                        label="Accept orders"
                                        description="Toggle global store visibility and incoming order acceptance"
                                    >
                                        <Toggle checked={isStoreOpen} onChange={toggleStore} />
                                    </SettingRow>
                                </div>
                                <div className="py-4">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Scheduling</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors text-left group">
                                            <Clock size={16} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                                            <div>
                                                <p className="text-[13px] font-semibold text-gray-900">Auto-closing</p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">Schedule closing time</p>
                                            </div>
                                        </button>
                                        <button className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors text-left group">
                                            <Timer size={16} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                                            <div>
                                                <p className="text-[13px] font-semibold text-gray-900">Prep time</p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">Set default prep duration</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PRICING & GST */}
                        {activeSection === 'Pricing' && (
                            <div className="px-6 py-2">
                                <div className="py-4 border-b border-gray-100">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">GST Configuration</p>

                                    <SettingRow
                                        label="Enable GST"
                                        description="Show GST as part of the price breakdown on checkout"
                                    >
                                        <Toggle
                                            checked={gst.gstEnabled}
                                            onChange={() => setGst(g => ({ ...g, gstEnabled: !g.gstEnabled }))}
                                        />
                                    </SettingRow>

                                    {gst.gstEnabled && (
                                        <>
                                            <div className="py-4 border-b border-gray-100">
                                                <p className="text-[14px] font-semibold text-gray-900 mb-1">GST Type</p>
                                                <p className="text-[12px] text-gray-400 mb-3">How GST is applied to product prices</p>
                                                <div className="flex gap-3">
                                                    {(['included', 'excluded'] as const).map((type) => (
                                                        <button
                                                            key={type}
                                                            onClick={() => setGst(g => ({ ...g, gstType: type }))}
                                                            className={`flex-1 py-3 px-4 rounded-xl border text-[13px] font-semibold transition-colors text-left
                                                                ${gst.gstType === type
                                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <p className="capitalize">{type}</p>
                                                            <p className={`text-[11px] mt-0.5 font-normal ${gst.gstType === type ? 'text-indigo-500' : 'text-gray-400'}`}>
                                                                {type === 'included'
                                                                    ? 'GST already in price'
                                                                    : 'GST added on top'}
                                                            </p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="py-4">
                                                <p className="text-[14px] font-semibold text-gray-900 mb-1">GST Rate</p>
                                                <p className="text-[12px] text-gray-400 mb-3">Enter the applicable GST percentage</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative flex-1 max-w-[140px]">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            step={0.5}
                                                            value={gst.gstPercentage}
                                                            onChange={(e) => setGst(g => ({ ...g, gstPercentage: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                                                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition pr-8"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400 font-medium">%</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {[5, 12, 18, 28].map(rate => (
                                                            <button
                                                                key={rate}
                                                                onClick={() => setGst(g => ({ ...g, gstPercentage: rate }))}
                                                                className={`px-3 py-2 rounded-lg text-[12px] font-medium border transition-colors
                                                                    ${gst.gstPercentage === rate
                                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                {rate}%
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {gst.gstEnabled && (
                                    <div className="py-4 border-b border-gray-100">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Preview</p>
                                        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-[13px]">
                                            <div className="flex justify-between text-gray-600 mb-1.5">
                                                <span>Item total</span>
                                                <span>₹100.00</span>
                                            </div>
                                            {gst.gstType === 'included' ? (
                                                <>
                                                    <div className="flex justify-between text-gray-400 text-[12px] mb-1.5 pl-3">
                                                        <span>↳ Base price</span>
                                                        <span>₹{(100 / (1 + gst.gstPercentage / 100)).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-gray-400 text-[12px] mb-1.5 pl-3">
                                                        <span>↳ GST ({gst.gstPercentage}%)</span>
                                                        <span>₹{(100 - 100 / (1 + gst.gstPercentage / 100)).toFixed(2)}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex justify-between text-gray-400 text-[12px] mb-1.5">
                                                    <span>GST ({gst.gstPercentage}%)</span>
                                                    <span>+₹{(100 * gst.gstPercentage / 100).toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200 mt-1">
                                                <span>To Pay</span>
                                                <span>₹{gst.gstType === 'included' ? '100.00' : (100 + 100 * gst.gstPercentage / 100).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="py-4">
                                    <button
                                        onClick={saveGST}
                                        disabled={gstSaving}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-xl text-[14px] transition-colors"
                                    >
                                        {gstSaving ? 'Saving…' : 'Save GST Settings'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* HARDWARE */}
                        {activeSection === 'Hardware' && (
                            <div className="px-6 py-2">
                                <div className="py-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Thermal printer</p>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium
                                            ${isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                            {isConnected ? 'Connected' : 'Offline'}
                                        </span>
                                    </div>

                                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Zap size={13} className="text-amber-500" />
                                            <p className="text-[13px] font-semibold text-gray-900">Auto-print</p>
                                        </div>
                                        <p className="text-[12px] text-gray-400 mb-4">
                                            Automatically print kitchen tickets when new orders arrive.
                                        </p>

                                        {!isConnected ? (
                                            <button
                                                onClick={() => setShowGuide(true)}
                                                className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white py-2.5 rounded-xl text-[13px] font-medium hover:bg-indigo-700 transition-colors"
                                            >
                                                <Download size={14} />
                                                Set up printer
                                            </button>
                                        ) : (
                                            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheck size={14} className="text-emerald-600" />
                                                    <span className="text-[12px] font-medium text-emerald-700">Active connection</span>
                                                </div>
                                                <button
                                                    onClick={() => window.location.reload()}
                                                    className="text-[12px] text-emerald-600 hover:text-emerald-800 transition-colors"
                                                >
                                                    Refresh
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => setShowGuide(true)}
                                        className="flex items-center gap-1.5 mt-4 text-[12px] text-gray-400 hover:text-gray-700 transition-colors"
                                    >
                                        <ExternalLink size={12} />
                                        View setup guide
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* NOTIFICATIONS */}
                        {activeSection === 'Notifications' && (
                            <div className="px-6 py-2">
                                <div className="py-4">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Alert channels</p>

                                    <SettingRow
                                        label="Sound alerts"
                                        description="Play an alert sound when new orders come in"
                                    >
                                        <Toggle checked={true} onChange={() => {}} />
                                    </SettingRow>

                                    <div className="py-4 border-b border-gray-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <p className="text-[14px] font-semibold text-gray-900">Volume</p>
                                                <p className="text-[12px] text-gray-400 mt-0.5">Alert volume level</p>
                                            </div>
                                            <span className="text-[12px] font-medium text-gray-600">80%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: '80%' }} />
                                        </div>
                                    </div>

                                    <SettingRow
                                        label="Email alerts"
                                        description="Receive a daily summary at your registered email"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-[12px] text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors">
                                                Daily @ 22:00 <ChevronDown size={12} className="text-gray-400 ml-1" />
                                            </div>
                                            <Toggle checked={false} onChange={() => {}} />
                                        </div>
                                    </SettingRow>

                                    <SettingRow
                                        label="SMS alerts"
                                        description="Emergency fallback notifications via SMS"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-[12px] text-gray-400">+91 ••• ••• 0892</span>
                                            <Toggle checked={true} onChange={() => {}} />
                                        </div>
                                    </SettingRow>
                                </div>
                            </div>
                        )}

                        {/* APPEARANCE */}
                        {activeSection === 'Appearance' && (
                            <div className="px-6 py-2">
                                <div className="py-4">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Theme</p>

                                    <SettingRow
                                        label="Night mode"
                                        description="Switch to a dark-themed interface"
                                    >
                                        <Toggle
                                            checked={theme === 'dark'}
                                            onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                        />
                                    </SettingRow>

                                    <div className="py-4">
                                        <p className="text-[14px] font-semibold text-gray-900 mb-1">Accent color</p>
                                        <p className="text-[12px] text-gray-400 mb-4">Choose a highlight color for the interface</p>
                                        <div className="flex items-center gap-2.5">
                                            {[
                                                { color: '#6366F1', label: 'Indigo', ring: 'ring-indigo-300', active: true },
                                                { color: '#06B6D4', label: 'Cyan', ring: 'ring-cyan-200', active: false },
                                                { color: '#111827', label: 'Slate', ring: 'ring-gray-300', active: false },
                                                { color: '#EF4444', label: 'Red', ring: 'ring-red-200', active: false },
                                            ].map(accent => (
                                                <button
                                                    key={accent.color}
                                                    title={accent.label}
                                                    className={`w-7 h-7 rounded-full border-2 border-white ring-2 ${accent.ring} transition-transform hover:scale-110 ${accent.active ? 'scale-110' : ''}`}
                                                    style={{ background: accent.color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="pb-4 pt-2">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">About</p>
                                    <div className="space-y-2">
                                        {['Privacy', 'Terms of Service', 'Hardware API'].map(link => (
                                            <button key={link} className="flex w-full items-center justify-between py-2 text-[13px] text-gray-700 hover:text-gray-900 transition-colors group">
                                                {link}
                                                <span className="text-gray-300 group-hover:text-gray-500 transition-colors">→</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <PrinterSetupGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
        </div>
    );
}
