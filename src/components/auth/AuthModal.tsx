'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ArrowRight, Loader2, User, Home, Hash, Phone, RotateCcw, Mail, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserByEmail, upsertUserProfileByEmail } from '@/lib/firestore';
import { saveUserEmail, signInWithEmailToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { IIM_MUMBAI_HOSTELS } from '@/lib/hostels';
import Image from 'next/image';

const EMAIL_DOMAINS = ['gmail.com', 'iimmumbai.ac.in', 'iitb.ac.in', 'yahoo.com', 'outlook.com'];

type ModalStep = 'email' | 'otp' | 'profile';

export default function AuthModal() {
    const router = useRouter();
    const { isAuthModalOpen, closeAuthModal, setUserProfile, setPhoneNumber, setSessionEmail, user, isLoggedIn, sessionEmail, userProfile } = useAuth();

    const [step, setStep] = useState<ModalStep>('email');
    const [loading, setLoading] = useState(false);

    // Ensure modal starts at email step and closes if already fully logged in
    useEffect(() => {
        if (isAuthModalOpen && isLoggedIn && userProfile?.phone) {
            closeAuthModal();
        }
    }, [isAuthModalOpen, isLoggedIn, userProfile, closeAuthModal]);

    // Step 1 – email (single field, smart suggestions)
    const [email, setEmail] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);

    // Compute suggestions as user types (same logic as vendor modal)
    useEffect(() => {
        const atIndex = email.indexOf('@');
        if (atIndex === -1 && email.length > 0) {
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

    const emailValid = email.includes('@') && email.split('@')[0].length > 0 && email.split('@')[1]?.length > 1;

    // Step 2 – OTP
    const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
    const [otpError, setOtpError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Reset on close
    useEffect(() => {
        if (!isAuthModalOpen) {
            setStep('email');
            setEmail('');
            setSuggestions([]);
            setOtp(Array(6).fill(''));
            setOtpError('');
            setResendCooldown(0);
            setLoading(false);
        }
    }, [isAuthModalOpen]);

    const startCooldown = useCallback(() => {
        setResendCooldown(30);
        cooldownRef.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
                return prev - 1;
            });
        }, 1000);
    }, []);
    useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

    // ── Step 1: Send OTP ─────────────────────────────────────────────────────────
    const handleSendOtp = async () => {
        if (!emailValid) return;
        setLoading(true);
        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || 'Failed to send OTP.'); return; }
            setStep('otp');
            setOtp(Array(6).fill(''));
            setOtpError('');
            startCooldown();
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── OTP handlers ────────────────────────────────────────────────────────────
    const handleOtpChange = (index: number, value: string) => {
        const char = value.replace(/\D/g, '').slice(-1);
        const newOtp = [...otp]; newOtp[index] = char; setOtp(newOtp); setOtpError('');
        if (char && index < 5) inputRefs.current[index + 1]?.focus();
    };
    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            if (otp[index] === '' && index > 0) inputRefs.current[index - 1]?.focus();
            else { const n = [...otp]; n[index] = ''; setOtp(n); }
        } else if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
        else if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
    };
    const handleOtpPaste = (e: React.ClipboardEvent) => {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length > 0) {
            e.preventDefault();
            const newOtp = Array(6).fill('');
            pasted.split('').forEach((c, i) => { newOtp[i] = c; });
            setOtp(newOtp);
            inputRefs.current[Math.min(pasted.length, 5)]?.focus();
        }
    };

    // ── Step 2: Verify OTP ───────────────────────────────────────────────────────
    const handleVerifyOtp = useCallback(async (otpVal?: string[]) => {
        const otpString = (otpVal ?? otp).join('');
        if (otpString.length < 6) { setOtpError('Please enter all 6 digits.'); return; }
        setLoading(true); setOtpError('');
        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otpString }),
            });
            const data = await res.json();
            if (!res.ok) { setOtpError(data.error || 'Verification failed.'); return; }

            // Persist email and sign in with LOCAL persistence (60-day session)
            saveUserEmail(email.trim().toLowerCase());
            setSessionEmail(email.trim().toLowerCase());
            await signInWithEmailToken(data.token);
            const existingUser = await getUserByEmail(email.trim().toLowerCase());
            if (existingUser && existingUser.name) {
                setUserProfile(existingUser);
                setPhoneNumber(existingUser.phone);
                toast.success(`Welcome back, ${existingUser.name}! 👋`);
                closeAuthModal();
                router.push('/checkout');
            } else {
                toast.success('Login successful! Let\'s complete your profile. ✨');
                closeAuthModal();
                router.push('/account');
            }
        } catch {
            setOtpError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [otp, email, setUserProfile, setPhoneNumber, closeAuthModal, router]);

    useEffect(() => {
        if (otp.every(d => d !== '') && step === 'otp') handleVerifyOtp(otp);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [otp, step]);

    const maskedEmail = email
        ? email.replace(/(.{2})(.*)(@.*)/, (_, a, _b, c) => `${a}***${c}`)
        : '';

    if (!isAuthModalOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeAuthModal}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <button onClick={closeAuthModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10">
                    <X size={20} />
                </button>

                {/* Branding */}
                <div className="pt-8 pb-5 px-8 text-center border-b border-gray-100">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto mb-3 shadow-md ring-2 ring-gray-100">
                        <Image src="/favicon.png" alt="Aroma Dhaba" width={56} height={56} className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Aroma Dhaba</h2>
                    <p className="text-xs text-gray-400 mt-0.5">IIM Mumbai's favourite canteen</p>
                </div>

                <div className="px-8 py-6 space-y-4">

                    {/* ── STEP 1: EMAIL ── */}
                    {step === 'email' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
                                <div className="relative">
                                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        id="auth-email-input"
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && emailValid && handleSendOtp()}
                                        placeholder="you@gmail.com"
                                        autoFocus
                                        autoComplete="email"
                                        className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition"
                                    />
                                </div>

                                {/* Smart suggestions — appear as the user types */}
                                {suggestions.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {suggestions.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => { setEmail(s); setSuggestions([]); }}
                                                className="text-xs px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-200 transition-colors font-medium truncate max-w-[180px]"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                id="auth-send-otp-btn"
                                onClick={handleSendOtp}
                                disabled={!emailValid || loading}
                                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-200 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20"
                            >
                                {loading
                                    ? <Loader2 size={16} className="animate-spin" />
                                    : <><ArrowRight size={16} /> Continue</>
                                }
                            </button>
                        </div>
                    )}

                    {/* ── STEP 2: OTP ── */}
                    {step === 'otp' && (
                        <div className="space-y-4">
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
                                    <Mail size={24} />
                                </div>
                                <div>
                                    <p className="text-base font-bold text-gray-900">Please check your email</p>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        We&apos;ve sent a code to{' '}
                                        <span className="font-semibold text-gray-700">{maskedEmail}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Always-visible email edit bar */}
                            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                                <span className="text-xs text-gray-500 truncate flex-1 font-medium">{email}</span>
                                <button
                                    type="button"
                                    onClick={() => { setStep('email'); setOtp(Array(6).fill('')); setOtpError(''); }}
                                    className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 transition-colors ml-2 shrink-0"
                                >
                                    <Pencil size={11} /> Edit
                                </button>
                            </div>

                            {otpError && (
                                <div className="px-4 py-2.5 bg-red-50 text-red-600 text-sm rounded-xl text-center font-medium border border-red-100">
                                    {otpError}
                                </div>
                            )}

                            {/* 6-box OTP */}
                            <div className="flex items-center justify-center gap-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <input
                                        key={i}
                                        ref={el => { inputRefs.current[i] = el; }}
                                        id={`otp-box-${i}`}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={otp[i]}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        onPaste={i === 0 ? handleOtpPaste : undefined}
                                        className={`w-10 h-11 text-center text-lg font-bold rounded-xl border-2 bg-gray-50 text-gray-900 transition-all outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 ${otp[i] ? 'border-red-300' : 'border-gray-200'}`}
                                    />
                                ))}
                            </div>

                            <button
                                id="auth-verify-btn"
                                onClick={() => handleVerifyOtp()}
                                disabled={loading || otp.join('').length < 6}
                                className="w-full bg-gray-100 text-gray-400 font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed enabled:bg-red-500 enabled:text-white enabled:shadow-lg enabled:shadow-red-500/20 enabled:hover:bg-red-600"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Verify'}
                            </button>

                            <p className="text-center text-sm text-gray-400">
                                Didn&apos;t receive it?{' '}
                                {resendCooldown > 0 ? (
                                    <span className="font-semibold text-gray-400">Resend in {resendCooldown}s</span>
                                ) : (
                                    <button type="button" onClick={handleSendOtp}
                                        className="font-bold text-gray-700 hover:text-red-500 transition-colors inline-flex items-center gap-1">
                                        <RotateCcw size={11} /> Resend
                                    </button>
                                )}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
