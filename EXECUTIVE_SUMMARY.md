# ZERO BROKER — Executive Summary
### IDE303 Software Engineering Startup · CST Bhutan · 2026

---

## The Problem

Bhutan has no formal digital marketplace for real estate. Property buyers and sellers rely on informal brokers who charge **1–3% commission** on every transaction — Nu. 80,000 to Nu. 2.4 lakh on an average property — simply for making an introduction. There is no way to verify a seller's identity, no central record of listings, and property fraud is common. Rural sellers are particularly exploited, with limited access to buyers outside their immediate geography.

---

## The Solution

**Zero Broker** is Bhutan's first centralised, broker-free property marketplace. It connects sellers directly with verified buyers across all 20 Dzongkhags, with identity verification, admin moderation, and an on-platform deal confirmation system that removes the need for a broker while preserving — and improving — the trust and safety a broker was supposed to provide.

**Zero Broker is a free, non-commercial public service. No fees. No commissions. No subscriptions. Ever.**

**Core principle:** We removed the broker. Not the safety.

---

## What We Built

A fully deployed, live web platform with:

| Feature | Description |
|---|---|
| CID Identity Verification | Sellers upload Citizen Identity Document; admin-verified before listing |
| Admin Moderation | Every listing reviewed before going live; rejection reasons sent to seller |
| Listing Lifecycle Engine | Formal state machine: draft → pending → approved → enquiring → negotiating → sold |
| Structured Offer System | Buyers attach a price offer alongside their enquiry — not just a text message |
| Zero Broker Trust Layer | Sidebar panel on every listing showing exactly what was verified |
| Real-time Chat | On-platform messaging between buyer and seller after enquiry is accepted |
| Dual Deal Confirmation | Both parties confirm on-platform before deal closes — creating a record |
| Document Verification | Ownership certificates, tax clearances, land thram uploaded and admin-reviewed |
| Fraud Reporting | Any user can flag a suspicious listing; admin resolves |
| Interactive Map | Leaflet map with per-property pins across all Dzongkhags |
| EMI Calculator | Built-in calculator with BNB (9%), BDBL (8.5%), BOBL (9.5%) reference rates |
| Automated Test Suite | 28 passing unit tests for the state machine and business logic |

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Supabase (PostgreSQL + Auth + Realtime + Storage) · Leaflet · Vercel (CI/CD)

---

## Who Benefits and How

| Beneficiary | Benefit |
|---|---|
| **Ordinary sellers** | List a property for free, reach buyers across the whole country, not just their Dzongkhag |
| **Rural sellers** | Equal access to the national market without needing a Thimphu broker contact |
| **Buyers** | Search all 20 Dzongkhags in one place, see verified listings only, pay no broker fee |
| **Society** | Less fraud, transparent pricing, reduced exploitation of less-educated sellers |
| **Government** | First structured digital record of property transactions in Bhutan |

---

## Market Alignment — Why Bhutan Needs This Now

- No existing digital property marketplace in Bhutan — the gap is real and unaddressed
- Thimphu property values growing 8–12% annually — high stakes make trust critical
- Gelephu Mindfulness City development will create new demand across multiple Dzongkhags
- 67% smartphone penetration among urban youth (2024) — the audience is ready
- Government's **Digital Drukyul** initiative aligns with digital public infrastructure

---

## Sustainability — How It Stays Free

Zero Broker is not a business. It is a **public good**, sustained the same way Bhutan's public services are — through institutional support, not user fees.

### Operating Cost Reality
| Item | Cost |
|---|---|
| Vercel hosting (current) | Free tier — sufficient for MVP |
| Supabase database | Free tier — 500 MB, supports thousands of listings |
| Domain (.bt) | ~Nu. 1,500/year |
| **Total current cost** | **Near zero** |

As the platform grows, three non-commercial sustainability paths exist:

**1. CST / University Ownership**
Maintained as a student-built public infrastructure project by the College of Science and Technology. Operational costs (~Nu. 15,000–30,000/year at scale) are institutional overhead, not a revenue requirement.

**2. Ministry of Information and Communications (MoICE)**
Adoption as part of Bhutan's **e-Government** digital services portfolio — the same model used for the Online Service Delivery Portal, eDruk, and similar initiatives. Zero fee to citizens, funded from the digital services budget.

**3. National Land Commission (NLC) Integration**
Partnership with the NLC to integrate thram (land ownership) records directly into listing verification. The platform becomes part of the official property transaction infrastructure. Operational costs absorbed by the NLC as part of land administration.

### Why It Does Not Need Revenue
The platform removes cost from the system rather than adding a new cost. Every transaction that goes through Zero Broker instead of a broker saves the parties Nu. 80,000–2,40,000. The social return vastly exceeds the server cost. This is the same logic as a public library — it does not need to charge per book to justify its existence.

---

## Individual Idea Summary

**Zero Broker** was conceived as a response to a personally observed market failure: every property transaction in Bhutan goes through a broker who adds cost but not proportional value. The core insight is that the broker's three jobs — identity verification, document verification, and connecting parties — can all be replaced by software, while the fourth job — taking a commission — should simply be eliminated.

The platform is designed to be permanently free. Its value is not measured in revenue but in the savings it creates for ordinary Bhutanese citizens, the fraud it prevents, and the financial access it extends to rural sellers who would otherwise have no reach beyond their village. The name is both the product promise and the mission: **zero brokers, zero commission, full trust.**

---

*Submitted for IDE303 · Final MVP Review · College of Science and Technology, Bhutan*
