# TallyPunk — Requirements Tracker

_Living document. Every idea we throw into a conversation becomes a numbered requirement here, so when we build that part — in 3 weeks or 3 months — we don't forget it. The Functional Interface Diagram is the "big picture"; this is the "don't-lose-the-detail" list that sits beside it._

**Started:** 5 Jun 2026 · **Last updated:** 30 Jun 2026 (round 4) · **Owner:** Mate

---

## How this works

- Each item has an **ID** (area prefix + number), a **Phase**, a **Status**, and my **Take / open question**.
- **(\*)** marks items Mate flagged in chat with an asterisk ("jot for later"). Capturing here is *extra*.
- **Phase:** `MVP` (launch) · `P2` / `P3` (later, but designed-for now) · `Later` · `Decided`.
- **Status:** `[Agreed]` · `[Recommend]` (needs your nod) · `[Question]` · `[Parked]` · `[Open]`.
- **(affects diagram)** = changes the Functional Interface Diagram → folds into v0.2.

---

## A · Global / cross-cutting

- **GBL-01** · `MVP` · `[Agreed]` — **Audit metadata on every record:** `created_by` + `created_at`, `last_edited_by` + `edited_at`. Used for quick "who/when" display. **(\*)**
- **GBL-02** · `MVP` record / `P2` rich view · `[Agreed]` — **Full audit log** (append-only change history). **We record it for everyone** (rows are tiny, and it protects integrity + support); the **rich, browsable history view is a paid feature**; retain ~**5 years** (cost-permitting / EU limits aside). **(\*)**
- **GBL-06** · `MVP`-ish · `[Recommend]` — **Per-object "History" tab.** Every Pool / Grant / Stakeholder shows its own change log (who changed what, when, before → after).
  _Take:_ this is your own conclusion and it's the right one — a single "last edited by" is weak if a record is edited many times; the per-object history is what makes edits trustworthy (and is the anti-"grants disappearing" feature made visible). GBL-01 = the quick stamp; GBL-06 = the full story; same underlying log as GBL-02.
- **GBL-03** · `MVP` · `[Agreed]` — **Soft-delete via Trash** for **Grants & Stakeholders** (restore anytime; auto-purge after **30 days** or manual "empty"). **Pools are not trashed** — deleting a pool linked to grants is blocked until those grants are reassigned; an empty pool deletes outright. Deleting a Stakeholder with active grants is likewise constrained.
- **GBL-04** · `MVP` · `[Recommend]` — **Concurrency failsafe:** optimistic locking — warn "X edited this 2 min ago" instead of silently overwriting.
- **GBL-05** · `MVP` (sort/show-hide) · `P2` (saved views) · `[Recommend]` — **Power lists:** sortable + show/hide/reorder columns, saved per login. Differentiator vs Ledgy. _Status:_ sandbox Stakeholders list now has click-to-sort headers + show/hide/**reorder** columns, saved locally (server-side saved views stay P2).

- **GBL-07** · `MVP` (sandbox live) · `[Done]` — **Logging started.** Every create/edit writes a `LogEntry` with a standard succinct tag (**CREATE / UPDATE / DELETE**) + actor + timestamp + summary. A per-object **History** dialog (GBL-06) reads it (embeddable from any object). Maps 1:1 to the future AuditLog table. Next: add UPDATE field-level before→after detail, and DELETE/RESTORE when trash lands.

- **GBL-08** · `MVP` · `[Agreed]` — **Human-friendly sequential display IDs (per entity).** Every **Stakeholder, Company, Pool, and Grant** carries a stable, sequential, human-readable **ID** shown as its own column and on its detail view — separate from the internal database key — so two same-named records are never confused.
  - **Zero-padded minimum widths per entity:** Company **`01`** (2 digits) · Pool **`001`** (3) · Stakeholder **`000001`** (6) · Grant **`0000001`** (7). Numbering starts at 1.
  - **No maximum — the padding is a minimum display width, not a cap.** When the count outgrows the padded range the ID simply gains a digit: e.g. companies run `…, 98, 99, 100, 101, …` while the first ninety-nine keep their padded form (`01, 02, …`); likewise pools `999 → 1000`, grants `9999999 → 10000000`, etc.
  - IDs are **monotonic per entity** (numbers are not reused after a delete). The stored value is the integer sequence; zero-padding is display-only formatting.
  - _Status:_ Stakeholder IDs are **live in the sandbox** (`000001`, shown as a column + on the detail header). Company / Pool / Grant IDs to follow as each entity is built out.

## B · Accounts & permissions

- **ACC-01** · `MVP` · `[Agreed]` — Multiple users per account; min Edit + Read-only (role model: Owner / Admin / Editor / Viewer). **(\*)**
- **ACC-02** · entity `MVP` / access `P2–P3` · `[Agreed — critical]` — **Company is first-class from day 1.** One login may manage many Companies; data scoped per Company; later a Company login sees only its own. Build `Company` + `Membership` now so multi-company is a config flip, not a rebuild. (affects diagram §2/§3)
- **ACC-03** · `P2` · `[Recommend]` — Per-Company permissioning (invited company-user sees only their Company). No schema change if ACC-02 done now.

## C · Pools

- **POOL-01** · `MVP` · `[Agreed]` — Pool create/edit is a **full screen** (like Grant), not a drawer. (affects diagram)
- **POOL-02** · `MVP` · `[Agreed]` — **Pools page:** primary action **Create Pool** (button under list; big "+" centre of an empty list). Click → detail; **Edit** unlocks; **Delete** (constraint-guarded). **Pool size = an integer; unit of measure = "options"** (label shown beside the box; the underlying unit can vary by pool type — options / units / SARs — but "options" is the default display). (affects diagram)
- **POOL-03** · `MVP` · `[Agreed]` — **"Infinity pool"** (uncapped). UX: a checkbox **"Infinity pool ∞"** beside the size field; hover tooltip _"Uncapped pool — allows grants without a fixed size; size it later"_; **ticking greys out the size field and shows ∞.** Must stay visibly flagged. (affects diagram + §4)
- **POOL-04** · `MVP` · `[Agreed]` — Insufficient capacity on grant → popup "Not enough — create a new pool / add options." No auto-fallback. (see FLOW-01)
- **POOL-05** · `P2` · `[Recommend]` — **Roll-over** (carry unallocated leftover into a new pool, both keep a record). MVP answer for ~80% of cases is simply **resize/top-up** the existing pool (already supported via Edit); explicit roll-over is for starting a *new* plan.
- **POOL-06** · `P2` · `[Recommend — explore]` — **Merge pools** (consolidate two → one; recompute; re-point grants; audit). Housekeeping companion to roll-over.

## D · Grants

- **GRANT-01** · `MVP` · `[Agreed]` — Create/edit fast form.
- **GRANT-02** · `MVP`-ish · `[Recommend]` — **Optional attachment per grant** (signed grant letter; PDF/image).
  _How it works (your P.S. — yes, correct):_ the file goes to **object storage**; the **database stores a reference row** — the storage **key/ID** + filename + type + size + `uploaded_by` — linked by foreign key to the grant (or stakeholder). That's how the right PDF shows on the right page. We serve it via **signed, time-limited URLs** so only authorised users can open it (security).
- **GRANT-03** · `P2` · `[Recommend]` — Bulk grant creation (same atomic pipeline as import).
- **GRANT-04** · design · `[Note]` — **A grant can be created with NO pool** (pool = None) — you don't need a pool to grant. Idea: an implicit/hidden "infinity pool" behind the scenes so granting works before any pool exists; leaving pool = None then carries no capacity stopper. Revisit when we build Grants. (Mate's call, this session.)

## E · Stakeholders

- **STK-01** · `MVP` · `[Agreed]` — Create Stakeholder button.
- **STK-02** · `MVP` · `[Recommend]` — Saved, customisable, sortable column summary view per login. **(\*)** (see GBL-05)
- **STK-03** · `MVP` · `[Agreed]` — Detail uses **tabs** (Detail · Grants · Vesting plot [interactive] · **History** per GBL-06).
- **STK-04** · `MVP` · `[Agreed]` — Persistent left-hand name list + Next/Previous (name in brackets; greyed at ends). (affects diagram)

## F · Database (Diagram §2 / §3)

- **DB-01** · `MVP` · `[Agreed]` — One relational database (Postgres), Company-scoped. Not per-company physical DBs.
- **DB-02** · `P2/P3` · `[Note]` — A person may be a stakeholder in several Companies; cross-company linking later.
- **DB-03** · `MVP` · `[Agreed]` — Atomic transactions + concurrency failsafe (GBL-04).

## G · Data flows (Diagram §4)

- **FLOW-01** · `MVP` · `[Agreed]` — **No auto pool fallback.** Soft-block → assist (create/expand pool) → **return to the same grant screen** → user clicks **Save again**. (affects diagram §4)
- **FLOW-02** · `MVP` · `[Agreed]` — Cancel = soft-delete to trash (GBL-03).

## H · Import

- **IMP-01** · `P2` (consider earlier) · `[Recommend]` — Import templates: separate for Pools / Stakeholders / Grants (or one .xlsx, 3 tabs) + guided mapping wizard.
- **IMP-02** · `P2` · `[Recommend]` — "Fill the gaps": inline-create missing pools/stakeholders; sensible defaults.

## I · Tech (Diagram §6 — see Tech & Hosting Primer + Build Plan)

- **TECH-01** · `Decided` · `[Agreed]` — Relational database (Postgres / SQL).
- **TECH-02** · `Decided` · `[Agreed]` — Custom app, managed plumbing.
- **TECH-03** · `Decided` · `[Agreed]` — Vesting embedded in Grant; vested computed; stop-on-leave; "exercised" later (references a Pool column).
- **TECH-04** · `Decided` · `[Agreed]` — 1 company/account at launch; scales to multi-company without rebuild.
- **TECH-05** · `Decided` · `[Agreed]` — Local sandbox on **`F:\tallypunk sandbox`**, not Google Drive. (Docs stay in Drive; code/DB/containers on F:.)
- **TECH-06** · `Decided` · `[Agreed]` — **Hosting: Option A (managed pay-as-you-grow) now. Option C (big cloud) kept as a future *option*, not a plan — don't pre-build for it, just stay portable. Option B (self-run VPS) deliberately SKIPPED** — its only edge is cost/control, paid for in your time + patching/security risk you've sensibly decided not to carry. Portability (standard Postgres + Docker) keeps A→C open without a rewrite.
- **TECH-07** · `Optional` · `[Agreed]` — Docker is **optional, not required**, and **never on C:** (Mate's call). If ever used (to learn), install entirely on F: (`--installation-dir=F:\Docker --wsl-default-data-root=F:\DockerData`). For the local dev database we prefer a **free cloud dev DB (Neon/Supabase)** — nothing installed locally — or native Postgres on F:.
- **TECH-08** · `Parked` — Neon vs Supabase (managed Postgres). I'll raise a 1-pager at the commit step.
- **TECH-09** · `Parked` — Auth: managed block vs hand-roll. Raise when we add login.
- **TECH-10** · `Decided` · `[Recommend → confirm]` — **Build stack:** **Next.js (React + TypeScript)** as one project serving both the **marketing site** (static/SSR → SEO) and the **app**; **Tailwind CSS** for styling (brand tokens); **Postgres via Prisma** (a safe, typed database layer — also gives us parameterised queries = SEC-04); deploy on **Vercel or Render** (Option A). Auth parked (TECH-09).
  _Why:_ one stack for marketing + app = one repo, one deploy, shared brand components, less for you to learn. _Alternative considered:_ Astro for the marketing site (slightly leaner static) + a separate app — rejected to avoid running two stacks. _Needs your go-ahead (the one big commit)._
- **TECH-11** · `Decided` · `[Agreed]` — **Toolchain (Windows):** Node.js 24 LTS + Git + VS Code (already installed) + a free GitHub account. **Docker dropped from the required list** (optional, off-C — see TECH-07).
- **TECH-12** · `Decided` · `[Agreed]` — **Build order:** Phase 0 scaffold + run "hello" locally → Phase 1 landing page → more marketing pages → **git from the first commit**, push to GitHub early → deploy marketing live ("launch it up") → Phase 2 app shell + auth + DB (pools/stakeholders/grants), one page at a time against this tracker.

## J · Backups

- **BKP-01** · platform `MVP` / user-facing `P2` · `[Agreed]` — **Three things, kept separate:**
  1. **Platform backups protect EVERYONE** (free + paid): nightly DB snapshots + an automatic snapshot **before every import**. Our disaster recovery — "if we screw up, even free users don't suffer." Controlled restore window ~**4 weeks** (cost-bound).
  2. **User self-export (download) anytime, unlimited** (CSV/JSON, their PC, their dime) — this is how a paid user keeps "more than 4 weeks" without us storing it. Cheap for us (generated on demand).
  3. **Restoring a user's own file goes through the *validated import pipeline*, NEVER a raw database restore.** _Your instinct was right:_ letting users push an uncontrolled backup straight into the DB risks corrupting integrity/constraints. So "restore my export" = re-import with validation + dry-run + atomic write (IMP-01/02). Our controlled snapshot-restore stays for true disasters only.
  _Open:_ confirm the 4-week controlled window (export covers anything longer).

## K · Security (cross-cutting layer — does NOT change the stack)

- **SEC-01** · `MVP` · `[Recommend]` — Strong auth: hashed passwords, secure sessions, login lockout, optional 2FA (a managed auth block covers most).
- **SEC-02** · `MVP` · `[Agreed]` — Server-side authorization on every request (role + Company scope; browser never trusted). The "no one can reach others' data" guarantee.
- **SEC-03** · `MVP` · `[Recommend]` — HTTPS everywhere + DB encrypted at rest (managed host).
- **SEC-04** · `MVP` · `[Recommend]` — Parameterised queries (Prisma) + input validation → blocks SQL injection / XSS.
- **SEC-05** · `MVP` · `[Recommend]` — Secrets in a secret store / env, never in code or the repo.
- **SEC-06** · `P2` · `[Recommend]` — Audit log (GBL-02) = forensics trail; backups = ransomware/disaster recovery.
- **SEC-07** · ongoing · `[Recommend]` — Patch infra (managed) + keep app dependencies updated.

## L · Performance / speed (does NOT change the stack)

- **PERF-01** · `MVP` · `[Agreed]` — Single-page feel, instant button feedback, optimistic updates, skeleton loaders.
- **PERF-02** · `MVP` · `[Recommend]` — Indexed queries, pagination on big lists, fetch only what's shown.
- **PERF-03** · `MVP` · `[Recommend]` — Code-splitting, caching, CDN for static assets.
- **PERF-04** · note · `[Recommend]` — "Scale-to-zero" hosts have a ~1s cold start after idle; keep a small always-on instance if it bugs us at launch.

---

## M · Growth & acquisition (no-signup sandbox)

- **NSB-01** · `MVP`-ish · `[Recommend]` — **No-signup "Try it now" sandbox.** Visitors use TallyPunk with **pre-seeded sample data, no account**; gate **Save / Export / Share / own-data** behind a free account. Kills the email wall that loses fleeting interest. _Evidence:_ ~67% form-abandonment; each extra field −3–5%; an interactive "try it" lifted freemium signups 13.3%→16.7% and qualified leads +20–25%. CTA to A/B: "Try it now — no sign-up" / "Play with a sample company".
- **NSB-02** · risk · `[Agreed]` — **Bot/crawler risk is dissolved by building the sandbox client-side** (in-browser, in-memory, no server writes) — nothing to overload or protect. _If_ a server-side sandbox is ever added: Cloudflare Turnstile (free, invisible) + per-IP rate limits + auto-expiring ephemeral sandboxes.
- **NSB-03** · model · `[Recommend]` — Funnel: anonymous sandbox → "create free account to keep your data" → free tier (≤10 stakeholders) → paid. **Reverse-trial** flavour (~15–40% better than pure freemium; only ~7% of SaaS use it).
- **ARCH-01** · `MVP` · `[Recommend]` — **Build the app front-end on a swappable data layer** (a `DataSource` interface): **in-memory** for the demo, **API→Postgres** for logged-in users. The sandbox = the real UI on fake data → build once, reuse. This is the "build the underbelly first" approach — validated.

## Items that change the Functional Interface Diagram → fold into v0.2

POOL-01/02/03 (full-screen + size unit + infinity tickbox), POOL-04 / FLOW-01 (assist-and-return), STK-03/04 (History tab + left list + next/prev), ACC-02 (Company entity), GBL-01/02/06 (audit + per-object history), GBL-03 (trash + pool-delete constraint), GBL-04 (concurrency). Optionally add a thin security/rules-layer note to §2.

## Open questions waiting on Mate

1. **Confirm the build stack** (TECH-10: Next.js + Tailwind + Postgres/Prisma). The one big commit.
2. Controlled-backup window — 4 weeks ok, with unlimited self-export beyond it? (BKP-01)
3. Pool size field name — "Pool size", "Total options", or your "Depth"? (POOL-02)

## Parked (I'll raise when we need to decide)

- Neon vs Supabase (TECH-08). · Managed auth vs hand-roll (TECH-09).

## Change log

- **5 Jun 2026 (r1)** — Tracker created; 30 requirements.
- **5 Jun 2026 (r2)** — Added Security (K) + Performance (L); infinity-pool UX; trash rules; two-layer backups; roll-over/merge; Docker; F:\ sandbox; parked Neon/Supabase + auth. 41 items.
- **6 Jun 2026 (r3)** — Decided to start building. Hosting: A now / C optional / **B skipped**. Stack committed (TECH-10/11/12: Next.js + Tailwind + Postgres/Prisma, toolchain, build order). Per-object History (GBL-06) + audit retention ~5yr. Backups: user self-export + restore-via-import. Pool size unit = options. Object-storage reference model (GRANT-02). 47 items.
- **30 Jun 2026 (r4)** — Sandbox build well underway: branded landing + Pools + Companies + **Stakeholders** (sub-section ribbon with Detail/Grants/Vesting/History as full pages, persistent scrollable left name-list with wrap-around Back/Next, configurable + sortable columns, per-object History). Added **GBL-08** (per-entity display IDs: Company `01` / Pool `001` / Stakeholder `000001` / Grant `0000001`; no max → grows a digit). Power-list GBL-05/STK-02 partially live. Smoke/regression checklist doc added. 48 items.
