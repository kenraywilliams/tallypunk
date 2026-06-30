# TallyPunk — Tech & Hosting Primer (plain English)
### + Section 6 of the Functional Interface Diagram, re-validated

_Written for a smart non-engineer. Goal: you understand the landscape well enough to make the call when we commit — not to commit today._
**Date:** 5 Jun 2026

---

## BLUF

- **Re-validated §6 conclusion still holds:** relational database, build the app ourselves, vesting stays inside Grant. Your feedback mostly **adds requirements** (Company-from-day-1, file attachments, audit depth, backups) rather than changing direction.
- **One-line recommendation:** build a custom app on a **relational (Postgres) database**, hosted on a **"pay-as-you-grow" managed platform** so you pay roughly **free–$30/month at tiny scale** and only pay more as customers and usage grow. Keep everything **standard and portable** so you're never trapped with one vendor.
- **Sandbox question: validated — yes.** Build and test locally on your PC first (with fake data), then a staging copy, then live. Details in Part 5.

---

## Part 1 · The pieces of a web app, in human terms

Think of it like a building:

1. **Frontend** — the rooms people see and click (the pages in the browser).
2. **Backend / API** — the staff who enforce the house rules: your pool-capacity checks, the credit/debit cascade, who's allowed to do what.
3. **Database** — the filing cabinet that holds everything. **Postgres** (relational), as decided.
4. **File storage** — the locked cupboard for documents: grant-letter **attachments** (req GRANT-02) and exported PDFs/CSVs. This is "object storage" (S3-style).
5. **Auth** — the front-door lock and ID check: login, roles, sessions.
6. **Email** — the postman: invites, notifications (e.g. Resend or Postmark).
7. **Payments** — the till: Stripe, once you charge.
8. **Hosting** — the land the building sits on: where the backend + database actually run.
9. **Backups** — the safety-deposit box: automatic copies in case something breaks.

**Important nuance on "build it all ourselves" (your words):** we should build **the rooms and the staff** (frontend + backend logic) ourselves — that's our product and our edge. We should **rent the filing cabinet, locks, postman, till and land as managed services**. Hand-building your own database engine, auth system or payment handling is where solo founders lose months and accidentally create security holes. So: **custom app, managed plumbing.** That's the grown-up version of "build it ourselves."

## Part 2 · Your five criteria, mapped

- **Efficient / cheap at tiny scale** — managed services have free or near-free tiers and "scale to zero" (you pay almost nothing when idle). Realistic first-customers cost: **~$0–$30/month**.
- **Scalable** — when you grow, you move up a paid tier or add capacity. **No rebuild** required if we design it standard.
- **Secure** — managed providers handle the scary parts (patching, encryption, network security, backups). **We** enforce the TallyPunk-specific part: per-Company isolation + roles, in the backend.
- **Movable / portable** — if we use **plain Postgres + containers (Docker)**, you can pick the whole thing up and move it to another host in days, not months. The trap is leaning on a vendor's proprietary extras — we'll keep those optional.
- **Backup-able** — managed databases do automatic nightly snapshots; on top, we add your own "export my data" and a **snapshot-before-every-import** (this is what saves you when an import goes wrong — req BKP-01).

## Part 3 · Three hosting archetypes (choose later, not now)

**Option A — Managed "pay-as-you-grow" — RECOMMENDED for your stage.**
A managed Postgres database (e.g. **Neon** or **Supabase**) + a simple app host (e.g. **Render**, **Railway**, **Fly.io**, or **Vercel**).
- _Cost:_ roughly **free to ~$25–45/month** at launch; rises with usage.
- _Pros:_ cheapest to start, least maintenance for you, backups built in, scales without a rewrite.
- _Cons:_ usage-based bills can creep if you don't watch them; some vendor features create lock-in (we stick to the standard Postgres parts).
- _Note:_ **Supabase** bundles auth + file storage + realtime in one ($25/mo Pro), which can save build time; **Neon** is a leaner, cheaper pure-Postgres ($19/mo Launch). Trade-off = convenience vs portability.

**Option B — One small rented server (a "VPS", e.g. Hetzner or DigitalOcean, ~$5–40/month).**
Everything on one box you control.
- _Pros:_ dirt cheap, fully portable, no surprise usage bills.
- _Cons:_ **you** (or I, scripting it for you) handle setup, security updates, backups and scaling; it's a single point of failure unless you add redundancy. More of your time, less hand-holding.
- _Good if:_ you want maximum control and the lowest fixed cost, and don't mind a bit of ops.

**Option C — Big cloud (AWS / GCP / Azure).**
What the giants use.
- _Pros:_ effectively unlimited scale, every security/compliance feature.
- _Cons:_ complex, easy to **overspend early**, steep learning curve. **Overkill at 20–2,000 customers.**
- _Revisit only if:_ you hit serious scale or enterprise customers demand it.

**My pick for TallyPunk now:** **Option A**, built so portably that you can drop down to **Option B** (cheap VPS) to save money, or climb to **Option C** later — without a rewrite. That is exactly your "pay cents until we need to pay more, then pay more" goal.

**Rough cost ladder (illustrative, 2026 pricing — real numbers depend on usage):**
- 0–50 customers: **~$0–$30/mo** (free tiers + one small paid service).
- ~500 customers: **~$50–$150/mo**.
- 2,000–20,000 customers: scale the DB + app tiers; still small next to the revenue at that point.

## Part 4 · Section 6 re-validated (unbiased), your feedback folded in

- **Relational DB — still yes.** Your roll-over (POOL-05), audit log (GBL-02) and multi-company (ACC-02) needs all lean *harder* on relational integrity. No change.
- **Build ourselves — yes, for the app**; rent managed plumbing (see Part 1 caveat). Minor refinement to your "build it all."
- **Vesting embedded in Grant — agreed.** Vested = computed from grant terms; a **stop-on-leave** date halts it; an **"exercised"** figure on the Stakeholder comes later and can reference a Pool column. No separate Vesting object.
- **Company from day 1 — NEW hard requirement (ACC-02).** This is the biggest addition: the schema must carry **Company + Membership** now, even though launch is one company per account. It's the difference between a config change later and a painful rebuild.
- **File storage — NEW need.** Grant attachments + exports require object storage. Adds one managed piece.
- **Concurrency control, audit depth, soft-delete/trash, backups — confirmed** as platform requirements.

**Net:** the v0.1 §6 direction is sound; your feedback adds requirements rather than overturning anything. I'll rewrite §6 (and a few diagrams) in **v0.2** to show the Company entity, the assist-and-return grant flow, and the uncapped pool.

## Part 5 · How we start building — the sandbox (validated: yes)

Three environments, same code, different settings + data:

1. **Local sandbox — on `F:\tallypunk sandbox`, NOT Google Drive.** The whole app + a local Postgres run on your machine with **fake "practice" companies, stakeholders and grants**. This is where we build and safely break things. **Docker** spins it all up with one command — and since you want to learn it, I'll set it up *with* you and explain each step. _Will it be large?_ The code is tiny, but dependencies + the local database + Docker images add up to a **few GB** and change constantly — which is exactly why this lives on F: and not in Drive (Drive would thrash trying to sync it, and could corrupt files).
2. **Staging.** A private online copy that mirrors the live site, for a final "is it really working?" check before customers see anything. Can run on a free tier.
3. **Production.** The real, live site with real customer data.

**Validated ✓ — this is exactly the right way to start.** Two cautions: (a) keep **real customer data out** of local/staging — always fake data there (privacy + safety); (b) even while building locally, we design the database for the **cloud Postgres target** so moving local → live is painless, not a port.

## What you need to decide (later, not today)

1. Hosting archetype: **A** (managed, recommended) / **B** (cheap VPS) / **C** (big cloud).
2. Managed Postgres: **Neon** (lean, cheap) vs **Supabase** (bundles auth + storage).
3. Whether to use a **managed auth** building block or hand-roll login.

None of this blocks design work — it's the menu for when we're ready to commit.

## Part 6 · Security & speed (both validated — neither changes the landscape)

**Security** is a *layer of habits across every piece*, not a separate product or a different stack:
- **Login:** hashed passwords, secure sessions, lockout after repeated bad attempts, optional 2-factor. (A managed auth block hands us most of this.)
- **Access:** the backend re-checks your role + which Company you belong to on *every* request — the browser is never trusted. This is what stops someone poking around other people's data.
- **Encryption:** HTTPS everywhere + database encrypted at rest (the managed host does this).
- **Safe inputs:** parameterised queries + validation block the two classic break-ins (SQL injection and XSS).
- **Secrets** (DB passwords, API keys) live in a secret store, never in the code.

→ **Verdict:** doesn't change Option A. It adds a checklist we follow and one managed building block (auth).

**Speed / "super-responsive"** is good engineering on the same stack:
- A **single-page app** (no full-page reloads), instant button feedback, and "optimistic" updates make it *feel* instant.
- **Indexed queries + pagination** keep data fast even with lots of records.
- **Caching + a CDN** make pages load light and quick.
- One honest caveat: the cheapest **"scale-to-zero"** hosting sleeps when idle, so the very first click after a quiet period can lag a second. If that bugs us at launch, a small always-on instance (a few $/mo) removes it.

→ **Verdict:** doesn't change Option A either. Postgres + a modern frontend are plenty fast at our scale.

## Glossary (plain English)

- **SQL** — the standard language for talking to relational databases ("give me all grants in pool X").
- **Postgres (PostgreSQL)** — yes, a **SQL / relational** database: data lives in linked tables (our Pools, Grants, Stakeholders). It's the most respected free one. So "Postgres" and "a SQL database" are, for us, the same choice.
- **Relational** — data split into tables that reference each other (a Grant points to a Pool and a Stakeholder). Lets the database enforce rules like pool capacity.
- **MVP — Minimum Viable Product** — the smallest version genuinely useful enough to launch, learn from, and charge for, *without* the nice-to-haves. We ship the MVP, then add the P2/P3 features.
- **Frontend / Backend** — frontend = what you see in the browser; backend = the server code that enforces rules and talks to the database.
- **API** — the backend's "service window": the frontend asks it for data/actions; it checks permissions and replies.
- **Docker** — packages the app + database into identical "containers" so they run the same on your PC and on the live server. (Your learning track.)
- **Staging vs Production** — staging = private rehearsal copy; production = the real live site.
- **RBAC** — Role-Based Access Control: permissions decided by role (Owner / Admin / Editor / Viewer).
- **Soft-delete** — "delete" moves an item to a Trash you can restore from, instead of destroying it.
- **Object storage** — where uploaded files (grant letters, exports) live; separate from the database.
- **Scale-to-zero / cold start** — cheap hosting that sleeps when idle (saves money) but takes ~a second to wake on the first request.

---

### Sources (current 2026 pricing/landscape)
- [Neon vs Supabase — pricing & free tiers (2026)](https://www.closefuture.io/blogs/neon-vs-supabase)
- [Supabase pricing 2026 breakdown](https://toolradar.com/blog/supabase-pricing-2026)
- [Neon serverless Postgres pricing 2026](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/)
- [Railway vs Render vs Fly.io for solo developers (2026)](https://devtoolpicks.com/blog/railway-vs-render-vs-fly-io-solo-developers-2026)
- [Fly.io vs Railway 2026 — cost tests](https://thesoftwarescout.com/fly-io-vs-railway-2026-which-developer-platform-should-you-deploy-on/)
- [Solo-founder SaaS stack & costs (ProductLed)](https://productled.com/blog/the-solo-founder-playbook-how-to-run-a-1m-arr-saas-with-one-person)
