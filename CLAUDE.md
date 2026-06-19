# Cricket Scoring App — Claude Context

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

### `src/components/player/PlayerCard.jsx`
- Outer `<div>` (card wrapper)
- Inner `<button>` (navigates to player profile) — `flex-1`
- Separate trash `<button>` (shown only when `onDelete` prop present) — `flex-shrink-0`

### `src/pages/LiveScoring.jsx`
- `oversLimitOpen` state triggers BottomSheet when `total_legal_balls >= total_overs * 6`
- BottomSheet has "Undo Last Ball" and "End Innings" actions
- Guard: `if (winConfirmOpen) return` prevents conflict with win condition modal

### `src/pages/AdminUsers.jsx`
- `friendlyInviteError(msg)` maps raw error strings to user-friendly messages
- Catch-all: "Could not send invite. Please check your SMTP settings or try again later."
- Error extraction from `FunctionsHttpError`: `await error.context?.json?.()` then check `body.error` → `body.code`

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

## Pending / Known Issues
- Invite emails land in spam for new recipients (Gmail account is new, no domain reputation). Long-term fix: custom domain + proper SPF/DKIM.
- No test suite — all verification done manually via preview server.
