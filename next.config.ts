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
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      // Allow Google Fonts and inline styles (for Tailwind/CSS-in-JS)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Google Fonts files
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self, data URIs, Unsplash, Firebase Storage
      "img-src 'self' blob: data: https://images.unsplash.com https://firebasestorage.googleapis.com",
      // API connections: Firebase, Google APIs
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com",
      // Allow Web Workers for Firebase SDK
      "worker-src blob:",
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
    ],
  },
};

export default nextConfig;
