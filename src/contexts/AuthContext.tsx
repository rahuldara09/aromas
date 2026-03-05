'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { signOutUser, getSessionPhone, clearSessionPhone } from '@/lib/auth';
import { UserProfile } from '@/lib/firestore';

interface AuthContextType {
    user: User | null;
    /** Phone number attached to this anonymous session (stored in Firestore user doc, not localStorage) */
    phoneNumber: string | null;
    setPhoneNumber: (phone: string | null) => void;
    /** The fetched Firestore user profile, if any */
    userProfile: UserProfile | null;
    setUserProfile: (profile: UserProfile | null) => void;
    /** True until the first auth state check completes */
    loading: boolean;
    /** True ONLY when Firebase reports a real authenticated user — no localStorage fallback */
    isLoggedIn: boolean;
    signOut: () => Promise<void>;
    openAuthModal: () => void;
    closeAuthModal: () => void;
    isAuthModalOpen: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    phoneNumber: null,
    setPhoneNumber: () => { },
    userProfile: null,
    setUserProfile: () => { },
    loading: true,
    isLoggedIn: false,
    signOut: async () => { },
    openAuthModal: () => { },
    closeAuthModal: () => { },
    isAuthModalOpen: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);

            if (firebaseUser) {
                // Real Firebase session exists — restore phone from sessionStorage if available
                const savedPhone = getSessionPhone();
                if (savedPhone) setPhoneNumber(savedPhone);
                setIsAuthModalOpen(false);
            } else {
                // No Firebase session — clear all state
                setPhoneNumber(null);
                setUserProfile(null);
                clearSessionPhone();
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await signOutUser(); // also clears sessionStorage
        setUser(null);
        setPhoneNumber(null);
        setUserProfile(null);
    };

    // ── SECURITY: isLoggedIn depends ONLY on Firebase Auth, never localStorage ──
    const isLoggedIn = !!user;

    return (
        <AuthContext.Provider
            value={{
                user,
                phoneNumber,
                setPhoneNumber,
                userProfile,
                setUserProfile,
                loading,
                isLoggedIn,
                signOut: handleSignOut,
                openAuthModal: () => setIsAuthModalOpen(true),
                closeAuthModal: () => setIsAuthModalOpen(false),
                isAuthModalOpen,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
