@AGENTS.md

# TallyPunk — guide for Claude Code

> ⚠️ This repo runs a non-standard Next.js (see AGENTS.md above). Check `node_modules/next/dist/docs/` before writing framework code.

TallyPunk is an equity / cap-table / option-pool / vesting tracker — a simpler, less-buggy alternative to Ledgy & Carta. Solo founder (Mate, Madrid); freemium. One Next.js project serves both the marketing site and the product app.

This project is built in a **hybrid workflow**: fast UI iteration happens in Claude "cowork" mode; backend work, builds/tests, and commits happen here in Claude Code. Keep the two in sync through this file + `docs/`.

## Read first
- `docs/TallyPunk-Requirements-Tracker.md` — the living, numbered requirements list (e.g. POOL-03, STK-04, GBL-08). **Single source of truth for scope** — every decision is captured here; add to it when scope changes.
- `docs/TallyPunk-Tech-and-Hosting-Primer.md` — stack / security / hosting rationale + a plain-English glossary.
- `docs/TallyPunk-Build-Plan.md` — build order + getting-started runbook.
- `docs/TallyPunk-Smoke-Checklist.md` — the manual regression checklist. Run the relevant part before each commit; add a line for every new flow.

## Stack
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 (`@import "tailwindcss"`). Planned backend: Postgres via Prisma; managed hosting (Vercel/Render — "Option A"); auth TBD. No Docker required.

## What exists (Jun 2026)
- Branded **landing page** (`app/page.tsx`) from the brand mockup.
- A no-signup browser **sandbox** product under `app/(app)/` — `/dashboard`, `/pools`, `/companies`, `/stakeholders`, plus placeholder routes.
- **Pools**, **Companies**, **Stakeholders** modules: create / view / edit, per-object **History** logs, company↔pool linking.
- **Stakeholders** is a sub-section: a ribbon (List · Detail · Grants · Vesting · History) with full-page nested routes under `app/(app)/stakeholders/[id]/`, a persistent scrollable left name-list (sort by first/surname, wrap-around Back/Next), configurable + sortable columns, and sequential display IDs.

## Not built yet (the backend phase — likely your work)
Grants, vesting math, Trash/soft-delete (GBL-03), CSV Import/Export, auth (SEC-01), and the **real database** (swap localStorage → Prisma/Postgres behind the existing data-layer seam). Next feature up is **Grants** (GRANT-01..04; field shortlist: stakeholder, optional pool, quantity, grant date, vesting schedule, strike price — totals are derived).

## Architecture & conventions — please follow
- **Swappable data layer (ARCH-01).** ALL app state flows through `app/(app)/SandboxProvider.tsx` — a React context backed by localStorage (key `tallypunk-sandbox-v1`). The UI never touches storage directly. The plan is to swap this `DataSource` for an API→Postgres layer for logged-in users **without rewriting the UI**. Preserve this seam; don't scatter `localStorage`/`fetch` through components.
- **Entity interfaces map 1:1 to future Postgres tables** (Pool, Company, Stakeholder, LogEntry — all in SandboxProvider.tsx). Keep them clean.
- **Audit logging (GBL-02/06/07).** Every create/edit appends a `LogEntry` (CREATE/UPDATE/DELETE + actor + timestamp + before→after summary); a per-object History dialog reads it. New entities log the same way.
- **Display IDs (GBL-08).** Each entity carries a sequential, zero-padded human ID separate from its internal key: Company `01`, Pool `001`, Stakeholder `000001`, Grant `0000001`. Padding is a minimum width, not a cap (…99 → 100 → …); monotonic per entity. Stakeholder is implemented — mirror it.
- **Styling.** One global stylesheet `app/globals.css`, mostly scoped under `.app`. Editorial theme: Fraunces serif + Inter; paper `#f7f3ec`, plum accent `#8a4b6b`, ink `#211d18`. Reuse the CSS variables/classes; avoid inline styles.
- **Modals** (`app/(app)/Modal.tsx`) render via a React portal to `document.body` — so they sit OUTSIDE `.app`; any CSS they rely on must NOT be scoped under `.app` (this has bitten us before).
- Sandbox actor string is `"Sandbox user"`.

## Working rules
- After adding new routes/files, **clean-rebuild**: stop dev → `rm -rf .next` → `npm run dev` (Turbopack caches the route tree).
- **Pre-commit gate: `npm run build` must pass** (types + lint + routes). Then run the relevant smoke-checklist section.
- Repo: GitHub `kenraywilliams/tallypunk`, branch `main`. Owner pushes with a PAT.
- Owner (Mate) codes but isn't a pro dev — explain backend choices plainly, keep it KISS, prefer managed + portable. Don't add heavy infra (no Docker-on-C:).

## Owner communication preferences
BLUF; bullet points; devil's-advocate + a minority view; **CAE** (Claim / Argument / Evidence) when persuading; challenge assumptions with facts; sustainability / cruelty-free lean; don't politicise.

## Commands
- `npm run dev` — local dev (Turbopack)
- `npm run build` — production build / **pre-commit gate**
- `npm run start` — serve the build
