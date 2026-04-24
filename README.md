# Innovena Platform

Multi-tenant SaaS for comparing and booking digital services — web, AI,
marketing, app development, and consultants. Runs at `platform.innovena.no`;
the existing `innovena.no` site remains the marketing/lead-magnet front end.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Supabase** — Postgres, Auth, Storage, Realtime (EU region for GDPR)
- **Stripe** — Subscriptions + invoicing (990 kr/mnd lead plan, marketing packages, contract payments)
- **Resend** — transactional email
- **Tailwind CSS 4** + custom shadcn-style components
- **dnd-kit** — CRM Kanban (wired in fase 3)

## Phase 1 scope (what's built)

- Auth (email/password) with role selection: `customer` / `agency` / `solo_consultant`
- Multi-tenant data model with RLS: tenants, memberships, user roles
- Service categories seeded from Innovena's real list
- Customer dashboard: **AI-powered 5-step wizard** at `/kunde/prosjekter/ny` that categorizes free text, enriches URLs, suggests scope, estimates budget, and generates a polished brief. Falls back to a manual flow if `ANTHROPIC_API_KEY` isn't set.
- Agency/solo dashboard: leads inbox, CRM pipeline (read-only Kanban), consultants list, subscription shell, marketing packages shell
- **Invoice + payment link flow**: agencies create invoices for their leads, generate Stripe Checkout payment links with a transparent 2.5% platform fee, customers pay directly in-platform, Stripe webhook marks invoice paid.
- Admin dashboard: approve/suspend/reject tenants, review categories
- Consultant marketplace placeholder at `/konsulenter`
- Automatic lead distribution: new projects fan out to up to 5 matching active tenants, each getting a pipeline card in their first stage
- Stripe / Resend / Anthropic abstracted behind env checks — calls fail cleanly if not configured

## Local setup

### 1. Create the Supabase project

Create a project in the EU region (Stockholm or Frankfurt). Then:

1. In **Authentication → Providers**, ensure Email is enabled.
2. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/api/auth/callback` to Redirect URLs.
3. In **SQL Editor**, run the three migration files in order:
   - `supabase/migrations/20260423000001_initial_schema.sql`
   - `supabase/migrations/20260423000002_rls_policies.sql`
   - `supabase/migrations/20260423000003_seed_categories.sql`

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

**Optional for phase 1 but strongly recommended:**

- `ANTHROPIC_API_KEY` — unlocks the AI wizard (URL enrichment, scope suggestion, budget estimation, brief generation). Uses `claude-haiku-4-5` for fast ops and `claude-sonnet-4-6` for the final brief. Without it, the wizard falls back to a manual form.
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — enables payment link creation on invoices and webhook-driven payment confirmation.

Resend keys can stay empty until transactional email is wired up.

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Create the first admin

Sign up at `/registrer` as a `kunde` with your own email, then promote yourself:

```bash
npx tsx scripts/bootstrap-admin.ts jf@snakk.ai
```

Refresh — you now have access to `/admin`, where you can approve the first
test agencies so they can start receiving leads.

## Planned phases

| Phase | Scope |
| --- | --- |
| **1 (now)** | Auth, tenants, dashboards, lead distribution skeleton |
| 2 | Bid submission, accept/sign flow, contract PDF, customer bid review |
| 3 | Realtime messaging, functional Kanban drag-and-drop, notifications |
| 4 | Stripe 990 kr/mnd subscriptions, marketing packages, invoice payments with optional 2.5% platform fee |
| 5 | Consultant marketplace with filtering, availability, booking |
| 6 | Admin analytics, Google Ads / Meta lead ingestion, category admin UI |

## Architecture notes

- **Tenant isolation** is enforced by Postgres RLS, not by application filters. See `supabase/migrations/20260423000002_rls_policies.sql`. Think carefully before using `src/lib/supabase/admin.ts` (service role) — it bypasses RLS and is only for privileged server-side operations like lead distribution across tenants.
- **Roles vs. memberships**: `user_roles` is the global set of hats a user can wear (`customer`, `agency_member`, `consultant`, `admin`). `tenant_members` is scoped — which user belongs to which tenant. A solo consultant is the single owner of their own tenant.
- **Lead distribution** happens in `src/app/api/projects/route.ts` after a project is created: matching active tenants get a `project_lead` row plus a pipeline card in their first stage. The hard cap of 5 will become configurable per category in phase 6.
- **AI wizard**: `src/lib/ai/` holds the Anthropic client, the frozen cached system prompt (22 categories + price calibration), and typed operations. Each operation uses structured outputs via Zod schemas — `messages.parse()` validates the response. Haiku 4.5 powers fast ops (categorize, enrich URL, suggest scope, estimate budget); Sonnet 4.6 generates the final brief. The system prompt is stable, so prompt caching kicks in after the first request per 5-minute window — check `usage.cache_read_input_tokens` in logs to verify.
- **Payments abstraction**: Stripe Checkout Sessions (via `src/lib/stripe/payments.ts`) creates hosted payment pages. The platform fee is added as a transparent "Servicegebyr" line item; funds flow into Innovena's account for now, pay-out to agencies handled manually until Stripe Connect is wired up. All call sites guard on `STRIPE_SECRET_KEY` so the UI degrades cleanly when not configured.
- **Wizard state** persists to `localStorage` (`innovena-wizard-v1`) so users can close the tab and resume. Cleared on successful publish.

## Conventions

- URLs are Norwegian: `/kunde`, `/byraa`, `/konsulenter`, `/admin`, `/logg-inn`, `/registrer`. Language is `nb-NO`; i18n infrastructure will be added when English support is needed.
- All authenticated routes use `export const dynamic = "force-dynamic"` because they depend on cookies — do not attempt to cache them.
- Server actions live alongside the page that uses them (`actions.ts`); API routes under `src/app/api/*` handle mutations shared across pages.

## What to verify before going live

- [ ] Supabase project is in EU region
- [ ] RLS is enabled on every table (check `pg_class.relrowsecurity`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only used server-side, never exposed to browser bundle
- [ ] Stripe webhook endpoint is registered: `/api/webhooks/stripe` (phase 4)
- [ ] Resend domain is verified before sending production email
- [ ] DNS: CNAME `platform.innovena.no` to Vercel deployment
