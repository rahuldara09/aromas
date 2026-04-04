'use client';

import React, { useState, useEffect } from 'react';
import { X, Apple, Monitor, ShieldAlert, CheckCircle2, Download, Copy, Check, ExternalLink, Play, ChevronDown, ChevronUp, Zap, HelpCircle, Bug, Terminal, Activity, RefreshCw, User } from 'lucide-react';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';

interface PrinterSetupGuideProps {
    isOpen: boolean;
    onClose: () => void;
}

const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            // Check if navigator.clipboard is available (Secure contexts only)
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } else {
                throw new Error('Clipboard API not available');
            }
        } catch (err) {
            // Fallback for non-secure contexts (e.g., accessing via IP address)
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }
            } catch (err2) {
                console.error('Failed to copy text: ', err2);
            }
        }
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-500 dark:text-gray-400 shrink-0"
            title="Copy to clipboard"
        >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
    );
};

const AdvancedStep = ({ title, command, description }: { title: string, command: string, description?: string }) => (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 space-y-2">
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider font-mono">{title}</span>
            <CopyButton text={command} />
        </div>
        <div className="bg-gray-900 p-2 rounded border border-gray-800 overflow-x-auto">
            <code className="text-[10px] font-mono text-indigo-300 whitespace-nowrap">{command}</code>
        </div>
        {description && <p className="text-[9px] font-medium text-gray-500 dark:text-gray-400">{description}</p>}
    </div>
);

export default function PrinterSetupGuide({ isOpen, onClose }: PrinterSetupGuideProps) {
    const { isConnected } = useThermalPrinter();
    const [activeTab, setActiveTab] = useState<'mac' | 'windows'>('mac');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [manuallyShowSetup, setManuallyShowSetup] = useState(false);
    const [username, setUsername] = useState('your-username');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const isWin = navigator.userAgent.toLowerCase().includes('win');
            setActiveTab(isWin ? 'windows' : 'mac');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const showSetupSteps = !isConnected || manuallyShowSetup;

    // Helper to replace username in paths
    const getPath = (template: string) => template.replace('<your-username>', username || 'your-username');

    const steps = {
        mac: {
            folderPath: getPath('/Users/<your-username>/Documents/vyapar_printer'),
            cdCommand: getPath('cd ~/Documents/vyapar_printer'),
            downloadLinks: [
                { label: 'Download .dmg (Recommended)', href: '/downloads/vyapar_printer_mac.dmg', primary: true },
                { label: 'Download .zip (Alternative)', href: '/downloads/vyapar_printer_mac.zip', primary: false }
            ]
        },
        windows: {
            folderPath: getPath('C:\\Users\\<your-username>\\Documents\\vyapar_printer'),
            cdCommand: getPath('cd %USERPROFILE%\\Documents\\vyapar_printer'),
            downloadLinks: [
                { label: 'Download for Windows (.zip)', href: '/downloads/vyapar_printer_win.zip', primary: true }
            ]
        }
    };

    const current = steps[activeTab];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            
            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[24px] shadow-2xl flex flex-col border border-gray-100 dark:border-gray-800">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-[#111827] dark:text-white leading-tight">Universal Printer Setup</h2>
                            {isConnected && (
                                <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Active
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">Version 2.6 (Stable) • 3-Level Setup Guide</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-8 pb-12">
                    
                    {/* SMART DETECTION: SUCCESS VIEW */}
                    {isConnected && !manuallyShowSetup && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 p-8 rounded-[24px] text-center space-y-4">
                            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                                <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-300">Printer Already Connected!</h3>
                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400/80 mt-1">Your system is ready to print direct thermal orders.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <button 
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
                                >
                                    Dismiss & Start Working
                                </button>
                                <button 
                                    onClick={() => setManuallyShowSetup(true)}
                                    className="flex-1 py-3 bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-black hover:bg-emerald-50 dark:hover:bg-gray-700/50 transition-all"
                                >
                                    Re-setup Printer
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SETUP STEPS (VISIBLE IF NOT CONNECTED OR MANUALLY TRIGGERED) */}
                    {showSetupSteps && (
                        <>
                            {/* 🔹 LEVEL 1: 1-CLICK SETUP (RECOMMENDED) */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                                    <Zap className="text-indigo-500 shrink-0" size={18} />
                                    <h3 className="text-base font-black dark:text-white uppercase tracking-tight">1. 1-Click Setup <span className="text-indigo-500">(Recommended)</span></h3>
                                </div>
                                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-900/20 p-5 rounded-[20px] grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                    <div className="space-y-3">
                                        <p className="text-xs font-bold text-gray-600 dark:text-gray-300">Fastest setup for non-technical users. Just download and run.</p>
                                        <div className="flex flex-col gap-2">
                                            {current.downloadLinks.filter(l => l.primary).map((link, idx) => (
                                                <a key={idx} href={link.href} download className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/20 transition-all transform active:scale-[0.98]">
                                                    <Download size={14} /> {link.label}
                                                </a>
                                            ))}
                                            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><HelpCircle size={10}/> Double-click installer → auto-start active.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 border-l border-indigo-100 dark:border-indigo-900/30 pl-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-5 h-5 bg-indigo-100 dark:bg-indigo-900/50 rounded flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">01</div>
                                            <span className="text-[11px] font-bold dark:text-gray-200">Download the app</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-5 h-5 bg-indigo-100 dark:bg-indigo-900/50 rounded flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">02</div>
                                            <span className="text-[11px] font-bold dark:text-gray-200">Double click & Install</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-5 h-5 bg-indigo-100 dark:bg-indigo-900/50 rounded flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">03</div>
                                            <span className="text-[11px] font-bold dark:text-gray-200">Wait for Green Dot</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 🔹 LEVEL 2: QUICK SETUP (COPY-PASTE) */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                                    <Terminal className="text-gray-400 shrink-0" size={18} />
                                    <h3 className="text-base font-black dark:text-white uppercase tracking-tight">2. Quick Setup <span className="text-gray-400">(Manual Terminal)</span></h3>
                                </div>

                                {/* OS Tabs & Username Field */}
                                <div className="space-y-3">
                                    <div className="flex p-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                                        <button 
                                            onClick={() => setActiveTab('mac')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'mac' ? 'bg-white dark:bg-gray-700 shadow-sm text-[#111827] dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            <Apple size={14} /> Mac
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('windows')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'windows' ? 'bg-white dark:bg-gray-700 shadow-sm text-[#111827] dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            <Monitor size={14} /> Windows
                                        </button>
                                    </div>

                                    {/* Editable Username Field */}
                                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                        <div className="w-8 h-8 bg-white dark:bg-gray-900 rounded-lg flex items-center justify-center shadow-sm">
                                            <User size={14} className="text-indigo-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-0.5">Your OS Username</p>
                                            <input 
                                                type="text" 
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                placeholder="e.g. rahuldara"
                                                className="w-full bg-transparent border-none p-0 text-xs font-black text-indigo-600 dark:text-indigo-400 focus:ring-0 placeholder:text-gray-300 dark:placeholder:text-gray-700"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Steps */}
                                <div className="space-y-5">
                                    <div className="flex items-start gap-4">
                                        <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0 mt-0.5">1</div>
                                        <div className="flex-1 space-y-3">
                                            <p className="text-xs font-black dark:text-gray-200">Download & Move Folder</p>
                                            <div className="flex flex-col gap-2">
                                                <a href="/downloads/vyapar_printer.zip" download className="flex items-center justify-center gap-2 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] font-black uppercase tracking-tight text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors w-full sm:w-auto self-start px-4">
                                                    <Download size={14}/> Download Source Code (.zip)
                                                </a>
                                                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Extract and move the folder to:</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-950 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 flex items-center justify-between group">
                                                <code className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 break-all">{current.folderPath}</code>
                                                <CopyButton text={current.folderPath} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0 mt-0.5">2</div>
                                        <div className="flex-1 space-y-2">
                                            <p className="text-xs font-black dark:text-gray-200">Navigate & Run</p>
                                            <div className="bg-gray-900 p-3 rounded-lg border border-gray-800 space-y-3">
                                                <div className="flex items-center justify-between group border-b border-gray-800 pb-2">
                                                    <code className="text-[10px] font-mono text-emerald-400 font-bold">{current.cdCommand}</code>
                                                    <CopyButton text={current.cdCommand} />
                                                </div>
                                                <div className="flex items-center justify-between group">
                                                    <code className="text-[10px] font-mono text-indigo-300 font-bold">npm install && npm start</code>
                                                    <CopyButton text="npm install && npm start" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-6 h-6 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-[10px] font-black text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">3</div>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-black dark:text-gray-200">Save for background (Auto-start)</p>
                                                <span className="text-[9px] font-black bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">PM2 READY</span>
                                            </div>
                                            <div className="bg-gray-900 p-3 rounded-lg border border-gray-800 flex items-start justify-between group">
                                                <code className="text-[10px] font-mono text-gray-300 whitespace-pre">npm install -g pm2{"\n"}pm2 start server.js --name vyapar_printer{"\n"}pm2 startup{"\n"}pm2 save</code>
                                                <CopyButton text={`npm install -g pm2\npm2 start server.js --name vyapar_printer\npm2 startup\npm2 save`} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* 🔹 LEVEL 3: ADVANCED / HARDCORE SETUP ⚙️ */}
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <Bug className="text-gray-400 group-hover:text-[#9B1B30] transition-colors" size={18} />
                                <div className="text-left">
                                    <h4 className="text-sm font-black dark:text-white uppercase tracking-tight">Advanced Setup (Developers)</h4>
                                    <p className="text-[10px] font-medium text-gray-400">Power users, debugging & custom infrastructure</p>
                                </div>
                            </div>
                            {showAdvanced ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                        </button>

                        {showAdvanced && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
                                <AdvancedStep 
                                    title="Raw Mode (No PM2)" 
                                    command="node server.js" 
                                    description="Monitor logs directly in terminal."
                                />
                                <AdvancedStep 
                                    title="Custom Port" 
                                    command="PORT=9100 node server.js" 
                                    description="Change the API listener port."
                                />
                                <AdvancedStep 
                                    title="View Logs" 
                                    command="pm2 logs vyapar_printer" 
                                    description="Debug failures in real-time."
                                />
                                <AdvancedStep 
                                    title="Control PM2" 
                                    command="pm2 restart vyapar_printer" 
                                    description="Stop, restart or delete service."
                                />
                                <AdvancedStep 
                                    title="Clean Install" 
                                    command="rm -rf node_modules && npm install" 
                                    description="Fix broken dependencies."
                                />
                                <AdvancedStep 
                                    title="Health Check" 
                                    command="curl http://localhost:9100/health" 
                                    description="Test if service is responding."
                                />
                                <AdvancedStep 
                                    title="Debug Mode" 
                                    command="DEBUG=printer:* node server.js" 
                                    description="See detailed printer driver logs."
                                />
                                <div className="p-3 rounded-lg bg-red-50/30 dark:bg-red-900/10 border border-red-100/30 dark:border-red-900/20 flex flex-col justify-center items-center text-center gap-2">
                                    <RefreshCw size={18} className="text-[#9B1B30] dark:text-red-400" />
                                    <p className="text-[10px] font-black uppercase text-[#9B1B30] dark:text-red-400">Restart System</p>
                                    <p className="text-[9px] font-medium text-red-600/80 dark:text-red-400/60">If port conflicts or drivers fail.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* NOTES SECTION */}
                    {showSetupSteps && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-3">
                            <div className="flex items-start gap-3">
                                <ShieldAlert size={16} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-[10px] font-black text-amber-900 dark:text-amber-200 uppercase">Security Note</h4>
                                    <p className="text-[10px] font-medium text-amber-800/80 dark:text-amber-400/60 mt-0.5 leading-relaxed">
                                        Right-click installer and choose "Open" or click "More Info" on warnings. External services are flagged by default.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                                <Activity size={16} className="text-blue-500 shrink-0" />
                                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400">
                                    Node.js Required: <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">Download Official Installer</a>
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center px-8">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-tight">vyapar_printer v2.6 • PRO MODAL</p>
                    <div className="flex gap-4">
                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-tight flex items-center gap-1">
                            <Activity size={10} /> {isConnected ? 'Service Connected' : 'Waiting for Service...'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
