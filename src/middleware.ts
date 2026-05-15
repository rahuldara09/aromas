import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware
 *
 * Two responsibilities:
 *
 * 1. ELECTRON MODE (ELECTRON_APP=1 env var set by next-server.ts spawn):
 *    This app is a vendor-only POS desktop app — customer pages must never render.
 *    Any route outside /vendor, /api, /_next is redirected to /vendor/orders
 *    at the server level, before a single byte of customer JS runs.
 *
 * 2. WEB MODE (normal Vercel/server deploy):
 *    Pass through to let vendor/layout.tsx handle auth enforcement.
 *    No route blocking — full site is accessible.
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ── Electron / desktop POS mode ──────────────────────────────────────────
    if (process.env.ELECTRON_APP === '1') {
        const isAllowed =
            pathname.startsWith('/vendor') ||
            pathname.startsWith('/api') ||
            pathname.startsWith('/_next') ||
            pathname === '/favicon.ico';

        if (!isAllowed) {
            // Server-level redirect — customer route never renders, no JS loaded
            const vendorUrl = request.nextUrl.clone();
            vendorUrl.pathname = '/vendor/orders';
            return NextResponse.redirect(vendorUrl);
        }

        return NextResponse.next();
    }

    // ── Web mode ──────────────────────────────────────────────────────────────
    // Vendor layout.tsx handles the actual auth check — pass through here.
    return NextResponse.next();
}

export const config = {
    // Run on all routes so the Electron redirect covers the full site.
    // _next/static, _next/image, and favicon are excluded for performance.
    matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
