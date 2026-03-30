import { auth } from './firebase';
import { signInAnonymously, setPersistence, browserLocalPersistence } from 'firebase/auth';

const PHONE_SESSION_KEY = 'aromas_vendor_phone';
const EMAIL_SESSION_KEY = 'aromas_user_email';
const EMAIL_EXPIRY_KEY = 'aromas_user_email_expiry';

const SESSION_DURATION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

export function saveSessionPhone(phone: string): void {
    if (typeof window === 'undefined') return;
    const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
    sessionStorage.setItem(PHONE_SESSION_KEY, formatted);
}
export function getSessionPhone(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(PHONE_SESSION_KEY);
}
export function clearSessionPhone(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(PHONE_SESSION_KEY);
}

/**
 * Persist the user's email for 60 days.
 * Saves both the email and an expiry timestamp to localStorage.
 */
export function saveUserEmail(email: string): void {
    if (typeof window === 'undefined') return;
    const expiry = Date.now() + SESSION_DURATION_MS;
    localStorage.setItem(EMAIL_SESSION_KEY, email.toLowerCase().trim());
    localStorage.setItem(EMAIL_EXPIRY_KEY, String(expiry));
}

/**
 * Get the stored email. Returns null if expired or not set.
 * Auto-clears on expiry.
 */
export function getUserEmail(): string | null {
    if (typeof window === 'undefined') return null;
    const email = localStorage.getItem(EMAIL_SESSION_KEY);
    const expiry = localStorage.getItem(EMAIL_EXPIRY_KEY);
    if (!email) return null;
    // Backwards compat: if no expiry key, treat as valid (old sessions)
    if (expiry && Date.now() > Number(expiry)) {
        clearUserEmail();
        return null;
    }
    return email;
}

export function clearUserEmail(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(EMAIL_SESSION_KEY);
    localStorage.removeItem(EMAIL_EXPIRY_KEY);
}

/**
 * Set Firebase Auth to LOCAL persistence (survives browser restart),
 * then sign in with a custom token. Ensures the Firebase session
 * also lasts as long as possible on this device.
 */
export async function signInWithEmailToken(customToken: string): Promise<void> {
    await setPersistence(auth, browserLocalPersistence);
    const { signInWithCustomToken } = await import('firebase/auth');
    await signInWithCustomToken(auth, customToken);
}

/**
 * Sign in anonymously via Firebase (for vendor/phone sessions).
 */
export async function signInWithPhone(phoneNumber: string): Promise<void> {
    const formatted = phoneNumber.startsWith('+91')
        ? phoneNumber
        : `+91${phoneNumber}`;

    saveSessionPhone(formatted);

    try {
        await signInAnonymously(auth);
    } catch (err: unknown) {
        const code = (err as { code?: string }).code ?? '';
        if (code === 'auth/configuration-not-found') {
            throw new Error(
                'Firebase Anonymous Auth is not enabled. ' +
                'Go to Firebase Console → Authentication → Sign-in method → Enable Anonymous.'
            );
        } else if (code === 'auth/network-request-failed') {
            throw new Error('Network error during sign-in. Please check your connection and try again.');
        } else {
            throw err;
        }
    }
}

export async function signOutUser(): Promise<void> {
    try {
        const { signOut } = await import('firebase/auth');
        await signOut(auth);
    } catch {
        // Ignore sign-out errors
    }
    clearSessionPhone();
    clearUserEmail();
}
