# TallyPunk — Build Plan & Getting Started

_The recipe for actually building it. Decisions live in the Requirements Tracker; this is the "what we do, in what order, and what you install."_
**Date:** 6 Jun 2026

---

## BLUF

- We build **one Next.js project** that serves both the **marketing site** (for SEO) and the **app** (behind login), with **Postgres** added when we reach data.
- **You install 4 tools (~30 min).** Then I scaffold the landing page into `F:\tallypunk sandbox`, we run it locally and see it in your browser, then build **page by page**, commit to **git early**, and **deploy live** when the marketing site looks good.
- Build order on purpose: **landing page first** — low risk, no database, a real SEO asset live early, and it teaches you the toolchain before we tackle the hard app.

---

## 1 · The stack (the one big commit — your go-ahead, please)

| Piece | Choice | In plain English |
|---|---|---|
| Framework | **Next.js (React + TypeScript)** | Runs the marketing pages *and* the app in one project. Great SEO (can pre-render pages), huge community, tons of learning material. |
| Styling | **Tailwind CSS** | Fast, consistent styling; we bake in your brand colours (ink `#1c1d20`, purple `#6c4cf1`) and the logo. |
| Database | **Postgres** via **Prisma** | Postgres = the SQL database we chose. Prisma is a safe, typed "translator" between our code and the DB (also gives parameterised queries = blocks SQL injection). Added in Phase 2. |
| Hosting | **Vercel or Render** (Option A) | Cheap-to-free at launch, scales by paying more, backups built in. |
| Local database (dev) | **Free cloud DB (Neon/Supabase)** — or native Postgres on F: | For dev, the app on F: talks to a free cloud Postgres (nothing installed on your PC), or a native Postgres pointed at F:. **Docker is optional** and, if ever used, installs entirely on F: — never C:. |
| Auth | *Parked* (TECH-09) | Decided when we add login. |

**Why one Next.js project for both:** one repo, one deploy, shared brand components, half as much for you to learn. **Alternative considered:** Astro for the marketing site (a touch leaner for pure static pages) + a separate app — rejected, because running two stacks is more to maintain for a solo founder. If you'd rather split them later, we can.

## 2 · Software to install (Windows)

You already have **VS Code** and **Git** ✓. To start you only need **Node** + a **GitHub** repo. All free.

1. **Node.js 24 LTS** — Windows Installer (.msi) from **https://nodejs.org/en/download** → pick the **LTS** (24.x), 64-bit; accept defaults. _Check:_ open a **new** terminal → `node -v` (`v24.x`) and `npm -v`.
2. **GitHub repo** — free account at **https://github.com** → **New repository** → name **`tallypunk`** → **Private** → **don't** add a README/.gitignore (we push our own). VS Code prompts you to sign in on the first push.

**Docker — skipped (optional, and never on C:).** You don't need it for the landing page. For the database in Phase 2 we'll use a **free cloud dev database** (Neon/Supabase) — nothing installed locally — or a native Postgres on F:. If you ever want Docker purely to learn it, it installs **entirely on F:** via command line (run as admin):
`"Docker Desktop Installer.exe" install --installation-dir=F:\Docker --wsl-default-data-root=F:\DockerData`
(One honest caveat: WSL2 is a Windows feature, so a tiny kernel file sits on C regardless — that's Windows, not Docker, and it's negligible.)

## 3 · How we'll work together

- **I write and edit the code** straight into `F:\tallypunk sandbox` (once you grant me access to that folder).
- **You run the commands** — I'll give you exact copy-paste lines for VS Code's terminal and explain what each does. Nothing cryptic.
- **You see it live** at `http://localhost:3000` in your browser as we go.
- **Git from the first commit** (locally), and we **push to GitHub early** — that's your real backup and the start of "CM". You don't have to wait for a few pages.
- **I verify** what I can in my own sandbox before handing you commands, so you hit fewer surprises.
- **"Launch it up"** = first it runs locally on your PC; when the marketing site looks good we deploy it live (Vercel/Render) on your domain.

## 4 · Build order (phases)

**Phase 0 — Foundations (one session).** You install the tools; I scaffold the Next.js project into F:; you run 2–3 commands and see a "hello" page locally. Optional: spin up a local Postgres in Docker just to meet it.

**Phase 1 — Marketing site (low risk, real payoff).** Port your existing landing mockup into Next.js + Tailwind + brand; see it locally; add pages one at a time (home, pricing, learn, the calculator/alternatives later); **init git → push to GitHub**; **deploy live**. You'll have a real, indexable site early.

**Phase 2 — The app (the hard part, done slowly).** App shell + navigation behind `/app`; decide auth (TECH-09); add Postgres; then build the core objects **one page at a time — Pools → Stakeholders → Grants** — each checked against the tracker (capacity guard, credit/debit cascade, audit/history, trash, concurrency).

## 5 · Your immediate next action

1. **Install the 4 tools** (Section 2).
2. **Confirm the stack** (Section 1) — or veto any part.
3. **Say "go" and approve access to `F:\tallypunk sandbox`** — I'll scaffold Phase 0 and hand you the few commands to see TallyPunk running locally.

---

## Decisions locked this round (see tracker for detail)

- Hosting **A** now; **C** kept as a future option (not a plan); **B skipped** (no self-run servers).
- Stack: **Next.js + Tailwind + Postgres/Prisma**, deploy on Vercel/Render.
- Toolchain: Node, Git, VS Code, Docker (+WSL2), GitHub.
- Git from the first commit; landing page first; deploy when good.
