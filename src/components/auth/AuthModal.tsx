'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ArrowRight, Loader2, User, Home, Hash, Phone, RotateCcw, ArrowLeft, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserByEmail, upsertUserProfileByEmail } from '@/lib/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { IIM_MUMBAI_HOSTELS } from '@/lib/hostels';
import Image from 'next/image';

const DOMAINS = ['@gmail.com', '@iimmumbai.ac.in', '@yahoo.com', '@outlook.com'];
type ModalStep = 'email' | 'otp' | 'profile';

export default function AuthModal() {
    const router = useRouter();
    const { isAuthModalOpen, closeAuthModal, setUserProfile, setPhoneNumber } = useAuth();

    const [step, setStep] = useState<ModalStep>('email');
    const [loading, setLoading] = useState(false);

    // Step 1 – email
    const [localPart, setLocalPart] = useState('');
    const [selectedDomain, setSelectedDomain] = useState('');
    const [customDomain, setCustomDomain] = useState('');
    const [showCustom, setShowCustom] = useState(false);
    const email = localPart.trim()
        ? `${localPart.trim()}${showCustom ? customDomain : selectedDomain}`
        : '';
    const emailValid = localPart.trim().length > 0 && (showCustom ? customDomain.includes('.') : !!selectedDomain);

    // Step 2 – OTP
    const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
    const [otpError, setOtpError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Step 3 – Profile
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [hostel, setHostel] = useState('');
    const [room, setRoom] = useState('');
    const profileValid = name.trim() !== '' && phone.length === 10 && hostel !== '' && room.trim() !== '';

    // Reset on close
    useEffect(() => {
        if (!isAuthModalOpen) {
            setStep('email');
            setLocalPart('');
            setSelectedDomain('');
            setCustomDomain('');
            setShowCustom(false);
            setOtp(Array(6).fill(''));
            setOtpError('');
            setResendCooldown(0);
            setName('');
            setPhone('');
            setHostel('');
            setRoom('');
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
                body: JSON.stringify({ email }),
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

    // ── OTP input handlers ───────────────────────────────────────────────────────
    const handleOtpChange = (index: number, value: string) => {
        const char = value.replace(/\D/g, '').slice(-1);
        const newOtp = [...otp];
        newOtp[index] = char;
        setOtp(newOtp);
        setOtpError('');
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
        setLoading(true);
        setOtpError('');
        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp: otpString }),
            });
            const data = await res.json();
            if (!res.ok) { setOtpError(data.error || 'Verification failed.'); return; }

            await signInWithCustomToken(auth, data.token);

            // Check if user already has a profile
            const existingUser = await getUserByEmail(email);
            if (existingUser && existingUser.name) {
                // Returning user — restore profile and proceed
                setUserProfile(existingUser);
                setPhoneNumber(existingUser.phone);
                toast.success(`Welcome back, ${existingUser.name}! 👋`);
                closeAuthModal();
                router.push('/checkout');
            } else {
                // New user — collect profile
                setStep('profile');
            }
        } catch {
            setOtpError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [otp, email, setUserProfile, setPhoneNumber, closeAuthModal, router]);

    // Auto-verify when 6 digits filled
    useEffect(() => {
        if (otp.every(d => d !== '') && step === 'otp') handleVerifyOtp(otp);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [otp, step]);

    // ── Step 3: Save profile ─────────────────────────────────────────────────────
    const handleProfileSave = async () => {
        if (!profileValid) return;
        setLoading(true);
        try {
            await upsertUserProfileByEmail(email, name.trim(), phone, hostel, room.trim());
            const profile = { phone: `+91${phone}`, name: name.trim(), lastHostel: hostel, lastRoom: room.trim(), totalOrders: 0, email };
            setUserProfile(profile);
            setPhoneNumber(`+91${phone}`);
            toast.success('Welcome to Aroma Dhaba! 🎉');
            closeAuthModal();
            router.push('/checkout');
        } catch {
            toast.error('Could not save profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

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
                {/* Close */}
                <button
                    onClick={closeAuthModal}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                >
                    <X size={20} />
                </button>

                {/* Logo + branding */}
                <div className="pt-8 pb-5 px-8 text-center border-b border-gray-100">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto mb-3 shadow-md ring-2 ring-gray-100">
                        <Image src="/favicon.png" alt="Aroma Dhaba" width={56} height={56} className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Aroma Dhaba</h2>
                    <p className="text-xs text-gray-400 mt-0.5">IIM Mumbai's favourite canteen</p>
                </div>

                <div className="px-8 py-6 space-y-5">

                    {/* ── STEP 1: EMAIL ── */}
                    {step === 'email' && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <p className="text-sm font-semibold text-gray-800">Sign in with your email</p>
                                <p className="text-xs text-gray-400 mt-0.5">Enter your roll no / name and pick your domain</p>
                            </div>

                            {/* Local part input */}
                            <div className="relative">
                                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    id="auth-email-local"
                                    type="text"
                                    value={localPart}
                                    onChange={e => setLocalPart(e.target.value.replace(/\s/g, '').replace(/@.*/g, ''))}
                                    onKeyDown={e => e.key === 'Enter' && emailValid && handleSendOtp()}
                                    placeholder="yourname / rollno"
                                    autoFocus
                                    autoComplete="off"
                                    className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition"
                                />
                            </div>

                            {/* Domain chips */}
                            {!showCustom && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Select domain</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {DOMAINS.slice(0, 2).map(domain => (
                                            <button
                                                key={domain}
                                                type="button"
                                                onClick={() => setSelectedDomain(domain)}
                                                className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all text-left truncate ${
                                                    selectedDomain === domain
                                                        ? 'border-red-400 bg-red-50 text-red-600'
                                                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                                                }`}
                                            >
                                                {domain}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {DOMAINS.slice(2).map(domain => (
                                            <button
                                                key={domain}
                                                type="button"
                                                onClick={() => setSelectedDomain(domain)}
                                                className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all text-left truncate ${
                                                    selectedDomain === domain
                                                        ? 'border-red-400 bg-red-50 text-red-600'
                                                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                                                }`}
                                            >
                                                {domain}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setShowCustom(true); setSelectedDomain(''); }}
                                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors w-full text-center pt-1"
                                    >
                                        Use a different email domain →
                                    </button>
                                </div>
                            )}

                            {/* Custom domain input */}
                            {showCustom && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">@</span>
                                        <input
                                            type="text"
                                            value={customDomain.replace('@', '')}
                                            onChange={e => setCustomDomain(`@${e.target.value.replace('@', '')}`)}
                                            placeholder="yourdomain.com"
                                            autoFocus
                                            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setShowCustom(false); setCustomDomain(''); setSelectedDomain(DOMAINS[0]); }}
                                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        ← Back to quick pick
                                    </button>
                                </div>
                            )}

                            {/* Preview */}
                            {emailValid && (
                                <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-center">
                                    <p className="text-xs text-gray-400">Sending OTP to</p>
                                    <p className="text-sm font-bold text-gray-800 truncate">{email}</p>
                                </div>
                            )}

                            <button
                                id="auth-continue-btn"
                                onClick={handleSendOtp}
                                disabled={!emailValid || loading}
                                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-200 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                {loading
                                    ? <Loader2 size={16} className="animate-spin" />
                                    : <><ArrowRight size={16} /> Send OTP</>
                                }
                            </button>
                        </div>
                    )}

                    {/* ── STEP 2: OTP ── */}
                    {step === 'otp' && (
                        <div className="space-y-5">
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
                                    <Mail size={24} />
                                </div>
                                <div>
                                    <p className="text-base font-bold text-gray-900">Please check your email</p>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        We&apos;ve sent a code to <span className="font-semibold text-gray-700">{maskedEmail}</span>
                                    </p>
                                </div>
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
                                        className={`w-10 h-11 text-center text-lg font-bold rounded-xl border-2 bg-gray-50 text-gray-900 transition-all outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 ${
                                            otp[i] ? 'border-red-300' : 'border-gray-200'
                                        }`}
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

                            <div className="flex flex-col items-center gap-2 text-sm">
                                <p className="text-gray-400">
                                    Didn&apos;t receive an email?{' '}
                                    {resendCooldown > 0 ? (
                                        <span className="font-semibold text-gray-400">Resend in {resendCooldown}s</span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleSendOtp}
                                            className="font-bold text-gray-700 hover:text-red-500 transition-colors inline-flex items-center gap-1"
                                        >
                                            <RotateCcw size={12} /> Resend
                                        </button>
                                    )}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => { setStep('email'); setOtp(Array(6).fill('')); setOtpError(''); }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 font-medium text-xs"
                                >
                                    <ArrowLeft size={12} /> Change email
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3: PROFILE ── */}
                    {step === 'profile' && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <p className="text-sm font-bold text-gray-800">One-time profile setup</p>
                                <p className="text-xs text-gray-400 mt-0.5">Just this once — we&apos;ll remember you!</p>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Your Name <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Full name"
                                        autoFocus
                                        className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition"
                                    />
                                </div>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Mobile Number <span className="text-red-500">*</span></label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-600 text-sm font-semibold">+91</span>
                                    <div className="relative flex-1">
                                        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="tel"
                                            maxLength={10}
                                            value={phone}
                                            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            placeholder="10-digit number"
                                            className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-r-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Hostel */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Hostel <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Home size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    <select
                                        value={hostel}
                                        onChange={e => setHostel(e.target.value)}
                                        className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition bg-white"
                                    >
                                        <option value="">Select your hostel</option>
                                        {IIM_MUMBAI_HOSTELS.map((h: string) => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▾</div>
                                </div>
                            </div>

                            {/* Room */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Room Number <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={room}
                                        onChange={e => setRoom(e.target.value)}
                                        placeholder="e.g. 102"
                                        className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition"
                                    />
                                </div>
                            </div>

                            <button
                                id="auth-profile-save-btn"
                                onClick={handleProfileSave}
                                disabled={!profileValid || loading}
                                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-200 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Proceed to Order →'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
