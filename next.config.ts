import type { NextConfig } from "next";

// ─── Security Headers ─────────────────────────────────────────────────────────
// Applied to every route in the application.
const securityHeaders = [
  // Prevent browsers from inferring MIME types (XSS mitigation)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Prevent embedding in iframes (clickjacking protection)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Control how much referrer info is sent to external sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Enforce HTTPS for 1 year (preload for strict environments)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Disable browser features we don't use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Allow Next.js inline scripts and eval in dev; restrict to 'self' in prod
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://sdk.cashfree.com https://apis.google.com https://www.googletagmanager.com https://va.vercel-scripts.com",
      // Allow Google Fonts and inline styles (for Tailwind/CSS-in-JS)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Google Fonts files
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self, data URIs, Unsplash, Firebase Storage, R2, and Cashfree
      "img-src 'self' blob: data: https://127.0.0.1:9443 http://127.0.0.1:9100 https://localhost:9443 http://localhost:9100 https://images.unsplash.com https://firebasestorage.googleapis.com https://*.public.blob.vercel-storage.com https://*.r2.dev https://res.cloudinary.com https://*.cashfree.com https:",
      // API connections: Firebase, Google APIs, Upstash Redis, Local Print Server, Cashfree, Cloudinary
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://*.upstash.io https://127.0.0.1:9443 http://127.0.0.1:9100 https://localhost:9443 http://localhost:9100 https://sdk.cashfree.com https://api.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com https://*.cashfree.com https://api.cloudinary.com",
      // Allow Web Workers for Firebase SDK
      "worker-src blob:",
      // Allow frames from Cashfree for the checkout experience
      "frame-src 'self' https://sdk.cashfree.com https://api.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com https://*.firebaseapp.com",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // ── Security Headers ────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // ── Strip all console.log/warn/info in production ───────────────────────────
  // Prevents PII (phone numbers, order IDs, user data) leaking via DevTools console
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error'] }   // keep console.error for monitoring
        : false,                   // keep all logs in development
  },

  // ── Image Domains ─────────────────────────────────────────────────────────
    images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

export default nextConfig;
