import { auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';

const PHONE_SESSION_KEY = 'aromas_vendor_phone';

/**
 * Saves the phone number to sessionStorage.
 * sessionStorage is cleared when the browser tab closes — safer than localStorage
 * because it cannot be accessed across tabs or after the browser session ends.
 */
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
 * Sign in anonymously via Firebase.
 * Phone number is saved to sessionStorage so it survives page refreshes
 * within the same browser session.
 */
export async function signInWithPhone(phoneNumber: string): Promise<void> {
    const formatted = phoneNumber.startsWith('+91')
        ? phoneNumber
        : `+91${phoneNumber}`;

    // Save to sessionStorage BEFORE signIn so the AuthContext onAuthStateChanged
    // callback can read it immediately when the Firebase session fires.
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
}
