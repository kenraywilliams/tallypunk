# TallyPunk — Smoke & Regression Checklist

_Goal: keep cowork-built code safe to commit. Two cheap gates now, a proper one later._

---

## Gate 1 — Build check (run before EVERY commit)

```
npm run build
```

If it compiles clean, you're safe on the big stuff: **no TypeScript errors, no broken imports, no bad edits**. This catches ~90% of what could silently break (it's what would've caught the circular-import / un-scoped-CSS class of issues). If it errors, paste the error to me. (Optional: `npm run lint` for style/unused warnings.)

**Habit:** `npm run build` → if green → `git add -A && git commit && git push`.

## Gate 2 — 2-minute manual smoke (after any UI change)

Quick click-through — the compiler can't catch behaviour, your eyes can:

- **Landing** loads styled; **Try it now** → `/dashboard`.
- **Nav**: every tab + **Manage** menu + account menu route; active tab underlines; sandbox bar + nav stay pinned when you scroll.
- **Pools empty**: big **+** → create dialog; create with defaults → toast + new row + the row **flashes**.
- **Create/Edit dialog**: type toggle + **tooltip shows**; company select + **+ New company**; quantity shows **commas** on blur; **Infinity** tick → ∞, untick → red note; **duplicate name blocked** (red, two spots).
- **Edit**: **Save greyed until a change**; **Cancel resets** the form (re-open Edit = clean); the change appears in **History** as `before → after`.
- **Linking**: row-click opens **view**; pencil opens **edit**; the **Company** button opens the company dialog; a company's **pool buttons** open the pool dialog **on top** (closable, returns underneath).
- **Logs**: scroll is **inside** the panel; title + **Close** always visible.
- **Click-outside** closes a **view** dialog (back to whatever's behind), but an **edit/create** dialog needs Cancel/×.
- **Reset sandbox** clears everything; **refresh** persists what you kept.

## Gate 3 — later (when we move to Claude Code / set up CI)

- **Playwright** e2e covering the flows above (write once, runs forever).
- **GitHub Actions**: run `build` + `lint` + e2e on every push/PR — a red check blocks a bad merge automatically.

That's the natural home for "real" regression safety; for now Gates 1–2 keep us moving fast without breaking things. Logged as a future task in the tracker.

## Keeping this current

**This checklist is a living doc — it must grow with the app.** Every time we add a page, dialog, or flow, add its smoke line to Gate 2 (and later its e2e test to Gate 3). A checklist that lags the product gives false confidence. Quick rule of thumb when we ship a feature:

- New page/route → add a "loads styled + routes" line.
- New create/edit flow → add a "create with defaults / Save-on-change / Cancel-resets" line.
- New validation rule → add the "blocked when…" line.
- New data relationship (e.g. Grants ↔ Pools) → add a "link works both ways" line.

I'll prompt to update it as we go; flag me if I forget.

---
_Started 26 Jun 2026. Last updated 26 Jun 2026._
