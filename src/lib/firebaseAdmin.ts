import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Singleton Firebase Admin SDK instance.
 * Uses a service account key stored in environment variables (never in code).
 *
 * Required env vars (in .env.local, server-side only — NO NEXT_PUBLIC_ prefix):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */
function getAdminApp(): App {
    if (getApps().length > 0) return getApps()[0];

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (projectId && clientEmail && privateKey) {
        return initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
        });
    }

    if (credentialsPath) {
        return initializeApp({
            credential: cert(require(credentialsPath)),
        });
    }

    throw new Error(
        'Firebase Admin SDK credentials are not configured for local development.\n' +
        'Either set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local,\n' +
        'or set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file path.\n' +
        'See Firebase Console → Project Settings → Service Accounts → Generate new private key.'
    );
}

const adminApp = getAdminApp();

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
