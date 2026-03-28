'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, Loader2, Pencil, CheckCircle2, User, Home, Hash } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithPhone } from '@/lib/auth';
import { getUserByPhone, upsertUserProfile, UserProfile } from '@/lib/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { IIM_MUMBAI_HOSTELS } from '@/lib/hostels';

type ModalStep = 'phone' | 'confirm' | 'profile';

export default function AuthModal() {
    const router = useRouter();
    const { isAuthModalOpen, closeAuthModal, user, phoneNumber: ctxPhone, setUserProfile, setPhoneNumber } = useAuth();
    const [step, setStep] = useState<ModalStep>('phone');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');

    // Profile fields (for new users)
    const [name, setName] = useState('');
    const [hostel, setHostel] = useState('');
    const [room, setRoom] = useState('');
    const profileValid = name.trim() !== '' && hostel !== '' && room.trim() !== '';

    // Close on user login — require BOTH Firebase user AND phone number,
    // otherwise stale anonymous sessions auto-close the modal before the user can enter their number.
    useEffect(() => {
        if (user && ctxPhone && step !== 'profile') closeAuthModal();
    }, [user, ctxPhone, step, closeAuthModal]);

    // Reset on close
    useEffect(() => {
        if (!isAuthModalOpen) {
            setStep('phone');
            setPhone('');
            setName('');
            setHostel('');
            setRoom('');
            setLoading(false);
        }
    }, [isAuthModalOpen]);

    // ─── Step 1 → Step 2: just show confirm screen ──────────────────────────────
    const handleContinue = () => {
        if (!phone || phone.length < 10) {
            toast.error('Please enter a valid 10-digit mobile number');
            return;
        }
        setStep('confirm');
    };

    // ─── Step 2 → Sign in + Firestore lookup + redirect ─────────────────────────
    const handleConfirm = async () => {
        setLoading(true);
        setLoadingMsg('Signing in...');
        try {
            // 1. Create anonymous Firebase session (gives us a real UID)
            const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
            await signInWithPhone(formattedPhone);
            setPhoneNumber(formattedPhone); // Store phone in React state only — never localStorage

            // 2. Query Firestore for an existing user with this phone number
            setLoadingMsg('Checking account...');
            const existingUser = await getUserByPhone(phone);

            if (existingUser) {
                // ─ Case A: Existing user ─────────────────────────────────────
                setUserProfile(existingUser);
                setLoadingMsg('Welcome back!');
                toast.success(`Welcome back, ${existingUser.name}! 👋`);
                closeAuthModal();
                router.push('/checkout');
            } else {
                // ─ Case B: New user → profile setup form ─────────────────────
                setStep('profile');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(
                msg.includes('network') || msg.includes('offline')
                    ? 'Network error. Check your connection and try again.'
                    : 'Login failed. Please try again.'
            );
        } finally {
            setLoading(false);
            setLoadingMsg('');
        }
    };


    // ─── Step 3: save profile and redirect to checkout ──────────────────────────
    const handleProfileSave = async () => {
        if (!profileValid) return;
        setLoading(true);
        setLoadingMsg('Saving profile...');
        try {
            if (phone) {
                await upsertUserProfile(phone, name.trim(), hostel, room.trim(), true);
                setUserProfile({
                    phone: `+91${phone}`,
                    name: name.trim(),
                    lastHostel: hostel,
                    lastRoom: room.trim(),
                    totalOrders: 0,
                });
                setPhoneNumber(phone);
            }

            setLoadingMsg('Redirecting...');
            toast.success('Profile saved! 🎉');
            closeAuthModal();
            router.push('/checkout');
        } catch (err) {
            console.error('[Auth] handleProfileSave error:', err);
            toast.error('Could not save profile. Please try again.');
        } finally {
            setLoading(false);
            setLoadingMsg('');
        }
    };

    if (!isAuthModalOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeAuthModal}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 relative animate-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close */}
                <button
                    onClick={closeAuthModal}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Logo + title */}
                <div className="text-center mb-6">
                    <div className="w-14 h-14 rounded-xl overflow-hidden mx-auto mb-3 shadow-md">
                        <img
                            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=100&q=80"
                            alt="Aroma Dhaba"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Aroma Dhaba</h2>
                    <p className="text-sm text-gray-500 mt-1">IIM Mumbai's favorite canteen</p>
                </div>

                {/* ── STEP 1: Phone Input ── */}
                {step === 'phone' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-2">Phone Number</label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-600 text-sm font-semibold">
                                    +91
                                </span>
                                <input
                                    type="tel"
                                    maxLength={10}
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                                    placeholder="Enter your mobile number"
                                    className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleContinue}
                            disabled={phone.length < 10}
                            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
                        >
                            <ArrowRight size={18} />
                            Continue
                        </button>
                    </div>
                )}

                {/* ── STEP 2: Confirm Number ── */}
                {step === 'confirm' && (
                    <div className="space-y-5">
                        <div className="text-center bg-gray-50 rounded-2xl px-6 py-5">
                            <p className="text-sm text-gray-500 mb-1">Confirm your number</p>
                            <p className="text-2xl font-bold text-gray-900 tracking-wide">+91 {phone}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setStep('phone')}
                                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Pencil size={14} />
                                Edit Number
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={loading}
                                className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-semibold transition-colors"
                            >
                                {loading
                                    ? <Loader2 size={16} className="animate-spin" />
                                    : <CheckCircle2 size={16} />
                                }
                                {loading ? (loadingMsg || 'Please wait...') : 'Confirm & Proceed'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Profile Setup (new users only) ── */}
                {step === 'profile' && (
                    <div className="space-y-4">
                        <div className="text-center mb-1">
                            <p className="text-sm font-semibold text-gray-800">Quick profile setup</p>
                            <p className="text-xs text-gray-400 mt-0.5">Just this once — we'll remember you!</p>
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Full name"
                                    autoFocus
                                    className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition"
                                />
                            </div>
                        </div>

                        {/* Hostel Dropdown */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hostel <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Home size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                <select
                                    value={hostel}
                                    onChange={(e) => setHostel(e.target.value)}
                                    className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition bg-white"
                                >
                                    <option value="">Select your hostel</option>
                                    {IIM_MUMBAI_HOSTELS.map((h: string) => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▾</div>
                            </div>
                        </div>

                        {/* Room Number */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Room Number <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={room}
                                    onChange={(e) => setRoom(e.target.value.replace(/\D/g, ''))}
                                    placeholder="e.g. 102"
                                    className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleProfileSave}
                            disabled={!profileValid || loading}
                            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-200 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                            {loading ? 'Saving...' : 'Proceed to Order →'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
