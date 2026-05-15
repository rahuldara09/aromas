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

    // 1. Manage Firebase Auth Session
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                // Restore session info from localStorage immediately
                const savedPhone = getSessionPhone();
                if (savedPhone) setPhoneNumber(savedPhone);

                let emailToUse = getUserEmail();
                if (!emailToUse && firebaseUser.email) {
                    emailToUse = firebaseUser.email;
                    saveUserEmail(emailToUse);
                }
                if (emailToUse) setSessionEmail(emailToUse);
            } else {
                // No active Firebase session — reset in-memory state
                setPhoneNumber(null);
                setSessionEmail(null);
                setUserProfile(null);
            }

            // Mark initial auth check as done, but loading might continue if we're fetching a profile
            if (!firebaseUser) setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Fetch User Profile whenever sessionEmail or User changes
    useEffect(() => {
        const fetchProfile = async () => {
            if (user && sessionEmail && !userProfile) {
                try {
                    const profile = await getUserByEmail(sessionEmail);
                    if (profile) {
                        setUserProfile(profile);
                        if (profile.phone) {
                            setPhoneNumber(profile.phone);
                            saveSessionPhone(profile.phone); // Keep localStorage in sync
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch user profile:', error);
                } finally {
                    setLoading(false);
                }
            } else if (user && !sessionEmail) {
                // If we have a user but no session email yet, we're likely still initializing
                // If it's an anonymous user, we can stop loading
                if (user.isAnonymous) setLoading(false);
            } else if (!user) {
                // No user — loading is handled by the auth effect
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user, sessionEmail, userProfile]);

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
