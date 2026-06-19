# Cricket Scoring App — Claude Context

## Hard Rules (Always Follow)

1. **Self-audit after every change set.** Before reporting a task as done, re-read every file touched and check for: logic errors, missing null guards, unhandled async errors, state not reset, RLS gaps, and broken flows introduced by the change. Fix anything found.
2. **After fixes pass self-audit**, update `CLAUDE.md` and the memory files to reflect what changed.
3. **End every task** with a one-paragraph summary of what changed, and a clear merge recommendation (safe / needs testing / not ready).

---

## Project Overview
Mobile-first cricket scoring PWA. React + Vite SPA, Supabase backend (PostgreSQL + RLS + Storage + Edge Functions), deployed on Vercel.

**Dev server:** `npm run dev` → http://localhost:5173  
**Supabase project ref:** `ieftvcljzjwmckyvgpxp`  
**Deploy edge functions:** `npx supabase functions deploy <name> --project-ref ieftvcljzjwmckyvgpxp`

---

## Tech Stack
- **Frontend:** React 19, React Router v7, Zustand stores, react-hot-toast, lucide-react, recharts
- **Backend:** Supabase (PostgreSQL, RLS policies, Storage buckets, Auth, Edge Functions in Deno/TypeScript)
- **Styling:** Tailwind CSS with custom design tokens (`ink-*`, `brand-green`, `brand-teal`)
- **Forms:** react-hook-form + zod
- **Build:** Vite, deployed to Vercel

---

## Architecture

### Key Directories
```
src/
  pages/          # Route-level components (one per page)
  components/     # Shared UI components
    player/       # PlayerCard, PlayerAvatar
    shared/       # ConfirmDialog, LoadingSkeleton, EmptyState, BottomSheet
  stores/         # Zustand stores (matchStore, playerStore, authStore, tournamentStore)
  services/       # Supabase data access layer (playerService, matchService, etc.)
  hooks/          # useRole, useWinCondition, etc.
  lib/            # supabase.js client init
supabase/
  functions/      # Edge functions (invite-user, delete-user)
  migrations/     # SQL migrations 001–010
```

### Roles & Auth
Roles: `admin`, `scorer`, `captain`, `player`, `viewer`  
Role check hook: `src/hooks/useRole.js` → `{ isAdmin, isScorer, canManagePlayers, isPlayer, userId }`  
App users table: `public.app_users` (id = auth.uid(), email, full_name, role)

---

## Database & RLS

### Migrations Applied (in order)
| # | File | Purpose |
|---|------|---------|
| 001 | `001_initial.sql` | Base schema |
| 002 | `002_add_player_role.sql` | Player role field |
| 003 | `003_auth_users.sql` | Auth + app_users + RLS (replaced blanket allow-all) |
| 004–007 | tournament/team/series | Tournaments feature |
| 008 | `008_fix_fk_cascades.sql` | **CASCADE delete on player_career_stats and player_tournament_stats** |
| 009 | `009_storage_policies.sql` | **Storage RLS for player-photos bucket + players UPDATE policy** |
| 010 | `010_player_delete_policy.sql` | **Admin DELETE policy on players table** |

### Critical RLS Behaviour
Supabase RLS with no matching policy = **silent no-op**: returns HTTP 200, 0 rows deleted, no error. This burned us on player deletion — migration 003 replaced the blanket policy but never added DELETE. Migration 010 fixes this.

### Storage
Bucket: `player-photos` (public read, authenticated upload/update — migration 009)

---

## Edge Functions

### `invite-user`
- Validates caller is admin
- Calls `auth.admin.inviteUserByEmail()`
- Upserts into `app_users` (handles re-invite)
- **Error handling:** `inviteError` handled with explicit property access (not JSON.stringify) to capture `AuthApiError` prototype fields
- `inviteError.status || 500` returned as HTTP status

### `delete-user`
- Deletes from auth + app_users

### SMTP (Invite Emails)
- Provider: Gmail SMTP with App Password (NOT Resend — `onboarding@resend.dev` only works for verified recipients on free tier)
- Configured in Supabase Dashboard → Project Settings → Auth → SMTP
- Invite emails may land in spam for new recipients — advise them to add sender to contacts

---

## Key Pages & Components

### `src/pages/Players.jsx`
- Header: Players count + Filter button + Delete All (trash icon, admin only) + Add button
- Delete All is **icon-only** (no text) to avoid mobile overflow
- Individual player delete: `onDelete={isAdmin ? setDeletePlayerTarget : undefined}` passed to PlayerCard
- Two ConfirmDialogs: one for single player delete, one for delete-all
- **PlayerCarousel** rendered above the filter panel (when players exist and not loading)
  - `activeCarouselIndex` state resets to 0 whenever search/filter changes

### `src/components/player/PlayerCard.jsx`
- Outer `<div>` (card wrapper)
- Inner `<button>` (navigates to player profile) — `flex-1`
- Separate trash `<button>` (shown only when `onDelete` prop present) — `flex-shrink-0`

### `src/components/player/PlayerCarousel.jsx`
- 3D card carousel — pure CSS transforms, no external library
- Props: `players[]`, `activeIndex`, `onChangeIndex(idx)`, `onSelect(playerId)`
- **Front face:** avatar (photo or initials), name, role badge
- **Back face (flip on tap of center card):** player name, Runs / Wickets / Matches stat rows, "View Profile →" button
- Stats fetched lazily via `playerService.getCareerStats()` on first flip; cached in local `statsCache` state
- Swiping resets flip to front on the new active card
- Tapping a side card advances index (does not flip); tapping back face flips back to front
- "View Profile →" uses `e.stopPropagation()` to prevent the back-flip handler from firing

### `src/pages/LiveScoring.jsx`
- `oversLimitOpen` state triggers BottomSheet when `total_legal_balls >= total_overs * 6`
- BottomSheet has "Undo Last Ball" and "End Innings" actions
- Guard: `if (winConfirmOpen) return` prevents conflict with win condition modal

### `src/pages/AdminUsers.jsx`
- `friendlyInviteError(msg)` maps raw error strings to user-friendly messages
- Catch-all: "Could not send invite. Please check your SMTP settings or try again later."
- Error extraction from `FunctionsHttpError`: `await error.context?.json?.()` then check `body.error` → `body.code`
- User row layout: avatar left, name + email + role pill stacked in middle column, trash anchored top-right
- Role select has `ROLE_COLORS` for all five roles incl. `player` (teal); fixed `w-24` removed — pill sizes naturally
- ConfirmDialog used for delete confirmation (no inline confirm block in the row)

### `src/services/playerService.js`
- `deletePlayer(id)`: explicitly deletes from `player_career_stats` and `player_tournament_stats` before hard-delete (belt-and-suspenders alongside cascade migration)
- `deleteAllPlayers()`: same pattern — deletes stats rows for unused players before hard-delete

---

## Common Gotchas

1. **RLS silent no-op** — always verify DELETE policies exist for each role that needs to delete. Test with `preview_eval` checking `{ data, error, count }`.
2. **Supabase AuthApiError** — prototype properties aren't captured by `JSON.stringify`. Always access `.message`, `.status`, `.code` explicitly.
3. **FK constraints** — `player_career_stats` and `player_tournament_stats` cascade on player delete (migration 008). If adding new tables that reference `players(id)`, always add `on delete cascade`.
4. **Edge function errors** — `supabase.functions.invoke` wraps non-2xx as `FunctionsHttpError`; the real body is in `error.context.json()`.
5. **Resend SMTP** — `onboarding@resend.dev` only delivers to verified recipients. Use Gmail SMTP + App Password for production invites.

---

## Bug Fixes Log (June 2026)

| File | Bug | Fix |
|------|-----|-----|
| `TournamentDetail.jsx` | `navigate('/matches/${startMatchId}')` after `setStartMatchId(null)` navigated to `/matches/null` | Capture id in local var before clearing state |
| `MatchSummary.jsx` | Delete button had no loading guard — double-submit possible | Added `deleting` state + disabled confirm button during deletion |
| `ConfirmDialog.jsx` | No `disabled` prop | Added `disabled` prop with opacity + cursor styles |
| `LiveScoring.jsx` | `NewBatsmanModal` closeable without selecting batsman | `onClose` blocks close and shows toast when candidates remain |
| `playerService.js` | `deleteAllPlayers` used fragile dummy UUID filter | Replaced with `.not('id', 'is', null)` |
| `authStore.js` | Removed users stayed logged in until page reload | Realtime subscription on own `app_users` row; DELETE fires immediate `signOut()` |
| `migrations/011` | Invited player-role users got RLS error on profile creation | Added `player_insert_own_profile` policy |
| `AdminUsers.jsx` | Inline confirm block in user row caused layout shift and text truncation | Replaced with `ConfirmDialog` modal; row is always consistent width |
| `AdminUsers.jsx` | `player` role had no color in `ROLE_COLORS` — showed unstyled text | Added teal color entry for `player` role |
| `AdminUsers.jsx` | Name/email/role aligned inconsistently across rows | Redesigned card: avatar left, name+email+role pill stacked vertically, trash top-right |
| `PlayerCarousel.jsx` | Tapping center card navigated immediately to profile | Added CSS 3D flip — front shows avatar/name/role, back shows stats + "View Profile" button |
| `PlayerNew.jsx` | Player-role user could navigate to `/players/new` and hit DB unique constraint error on second profile | On mount, calls `getPlayerByUserId()` — if profile exists, redirects to it with info toast; `return null` while checking prevents form flash |

## Supabase Realtime Prerequisite
For auto-logout on user removal to work, `app_users` must have Replication enabled:
**Dashboard → Database → Replication → toggle `app_users` on**

---

## Pending / Known Issues
- Invite emails land in spam for new recipients (Gmail account is new, no domain reputation). Long-term fix: custom domain + proper SPF/DKIM.
- No test suite — all verification done manually via preview server.
