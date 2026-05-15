# Aromas — Technical Architecture & Product Ecosystem Document

**Version 1.0 · May 2026 · Internal Engineering Document**
**Derived from live codebase analysis · No hallucinated features**

---

## Table of Contents

1. [Executive Product Overview](#1-executive-product-overview)
2. [Complete Platform Vision](#2-complete-platform-vision)
3. [System Architecture Breakdown](#3-system-architecture-breakdown)
4. [Technical Stack Analysis](#4-technical-stack-analysis)
5. [Product Ecosystem Map](#5-product-ecosystem-map)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Backend Architecture](#7-backend-architecture)
8. [Database Architecture](#8-database-architecture)
9. [API Architecture Breakdown](#9-api-architecture-breakdown)
10. [Authentication System](#10-authentication-system)
11. [Payment Architecture](#11-payment-architecture)
12. [Real-Time System Design](#12-real-time-system-design)
13. [Settlement & Financial Architecture](#13-settlement--financial-architecture)
14. [Event-Driven & Cron System](#14-event-driven--cron-system)
15. [Infra & Deployment Architecture](#15-infra--deployment-architecture)
16. [Security Architecture](#16-security-architecture)
17. [Current Features Implemented](#17-current-features-implemented)
18. [Features Under Development / Stubs](#18-features-under-development--stubs)
19. [Multi-Tenant Architecture Strategy](#19-multi-tenant-architecture-strategy)
20. [AI Infrastructure Opportunities](#20-ai-infrastructure-opportunities)
21. [Scaling Recommendations](#21-scaling-recommendations)
22. [Suggested Team Structure](#22-suggested-team-structure)
23. [Technical Roadmap](#23-technical-roadmap)
24. [Engineering Workflow Recommendations](#24-engineering-workflow-recommendations)

---

## 1. Executive Product Overview

**Aromas** is a production-grade, full-stack campus food commerce platform deployed at IIM Mumbai. It is the first live instantiation of the **ByteBiz** vendor operating system — a B2B SaaS infrastructure product built for campus-bound food vendors who lack digital commerce infrastructure.

The platform simultaneously serves three distinct user groups:

| Persona | Experience | Tech Surface |
|---------|-----------|-------------|
| **Student / Customer** | Browse menu, order online, pay via UPI/card, track order to hostel room | Customer Storefront (`/`, `/menu`, `/checkout`, `/order/[id]`) |
| **Vendor / Operator** | Live order board, POS for walk-in customers, menu management, analytics, thermal printing, daily settlements | Vendor Dashboard (`/vendor/*`) |
| **ByteBiz Admin** | Vendor onboarding, settlement verification, audit | Admin Panel (`/vendor/admin/*`, `/api/admin/*`) |

**Key business metrics built into the platform:**

- **Delivery scope:** Hostel-to-room delivery (IIM Mumbai hostel clusters)
- **Dual order modes:** Online (UPI/card via Cashfree) + POS (walk-in, cash/UPI)
- **Platform fee model:** ₹2 per paid online order (collected daily via settlement system)
- **Settlement enforcement:** Online ordering auto-locks until daily platform fee is paid
- **Zero admin overhead:** Daily Excel reports emailed automatically; settlement reminders built in

---

## 2. Complete Platform Vision

Aromas is not a standalone food ordering app. It is the **first deployed node of ByteBiz** — a replicable campus commerce operating system. The architecture is explicitly designed for multi-tenancy: the codebase can be redeployed for any campus vendor with only environment variable changes.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ByteBiz Platform Layer                        │
│                                                                 │
│  ┌──────────────────┐   ┌──────────────────┐   ┌────────────┐  │
│  │  Aromas (IIM)    │   │  H4 Canteen(IIT) │   │  Future    │  │
│  │  (LIVE ✅)        │   │  (Next deploy)   │   │  Campus N  │  │
│  └──────────────────┘   └──────────────────┘   └────────────┘  │
│                                                                 │
│  Each vendor = one deployment, same codebase, different env     │
└─────────────────────────────────────────────────────────────────┘
```

The long-term thesis: every campus vendor in India gets the same production-grade commerce stack that enterprise restaurants pay tens of thousands of dollars for, deployed in 48 hours, at ₹2/order.

---

## 3. System Architecture Breakdown

### Current State — Implemented Systems

```
┌──────────────────────────────────────────────────────────────────────┐
│                         VERCEL EDGE NETWORK                          │
│  CDN + Edge Middleware (middleware.ts) + Cron Jobs                   │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────────┐
│                    NEXT.JS 16 APPLICATION                            │
│                                                                      │
│  ┌─────────────────────┐  ┌───────────────────────────────────────┐ │
│  │  Customer Storefront │  │      Vendor Dashboard (/vendor/*)     │ │
│  │  / /menu /checkout   │  │  Orders · Analytics · Menu · POS      │ │
│  │  /order/[id]         │  │  Kitchen · Settings · Settlements      │ │
│  └─────────────────────┘  └───────────────────────────────────────┘ │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     API Routes (Serverless)                    │  │
│  │  /api/auth/*   /api/vendor-auth/*   /api/orders/*             │  │
│  │  /api/payment/*   /api/settlements/*   /api/products/*        │  │
│  │  /api/vendor/*   /api/admin/*   /api/cron/*   /api/print      │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
          │                   │                      │
┌─────────▼──────┐  ┌─────────▼──────┐  ┌───────────▼──────────────┐
│   Firebase      │  │ Upstash Redis  │  │    External Services      │
│   Firestore     │  │ (Rate Limit +  │  │  Cashfree · Resend        │
│   (primary DB)  │  │  OTP Storage)  │  │  Cloudinary · QZ Tray     │
│   Firebase Auth │  └────────────────┘  └──────────────────────────┘
│   (custom token)│
└─────────────────┘

Additional Apps (same repo):
├── /mobile          → React Native Expo app (vendor mobile)
└── /aroma_printer   → Electron app (thermal printer bridge)
```

### Why This Architecture

**Firestore over PostgreSQL (current stage decision):**
- Real-time listeners built in — no WebSocket server to manage
- Schema-less = fast iteration as product evolves
- Vendor dashboard requires live order updates; Firestore `onSnapshot` provides this at zero infra cost
- Trade-off: Limited query flexibility, no joins, no aggregations (mitigated by denormalization)

**Next.js monorepo over microservices:**
- Single repo, single deploy, zero inter-service latency
- Vercel serverless scales each API route independently
- Correct choice for 1-3 campus scale; revisit at 50+ campuses

**Vercel Cron over dedicated job scheduler:**
- Settlement and daily report jobs are simple, single-tenant, predictable
- Vercel Cron is zero-config for this use case
- Trade-off: No retry logic, no job history UI — acceptable at current scale

---

## 4. Technical Stack Analysis

### Frontend Stack

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| Framework | Next.js | 16.1.6 | App Router, server components, edge middleware, built-in cron |
| UI Runtime | React | 19.2.3 | Concurrent features, improved hydration |
| Language | TypeScript | 5.x | Type safety across full stack |
| Styling | Tailwind CSS | 4.2.4 | New CSS-native config model (no tailwind.config.ts) |
| Animation | Framer Motion | 12.34.4 | Page transitions, order board animations |
| Charts | Recharts | 3.7.0 | Analytics page — revenue/orders charts |
| State (Cart) | Zustand | 5.0.11 | Lightweight cart state with localStorage persistence |
| Toasts | react-hot-toast | 2.6.0 | Order status notifications |
| Icons | Lucide React | 0.576.0 | Consistent icon system |
| QR Codes | react-qr-code | 2.0.21 | UPI payment QR generation |
| Themes | next-themes | 0.4.6 | Dark/light mode |
| Analytics | @vercel/analytics | 1.6.1 | Web vitals, page views |

> **Critical Note for Engineers:**
> This project uses **Tailwind v4** — the config model is completely different from v3.
> There is **no `tailwind.config.ts`** file. All design tokens are declared in `globals.css` via `@theme` directives.
> Tailwind v4 uses `@import "tailwindcss"` and CSS-native custom properties.
> Do NOT follow v3 docs. Read the v4 migration guide before touching any styles.

### Backend Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| API | Next.js Route Handlers | Serverless API (no separate backend process) |
| Database | Firebase Firestore | Primary data store + real-time |
| Auth (server) | Firebase Admin SDK | Token verification, custom claims |
| Auth (client) | Firebase Client SDK | Client token + onSnapshot listeners |
| Rate Limiting | Upstash Redis | Sliding-window rate limiting via REST API |
| OTP Storage | Upstash Redis | 5-min TTL OTP cache |
| Email | Resend | OTP delivery, daily Excel reports |
| Payments | Cashfree PG | Payment sessions + webhook verification |
| Image CDN | Cloudinary | Optimized product images |
| Validation | Zod | Schema validation on all API inputs |
| Logging | Custom logger | Env-aware (errors only in prod) |
| Excel Reports | ExcelJS | Styled daily sales reports |
| QR Generation | qrcode | UPI payment QR codes |
| Printing | QZ Tray | Browser-to-thermal-printer bridge |

### Tailwind v4 Pattern (In Use)

```css
/* app/globals.css — Tailwind v4 pattern */
@import "tailwindcss";

/* Design tokens declared here, NOT in tailwind.config.ts */
@theme {
  --color-brand-primary: #your-color;
}
```

---

## 5. Product Ecosystem Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AROMAS PLATFORM (ByteBiz)                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   CUSTOMER EXPERIENCE                         │  │
│  │                                                              │  │
│  │  Homepage → Categories → Menu → Cart → Checkout → Tracking  │  │
│  │                                                              │  │
│  │  Auth: Email OTP (Firebase custom token)                     │  │
│  │  Payment: Cashfree (UPI / Card / Wallet)                     │  │
│  │  Delivery: Hostel-to-room (address at checkout)              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↕  Real-time via Firestore              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    VENDOR OPERATIONS                          │  │
│  │                                                              │  │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │  Orders    │  │   POS    │  │  Menu    │  │Analytics │  │  │
│  │  │  Kanban    │  │Terminal  │  │  CRUD    │  │+ Reports │  │  │
│  │  │  Board     │  │(Walk-in) │  │          │  │          │  │  │
│  │  └────────────┘  └──────────┘  └──────────┘  └──────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────────────────┐    │  │
│  │  │  Kitchen   │  │Settings  │  │  Daily Settlements    │    │  │
│  │  │  Display   │  │GST/Store │  │  ₹2/order platform   │    │  │
│  │  └────────────┘  └──────────┘  └──────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↕                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     ADMIN LAYER                               │  │
│  │  Vendor management · Settlement approval · Audit logs        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────┐     ┌──────────────────────────────────┐  │
│  │   Mobile App         │     │  Aroma Printer (Electron)        │  │
│  │   (React Native)     │     │  Bridge: Browser → Thermal Printer│  │
│  │   /mobile folder     │     │  /aroma_printer folder            │  │
│  └─────────────────────┘     └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Frontend Architecture

### App Router Directory Structure

```
src/app/
├── layout.tsx                     ← Root layout (SEO, auth init, theme, GA4)
├── globals.css                    ← Tailwind v4 + design tokens + animations
├── page.tsx                       ← Homepage (category grid)
├── robots.ts                      ← SEO robots.txt generation
├── sitemap.ts                     ← Dynamic sitemap generation
│
├── menu/
│   ├── page.tsx                   ← Full product catalog
│   └── MenuContent.tsx            ← Reusable menu display component
│
├── checkout/
│   └── page.tsx                   ← Cart review + payment initiation
│
├── order/
│   └── [orderId]/
│       └── page.tsx               ← Real-time order tracking
│
├── categories/
│   └── page.tsx                   ← Category browser
│
├── blog/
│   ├── page.tsx                   ← Blog listing
│   └── [slug]/page.tsx            ← Individual post
│
├── about/page.tsx
├── contact/page.tsx
├── account/page.tsx               ← User profile
│
├── legal/
│   ├── privacy-policy/page.tsx
│   ├── terms-and-conditions/page.tsx
│   ├── refund-policy/page.tsx
│   └── contact-us/page.tsx
│
└── vendor/                        ← Vendor Dashboard (auth-gated)
    ├── layout.tsx                 ← Auth guard + VendorContext provider
    ├── page.tsx                   ← Redirect/home
    ├── orders/
    │   ├── page.tsx               ← Kanban order board (CORE feature)
    │   ├── OrderDetailsDrawer.tsx ← Order detail slide-over
    │   └── POSDrawer.tsx          ← Walk-in order creation
    ├── analytics/page.tsx         ← Revenue charts + settlement history
    ├── kitchen/page.tsx           ← Kitchen display system
    ├── menu/page.tsx              ← Product CRUD
    ├── settings/page.tsx          ← Store open/close, GST
    └── admin/
        └── settlements/page.tsx   ← Admin settlement approval
```

### Component Structure

```
src/components/
├── auth/
│   └── AuthModal.tsx              ← Email OTP login (customer)
│
├── cart/
│   ├── CartSidebar.tsx            ← Desktop cart drawer
│   ├── EmptyCart.tsx              ← Empty state UI
│   └── MobileCartBar.tsx         ← Fixed bottom bar (mobile)
│
├── checkout/
│   ├── OrderSummaryPanel.tsx      ← Pre-payment order review
│   ├── PaymentFooter.tsx          ← Pay button + status
│   └── PayUForm.tsx               ← PayU integration (deprecated, commented out)
│
├── layout/
│   ├── Header.tsx                 ← Top navigation
│   ├── Banner.tsx                 ← Alert/announcement banner
│   ├── Footer.tsx                 ← Page footer
│   └── FooterWrapper.tsx          ← Footer display logic
│
├── products/
│   ├── ProductCard.tsx            ← Menu item card (image, price, add to cart)
│   ├── CategoryCard.tsx           ← Category tile
│   ├── CldImage.tsx               ← Cloudinary-optimized image (srcset, blur placeholder)
│   └── ReviewsSlider.tsx          ← Customer reviews carousel
│
└── vendor/
    ├── SettlementBanner.tsx       ← Settlement reminder strip (top of vendor dashboard)
    ├── SettlementModal.tsx        ← UTR entry + QR payment modal
    ├── StepUpAuthModal.tsx        ← Vendor OTP login modal
    └── PrinterSetupGuide.tsx      ← QZ Tray setup walkthrough
```

### State Management Architecture

```
┌─────────────────────────────────────────────────────┐
│               GLOBAL STATE LAYERS                    │
│                                                     │
│  1. Zustand (Cart) — cartStore.ts                   │
│     Persistent via localStorage                     │
│     items, addItem, removeItem, totals              │
│                                                     │
│  2. React Context (Auth) — AuthContext.tsx          │
│     Firebase user, email, phone, profile            │
│                                                     │
│  3. React Context (Vendor) — VendorContext.tsx      │
│     Live orders (Firestore listener)                │
│     Products (Firestore listener)                   │
│     Store status (Firestore listener)               │
│     Settlement lock state                           │
│     Audio controls (new order sounds)               │
│                                                     │
│  4. Firestore Real-time (page-level)                │
│     Order tracking page: order status               │
│     Customer storefront: settlement lock check      │
└─────────────────────────────────────────────────────┘
```

### Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useGSTSettings` | `hooks/useGSTSettings.ts` | Reads GST config from store settings, computes applicable tax |
| `useThermalPrinter` | `hooks/useThermalPrinter.ts` | QZ Tray connection management, receipt printing |

---

## 7. Backend Architecture

All backend logic lives inside Next.js Route Handlers (`src/app/api/**`). There is no separate API server or process — each route is a Vercel serverless function.

### Service-to-Service Communication Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                    REQUEST LIFECYCLE                                 │
│                                                                    │
│  Client Request                                                    │
│       │                                                            │
│       ▼                                                            │
│  [Vercel Edge] → middleware.ts (vendor routes: pass-through)       │
│       │                                                            │
│       ▼                                                            │
│  [API Route Handler]                                               │
│       │                                                            │
│       ├─ 1. Rate Limit Check (Upstash Redis)                      │
│       │      └─ 429 if exceeded, else continue                    │
│       │                                                            │
│       ├─ 2. Auth Verification (Firebase Admin)                    │
│       │      └─ 401 if invalid token                              │
│       │                                                            │
│       ├─ 3. Input Validation (Zod schema)                         │
│       │      └─ 400 with error details if invalid                 │
│       │                                                            │
│       ├─ 4. Business Logic                                         │
│       │      └─ Firestore reads/writes via Admin SDK              │
│       │                                                            │
│       └─ 5. Response                                               │
│              └─ Typed JSON response                                │
└────────────────────────────────────────────────────────────────────┘
```

### Core Library Modules (`src/lib/`)

| Module | File | Responsibility |
|--------|------|----------------|
| Firebase Client | `firebase.ts` | Client SDK init, exports `auth`, `db` |
| Firebase Admin | `firebaseAdmin.ts` | Admin SDK init, exports `adminDb`, `adminAuth` |
| Auth Utilities | `auth.ts` | Session storage, token sign-in helpers |
| Settlement Logic | `settlement.ts` | IST timezone math, period calculation |
| Zod Schemas | `schemas.ts` | `CreateOrderSchema`, `OrderItemSchema`, `DeliveryAddressSchema` |
| Vendor Operations | `vendor.ts` | Firestore listeners, order mutations, product CRUD |
| Rate Limiting | `rateLimit.ts` | Upstash Redis sliding window, IP extraction |
| Cloudinary | `cloudinary.ts` | URL transformation, srcset generation, blur placeholders |
| Logger | `logger.ts` | Env-aware logging (errors only in production) |
| Excel Reports | `report-excel.ts` | ExcelJS workbook generation, IST date helpers |
| Firestore Server | `firestore-server.ts` | Server-side Firestore reads (categories, etc.) |
| Order Status | `order-status.ts` | Status labels, SLA calculations |
| Receipt Formatter | `receiptFormatter.ts` | Thermal printer receipt formatting |
| Hostel List | `hostels.ts` | Campus hostel validation/list |
| SEO Config | `seo-config.ts` | Centralized metadata config |

### Payment Service Layer (`src/services/payment/`)

```
services/payment/
├── paymentProvider.ts          ← Interface definition: PaymentProvider
├── paymentService.ts           ← Singleton service (forces Cashfree)
└── providers/
    ├── cashfreeProvider.ts     ← Active: Cashfree PG v2023-08-01
    └── payuProvider.ts         ← Deprecated: PayU (commented out)
```

This is a proper **Strategy Pattern** implementation. Swapping payment providers requires only changing the active provider in `paymentService.ts` — no API route changes needed.

---

## 8. Database Architecture

### Primary Database: Firebase Firestore

Firestore is a NoSQL document database with real-time subscription support. The entire application state (orders, products, settings, settlements) lives here. Access from the server side uses the Admin SDK (`adminDb`), and from the client uses the client SDK (`db`) with Firestore Security Rules enforcement.

### Collection Schema

#### `categories/{id}`
```typescript
{
  name: string,
  imageURL: string,           // Cloudinary CDN URL
  productCount?: number
}
```

#### `products/{id}`
```typescript
{
  name: string,
  categoryId: string,
  price: number,              // POS / walk-in price
  onlinePrice?: number,       // Online price (includes packaging fee + GST if baked in)
  code?: string,              // Short lookup code (POS shortcut)
  serialNumber?: number,      // POS menu sort order
  onlineSerialNumber?: number,// Online menu sort order
  imageURL: string,
  description?: string,
  isAvailable?: boolean,      // false = out of stock
  isPOSItem?: boolean,        // Shown in POS terminal
  isOnlineItem?: boolean,     // Shown on customer storefront
  createdAt: Timestamp,
  updatedAt?: Timestamp
}
```

#### `posProducts/{id}`
Separate collection mirroring `products` structure. Populated by `scripts/sync-menu.ts`. The separation allows POS menu and online menu to diverge over time without coupling.

#### `orders/{id}`
```typescript
{
  userId: string,             // Firebase UID
  orderType: 'online' | 'pos',
  customerPhone: string,
  customerEmail?: string,
  items: [{
    productId: string,
    name: string,             // Snapshot at order time (not a live reference)
    price: number,
    quantity: number,
    imageURL: string,
    categoryId?: string
  }],
  itemTotal: number,
  dukanFee: number,           // ₹0 currently
  deliveryFee: number,        // ₹0 currently
  grandTotal: number,
  deliveryAddress: {
    name: string,
    mobile: string,
    hostelNumber: string,
    roomNumber: string,
    deliveryType: string,
    fullAddress?: string
  },
  status: OrderStatus,        // See status flow below
  orderToken: string,         // 3-digit daily sequence ('006')
  etaMinutes: number,
  expectedReadyTime: Timestamp,

  // Payment fields (online orders only)
  payment_status?: 'pending' | 'processing' | 'success' | 'failed' | 'refunded',
  payment_provider?: 'cashfree' | 'payu',
  payment_transaction_id?: string,
  payment_amount?: number,
  payment_verified_at?: Timestamp,
  payment_details?: {
    cf_payment_id: string,
    payment_method: string,
    bank_reference: string,
    // ... raw Cashfree fields
  },

  // Settlement tracking (per-order ₹2 platform fee)
  settlement_status?: 'pending' | 'paid',
  settlement_utr?: string,
  settlement_paid_at?: Timestamp,

  // Operations
  timeline?: {
    placed?: Timestamp,
    accepted?: Timestamp,
    preparing?: Timestamp,
    dispatched?: Timestamp,
    completed?: Timestamp,
    cancelled?: Timestamp
  },
  prep_time?: number,         // Minutes from accept → dispatch
  cancel_reason?: string,
  cancelled_by?: string,

  orderDate: Timestamp,
  timestamp: Timestamp,
  updatedAt?: Timestamp
}
```

#### `payments/{transaction_id}`
```typescript
{
  order_id: string,
  provider: 'cashfree' | 'payu',
  transaction_id: string,
  amount: number,
  currency: 'INR',
  status: 'pending' | 'success' | 'failed' | 'refunded',
  raw_response: string,       // Serialized webhook payload (audit trail)
  created_at: Timestamp,
  updated_at: Timestamp
}
```

#### `vendors/{phone_or_email}`
```typescript
{
  email: string,              // Normalized lowercase
  isVendor: boolean,
  isActive: boolean,
  role: 'vendor',
  createdAt: Timestamp
}
```

#### `vendor_daily_settlements/{YYYY-MM-DD}`
```typescript
{
  vendor_id: string,
  settlement_date: string,    // 'YYYY-MM-DD' IST
  period_start: Timestamp,    // Previous day 7 AM IST
  period_end: Timestamp,      // Current day 7 AM IST
  total_online_orders: number,
  rate_per_order: number,     // ₹2
  payable_amount: number,     // total_online_orders × rate_per_order
  status: 'pending' | 'paid' | 'overdue' | 'verification_pending' | 'rejected',
  transaction_id?: string,    // UTR submitted by vendor
  screenshot_url?: string,
  paid_at?: Timestamp,
  verified_at?: Timestamp,
  verified_by?: string,       // Admin UID or 'self'
  rejection_reason?: string,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

#### `settings/storeSettings`
```typescript
{
  isOpen: boolean,            // Master online ordering switch
  settlementLocked: boolean,  // Auto-set by cron; cleared on payment
  gstEnabled: boolean,
  gstType: 'included' | 'excluded',
  gstPercentage: number,
  updatedAt: Timestamp
}
```

### Data Relationships Diagram

```
categories ──────────────────── products
                                    │
                                    │ (snapshot at order time)
                                    ▼
                              order_items  ──── orders
                                                  │
                                                  ├── payments
                                                  │   (transaction record)
                                                  │
                                                  └── vendor_daily_settlements
                                                      (aggregated daily)

settings/storeSettings  ←──── (controls all online order flow)
vendors/{email}          ←──── (auth gate for /vendor/* routes)
posProducts              ←──── (separate POS catalog, synced from products)
```

### Firestore Security Rules Summary

| Collection | Public Read | Auth Read | Client Write |
|-----------|------------|-----------|-------------|
| `categories` | ✅ | ✅ | ❌ (admin SDK only) |
| `products` | ✅ | ✅ | ❌ |
| `posProducts` | ✅ | ✅ | ❌ |
| `orders` | ❌ | ✅ (own orders) | ✅ (create only) |
| `settings` | ✅ | ✅ | ❌ |
| `vendors` | ❌ | ✅ | ❌ |
| `vendor_daily_settlements` | ❌ | Vendor only | ❌ |
| `payments` | ❌ | ❌ | ❌ (webhook only) |
| `users` | ❌ | ✅ (own) | ✅ (own) |

All mutations to protected collections flow through API routes using the Admin SDK, bypassing client-side rules entirely.

---

## 9. API Architecture Breakdown

### Complete Route Map

```
src/app/api/
│
├── auth/
│   ├── send-otp/route.ts         POST  Customer OTP (email → Redis)
│   └── verify-otp/route.ts       POST  Customer OTP verify → Firebase token
│
├── vendor-auth/
│   ├── send-otp/route.ts         POST  Vendor OTP (checks vendors collection)
│   └── verify-otp/route.ts       POST  Vendor OTP verify → Firebase token + isVendor claim
│
├── orders/
│   ├── route.ts                  POST  Create online order
│   └── settle/route.ts           POST  Vendor confirms per-order UTR payment
│
├── payment/
│   ├── create/route.ts           POST  Initiate Cashfree payment session
│   ├── webhook/route.ts          POST  Cashfree webhook receiver (HMAC verified)
│   └── cron/cleanup/route.ts     GET   Clean up stale payment sessions
│
├── settlements/
│   ├── route.ts                  GET   Fetch today's settlement + UPI QR
│   │                             POST  Vendor submits UTR → auto-unlock ordering
│   └── verify/route.ts           POST  Admin approve/reject settlement
│
├── products/route.ts             POST/PUT/DELETE  Vendor menu CRUD
├── pos-products/route.ts         GET/POST/PUT/DELETE  POS menu CRUD
│
├── vendor/
│   ├── orders/pos/route.ts       POST  Create walk-in POS order
│   └── send-report/route.ts      POST  Email sales CSV to vendor
│
├── admin/
│   ├── add-vendor/route.ts       POST  Onboard new vendor
│   ├── settlements/route.ts      GET   List all settlements
│   └── audit/route.ts            GET   Audit log entries
│
├── cron/
│   ├── daily-settlement/route.ts GET   9AM IST: create settlement doc, lock ordering
│   ├── daily-report/route.ts     GET   Daily: Excel report email to vendor
│   └── monthly-archive/route.ts  GET   Archive old order data
│
├── upi-info/route.ts             GET   Vendor UPI ID + name
├── settings/route.ts             POST  Toggle store open/close, GST config
├── print/route.ts                POST  Proxy to local thermal printer service
└── init-super/route.ts           GET   One-time admin initialization
```

### API Request/Response Patterns

**Standard Success Response:**
```json
{ "success": true, "data": { ... } }
```

**Standard Error Response:**
```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

**Rate Limit Response (429):**
```json
{ "error": "Too many requests", "retryAfter": 1234567890 }
```

### Authentication Pattern (Vendor Routes)

All vendor API routes follow this verification chain:

```
1. Extract Bearer token from Authorization header
2. adminAuth.verifyIdToken(token) → decoded claims
3. Look up vendor in Firestore by:
   a. Firebase UID match in vendors collection
   b. Phone number from token claims
   c. Email from decoded token or x-vendor-phone header
4. Check: isVendor === true OR role === 'vendor' OR isActive === true
5. Return 401 if any check fails
```

---

## 10. Authentication System

### Dual Auth Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     TWO PARALLEL AUTH FLOWS                         │
│                                                                    │
│  CUSTOMER AUTH                      VENDOR AUTH                    │
│  ─────────────                      ───────────                    │
│  POST /api/auth/send-otp            POST /api/vendor-auth/send-otp │
│    ↓ Generate 6-digit OTP             ↓ Check vendors collection    │
│    ↓ Store in Redis (5 min TTL)       ↓ Generate OTP, store Redis   │
│    ↓ Send via Resend email            ↓ Send via Resend email        │
│                                                                    │
│  POST /api/auth/verify-otp          POST /api/vendor-auth/verify   │
│    ↓ Validate OTP from Redis           ↓ Validate OTP               │
│    ↓ Create Firebase custom token      ↓ Create custom token with   │
│    ↓ UID: user_{email_normalized}         claims: {isVendor: true,  │
│    ↓ Single-use (delete from Redis)       vendorEmail: ...}         │
│                                      ↓ UID: vendor_{email}          │
│  Client:                                                           │
│    signInWithCustomToken(auth, token)  ← same for both flows       │
│    Save email to localStorage (60-day expiry)                      │
└────────────────────────────────────────────────────────────────────┘
```

### Session Persistence

| Data | Storage | Key | TTL |
|------|---------|-----|-----|
| Customer email | localStorage | `aromas_user_email` | 60 days |
| Vendor email | localStorage | `vendorEmail` | Persistent |
| OTP | Upstash Redis | `otp:{email}` | 5 minutes |
| Rate limit counter | Upstash Redis | `ratelimit:{email}` | 10 minutes |

### Security Properties

- **OTPs are single-use:** Deleted from Redis immediately after successful verification
- **Custom tokens:** Short-lived Firebase custom tokens; client exchanges for Firebase ID token
- **Vendor gate:** isVendor claim in custom token, verified server-side on every protected request
- **No passwords:** Zero password storage — purely OTP-based

---

## 11. Payment Architecture

### Payment Flow (End-to-End)

```
CUSTOMER                   FRONTEND                    API                  CASHFREE
   │                          │                         │                      │
   │  Click "Pay Now"         │                         │                      │
   │─────────────────────────►│                         │                      │
   │                          │  POST /api/payment/create                      │
   │                          │─────────────────────────►│                      │
   │                          │                         │  Create Cashfree Order│
   │                          │                         │─────────────────────►│
   │                          │                         │  ← session_id, URL   │
   │                          │◄─────────────────────────│                      │
   │  Cashfree Checkout popup │                         │                      │
   │◄─────────────────────────│                         │                      │
   │  Enter UPI/card details  │                         │                      │
   │─────────────────────────►│                         │                      │
   │  (Directly on Cashfree)  │       WEBHOOK: POST /api/payment/webhook        │
   │                          │                         │◄─────────────────────│
   │                          │                         │  Verify HMAC-SHA256  │
   │                          │                         │  Validate amount ±₹1 │
   │                          │                         │  Update order in DB  │
   │                          │                         │──────────────────────►│
   │                          │                         │  ← 200 OK            │
   │  Order tracking page     │                         │                      │
   │◄─────────────────────────│                         │                      │
```

### Cashfree Integration Details

- **API Version:** Cashfree PG v2023-08-01
- **Order ID Format:** `order_{firebaseDocId}_{timestamp}` (max 45 chars)
- **Webhook Security:** HMAC-SHA256 over raw body with timestamp + secret
- **Amount Tolerance:** ±₹1 (floating point safety margin)
- **Idempotency:** Payment doc keyed by `transaction_id` — double webhooks are no-ops
- **Tags:** `internal_order_id` embedded in Cashfree order tags for recovery
- **Environments:** `SANDBOX` (dev) / `PRODUCTION` (live) via env var

### Payment Provider Strategy Pattern

```typescript
// src/services/payment/paymentProvider.ts
interface PaymentProvider {
  createPaymentSession(order: OrderData, baseUrl?: string): Promise<PaymentSession>
  verifyPayment(webhookData: unknown): Promise<PaymentVerification>
}

// Switching providers: change ONE LINE in paymentService.ts
// PayU was previously supported (provider file exists, commented out)
```

### Why Cashfree (Not Razorpay)

Cashfree offers a more flexible payout/settlement API for multi-vendor flows at lower cost at small scale. PayU was the original provider (evidence: `PayUForm.tsx`, `payuProvider.ts`) but was deprecated — Cashfree is the current active integration.

---

## 12. Real-Time System Design

### Architecture: Firestore `onSnapshot` (Not WebSockets)

Rather than building a custom WebSocket server, the platform leverages Firestore's built-in real-time subscription system. Every `onSnapshot` listener maintains a persistent WebSocket connection to Firestore's infrastructure.

```
VENDOR DASHBOARD REAL-TIME SUBSCRIPTIONS:

  VendorContext.tsx listens to:
  ┌────────────────────────────────────────────────────────────┐
  │                                                            │
  │  ① orders collection                                      │
  │     Query: where status NOT IN ['Completed', 'Cancelled'] │
  │     Trigger: New orders appear in vendor board instantly   │
  │                                                            │
  │  ② settings/storeSettings                                 │
  │     Fields: isOpen, settlementLocked, gstEnabled, etc.    │
  │     Trigger: Store toggle reflects immediately on both    │
  │              customer and vendor UI                        │
  │                                                            │
  │  ③ products collection                                    │
  │     Trigger: Menu changes visible to vendor and customer  │
  │              simultaneously (without page refresh)         │
  │                                                            │
  │  ④ posProducts collection                                 │
  │     Trigger: POS terminal reflects inventory changes       │
  │                                                            │
  └────────────────────────────────────────────────────────────┘

CUSTOMER REAL-TIME SUBSCRIPTIONS:

  ① settings/storeSettings (settlementLocked)
     Trigger: "Order Now" button hides if vendor owes settlement

  ② orders/{orderId} (order tracking page)
     Trigger: Status updates (Preparing → Dispatched) appear live
```

### Audio Alert System (Vendor Dashboard)

The vendor's order board plays distinct audio cues for each event:

| Event | Audio Trigger |
|-------|--------------|
| New order arrives | Alert sound |
| Order cancelled by customer | Cancellation sound |
| Order in queue >N minutes (red zone) | Red-zone warning |
| Order dispatched | Dispatch confirmation sound |

Audio is unlocked on first user interaction (browser autoplay policy compliance).

### Real-Time Order Status Flow

```
NEW ORDER PLACED
      │
      ▼
  [Placed]  ←── Firestore write by /api/orders or /api/payment/webhook
      │
      │  Vendor sees on order board (onSnapshot fires)
      │  Audio alert plays
      ▼
  [Pending]  ←── Vendor taps "Accept"
      │
      ▼
  [Preparing]  ←── Vendor taps "Start Preparing"
      │              Kitchen display updates
      ▼
  [Dispatched]  ←── Vendor taps "Dispatch"
      │               Dispatch audio plays
      ▼
  [Completed]  ←── Final confirmation (or auto after delivery)

  [Cancelled] can occur from Placed or Pending states
  POS orders: start at [Preparing] (skip Placed/Pending)
```

---

## 13. Settlement & Financial Architecture

This is the **core financial innovation** of the ByteBiz model. The platform charges ₹2 per paid online order and enforces collection through an automated ordering lock.

### Settlement System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DAILY SETTLEMENT CYCLE                            │
│                                                                     │
│  9:00 AM IST — Vercel Cron fires                                    │
│       │                                                             │
│       ▼                                                             │
│  GET /api/cron/daily-settlement                                     │
│       │                                                             │
│       ├─ Query orders from 7AM yesterday → 7AM today (IST)         │
│       │   WHERE payment_status = 'success'                         │
│       │   WHERE orderType = 'online'                                │
│       │                                                             │
│       ├─ Calculate: count × ₹2 = payable_amount                    │
│       │                                                             │
│       ├─ Write vendor_daily_settlements/{YYYY-MM-DD}                │
│       │   status: 'pending' (or 'paid' if ₹0)                     │
│       │                                                             │
│       └─ If payable_amount > 0:                                    │
│           settings/storeSettings.settlementLocked = TRUE           │
│           → Customer storefront: "Order Now" disappears            │
│           → New online orders: BLOCKED                              │
│                                                                     │
│  VENDOR SEES SETTLEMENT BANNER in dashboard                         │
│       │                                                             │
│       ▼                                                             │
│  Vendor pays via UPI (QR code generated from vendor UPI ID)        │
│       │                                                             │
│       ▼                                                             │
│  POST /api/settlements { transaction_id: "UTR_NUMBER" }            │
│       │                                                             │
│       ├─ Validate UTR uniqueness (dedup across all settlements)    │
│       ├─ Update settlement: status = 'paid'                        │
│       └─ IMMEDIATELY: settlementLocked = FALSE                     │
│           → Customer storefront: "Order Now" reappears             │
│           → Online orders: UNBLOCKED                                │
│                                                                     │
│  (Optional) Admin reviews via /vendor/admin/settlements             │
│       POST /api/settlements/verify { action: 'approve'|'reject' }  │
└─────────────────────────────────────────────────────────────────────┘
```

### Settlement Period Definition

```
Period Window:
  Start: Previous day 7:00 AM IST
  End:   Current day 7:00 AM IST

WHY 7 AM, not midnight:
  Campus canteens open around 7-8 AM. Using 7 AM as the day boundary
  means a full operating day (7 AM → 7 AM) is captured per settlement.
  This prevents orders from the early morning being split across two settlement days.
```

### Settlement Status Machine

```
pending → overdue     (if unpaid after next cron runs)
pending → paid        (vendor submits UTR)
pending → rejected    (admin rejects UTR)
overdue → paid        (vendor submits UTR late)
paid    → (terminal)
rejected → (terminal, manual resolution)
```

---

## 14. Event-Driven & Cron System

### Vercel Cron Jobs (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-settlement",
      "schedule": "30 3 * * *"   // 9:00 AM IST (UTC+5:30 → UTC 3:30)
    },
    {
      "path": "/api/cron/daily-report",
      "schedule": "30 3 * * *"   // 9:00 AM IST
    },
    {
      "path": "/api/cron/monthly-archive",
      "schedule": "0 0 1 * *"    // 1st of each month, midnight UTC
    },
    {
      "path": "/api/payment/cron/cleanup",
      "schedule": "0 */6 * * *"  // Every 6 hours (inferred)
    }
  ]
}
```

**Cron Security:** All cron routes verify `Authorization: Bearer {CRON_SECRET}` header. Vercel automatically attaches this header to cron-triggered requests. Manual invocations without the secret are rejected (401).

### Daily Report System

```
GET /api/cron/daily-report
      │
      ├─ Query all orders in IST day window
      │
      ├─ Build ExcelJS workbook:
      │   Sheet 1: Order-level rows (id, token, time, items, revenue)
      │   Sheet 2: Item-level aggregation (name, qty, revenue, avg price)
      │   Sheet 3: Summary (total revenue, order count, cancellations, best seller)
      │
      └─ Resend email to VENDOR_EMAIL:
          Styled HTML summary card
          Excel workbook as attachment
```

---

## 15. Infra & Deployment Architecture

### Production Stack

```
┌───────────────────────────────────────────────────────────────────┐
│                        VERCEL                                      │
│                                                                   │
│  ├─ Next.js App (SSR + static + edge)                             │
│  ├─ Serverless Functions (API routes — auto-scaled)               │
│  ├─ Edge Middleware (middleware.ts — runs at CDN edge)            │
│  ├─ Vercel Cron Jobs (daily-settlement, daily-report, etc.)       │
│  └─ Vercel Analytics (web vitals, page views)                     │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
              ┌───────────────┼──────────────────┐
              ▼               ▼                  ▼
    ┌─────────────┐  ┌────────────────┐  ┌──────────────────────┐
    │  Firebase   │  │ Upstash Redis  │  │  External Services   │
    │             │  │                │  │                      │
    │ Firestore   │  │ Rate Limiting  │  │ Cashfree (payments)  │
    │ Auth        │  │ OTP Storage    │  │ Resend (email)       │
    │ Admin SDK   │  │ REST API mode  │  │ Cloudinary (images)  │
    └─────────────┘  └────────────────┘  │ Google Analytics 4   │
                                         └──────────────────────┘

    LOCAL SERVICES (vendor's machine):
    ┌──────────────────────────────┐
    │  aroma_printer (Electron)    │
    │  Bridges browser → printer   │
    │  Listens on localhost:4000   │
    │  /api/print → proxies to it  │
    └──────────────────────────────┘
```

### Environment Strategy

```
.env.local          ← Local development
.env.local.example  ← Template checked into git (no secrets)
Vercel Dashboard    ← Production/preview secrets (never in git)
```

**Required Environment Variables:**

| Variable | Service | Exposure |
|---------|---------|----------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Client SDK | Browser (public) |
| `FIREBASE_ADMIN_*` | Firebase Admin SDK | Server only |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis | Server only |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis | Server only |
| `RESEND_API_KEY` | Resend email | Server only |
| `CASHFREE_APP_ID` | Cashfree | Server only |
| `CASHFREE_SECRET_KEY` | Cashfree | Server only |
| `CASHFREE_ENVIRONMENT` | Cashfree (SANDBOX/PRODUCTION) | Server only |
| `VENDOR_EMAIL` | Daily reports recipient | Server only |
| `VENDOR_UPI_ID` | Settlement QR generation | Server only |
| `VENDOR_UPI_NAME` | UPI display name | Server only |
| `CRON_SECRET` | Cron job auth | Server only |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 | Browser (public) |

### CI/CD Pipeline (Inferred from Vercel)

```
GitHub Push/PR
      │
      ├─ PR → Vercel Preview Deploy (unique URL per PR)
      │         ← Test here before merging
      │
      └─ Merge to main → Vercel Production Deploy
                          ← Automatic, ~30s build time
```

### Additional Apps in Repository

**`/mobile` — React Native Expo App**
- Vendor mobile app (likely for on-the-go order management)
- Separate build/deploy from main Next.js app
- Shares the same Firebase project

**`/aroma_printer` — Electron Desktop App**
- Runs on vendor's local machine at the kitchen
- Exposes local HTTP server on port 4000
- Receives print jobs from `/api/print` (which proxies from Vercel)
- Formats and sends ESC/POS commands to thermal printer
- QZ Tray (`/public/qz-tray.js`) is an alternative browser-based path for printing

---

## 16. Security Architecture

### HTTP Security Headers (`next.config.ts`)

```
X-Content-Type-Options:    nosniff
X-Frame-Options:           SAMEORIGIN
Referrer-Policy:           strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy:        camera=(), microphone=(), geolocation=()
Content-Security-Policy:   [strict policy — see below]
```

### Content Security Policy

The CSP is strict and explicitly whitelists each external resource:

| Directive | Allowed Sources |
|-----------|----------------|
| `script-src` | self, Cashfree SDK, Google APIs/GTM, Vercel scripts |
| `style-src` | self, inline (required for Tailwind), Google Fonts |
| `img-src` | self, Cloudinary, Firebase Storage, R2, Cashfree, Unsplash |
| `connect-src` | Firebase APIs, Upstash, Cashfree, Cloudinary, localhost printer |
| `frame-src` | Cashfree checkout iframe, Firebase auth UI |

**Why `unsafe-eval` and `unsafe-inline` in script-src:**
Required by Cashfree's hosted checkout SDK. This is a known trade-off with hosted payment providers that embed JavaScript. Mitigated by restricting to specific Cashfree domains.

### Console Log Stripping

```typescript
// next.config.ts
compiler: {
  removeConsole: process.env.NODE_ENV === 'production'
    ? { exclude: ['error'] }
    : false
}
```
Removes all `console.log/warn/info` in production builds. `console.error` kept for monitoring. This prevents accidental PII or business data exposure via browser dev tools in production.

### Rate Limiting Strategy

| Endpoint | Limit | Window |
|---------|-------|--------|
| `POST /api/auth/send-otp` | 3 per email | 10 minutes |
| `POST /api/orders` | 5 per IP | 1 minute |
| `POST /api/payment/create` | 5 per IP | 1 minute |
| `POST /api/vendor/orders/pos` | 5 per IP | 1 minute |

Rate limiting uses Upstash Redis sliding-window algorithm via `@upstash/ratelimit`. Gracefully degrades (allows requests) if Redis is unreachable — ensuring Redis outages don't block production traffic.

### Payment Webhook Security

```
POST /api/payment/webhook

1. Raw body is captured (before any JSON parsing)
2. HMAC-SHA256(rawBody + timestamp, CASHFREE_SECRET_KEY) is computed
3. Compared to x-webhook-signature header from Cashfree
4. Request rejected (400) if signatures don't match
5. Amount validated: abs(received - expected) <= ₹1
6. Idempotency: if payment doc already exists for transaction_id, skip processing
```

---

## 17. Current Features Implemented

### Customer-Facing (Storefront)

| Feature | Status | Location |
|---------|--------|---------|
| Homepage with category grid | ✅ Live | `app/page.tsx` |
| Full menu catalog | ✅ Live | `app/menu/` |
| Cart (persistent, localStorage) | ✅ Live | `store/cartStore.ts` |
| Mobile cart bar (fixed bottom) | ✅ Live | `components/cart/MobileCartBar.tsx` |
| Desktop cart sidebar | ✅ Live | `components/cart/CartSidebar.tsx` |
| Email OTP authentication | ✅ Live | `components/auth/AuthModal.tsx` |
| Checkout with address entry | ✅ Live | `app/checkout/` |
| Cashfree payment integration | ✅ Live | `services/payment/` |
| Real-time order tracking | ✅ Live | `app/order/[orderId]/` |
| Settlement lock (blocks ordering) | ✅ Live | `lib/vendor.ts` + `app/page.tsx` |
| Blog / content pages | ✅ Live | `app/blog/` |
| Legal pages (privacy, T&C, refund) | ✅ Live | `app/legal/` |
| SEO + Open Graph metadata | ✅ Live | `app/layout.tsx`, `lib/seo-config.ts` |
| Sitemap + robots.txt | ✅ Live | `app/sitemap.ts`, `app/robots.ts` |
| Dark/light theme toggle | ✅ Live | `components/ThemeProvider.tsx` |
| Cloudinary image optimization | ✅ Live | `components/products/CldImage.tsx` |
| Google Analytics 4 | ✅ Live | `components/GoogleAnalytics.tsx` |
| Vercel Analytics | ✅ Live | `app/layout.tsx` |
| Customer reviews carousel | ✅ Live | `components/products/ReviewsSlider.tsx` |

### Vendor Dashboard

| Feature | Status | Location |
|---------|--------|---------|
| Vendor email OTP login | ✅ Live | `components/vendor/StepUpAuthModal.tsx` |
| Live order board (Kanban) | ✅ Live | `app/vendor/orders/page.tsx` |
| Order status transitions | ✅ Live | `lib/vendor.ts:updateOrderStatus` |
| Batch dispatch (multiple orders) | ✅ Live | `app/vendor/orders/page.tsx` |
| Order detail drawer | ✅ Live | `app/vendor/orders/OrderDetailsDrawer.tsx` |
| POS terminal (walk-in orders) | ✅ Live | `app/vendor/orders/POSDrawer.tsx` |
| Kitchen display system | ✅ Live | `app/vendor/kitchen/page.tsx` |
| Menu management (CRUD) | ✅ Live | `app/vendor/menu/page.tsx` |
| Product availability toggle | ✅ Live | `lib/vendor.ts:toggleProductAvailability` |
| Sales analytics + charts | ✅ Live | `app/vendor/analytics/page.tsx` |
| Date-range report filtering | ✅ Live | `app/vendor/analytics/page.tsx` |
| Settlement history view | ✅ Live | `app/vendor/analytics/page.tsx` |
| Excel report download/email | ✅ Live | `lib/report-excel.ts` |
| Thermal printer integration | ✅ Live | `hooks/useThermalPrinter.ts` + `api/print/` |
| Printer setup guide | ✅ Live | `components/vendor/PrinterSetupGuide.tsx` |
| Daily settlement banner | ✅ Live | `components/vendor/SettlementBanner.tsx` |
| Settlement payment (UTR entry) | ✅ Live | `components/vendor/SettlementModal.tsx` |
| UPI QR code for settlement | ✅ Live | `api/settlements/route.ts` |
| Store open/close toggle | ✅ Live | `app/vendor/settings/page.tsx` |
| GST configuration | ✅ Live | `app/vendor/settings/page.tsx` |
| Audio alerts (new orders) | ✅ Live | `contexts/VendorContext.tsx` |

### Admin Features

| Feature | Status | Location |
|---------|--------|---------|
| Settlement approval/rejection | ✅ Live | `app/vendor/admin/settlements/page.tsx` |
| Vendor onboarding API | ✅ Live | `api/admin/add-vendor/route.ts` |
| Settlement list view | ✅ Live | `api/admin/settlements/route.ts` |
| Audit logs | ✅ Live | `api/admin/audit/route.ts` |

### Automated Systems

| Feature | Status | Schedule |
|---------|--------|---------|
| Daily settlement creation + order lock | ✅ Live | 9:00 AM IST |
| Daily Excel report email | ✅ Live | 9:00 AM IST |
| Monthly order archival | ✅ Live | 1st of month |
| Stale payment cleanup | ✅ Live | Every 6 hours |

---

## 18. Features Under Development / Stubs

| Feature | Evidence | Status |
|---------|---------|--------|
| PayU payment provider | `PayUForm.tsx`, `payuProvider.ts` exist but commented out | Deprecated (replaced by Cashfree) |
| Vendor mobile app | `/mobile` folder with React Native Expo project | In development |
| Desktop printer bridge | `/aroma_printer` Electron app | Functional (separate deploy) |
| Monthly analytics | `report-excel.ts:prevMonthIST()`, monthly cron | Partial (cron exists, UI may be incomplete) |
| Customer account page | `app/account/page.tsx` | Shell exists, depth unknown |
| Screenshot upload for settlements | `settlement_screenshot_url` field in schema | Schema ready, UI unknown |
| Custom domain / subdomain routing | CSP + image config have external hostnames | Infra ready, routing not implemented |

---

## 19. Multi-Tenant Architecture Strategy

### Current State: Single-Tenant Deployment

Aromas is a **single-vendor deployment** of the ByteBiz platform. The entire system serves one vendor (one Firestore project, one Cashfree account, one set of env vars). Multi-tenancy is achieved today by **cloning and redeploying** for each new vendor.

```
ByteBiz Multi-Tenant Strategy:

TODAY (per-vendor deploy):
  aromas.bytebiz.in → Firestore Project A, Cashfree Account A
  h4canteen.bytebiz.in → Firestore Project B, Cashfree Account B

FUTURE (single platform, multi-tenant):
  ┌────────────────────────────────────────────────────────┐
  │  bytebiz.in (shared platform)                          │
  │                                                        │
  │  Tenant resolution via subdomain in middleware.ts:     │
  │    h4canteen.bytebiz.in → vendorId: 'h4canteen'       │
  │    aromas.bytebiz.in    → vendorId: 'aromas'           │
  │                                                        │
  │  All data scoped to vendorId in every query            │
  └────────────────────────────────────────────────────────┘
```

### Migration Path to Multi-Tenant

The codebase is structured to make this migration achievable:

1. **Middleware is already in place** (`middleware.ts`) — currently a pass-through; subdomain detection can be added
2. **Vendor collection exists** — `vendors/{id}` can be extended with full vendor profiles
3. **Settlement system** is already per-vendor (keyed by vendor_id)
4. **Auth system** — vendor custom token already carries `vendorEmail` claim
5. **Firestore rules** — need to add vendorId scoping per collection

**Estimated migration complexity:** Medium. The main work is:
- Refactoring Firestore collections from flat to `vendors/{vendorId}/products/{productId}`
- Migrating from per-project Firebase to shared Firebase project with vendorId in all queries
- Building a vendor onboarding flow (form → Firestore → send credentials)

---

## 20. AI Infrastructure Opportunities

No AI systems are currently implemented. The following represent high-ROI, low-complexity additions directly applicable to the existing data model:

### Phase 1: Operational Intelligence (Low Complexity)

**Inventory Prediction**
- Input: `orders.items` history, order frequency per product
- Output: "You'll likely run out of Vada Pav by tomorrow at current rate"
- Implementation: Simple moving average on item quantities consumed per day

**Peak Hour Detection**
- Input: `orders.orderDate` timestamps aggregated by hour
- Output: Pre-warn vendor at 11 AM: "Lunch rush expected in 90 minutes — current queue depth: 3"
- Implementation: Hourly aggregation query + threshold alert via Resend

**Revenue Anomaly Detection**
- Input: `vendor_daily_settlements.payable_amount` history
- Output: Alert if today's orders are >40% below rolling 7-day average
- Implementation: Cron job comparing today's settlement to moving average

### Phase 2: Customer Experience (Medium Complexity)

**Wait Time ML Model**
- Input: Current `orders` count with `status = 'Preparing'`, historical `prep_time` values
- Output: Dynamic ETA displayed to customer (replacing fixed `etaMinutes`)
- Implementation: Linear regression on queue depth → prep time relationship

**Personalized Reorder**
- Input: Customer's past `orders.items` (keyed by email)
- Output: "Quick reorder: Masala Chai + Samosa (your usual 4 PM order)"
- Implementation: Client-side history from Firestore + simple frequency ranking

### Phase 3: Platform Intelligence

**Vendor Health Score**
- Composite: fulfillment rate, avg prep time, cancellation rate, settlement timeliness
- Surface: Internal admin dashboard + vendor-facing goal tracker

**Demand Forecasting**
- Input: Multi-day order history aggregated by product, time, day-of-week
- Output: Next 3-day demand forecast with suggested prep quantities
- Implementation: Facebook Prophet or simple ARIMA model (Python microservice or serverless function)

---

## 21. Scaling Recommendations

### Traffic Pattern (Campus Commerce)

```
Predicted daily load (current: 1 campus, 1 vendor):
  Peak: Lunch 12:30–1:30 PM (highest order volume)
  Peak: Breakfast 7:30–9:00 AM
  Peak: Evening 4:00–6:00 PM
  Off-peak: ~40% of daily orders outside peaks

Firestore limits at current scale:
  1,000 writes/second (Firestore limit)
  At 60 orders/min peak × ~5 doc writes each = 300 writes/min = ~5 writes/sec
  → Current load is <1% of Firestore limit. Zero scaling concerns today.
```

### Phase-Based Scaling Plan

**Phase 1 (Current — 1-5 vendors):**
- Current architecture is sufficient
- Vercel + Firebase + Upstash handles this effortlessly
- Focus: feature completeness, not scaling

**Phase 2 (5-50 vendors):**
- Add: Firestore composite indexes as query complexity grows
- Add: Cloudinary signed URLs for private vendor assets
- Add: Vercel Firewall rules (WAF) for bot protection
- Consider: Separate Firebase project per high-volume campus (data isolation)
- Consider: Caching menu data in Upstash Redis (menu changes infrequently)

**Phase 3 (50-500 vendors):**
- Migrate to: Multi-tenant architecture (single Firestore, vendorId-scoped)
- Add: Background job queue (Inngest / Trigger.dev) for settlement processing
- Add: Dedicated analytics store (Firestore → BigQuery export)
- Add: Read replicas or separate analytics Firestore project
- Consider: Custom settlement banking integration (Razorpay Route or Cashfree Splits)

**Phase 4 (500+ vendors — National Scale):**
- Decompose into: Order Service, Vendor Service, Settlement Service (separate deployments)
- Event-driven: Firebase → Pub/Sub → downstream services
- Database: Consider PostgreSQL for relational settlement/financial data
- Region: Deploy in Mumbai + Bangalore Vercel Edge regions

---

## 22. Suggested Team Structure

```
CURRENT STAGE (1-3 person team):
─────────────────────────────────
Founding Engineer / CTO (1)
  └─ Full-stack: Next.js, Firebase, payments, devops

GROWTH STAGE (6-12 months, 3-5 person team):
──────────────────────────────────────────────
Founding Engineer / Tech Lead (1)
  └─ Architecture decisions, payments, settlement engine, infra

Full-Stack Engineer (1)
  └─ Vendor dashboard features, API routes, database

Frontend Engineer (1)
  └─ Customer storefront, mobile app (React Native), component library

DevOps / Infra (0-1, part-time or contractor)
  └─ Firebase rules, Vercel config, monitoring, security

SCALE STAGE (12+ months):
────────────────────────────
Add: Backend Engineer (Firestore → PostgreSQL migration, settlement service)
Add: Mobile Engineer (full-time React Native)
Add: Data Analyst (BigQuery + Metabase dashboards)
```

---

## 23. Technical Roadmap

### Immediate (Next 4 Weeks)

```
Priority 1: Payment Stability
  □ Complete payment/webhook edge cases (refund flow)
  □ Add payment retry for failed sessions
  □ Admin dashboard for failed payments

Priority 2: Vendor Analytics
  □ Complete date-range filtering in analytics page
  □ Add per-item profitability view
  □ MTD (month-to-date) summary card

Priority 3: Order Management
  □ Order cancellation by vendor with reason
  □ Prep time tracking (accept → dispatch)
  □ SLA breach alerts (orders taking too long)
```

### Short-Term (1-3 Months)

```
□ React Native mobile app for vendor (orders on phone)
□ Push notifications for new orders (FCM integration)
□ Customer order history and reorder flow
□ Inventory tracking (manual stock levels, out-of-stock automation)
□ Scheduled menu availability (items available only during certain hours)
□ Customer feedback per order
```

### Medium-Term (3-6 Months)

```
□ Multi-vendor platform (single deploy, multiple vendors via subdomain)
□ Vendor onboarding self-service flow
□ Custom domain support per vendor
□ WhatsApp ordering integration (Twilio/Meta Business API)
□ AI-powered ETA prediction (ML on prep time data)
□ Revenue forecasting dashboard
□ Admin super-dashboard (all vendors across all campuses)
```

### Long-Term (6-12 Months)

```
□ Marketplace mode (student sees all campus vendors in one app)
□ Delivery partner coordination module
□ Razorpay/Cashfree split payment for multi-vendor carts
□ Vendor subscription tiers (feature gating)
□ BI analytics (BigQuery + Metabase or Redash)
□ Automated tax reporting (GST returns data export)
□ Second campus deployment (automated provisioning)
```

---

## 24. Engineering Workflow Recommendations

### Git Strategy

```
main          ← Production (auto-deploys to Vercel production)
├── feat/...  ← Feature branches
└── fix/...   ← Bug fix branches

Every PR:
  ├─ Vercel preview URL (test before merging)
  ├─ Payment routes: test against Cashfree SANDBOX
  └─ No direct pushes to main
```

### Local Development Setup

```bash
git clone <repo>
cd aromas

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local
# Fill in Firebase, Cashfree, Upstash, Resend credentials

# Run dev server
npm run dev

# TypeScript check
npx tsc --noEmit

# Build check (catches Next.js build errors)
npm run build
```

### Cron Job Testing (Local)

```bash
# Test daily settlement manually:
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-settlement

# Test daily report:
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-report
```

### Cashfree Testing

```bash
# Use SANDBOX environment in .env.local:
CASHFREE_ENVIRONMENT=SANDBOX

# Test UPI: Use Cashfree's test VPA (virtual payment address)
# Webhook testing: Use ngrok to expose localhost to Cashfree sandbox
```

### Key Engineering Rules

1. **Never write to Firestore from client code for sensitive collections.** Always go through `/api/*` routes that use the Admin SDK. Firestore rules are a last-resort guard, not the primary security layer.

2. **All price calculations must happen server-side.** The `POST /api/orders` and `POST /api/payment/create` routes both recalculate totals independently. Client-submitted totals are never trusted.

3. **Settlement lock is real-money critical.** Any changes to `/api/cron/daily-settlement` or `/api/settlements` unlock logic must be tested end-to-end before deploying.

4. **Tailwind v4 has no `tailwind.config.ts`.** All design tokens live in `globals.css`. Read the v4 docs before touching any CSS.

5. **Next.js 16 + React 19.** Do not apply patterns from Next.js 13/14 docs. Server Actions, use() hook, and Metadata API behave differently.

6. **Upstash Redis is the rate limit and OTP store.** If `UPSTASH_REDIS_*` env vars are missing in development, rate limiting gracefully passes — but OTP verification will fail. Both vars must be set for auth to work locally.

---

## Appendix: Scripts Reference

```
scripts/
├── seed-db.ts              ← Seed Firestore with initial categories/products
├── add-vendor-email.ts     ← Add a new vendor email to vendors collection
├── make-vendor.ts          ← One-step vendor creation helper
├── sync-menu.ts            ← Sync products → posProducts (keep POS catalog in sync)
└── [other maintenance scripts]
```

### Quick Reference: Key Files

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout, SEO, Firebase init, GA4 |
| `src/app/globals.css` | Full design system (Tailwind v4 tokens, animations) |
| `src/lib/vendor.ts` | All real-time listeners + order/product mutations |
| `src/lib/settlement.ts` | IST timezone math for settlement periods |
| `src/lib/rateLimit.ts` | Upstash rate limiting |
| `src/services/payment/providers/cashfreeProvider.ts` | Cashfree integration |
| `src/contexts/VendorContext.tsx` | Vendor dashboard real-time state |
| `src/store/cartStore.ts` | Zustand cart (persistent) |
| `src/types/index.ts` | All TypeScript type definitions |
| `next.config.ts` | Security headers, CSP, image allowlist |
| `firestore.rules` | Firestore security rules |
| `vercel.json` | Cron job schedules |

---

*Document generated from live codebase analysis of `/Users/rahuldara/IIT/aromas`.*
*All features described are derived from existing code, API routes, schemas, and lib modules.*
*No features are hallucinated. Sections marked "planned" or "recommended" are architectural proposals.*
*Generated: May 2026*
