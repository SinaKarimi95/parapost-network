# Parapost Network — Claude Code Workspace

> This file is gitignored and lives only on the local machine.
> It tells Claude Code exactly how to work in this repo and what the current state is.

---

## Project Info

- **Repo:** `E:\Parapost-Fork\parapost-fork` (your personal fork)
- **Upstream:** Lead developer's repo — changes go in via PRs, never direct push
- **Deployed on:** Vercel (auto-deploys from main branch of lead dev's repo after PR merge)
- **Local dev:** `npm run dev` → http://localhost:3000

---

## Tech Stack

- **Framework:** Next.js App Router (v16.2.2 — has breaking changes, read `node_modules/next/dist/docs/` before using any Next.js API)
- **Language:** TypeScript 5, React 19 — every page is `"use client"`
- **Styling:** Tailwind CSS 4 + CSS custom properties (`var(--parapost-accent-*)`)
- **Database / Auth:** Supabase (PostgreSQL + Auth + Storage) — no ORM, direct SDK calls via `lib/supabase.ts`
- **Theme system:** `components/ParapostPreferencesProvider.tsx` — sets `data-parapost-accent` on `<html>`, dispatches `parapost-preferences-updated` event. Use CSS vars, never hardcoded colors.

---

## Ground Rules

- **Never push directly to upstream.** All changes go on a branch → PR → lead dev merges.
- **One concern per branch.** Never mix settings, parachat, badges etc. in one PR.
- **No git actions** (commit, push, rebase) unless explicitly asked. Describe what to commit/push and let the user do it.
- **No database schema changes** without lead dev sign-off.
- **No changes outside the agreed scope of a task.**

---

## Branching Convention

```
settings/navigation-fixes     ← settings sidebar, scroll, font fixes (current)
bugfix/friend-request-duplicate
bugfix/parachat-realtime
bugfix/badges-paraghost
```

Create each branch from `main` of your fork before starting work on it.

---

## Settings Section — Architecture

All 13 settings pages live under `app/settings/`. The section uses a **shared layout shell**:

```
app/settings/layout.tsx         ← h-dvh shell + SettingsNav sidebar + scroll container
components/SettingsNav.tsx      ← desktop-only sidebar (hidden lg:flex, w-60)
components/BackToPrevious.tsx   ← shared back button (window.history.back + fallback)
```

**Navigation tree (back-button model):**
```
/settings                  ← hub — back → /dashboard
  /settings/account        ← back → /settings
    /settings/profile      ← back → /settings/account
    /settings/data         ← back → /settings/account
  /settings/privacy-safety ← back → /settings
    /settings/profile-visibility  ← back → /settings/privacy-safety
    /settings/blocked-users       ← back → /settings/privacy-safety
    /settings/content-feed        ← back → /settings/privacy-safety
  /settings/help-support   ← back → /settings
    /settings/legal        ← back → /settings/help-support
  /settings/notifications  ← back → /settings
  /settings/personalization ← back → /settings
  /settings/payments       ← back → /settings
```

Sub-pages do NOT own their own scroll container — `layout.tsx` provides it.
Sub-pages do NOT render blur orbs — `layout.tsx` provides them.

---

## Key Files

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout — has `export const viewport: Viewport` for mobile rendering |
| `app/settings/layout.tsx` | Settings shell — flex h-dvh, SettingsNav, scrollable content area |
| `app/settings/page.tsx` | Settings hub — hero card, search, 5 grouped card sections |
| `components/SettingsNav.tsx` | Desktop sidebar, usePathname active state, CSS var accent |
| `components/BottomNav.tsx` | Mobile bottom bar — includes `/settings` in shouldShow |
| `components/BackToPrevious.tsx` | Shared back button |
| `lib/supabase.ts` | Supabase client |
| `lib/friends.ts` | Follow/friendship logic |
| `app/globals.css` | Global CSS — base vars, resets, accent theme selectors |

---

## Next.js Viewport Note

The `viewport` export MUST be a separate named export, NOT inside `metadata`. Import `Viewport` from `"next"`. This is a server-side export — do not add `"use client"` to `app/layout.tsx`.

```tsx
import type { Metadata, Viewport } from "next";
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
```

---

## See TASKS.md for current work status
