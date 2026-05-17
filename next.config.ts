import type { NextConfig } from "next";
import path from "path";

// ─── Security Headers ───────────────────────────────────────────

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",

      // Scripts
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://sdk.cashfree.com https://apis.google.com https://www.googletagmanager.com https://va.vercel-scripts.com",

      // Styles
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

      // Fonts
      "font-src 'self' https://fonts.gstatic.com",

      // Images
      "img-src 'self' blob: data: https://127.0.0.1:9443 http://127.0.0.1:9100 https://localhost:9443 http://localhost:9100 https://images.unsplash.com https://firebasestorage.googleapis.com https://*.public.blob.vercel-storage.com https://*.r2.dev https://res.cloudinary.com https://*.cashfree.com https:",

      // API / sockets
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://*.upstash.io https://127.0.0.1:9443 http://127.0.0.1:9100 https://localhost:9443 http://localhost:9100 https://sdk.cashfree.com https://api.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com https://*.cashfree.com https://api.cloudinary.com",

      // Workers
      "worker-src blob:",

      // Frames
      "frame-src 'self' https://sdk.cashfree.com https://api.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com https://*.firebaseapp.com",
    ].join("; "),
  },
];

// ─── Next Config ────────────────────────────────────────────────

const nextConfig: NextConfig = {
  // Standalone build for Electron
  output: "standalone",

  // Allow Electron's 127.0.0.1 renderer to load /_next/* assets in dev mode
  allowedDevOrigins: ["http://127.0.0.1:3000", "http://127.0.0.1:3001"],

  // IMPORTANT FIX for Electron + standalone on Windows
  outputFileTracingRoot: path.join(__dirname),

  // better-sqlite3 has a native .node binary — it cannot be bundled.
  // All other packages (firebase-admin, @upstash/redis, resend) are handled
  // correctly by Turbopack's bundler and must NOT be listed here.
  // Listing them in serverExternalPackages causes Turbopack to generate
  // hashed module IDs (e.g. @upstash/redis-8c2350981ace2dff) that the
  // standalone server cannot resolve at runtime.
  serverExternalPackages: ["better-sqlite3"],

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/vendor-manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
    ];
  },

  // Keep console.error and console.warn in production so server errors
  // are visible in Electron logs. Remove only console.log/debug/info.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  // Remote image domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;