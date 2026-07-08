# TallyPunk — Session Handoff & Onboarding

**Purpose.** This is the *start-here* note for any new session (a fresh cowork/fable session, a new Claude Code session, or Mate himself later). It captures the current state, the non-obvious quirks, and the things that must be **re-validated against the actual code** before trusting them. It was written at the end of a long cowork session (early Jul 2026) that built the Grants + vesting-chart work and specced the terminate/pause/delete features.

> **Golden rule:** the durable truth is in the **files** (this doc, the Requirements Tracker, and the committed code) — not in any model's memory. When in doubt, read the code, don't trust a summary. Several claims below are marked **⟳ REVALIDATE**.

---

## 0 · Do this first (start-of-session checklist)

1. **Read this whole file.**
2. **Read the Requirements Tracker** — the single source of truth for scope, every decision numbered (POOL-xx, GRANT-xx, GBL-xx, STK-xx).
   - **Canonical:** `E:\GOOGLE DRIVE STORE\Claude\tallypunk\TallyPunk-Requirements-Tracker.md` (edited from cowork).
   - **Repo copy:** `docs/TallyPunk-Requirements-Tracker.md` (a *synced copy* — see §7; re-sync before Claude Code work).
3. **Skim** `docs/TallyPunk-Tech-and-Hosting-Primer.md`, `docs/TallyPunk-Build-Plan.md`, `docs/TallyPunk-Smoke-Checklist.md`.
4. **Analyse the code as it stands before changing anything** — at minimum open and read:
   - `app/(app)/SandboxProvider.tsx` — the data layer + all entity interfaces.
   - `app/(app)/grants/vesting.ts` — the pure vesting engine (the model).
   - `app/(app)/grants/VestingChart.tsx` — the chart + **every tuning constant** (§5).
   - `app/(app)/grants/GrantDialog.tsx` — the vesting editor UI.
   - `app/globals.css` — theme variables + the `.app` scoping (see §3).
   - `app/(app)/Modal.tsx` — portal behaviour.
5. **Confirm the build is green** (`npm run build`, in Claude Code — see §3 "mount staleness") *before* you start, so you know any later breakage is yours.
6. **Respect the quirks in §3** (inline styles, clean rebuilds, the data-layer seam).

---

## 1 · What this is

TallyPunk = equity / cap-table / option-pool / **vesting** tracker; a simpler, less-buggy Ledgy/Carta alternative. Solo founder **Mate** (Madrid), freemium. One Next.js 16 project (App Router, Turbopack) · React 19 · TS · Tailwind v4 serves both the marketing landing page and the product.

Right now the product is a **no-signup browser sandbox** (all state in `localStorage`), built behind a **swappable data layer** so it can later become API→Postgres without rewriting the UI.

---

## 2 · Current state — BUILT vs PENDING

### Built (validated against the file tree, Jul 2026)
- **Landing page** (`app/page.tsx`) + rotating preview.
- **App shell** (`app/(app)/`) with viewport lock (header + sub-ribbon fixed, inner panes scroll).
- **Pools**, **Companies**, **Stakeholders** modules (create / view / edit, per-object History via `LogDialog`).
- **Stakeholders sub-section** — ribbon (List · Profile · Grants · Vesting · History/Audit · Reports) as nested routes under `stakeholders/[id]/`; persistent left **Roster** list (sort first/surname, wrap-around Back/Next); power-list columns (sort/show-hide/reorder) via `listview.tsx`.
- **Grants** — `grants/page.tsx` (list) + `grants/GrantDialog.tsx` (create/view/edit) with typeable stakeholder + pool pickers, inline "create pool", pool-capacity guard, and the full vesting editor.
- **Vesting engine** — `grants/vesting.ts`: a true **step function** (see §4).
- **Vesting chart** — `grants/VestingChart.tsx`: multi-series, sandchart/overlaid, cliff+grant markers in a gutter, draggable/zoom axes, box-zoom, hover tags. Feeds from `stakeholders/[id]/vesting/page.tsx`. **This got the most iteration; §5 lists the tuning knobs.**
- **Display IDs (GBL-08)** — Stakeholder is live (`000001`). **⟳ REVALIDATE** whether Company/Pool/Grant IDs are wired yet (grant uses `gid()` in GrantDialog — check the others).
- **Audit logging (GBL-07)** — every create/edit writes a `LogEntry`; per-object History dialog reads it.

### Specced but NOT built (the next work)
- **Terminate vesting** — `GRANT-16`.
- **Pause vesting** — `GRANT-17`.
- **Stakeholder-level terminate/pause rollup** — `GRANT-18`.
- **Rate-change / part-time** — `GRANT-14`.
- **Delete (hard, cascade rules)** — `GBL-09`; **General Pool** catch-all — `POOL-09`; **Trash/soft-delete** is future — `GBL-03`.
- Smaller: `GRANT-09` (%+units split rows), `GRANT-11` (drop "(optional)" on strike), `GRANT-15` (massage the "granted" tag), `STK-05` (extended profile fields), `POOL-07/08` (pool default grant profile + stock value).
- Backend phase: real DB (Prisma/Postgres behind the seam), auth (`SEC-01`), CSV import/export.

### ⟳ REVALIDATE before building
- **Git state** — the last chart work was reportedly committed, but run `git status` / `git log` to confirm there's nothing dangling.
- **Vesting numbers** — the step-model rewrite changed `vestedFraction` app-wide; old sandbox grants created under the *previous* model reinterpret. A clean check = reset the sandbox and recreate a couple of grants.
- **Which display IDs are live** (above).

---

## 3 · Quirks & gotchas (the stuff that bites)

- **CSS caching (Turbopack).** New CSS classes in `globals.css` sometimes don't take effect until a **clean rebuild**: stop dev → `rm -rf .next` → `npm run dev`. Because of this, a lot of critical layout was done with **inline `style={{…}}`** deliberately (e.g. the whole grant modal grid, the chart controls, Modal `maxWidth`). *Don't "clean these up" into classes without testing a clean rebuild* — that's why they're inline.
- **`.app` scoping.** `globals.css` scopes most product styles under `.app` (starts ~line 107). **Modals render via a React portal to `document.body`** (`Modal.tsx`), so they live **outside `.app`** — any CSS a modal relies on must **not** be scoped under `.app`. This has bitten us repeatedly.
- **Mount / sandbox staleness.** In cowork, the bash sandbox sometimes serves **stale or truncated** copies of the host files (phantom tsc errors at last-line+1, wrong line counts). **Do not trust `tsc`/builds run in the cowork bash sandbox.** Validate via the Read tool + rely on **`npm run build` in Claude Code** (or the user's terminal) as the real gate.
- **Commits/pushes.** Committing/pushing from cowork fails (permission wall on `.git`, no git identity). Commits go through **Claude Code / the user's terminal with a PAT**. Occasionally a stale `.git/index.lock` needs `rm -f .git/index.lock`. In Claude Code, make sure the model is **Opus** (`/model`).
- **Commit-paste convention.** This session gives Mate a ready-to-paste commit message after changes; the baseline is **cumulative until he says "committed"** (then it resets). Keep that up.
- **Non-standard Next.js** — CLAUDE.md warns to check `node_modules/next/dist/docs/` before writing framework code.
- **Data-layer seam (ARCH-01).** ALL state flows through `SandboxProvider.tsx` (React context + `localStorage` key `tallypunk-sandbox-v1`). The UI never touches storage directly. Preserve this — don't scatter `localStorage`/`fetch` in components. Sandbox actor string is `"Sandbox user"`. Row-flash timer ≈ 4200 ms.

---

## 4 · The vesting model (so you don't misread the engine)

`grants/vesting.ts` — pure functions. **Rebuilt to a true STEP function** (GRANT-06/08/13):
- **Vesting period = N = the number of schedule rows** (Year 1..N). Fully vested = grant date + N years.
- **The cliff is a GATE *within* the period** (0..N), not extra years. Nothing vests until the cliff date; on that date **everything earned to then vests at once (the "boom")**, then it steps at the chosen frequency. Cliff clamped ≤ period.
- **`generateTranches`** builds discrete `{date, percent}` steps (boom at cliff, then per-frequency increments). **`vestedFraction` = Σ tranche % with date ≤ asOf** — a real staircase, so frequency now actually changes the shape.
- **`defaultVesting()`** = 1-yr cliff, `[25,25,25,25]`, monthly.
- **Not yet implemented:** terminate/pause/rate-change. The agreed architecture is a **transform on the generated tranches** (terminate = drop tranches ≥ date; pause = re-date tranches ≥ start by +duration [decision: *shift the tail*]; rate-change = re-scale). Keep the engine clean; layer events on top. Termination-day rule is **exclusive** (a tranche exactly on the termination date does **not** vest).

---

## 5 · Vesting-chart tuning knobs (for future massaging — GRANT-15 etc.)

All in `grants/VestingChart.tsx` unless noted. These are the dials Mate keeps asking to nudge:

| Concern | Where / value |
|---|---|
| Canvas | `W=760, H=360, padL=60, padR=18, padT=20, padB=60` |
| Marker gutter | `GUT=padT+plotH`; cliff/pen tip `M_APEX=GUT`; cliff base `M_BASE=GUT+12`; cliff label `M_CLETTER=GUT+21`; `PEN_LEN=18`; grant label `M_GLETTER=GUT+31` |
| Pen tilt | `<g transform={`rotate(12 …)`}>` (12° — flip sign/size to re-tilt) |
| Series colours | `COLORS[]` (8-colour plum/gold/teal palette) |
| Min time zoom | `MIN_XW = 14*DAY` (two weeks) |
| Y cap / min | `yCap = totalGranted*3`; `minYW = max(1, totalGranted*0.005)` |
| Default Y headroom | `yMax = totalGranted*1.2` (set in **`stakeholders/[id]/vesting/page.tsx`**) |
| Axis-zoom sensitivity | `Math.pow(2, ±dSvg/(plot*0.6))` — the `0.6` is the feel constant |
| Hover "gravity" | `GRAV_STRONG=5` px for grant/cliff dates, `GRAV_SOFT=2` for terminate/pause/resume (win near-ties only — tuned down from 10 after markers kept stealing the cursor); event rows join the tag within `EVT_NEAR_Y=20` px of the cursor (normal rows `NEAR_Y=14`; 40 grabbed every 0% row near the axis) |
| Marker snap | within `12` px; pens snap below axis **or** `sy > padT+plotH-16` (just above); **termination flags snap below the axis only**, and their tag anchors at the axis (not the series line) |
| "Near" tooltip band | `|c.y - hy| <= 14` px |
| Tooltip box width | `188` (or `236` when an event word shows) |
| Event word colour | `#eac27a` (gold, italic) on the dark tooltip |
| Gap-fill (hover targets) | in **page**: `MAX_GAP = 34*DAY`, and skip a fill point within `NEAR_EVENT = 8*DAY` of a grant/cliff |
| Prefs persistence | `localStorage` key `tallypunk-vchart-v1` (toggles persist across Prev/Next) |

**Behaviour notes:** cliff icon is **not** a hover point (read the step visually); only grant **pens** snap. Tooltip drops 0%/pre-cliff no-event grant rows (and shows nothing if only those are near). `%` is per-series (own quantity), Total is over the grand total. `GRANT-15` = Mate still wants the "granted" tag massaged — get concrete examples.

---

## 6 · Open decisions awaiting Mate

- **Stakeholder delete confirm** — recommend a **typed "delete"** (it destroys grants, unlike pool/company which preserve them). Not yet confirmed.
- **General Pool (POOL-09)** — a real named, undeletable, infinite pool vs just reusing "No pool / None". Recommend a real named pool. Not yet confirmed.
- **Transfer-to-a-specific-pool** on pool delete reuses the GRANT-07 over-capacity flow (General Pool never blocks).
- **`GRANT-15`** — "granted" tag styling/wording, pending examples.
- Locked already: pause = **shift the tail**; termination day = **excluded**.

---

## 7 · Doc topology (avoid the drift trap)

- **Canonical living docs are in Drive:** `E:\GOOGLE DRIVE STORE\Claude\tallypunk\` (Tracker, Tech Primer, Build Plan, Smoke Checklist, this Handoff, plus branding/mockups).
- **The repo `docs/` folder holds *copies*** that Claude Code reads. They **drift** — e.g. the repo Tracker was ~3 weeks stale until it was re-synced during this handoff. **Before Claude Code work, re-sync** the repo copies from Drive (and commit them). Before cowork work, edit the Drive copies.
- Keep **this Handoff** in both places and refreshed at the end of big sessions.

---

## 8 · Communication & working style (Mate)

BLUF; bullet points; **devil's-advocate + a minority view**; **CAE** (Claim/Argument/Evidence) when persuading; challenge assumptions with facts; sustainability / cruelty-free lean; don't politicise. He codes but isn't a pro dev — explain backend choices plainly, keep it **KISS**, prefer **managed + portable**, no heavy infra (no Docker-on-C:). Pre-commit gate: **`npm run build` must pass**, then run the relevant smoke-checklist section.
