'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { signOutUser, getSessionPhone, clearSessionPhone, getUserEmail, clearUserEmail, saveSessionPhone, saveUserEmail } from '@/lib/auth';
import { getUserByEmail, updateUserProfileUnified } from '@/lib/firestore';
import { UserProfile } from '@/types';

interface AuthContextType {
    user: User | null;
    /** Phone number linked to this session (from profile) */
    phoneNumber: string | null;
    setPhoneNumber: (phone: string | null) => void;
    /** Email for the current session */
    sessionEmail: string | null;
    setSessionEmail: (email: string | null) => void;
    /** The fetched Firestore user profile, if any */
    userProfile: UserProfile | null;
    setUserProfile: (profile: UserProfile | null) => void;
    /** True until the first auth state check completes */
    loading: boolean;
    /** True ONLY when Firebase reports a real authenticated user */
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
    sessionEmail: null,
    setSessionEmail: () => { },
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
    const [sessionEmail, setSessionEmail] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                // Try to restore phone (anonymous/vendor sessions)
                const savedPhone = getSessionPhone();
                if (savedPhone) setPhoneNumber(savedPhone);

                // Try to restore email-based session
                let emailToUse = getUserEmail();
                
                // Fallback: If localStorage email is missing but Firebase has it, use that
                if (!emailToUse && firebaseUser.email) {
                    emailToUse = firebaseUser.email;
                    saveUserEmail(emailToUse); // Sync back to localStorage for 60-day persistence
                }

                if (emailToUse) {
                    setSessionEmail(emailToUse);
                    // Load user profile by email (if not already loaded)
                    if (!userProfile) {
                        const profile = await getUserByEmail(emailToUse);
                        if (profile) {
                            setUserProfile(profile);
                            if (profile.phone) setPhoneNumber(profile.phone);
                            // Only auto-close modal if profile is already complete
                            setIsAuthModalOpen(false);
                        }
                        // If no profile found, leave modal open so profile step shows
                    }
                } else {
                    // Non-email sessions (e.g. anonymous) — close modal as before
                    setIsAuthModalOpen(false);
                }
            } else {
                // No Firebase session — clear in-memory state
                setPhoneNumber(null);
                setSessionEmail(null);
                setUserProfile(null);
                // Note: We don't clear localStorage/sessionStorage here,
                // as that should only happen on explicit sign out. 
                // This prevents Safari from wiping session data during its slow start.
            }

            setLoading(false);
        });
        return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSignOut = async () => {
        await signOutUser();
        setUser(null);
        setPhoneNumber(null);
        setSessionEmail(null);
        setUserProfile(null);
        clearUserEmail();
    };

    const isLoggedIn = !!user && !user.isAnonymous;

    return (
        <AuthContext.Provider
            value={{
                user,
                phoneNumber,
                setPhoneNumber,
                sessionEmail,
                setSessionEmail,
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
