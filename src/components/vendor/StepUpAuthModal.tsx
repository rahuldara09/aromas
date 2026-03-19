import React, { useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Store } from 'lucide-react';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Use a secondary app instance to preserve the main session
const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuth(secondaryApp);

interface StepUpAuthModalProps {
    onSuccess: () => void;
    onSignOut: () => void;
    initialPhone?: string;
}

export function StepUpAuthModal({ onSuccess, onSignOut, initialPhone = '' }: StepUpAuthModalProps) {
    const [phone, setPhone] = useState(initialPhone.replace('+91', ''));
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const pseudoEmail = `${phone}@super.aromadhaba.com`;
            await signInWithEmailAndPassword(secondaryAuth, pseudoEmail, password);
            
            const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
            const vendorSnap = await getDoc(doc(db, 'vendors', formattedPhone));
            
            if (vendorSnap.exists() && vendorSnap.data().isVendor === true) {
                sessionStorage.setItem('isVendorVerified', 'true');
                onSuccess();
            } else {
                setError('You are not registered as a vendor');
                await secondaryAuth.signOut();
            }
        } catch {
            setError('Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-md px-4">
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full space-y-6">
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shadow-inner">
                        <Store size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Vendor Access Required</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Please verify your credentials to continue.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                    {error && (
                        <div className="px-4 py-3 bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-500/20 text-center font-medium shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}
                    
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider pl-1">
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Current phone number"
                            required
                            className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/30 placeholder:text-gray-400 text-gray-900 dark:text-white transition-all text-center tracking-wider"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider pl-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/30 placeholder:text-gray-400 text-gray-900 dark:text-white transition-all text-center tracking-[0.3em] font-medium"
                        />
                    </div>

                    <div className="pt-2 flex flex-col gap-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-2xl text-sm transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-red-500/30 hover:shadow-red-500/50"
                        >
                            {loading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Verify & Continue'
                            )}
                        </button>
                        
                        <button
                            type="button"
                            onClick={onSignOut}
                            className="w-full text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-2 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
