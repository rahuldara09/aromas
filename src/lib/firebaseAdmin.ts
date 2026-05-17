import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Lazy Firebase Admin singleton.
 *
 * WHY NOT module-level initialisation:
 *   The previous code called getAdminApp() at module-evaluation time.  When a
 *   route file does `import { adminDb } from '@/lib/firebaseAdmin'` and this
 *   module throws during evaluation (missing / malformed credential env var),
 *   the entire route module fails to load.  Next.js then returns an HTML error
 *   page instead of a JSON response, so the client sees "Server error" with no
 *   actionable message.
 *
 * WHY Proxy:
 *   Callers use `adminDb.collection(...)` and `adminAuth.createCustomToken(...)`.
 *   We need to keep that API unchanged.  A Proxy intercepts every property
 *   access and triggers initialisation on first use — inside the request
 *   handler's try-catch — so a bad credential now returns a proper JSON 500
 *   instead of crashing the import.
 */

let _app: App | null = null;
let _initError: Error | null = null;
let _db:   ReturnType<typeof getFirestore> | null = null;
let _auth: ReturnType<typeof getAuth>      | null = null;

function getApp(): App {
  if (_app)       return _app;
  if (_initError) throw _initError;

  try {
    if (getApps().length > 0) {
      _app = getApps()[0];
      return _app;
    }

    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    // Private key may arrive as a single-line string with literal \n sequences
    // (from .env files) or as an actual multi-line PEM string — handle both.
    const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const credPath    = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (projectId && clientEmail && privateKey) {
      _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
      return _app;
    }

    if (credPath) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _app = initializeApp({ credential: cert(require(credPath)) });
      return _app;
    }

    throw new Error(
      'Firebase Admin SDK credentials are not configured for this environment.\n' +
      'Required env vars: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, ' +
      'FIREBASE_ADMIN_PRIVATE_KEY  (or set GOOGLE_APPLICATION_CREDENTIALS).',
    );
  } catch (err) {
    _initError = err as Error;
    throw _initError;
  }
}

// ── Getter functions ─────────────────────────────────────────────────────────
// Plain functions are the most reliable lazy-init pattern in Next.js App Router.
// A Proxy works at runtime but Next.js's production bundler can evaluate
// module-level Proxy construction in ways that cause module-load failures.
// Calling getAdminDb() / getAdminAuth() inside a route's try-catch guarantees
// that any credential error throws inside the handler (returns JSON 500)
// rather than at module-import time (returns HTML 500, bypasses try-catch).

export function getAdminDb():   ReturnType<typeof getFirestore> {
  return (_db   ??= getFirestore(getApp()));
}
export function getAdminAuth(): ReturnType<typeof getAuth> {
  return (_auth ??= getAuth(getApp()));
}

// Legacy Proxy-based exports — kept so the 20+ other route files that import
// `adminDb` / `adminAuth` continue to work without changes.
// The two auth routes (send-otp, verify-otp) now use getAdminDb/getAdminAuth
// directly for maximum reliability.
function _makeProxy<T extends object>(getInstance: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop: string | symbol) {
      const instance = getInstance();
      const val = Reflect.get(instance, prop, instance);
      return typeof val === 'function'
        ? (val as (...args: unknown[]) => unknown).bind(instance)
        : val;
    },
  });
}

export const adminDb   = _makeProxy(getAdminDb);
export const adminAuth = _makeProxy(getAdminAuth);
