# Zero Broker

**Bhutan's first verified, broker-free real estate marketplace.**

Zero Broker connects property sellers directly with buyers across all 20 Dzongkhags — with verified identities, admin-moderated listings, fraud prevention, and an end-to-end deal flow built in.

> IDE303 Software Engineering Startup — College of Science and Technology, Bhutan (2026)

---

## Problem

Bhutan has no centralised property marketplace. Buyers rely on word-of-mouth and informal brokers who charge 1–3% commission on every transaction. Fraud, misrepresentation, and duplicate listings are common, and there is no transparency around pricing or seller identity.

## Solution

Zero Broker eliminates the broker entirely. Sellers list directly, identities are verified through CID documents, listings pass admin review before going live, and all enquiries and negotiations happen on-platform with a dual-confirmation deal system.

---

## Key Features

| Feature | Details |
|---|---|
| **Verified identities** | Sellers upload Citizen Identity Document (CID) front + back; admin verifies before listing approval |
| **Admin moderation** | Every listing starts as a draft → pending → approved/rejected with rejection reasons |
| **Listing lifecycle** | Formal state machine: draft → pending → approved → enquiring → negotiating → sold/archived |
| **Enquiry system** | Buyers send enquiries; sellers accept/decline; both parties negotiate on-platform |
| **Real-time chat** | In-app messaging between buyer and seller once an enquiry is accepted |
| **Dual deal confirmation** | Both buyer and seller must confirm before a listing marks as sold |
| **Document verification** | Ownership certificates, tax clearances, land thrams uploaded and verified per-listing |
| **Fraud reporting** | Any user can flag a listing; admin reviews and resolves reports |
| **Map view** | Interactive map with per-property pins across all Dzongkhags |
| **EMI calculator** | Built-in loan calculator on every listing with BNB/BDBL/BOBL indicative rates |
| **Duplicate detection** | Admin panel automatically flags listings with similar titles, types, and prices |
| **Notifications** | Real-time notifications for enquiries, status changes, messages, and deal confirmations |
| **Saved listings** | Buyers can bookmark properties for later |
| **Bhutan-localised** | All 20 Dzongkhags, Nu. pricing displayed in Lakh/Crore format |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, custom CSS variables |
| Backend / Auth | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| Map | Leaflet.js + React Leaflet (OpenStreetMap tiles) |
| Deployment | Vercel (CI/CD via GitHub integration) |
| Icons | Lucide React |
| Notifications | React Hot Toast |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 16 (Vercel)                   │
│                                                          │
│   app/                   lib/                            │
│   ├── page.tsx (home)    ├── types.ts (domain types)     │
│   ├── listings/          ├── listing-lifecycle.ts        │
│   │   ├── page.tsx       │   └── state machine           │
│   │   ├── [id]/          └── supabase/                   │
│   │   │   ├── page.tsx       ├── client.ts               │
│   │   │   └── edit/          └── server.ts               │
│   │   └── new/                                           │
│   ├── dashboard/         components/                     │
│   ├── admin/             ├── ListingCard.tsx             │
│   ├── map/               ├── Navbar.tsx                  │
│   └── api/               ├── VerificationBadge.tsx       │
│       └── listings/      └── ListingProgressBar.tsx      │
│           └── [id]/status/                               │
└────────────────────────┬────────────────────────────────┘
                         │ Supabase SDK
┌────────────────────────▼────────────────────────────────┐
│                      Supabase                            │
│                                                          │
│   PostgreSQL          Auth           Storage             │
│   ├── profiles        ├── Email      ├── listing-images  │
│   ├── listings        └── Sessions  ├── listing-documents│
│   ├── enquiries                     └── cid-documents    │
│   ├── messages        Realtime                           │
│   ├── notifications   ├── listings                       │
│   ├── listing_documents├── enquiries                     │
│   ├── listing_reports └── notifications                  │
│   └── saved_listings                                     │
│                                                          │
│   Row Level Security on ALL tables                       │
│   DB triggers for state management                       │
└─────────────────────────────────────────────────────────┘
```

---

## Listing Lifecycle (State Machine)

```
        [Seller]               [Admin]           [Enquiry triggers]
  draft ──────────► pending ──────────► approved ──────────► enquiring
    ▲                  │                    │                     │
    │                  │ rejected           │ [enquiry accepted]  │
    │ [restore]        ▼                    ▼                     ▼
  archived ◄──── rejected            negotiating ◄──────── (accepted)
    ▲                                      │
    │                                      │ [both confirm deal]
    │                                      ▼
    └──────────────────────────────────── sold
```

State transitions are enforced in [`lib/listing-lifecycle.ts`](lib/listing-lifecycle.ts) and validated server-side in [`app/api/listings/[id]/status/route.ts`](app/api/listings/%5Bid%5D/status/route.ts) before any DB write.

---

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | User accounts with role (`buyer`/`seller`/`admin`), CID verification status |
| `listings` | Property listings with full lifecycle state, GPS coordinates, images |
| `enquiries` | Buyer → Seller interest with accept/decline/negotiate/confirm flow |
| `messages` | Chat messages scoped to an enquiry |
| `listing_documents` | Ownership certs, tax clearances uploaded per listing |
| `listing_reports` | Fraud/duplicate reports submitted by users, reviewed by admin |
| `notifications` | In-app notifications (enquiry, status_change, message, deal) |
| `saved_listings` | Bookmarked listings per buyer |

Row Level Security is enabled on every table. See [`supabase-schema.sql`](supabase-schema.sql) for the full schema, RLS policies, and database triggers.

---

## Quick Start

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/your-username/ZEROBROKER.git
cd ZEROBROKER
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in your Supabase project URL and anon key (see [Environment Variables](#environment-variables) below).

### 3. Set up the database

Open your Supabase project → **SQL Editor** → paste and run the entire contents of [`supabase-schema.sql`](supabase-schema.sql).

This creates all tables, RLS policies, triggers, storage buckets, and seeds 6 sample listings.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Create an admin account

1. Register a new account at `/auth/register`
2. In Supabase **Table Editor** → `profiles` → find your row → set `role` to `admin`
3. Log out and back in — you now have access to `/admin`

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

Copy `.env.example` to `.env.local` and fill both values. Both are found in your Supabase project under **Settings → API**.

---

## Running Tests

```bash
npm test
```

Tests cover the core state machine (`lib/listing-lifecycle.ts`) and price formatting (`lib/types.ts`) — the two utility modules with the most critical business logic.

---

## Deployment

The project is deployed on **Vercel** with automatic deployments on every push to `main`.

```bash
# Preview deploy
npx vercel

# Production deploy
npx vercel --prod
```

Environment variables are managed in the Vercel dashboard under **Settings → Environment Variables**.

---

## User Roles

| Role | Permissions |
|---|---|
| `buyer` | Browse listings, send enquiries, save listings, confirm deals |
| `seller` | All buyer permissions + create/manage listings, upload documents, receive enquiries |
| `admin` | All permissions + approve/reject listings, verify documents, manage fraud reports |

---

## Project Structure

```
ZEROBROKER/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Homepage (hero, featured, recent, how-it-works)
│   ├── listings/           # Browse, detail, new, edit
│   ├── dashboard/          # Role-aware user dashboard
│   ├── admin/              # Admin panel (listings, reports, users)
│   ├── map/                # Interactive property map
│   ├── auth/               # Login and register
│   └── api/listings/       # Server-side status transition API
├── components/             # Shared UI components
├── lib/
│   ├── types.ts            # All TypeScript types, constants, formatPrice
│   ├── listing-lifecycle.ts# State machine: transitions, guards, helpers
│   └── supabase/           # Supabase client (browser + server)
├── __tests__/              # Unit tests for utility modules
├── supabase-schema.sql     # Complete DB schema, RLS, triggers, seed data
├── middleware.ts           # Auth + role guard for protected routes
└── .env.example            # Required environment variable template
```

---

## Team

**IDE303 — Software Engineering Startup**
College of Science and Technology (CST), Royal University of Bhutan
