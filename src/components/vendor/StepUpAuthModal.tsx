'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Store, Mail, ArrowLeft, RotateCcw } from 'lucide-react';

// Common email domain suggestions (shown as chips after @)
const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'iimb.ac.in'];

interface VendorLoginModalProps {
    onSuccess: (email: string) => void;
    onSignOut?: () => void;
}

export function VendorLoginModal({ onSuccess, onSignOut }: VendorLoginModalProps) {
    const [step, setStep] = useState<'email' | 'otp'>('email');

    // Step 1
    const [email, setEmail] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);

    // Step 2
    const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Compute domain suggestions as user types
    useEffect(() => {
        const atIndex = email.indexOf('@');
        if (atIndex === -1 && email.length > 0) {
            // No @ yet — show full suggestions
            setSuggestions(EMAIL_DOMAINS.map(d => `${email}@${d}`));
        } else if (atIndex !== -1) {
            const domainTyped = email.slice(atIndex + 1);
            const localPart = email.slice(0, atIndex);
            if (localPart.length > 0) {
                const filtered = EMAIL_DOMAINS
                    .filter(d => d.startsWith(domainTyped) && d !== domainTyped)
                    .map(d => `${localPart}@${d}`);
                setSuggestions(filtered);
            } else {
                setSuggestions([]);
            }
        } else {
            setSuggestions([]);
        }
    }, [email]);

    const startCooldown = useCallback(() => {
        setResendCooldown(30);
        cooldownRef.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(cooldownRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

    // Step 1 — Send OTP
    const handleSendOtp = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!email.trim() || !email.includes('@')) {
            setEmailError('Please enter a valid email address.');
            return;
        }
        setEmailLoading(true);
        setEmailError('');

        try {
            const res = await fetch('/api/vendor-auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json();

            if (!res.ok) {
                setEmailError(data.error || 'Failed to send OTP. Try again.');
                return;
            }

            setStep('otp');
            setOtp(Array(6).fill(''));
            setOtpError('');
            startCooldown();
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        } catch {
            setEmailError('Network error. Please try again.');
        } finally {
            setEmailLoading(false);
        }
    };

    // Step 2 — Handle OTP digit input
    const handleOtpChange = (index: number, value: string) => {
        const char = value.replace(/\D/g, '').slice(-1);
        const newOtp = [...otp];
        newOtp[index] = char;
        setOtp(newOtp);
        setOtpError('');
        if (char && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            if (otp[index] === '' && index > 0) {
                inputRefs.current[index - 1]?.focus();
            } else {
                const newOtp = [...otp];
                newOtp[index] = '';
                setOtp(newOtp);
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length > 0) {
            e.preventDefault();
            const newOtp = Array(6).fill('');
            pasted.split('').forEach((c, i) => { newOtp[i] = c; });
            setOtp(newOtp);
            const nextEmpty = Math.min(pasted.length, 5);
            inputRefs.current[nextEmpty]?.focus();
        }
    };

    // Step 2 — Verify OTP
    const handleVerifyOtp = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const otpString = otp.join('');
        if (otpString.length < 6) {
            setOtpError('Please enter all 6 digits.');
            return;
        }
        setOtpLoading(true);
        setOtpError('');

        try {
            const res = await fetch('/api/vendor-auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otpString }),
            });
            const data = await res.json();

            if (!res.ok) {
                setOtpError(data.error || 'Verification failed. Please try again.');
                if (data.error?.includes('expired')) {
                    // Reset to allow resend
                }
                return;
            }

            // Sign in with the Firebase custom token
            await signInWithCustomToken(auth, data.token);
            // Store vendor email in sessionStorage for layout persistence
            sessionStorage.setItem('isVendorVerified', 'true');
            sessionStorage.setItem('vendorEmail', data.email);
            onSuccess(data.email);
        } catch {
            setOtpError('Network error. Please try again.');
        } finally {
            setOtpLoading(false);
        }
    };

    // Auto-verify when all 6 digits are filled
    useEffect(() => {
        if (otp.every(d => d !== '') && step === 'otp') {
            handleVerifyOtp();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [otp, step]);

    const maskedEmail = email
        ? email.replace(/(.{2})(.*)(@.*)/, (_, a, _b, c) => `${a}***${c}`)
        : '';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-md px-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full space-y-6 transition-all">

                {/* ─── STEP 1: EMAIL INPUT ─── */}
                {step === 'email' && (
                    <>
                        {/* Header */}
                        <div className="flex flex-col items-center text-center space-y-3">
                            <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shadow-inner">
                                <Store size={28} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Vendor Access</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Enter your registered email to continue.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSendOtp} className="space-y-4">
                            {emailError && (
                                <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-500/20 text-center font-medium animate-in fade-in slide-in-from-top-2">
                                    {emailError}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider pl-1">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        id="vendor-email-input"
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="you@gmail.com"
                                        required
                                        autoFocus
                                        autoComplete="email"
                                        className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/30 placeholder:text-gray-400 text-gray-900 dark:text-white transition-all"
                                    />
                                </div>

                                {/* Domain suggestion chips */}
                                {suggestions.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {suggestions.slice(0, 4).map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => { setEmail(s); setSuggestions([]); }}
                                                className="text-xs px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700 transition-colors font-medium truncate max-w-[160px]"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 flex flex-col gap-3">
                                <button
                                    id="vendor-send-otp-btn"
                                    type="submit"
                                    disabled={emailLoading}
                                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-2xl text-sm transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-red-500/30 hover:shadow-red-500/50"
                                >
                                    {emailLoading ? (
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        'Send OTP'
                                    )}
                                </button>

                                {onSignOut && (
                                    <button
                                        type="button"
                                        onClick={onSignOut}
                                        className="w-full text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-2 transition-colors"
                                    >
                                        Sign Out
                                    </button>
                                )}
                            </div>
                        </form>
                    </>
                )}

                {/* ─── STEP 2: OTP VERIFICATION ─── */}
                {step === 'otp' && (
                    <>
                        {/* Header */}
                        <div className="flex flex-col items-center text-center space-y-3">
                            <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shadow-inner">
                                <Mail size={28} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Please check your email</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    We&apos;ve sent a code to <span className="font-semibold text-gray-700 dark:text-gray-200">{maskedEmail}</span>
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            {otpError && (
                                <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-500/20 text-center font-medium animate-in fade-in slide-in-from-top-2">
                                    {otpError}
                                </div>
                            )}

                            {/* 6-Box OTP Input */}
                            <div className="flex items-center justify-center gap-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <input
                                        key={i}
                                        ref={el => { inputRefs.current[i] = el; }}
                                        id={`vendor-otp-${i}`}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={otp[i]}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        onPaste={i === 0 ? handleOtpPaste : undefined}
                                        className={`w-11 h-12 text-center text-xl font-bold rounded-xl border-2 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-all outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/30
                                            ${otp[i] ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-gray-700'}
                                        `}
                                    />
                                ))}
                            </div>

                            <button
                                id="vendor-verify-otp-btn"
                                type="submit"
                                disabled={otpLoading || otp.join('').length < 6}
                                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 font-bold py-3.5 rounded-2xl text-sm transition-all flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed enabled:bg-red-500 enabled:text-white enabled:shadow-lg enabled:shadow-red-500/30 enabled:hover:bg-red-600 enabled:hover:shadow-red-500/50"
                            >
                                {otpLoading ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    'Verify'
                                )}
                            </button>
                        </form>

                        {/* Footer actions */}
                        <div className="flex flex-col items-center gap-3 pt-1">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Didn&apos;t receive an email?{' '}
                                {resendCooldown > 0 ? (
                                    <span className="font-semibold text-gray-400">Resend in {resendCooldown}s</span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleSendOtp()}
                                        className="font-bold text-gray-800 dark:text-white hover:text-red-500 transition-colors inline-flex items-center gap-1"
                                    >
                                        <RotateCcw size={12} />
                                        Resend
                                    </button>
                                )}
                            </p>
                            <button
                                type="button"
                                onClick={() => { setStep('email'); setOtp(Array(6).fill('')); setOtpError(''); }}
                                className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center gap-1.5 font-medium"
                            >
                                <ArrowLeft size={13} />
                                Change email
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
