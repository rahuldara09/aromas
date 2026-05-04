# Aromas: Business & Product Document

## 1. Business Overview

**What the business is**
Aromas is a modern, high-performance commerce and ordering platform designed specifically for college campuses, hostels, and localized vendor ecosystems. It bridges the gap between students/customers and local food vendors by providing a seamless, end-to-end digital ordering, payment, and kitchen management system.

**Problem we are solving**
- **Long Queues & Wait Times:** Students and campus residents waste significant time waiting in lines during peak hours.
- **Operational Inefficiency for Vendors:** Local vendors lack modern tools to handle high-density order volumes, leading to missed orders, manual errors, and poor kitchen synchronization.
- **Fragmented Payment & Ordering:** Traditional campus setups rely on cash or disparate UPI codes, lacking a unified POS and online ordering experience.

**Target users**
- **Customers (Students/Campus Residents):** Tech-savvy users living in hostels who demand fast, transparent, and easy food ordering (delivery or takeaway).
- **Vendors (Kitchens/Canteens):** Local food operators needing robust, high-speed tools (POS, Kitchen Display Systems, printed KOTs) to manage complex operations smoothly.

**Why this product matters**
Aromas digitizes micro-economies. By providing enterprise-grade SaaS tools (typically reserved for large restaurant chains) to local campus canteens, we empower small vendors to scale their operations while giving students an unparalleled, frictionless dining experience.

---

## 2. Product Vision

**Long-term vision**
To become the defacto digital infrastructure for closed-loop, hyper-local economies (campuses, tech parks, food courts), powering everything from discovery and ordering to kitchen operations and automated payouts.

**What success looks like**
- 90%+ campus adoption rate.
- Zero manual order-taking for partnered vendors.
- Seamless order fulfillment with precise ETA predictions, dropping wait times by 50%.

**Key differentiators**
- **Hybrid POS + Online Ordering:** Works seamlessly for both walk-in customers (via POS) and online app users.
- **Hardware Integrated:** Direct integration with receipt printers (QZ Tray) for Kitchen Order Tickets (KOTs).
- **Hostel-Centric Delivery:** Optimized for unique environments (custom Address models handling Hostel Number, Room Number).
- **High-Density UI:** Vendor portals built with a POS-inspired, dark-mode aesthetic designed for fast-paced commercial kitchens.

---

## 3. Core Features Breakdown

### Vendor System (Portal)
- **Purpose:** A centralized command center for canteens to manage their entire operation.
- **How it works:** A secure Next.js web portal with dark-mode, POS-style high-density design.
- **User Flow:** Vendor logs in -> Views live dashboard of daily metrics -> Accesses orders, menu, or POS via sidebar navigation.

### Orders System (POS & Online)
- **Purpose:** To capture, track, and process every transaction.
- **How it works:** Real-time sync via Firebase. Handles both online orders and in-person walk-ins. Supports complex lifecycle statuses (`Pending`, `Preparing`, `Dispatched`, `Completed`).
- **User Flow:** Order arrives -> Triggers real-time alert & kitchen print -> Vendor accepts (moves to Preparing) -> Order marked ready/dispatched.

### Menu Management
- **Purpose:** Allow vendors to dynamically control their offerings.
- **How it works:** CRUD interface for categories and products. Supports toggling `isAvailable` for immediate out-of-stock actions.
- **User Flow:** Vendor opens Menu tab -> Edits item price/availability -> Instantly updates the customer-facing frontend.

### Kitchen / Operations
- **Purpose:** Streamline food preparation.
- **How it works:** Integration with QZ Tray for automated ticket printing. Kitchen display systems (KDS) for cooks to see what needs to be made.
- **User Flow:** Order is accepted -> KOT is automatically printed in the kitchen -> Cook prepares food based on ticket -> Order is marked done.

### Analytics
- **Purpose:** Provide actionable business intelligence.
- **How it works:** Aggregates Firebase data to show total revenue, order volume, peak hours, and top-selling items using Recharts.
- **User Flow:** Vendor clicks Analytics -> Views visually rich charts -> Makes data-driven inventory decisions.

### Customer Frontend (Menu, Checkout, Account)
- **Purpose:** The storefront for students.
- **How it works:** Mobile-first, responsive web app. Features cart state management via Zustand, payments via Cashfree, and address management.
- **User Flow:** User logs in -> Browses Categories -> Adds to Cart -> Selects Delivery/Takeaway & Hostel Details -> Pays via Cashfree -> Tracks Order ETA.

---

## 4. System Architecture (High-Level)

**Frontend Structure (Next.js 15+ App Router)**
- `src/app/`: Split routing for customer (`/menu`, `/order`, `/checkout`) and vendor (`/vendor/orders`, `/vendor/kitchen`, `/vendor/analytics`).
- `src/components/`: Reusable UI elements built with TailwindCSS v4, Framer Motion, and Lucide React.
- `src/store/`: Zustand stores for global state (e.g., Cart, User Session).

**Backend Logic (Serverless & Firebase)**
- **APIs (`src/app/api/`):** Next.js API routes handling Auth, Payments (`/payment`), Cron jobs, and super-admin controls.
- **Services/Middlewares:** Upstash Redis for rate-limiting. Next.js Middleware for route protection and role-based access.

**Database Design (Firebase Firestore)**
- **Users:** Profiles, saved addresses (Hostel/Room configurations).
- **Vendors:** Store info, settings, POS configurations.
- **Products & Categories:** Menu hierarchies with active/inactive flags.
- **Orders:** Deep entities holding items, financial breakdowns (item total, Dukan fee, delivery fee), timestamps, and payment statuses.

**Integrations**
- **Cashfree PG:** Primary payment gateway for seamless UPI/Card transactions.
- **QZ Tray:** Local hardware integration for automated KOT & Receipt printing.
- **Resend:** Transactional email delivery for order receipts and alerts.

---

## 5. Execution Flow (Real-World Step-by-Step)

**How a Vendor Joins:**
1. Aromas admin provisions a vendor account in Firestore.
2. Vendor logs into the highly dense, dark-themed POS portal.
3. Vendor sets up their menu categories, items, and hardware printer via `settings`.

**How a Customer Places an Order:**
1. Student opens the web app, browses the digital menu.
2. Adds items to the cart and proceeds to checkout.
3. Selects "Delivery to Hostel X, Room Y" or "Takeaway".
4. Completes payment via Cashfree UPI.

**How the Order Flows & Kitchen Processes It:**
1. Firebase real-time listeners trigger an alert on the Vendor's order screen.
2. The system auto-prints a KOT via QZ Tray in the kitchen.
3. The vendor clicks "Accept". The app calculates an ETA (base prep time + queue penalty) and pushes an update to the student.
4. The cook prepares the food based on the printed ticket. Once ready, the vendor clicks "Dispatch/Complete".

**How Analytics are Generated:**
1. Upon order completion, revenue and item counts are finalized in Firestore.
2. The Vendor's analytics page pulls this data, using Next.js client hooks to feed Recharts visualizations for daily, weekly, and monthly performance.

---

## 6. Folder & Code Structure Explanation

- `/app/vendor`: The closed-loop vendor POS and management dashboard. Contains sub-routes for `/orders`, `/analytics`, `/menu`, and `/kitchen`. Kept separate for strict role-based access and specific layout needs (high-density, operational focus).
- `/app/api`: Server-side API endpoints. Essential for securely communicating with Cashfree webhooks, Firebase Admin, and sending emails via Resend.
- `/src/components`: Modular UI building blocks. Divided into vendor components (heavy, POS-style tables/modals) and customer components (mobile-friendly, sleek cards).
- `/src/types`: TypeScript definitions (`index.ts`) ensuring strict data contracts across the app (e.g., `Order`, `Product`, `UserAddress`).
- `/src/store`: Zustand hooks for managing client-side state without prop-drilling, critical for the shopping cart and checkout flows.

---

## 7. Scalability Plan

**How the system can scale:**
- **Serverless Edge:** Next.js and Vercel handle traffic spikes seamlessly during campus rush hours.
- **Database:** Firebase Firestore scales horizontally to handle concurrent reads/writes. Rate limiting via Upstash protects API endpoints.

**Future Expansion (Multi-Vendor / Multi-City):**
- **Current State:** The architecture already supports multiple vendors (via vendor IDs attached to products/orders).
- **Phase 2 Expansion:** Introduce a hyper-local discovery feed where a user first selects their campus/city, then sees available canteens.
- **Logistics:** Integrate third-party delivery APIs (e.g., Dunzo/Shadowfax) or a dedicated internal rider app module for multi-campus expansion.

---

## 8. UI/UX Philosophy

**The Experience:**
- **Customer Frontend:** Sleek, consumer-grade, and frictionless. Emphasis on appetizing imagery, fast load times (Framer Motion micro-interactions), and a vibrant, modern layout tailored for Gen-Z.
- **Vendor Portal:** Designed like a professional software tool. High-density data views, dark-mode with cyan/indigo accents for low eye strain in bright kitchens, and large touch targets for rapid POS operation.

**Simplicity vs. Power:**
The customer app prioritizes *simplicity* (2-click checkout flow). The vendor app prioritizes *power* (robust order filtering, sliding timers for destructive actions, real-time syncing).

---

## 9. Business Model

**How Money is Made:**
- **Platform Fee (Dukan Fee):** A small convenience fee charged directly to the customer on every order.
- **Commission:** A negotiated percentage of the order value charged to the vendor for generating demand.
- **SaaS Subscription (Optional):** A flat monthly fee charged to vendors for using the POS, Kitchen display, and hardware printing features, regardless of online orders.

**Vendor Value Proposition:**
"Stop losing money to missed orders and long queues. We digitize your entire operation, give you a modern POS, and open up an online revenue stream for your campus—all without you buying expensive hardware upfront."

---

## 10. Future Roadmap

**Phase 1 (Current - MVP & Core):**
- Robust online ordering, Cashfree payments integration, real-time Firebase syncing, and basic POS & KOT printing via QZ Tray.

**Phase 2 (Growth & Refinement):**
- Robust inventory management (ingredient-level tracking).
- Loyalty programs & student wallets (pre-paid meal cards).
- Advanced analytics (predictive ordering, AI-driven stock alerts based on historical campus events).

**Phase 3 (Advanced Ideas):**
- Dedicated Rider App for cross-campus deliveries.
- AI voice ordering for walk-ins.
- Expansion to corporate tech parks using the exact same hyper-local micro-economy model.
