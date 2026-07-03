@AGENTS.md

# TallyPunk — guide for Claude Code

> ⚠️ This repo runs a non-standard Next.js (see AGENTS.md above). Check `node_modules/next/dist/docs/` before writing framework code.

TallyPunk is an equity / cap-table / option-pool / vesting tracker — a simpler, less-buggy alternative to Ledgy & Carta. Solo founder (Mate, Madrid); freemium. One Next.js project serves both the marketing site and the product app.

This project is built in a **hybrid workflow**: fast UI iteration happens in Claude "cowork" mode; backend work, builds/tests, and commits happen here in Claude Code. Keep the two in sync through this file + `docs/`.

## Read first
- **`docs/TallyPunk-Handoff.md` — READ THIS FIRST.** Session handoff & onboarding: current built-vs-pending state, the non-obvious quirks (CSS caching, `.app` scoping, mount staleness, commit flow), the vesting-chart tuning constants, open decisions, and a start-of-session checklist. Points out what to **re-validate against the code**.
- `docs/TallyPunk-Requirements-Tracker.md` — the living, numbered requirements list (e.g. POOL-03, STK-04, GBL-08). **Single source of truth for scope** — every decision is captured here; add to it when scope changes. NOTE: canonical copy lives in Drive (`E:\GOOGLE DRIVE STORE\Claude\tallypunk\`); the repo copy is a sync — re-sync before Claude Code work.
- `docs/TallyPunk-Tech-and-Hosting-Primer.md` — stack / security / hosting rationale + a plain-English glossary.
- `docs/TallyPunk-Build-Plan.md` — build order + getting-started runbook.
- `docs/TallyPunk-Smoke-Checklist.md` — the manual regression checklist. Run the relevant part before each commit; add a line for every new flow.

## Stack
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 (`@import "tailwindcss"`). Planned backend: Postgres via Prisma; managed hosting (Vercel/Render — "Option A"); auth TBD. No Docker required.

## What exists (updated Jul 2026 — see docs/TallyPunk-Handoff.md for detail)
- Branded **landing page** (`app/page.tsx`).
- No-signup browser **sandbox** under `app/(app)/` — `/dashboard`, `/pools`, `/companies`, `/stakeholders`, `/grants`, plus placeholders.
- **Pools**, **Companies**, **Stakeholders** modules: create / view / edit, per-object **History** logs, company↔pool linking, power-list columns.
- **Stakeholders** sub-section: ribbon (List · Profile · Grants · Vesting · History/Audit · Reports) as nested routes under `stakeholders/[id]/`, persistent left Roster list, sequential display IDs.
- **Grants** (`grants/`): `GrantDialog` (typeable pickers, inline create-pool, capacity guard) + the **step-function vesting engine** (`vesting.ts`) + a rich interactive **VestingChart.tsx** (multi-series, sandchart, gutter markers, drag/box zoom, hover tags).

## Not built yet (likely your work)
**Terminate vesting (GRANT-16), Pause (GRANT-17), stakeholder rollup (GRANT-18), rate-change (GRANT-14); Delete cascade (GBL-09) + General Pool (POOL-09); Trash (GBL-03, future).** Then smaller items (GRANT-09/11/15, STK-05, POOL-07/08) and the backend phase: real DB (swap localStorage → Prisma/Postgres behind the data-layer seam), auth (SEC-01), CSV import/export. **Read the Handoff + Tracker before starting** — the vesting model was rebuilt to a step function and the terminate/pause/delete rules are fully specced.

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
