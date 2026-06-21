# Cricket Scoring App — Claude Context

## Hard Rules (Always Follow)

1. **Self-audit after every change set.** Before reporting a task as done, re-read every file touched and check for: logic errors, missing null guards, unhandled async errors, state not reset, RLS gaps, and broken flows introduced by the change. Fix anything found.
2. **After fixes pass self-audit**, update `CLAUDE.md` and the memory files to reflect what changed.
3. **End every task** with a one-paragraph summary of what changed, and a clear merge recommendation (safe / needs testing / not ready).
4. **Test-then-build gate (no exceptions).** For every code change — no matter how small — before reporting done:
   a. Write or update test cases covering the changed behaviour.
   b. Run `npm test` and confirm all tests pass (fix source logic if tests reveal bugs — never weaken tests).
   c. Run `npm run build` and confirm zero errors.
   Only after both pass is the task considered complete. Deliver the final `CLAUDE.md` update as part of the same response.

---

## Project Overview
Mobile-first cricket scoring PWA. React + Vite SPA, Supabase backend (PostgreSQL + RLS + Storage + Edge Functions), deployed on Vercel.

**Dev server:** `npm run dev` → http://localhost:5173  
**Supabase project ref:** `ieftvcljzjwmckyvgpxp`  
**Deploy edge functions:** `npx supabase functions deploy <name> --project-ref ieftvcljzjwmckyvgpxp`

---

## Tech Stack
- **Frontend:** React 19, React Router v7, Zustand stores, react-hot-toast, lucide-react, recharts, satori (SVG card generation)
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
Role check hook: `src/hooks/useRole.js` → `{ isAdmin, isPlayer, canScore, canManagePlayers, canCreatePlayer, canManageOwnProfile, canManageVenues, canManageTournaments, userId }`

| Flag | Roles |
|------|-------|
| `canManagePlayers` | admin only — edit **any** player profile |
| `canCreatePlayer` | admin, scorer, captain, player — create new player / edit own profile |
| `canManageOwnProfile` | admin, scorer, captain, player |
| `canScore` | admin, scorer |
| `canManageVenues` / `canManageTournaments` | admin only |

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
| 011 | `011_player_self_insert.sql` | Player-role users can insert their own profile |
| 012 | `012_missing_rls_policies.sql` | **DELETE policies for venues + tournaments; replace blanket allow_all on match_players, scorecards, match_events, tournament_players, career/tournament stats** |
| 013 | `013_free_hit_setting.sql` | **`free_hit_on_no_ball boolean default false` added to `matches` — opt-in free hit per match** |
| 015 | `015_badge_columns.sql` | `bowl_hat_tricks int default 0` added to `player_career_stats` — needed for Hat-trick badge |
| 016 | `016_bat_thirties.sql` | `bat_thirties int default 0` added to `player_career_stats` and `player_tournament_stats`; RPC updated to increment on 30–49 innings |
| 017 | `017_man_of_series.sql` | **`man_of_series_id uuid REFERENCES players(id)` added to `tournaments` — needed for Man of Series feature** |
| 018 | `018_teams.sql` | **Global `teams` table — admins/scorers insert, admins delete, all authenticated users select. Powers auto-populate in match + tournament setup.** |
| 019 | `019_player_claim.sql` | **`players_claim_own` RLS policy — player-role user can UPDATE a row where `user_id IS NULL`, setting it to their own `auth.uid()`. Prevents duplicates when admin pre-creates a player before the user accepts their invite.** |
| 020 | `020_guest_player.sql` | **`is_guest boolean default false` added to `players` — marks players added without an app account. Shown as amber "Guest" badge on carousel. Admin can link a guest to a real account later via PlayerEdit.** |
| 021 | `021_team_players.sql` | **`is_guest boolean default false` added to `teams`; new `team_players` join table (team_id + player_id, PK) with RLS — admins/scorers insert/delete, all authenticated select. Powers guest team default roster feature.** |
| 022 | `022_matches_played_counter.sql` | **`matches_played int default 0` added to `player_career_stats`; RPC `increment_matches_played(match_id)` increments counter for all squad members atomically; backfills existing completed matches. Called from `matchService.incrementMatchesPlayed()` alongside `autoAssignManOfMatch` on match completion.** |
| 023 | `023_player_sub.sql` | **`is_substitute boolean default false` added to `match_players` — marks players added mid-match via the Sub flow.** |
| 024 | `024_match_player_active.sql` | **`is_active boolean default true` added to `match_players` — subbed-out players set to false, excluded from batting/bowling candidate lists.** |
| 025 | `025_sub_linkage.sql` | **`subbed_out_player_id uuid references match_players(id)` added — each sub row links to the exact match_players row they replaced, enabling correct swap-back with multiple subs in one match.** |

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

### `src/pages/Home.jsx`
- Fetches 3 data sources in parallel via `Promise.all`: `matchService.listMatches()`, `playerService.getAllCareerStats()`, `tournamentService.listTournaments()`
- **Sections (top to bottom):**
  1. **Header** — app name + role-aware CTA: `canScore` → "+ New Match", `isPlayer` → "My Profile", others → nothing
  2. **Live Match Hero** — shown only when `status === 'live' || 'paused'`; green gradient card with "Resume Scoring" (canScore) + "View Scorecard" buttons
  3. **Quick Stats Strip** — 2×2 grid: Matches count, Players count, Top Scorer (tap → player profile), Top Wickets (tap → player profile). Shows "—" when no data.
  4. **Active Tournament Banner** — shown when any tournament has `status !== 'completed'`; taps to `/tournaments/:id`
  5. **Recent Matches** — last 3 completed matches via `<MatchCard>`; "See all" link if >3 exist; role-aware empty state message
- `StatPill` helper component rendered inline — renders as `<button>` when `onClick` prop provided, plain `<div>` otherwise

### `src/pages/Players.jsx`
- Header: Players count + Filter button + Delete All (trash icon, `kameshwaran26@gmail.com` only) + Add button
- Delete All is **icon-only** (no text) to avoid mobile overflow; guarded by `isSuperAdmin = isAdmin && user?.email === 'kameshwaran26@gmail.com'`
- Add button shown to all `canCreatePlayer` roles (admin/scorer/captain/player); label is "Add" for admin, "My Profile" for others
- **No list** — only the PlayerCarousel is rendered when players exist (no PlayerCard list)
- Fetches `getAllCareerStats()` on mount, builds `statsMap = { [player_id]: stats }`, passed to carousel
- Two ConfirmDialogs: one for single player delete, one for delete-all
- `activeCarouselIndex` state resets to 0 whenever search/filter changes
- **OG / Guest toggle:** two full-width buttons directly below search bar (`playerTypeFilter` state: `'' | 'og' | 'guest'`); clicking the active button deselects; stacks with search and filter panel; counts toward `activeFilterCount` badge on Filter button
- **Compare mode:** ⚔ icon button (3rd element in OG/Guest row) toggles `compareMode`. In compare mode a banner appears with player chips + "Go ⚔" button. Tapping a carousel card selects it (no flip); **re-tapping a selected card deselects it** (promotes p2→p1 if needed). When both selected, sheet opens automatically. `PlayerVsSheet` renders at page root with `p1`, `p2`, `p1Stats`, `p2Stats` props.
- **Player count display:** inline `text-sm tabular-nums whitespace-nowrap` — shows plain number when unfiltered, `19 / 28` style (bold count + lighter total) when search/filter active. No pill/badge — scales cleanly to triple digits.

### `src/components/player/PlayerVsSheet.jsx`
- Props: `{ p1, p2, p1Stats, p2Stats, onClose }`
- Fetches `getPlayerVsPlayer(p1.id, p2.id)` on mount — two queries (p1 bat vs p2 bowl, p2 bat vs p1 bowl), wides filtered in JS not Supabase (Supabase `.neq` excludes NULL rows)
- Renders inside `BottomSheet` with `heightClass="h-auto" noScroll` — everything fits without scrolling
- **Header:** avatars + names + role + ⚔ icon (no sticky needed since no scroll)
- **Direct Matchup:** `BattleCard` per direction when deliveries exist; amber "No shared match history" card otherwise
- **Career:** `StatRow` grid (P1 value | label | P2 value); green highlight on winner; `lowerIsBetter=true` for bowling Avg and Econ

### `src/components/player/PlayerCarousel.jsx`
- **Circular infinite-loop** 3D card carousel — pure CSS transforms, no external library
- Props: `players[]`, `activeIndex`, `onChangeIndex(idx)`, `onSelect(playerId)`, `statsMap = {}`, `compareMode = false`, `selectedIds = []`
- `circularOffset(idx)` returns shortest-path offset so wrapping side cards appear on the correct side
- `wrap(idx)` helper: `((idx % n) + n) % n` — used in prev/next/swipe/click
- **Left/right arrow buttons** — circular white buttons (`w-9 h-9`) absolutely positioned at vertical center of the card container; shown only when `n > 1`; alternative to swiping
- **Front face:** avatar (photo or initials), name, role badge, style text, badge strip, stats strip (Runs/Wkts/Matches from `statsMap`)
- **Badge strip:** 7 emoji badges computed via `computeBadges(frontStats, 0, allStatsArr)`; earned badges shown full color, unearned shown `grayscale opacity-25`; `duckHunterCount` defaults to 0 on the carousel (no extra query); tapping a badge shows a full-height overlay on the info zone (dark slate for unearned, green gradient for earned) with emoji, label, unlock hint or "✓ Earned!" and "Tap to close" — tapping the overlay or anywhere on the card while open dismisses it instead of flipping
- **Back face (flip on tap of center card):** dark slate gradient (`#0f172a → #1e293b`), name/role header, 3×2 stat grid (Batting: Avg/SR/HS; Bowling: Avg/Economy/Best), full-width green "View Profile →" button pinned at bottom
- Detailed back-face stats fetched lazily via `playerService.getCareerStats()` on first flip; cached in `detailCache`
- Swiping resets flip to front on the new active card
- **Compare mode:** `compareMode` prop bypasses flip — `handleCardClick` calls `onSelect(playerId)` instead of `flipActive`. Entering compare mode resets flip+badge via `useEffect([compareMode])`. Selected cards get a green "✓ Selected" badge top-right; unselected active card gets a "Tap" badge.
- No rubber band — drag is unclamped (circular, no edges); soft resistance past `THRESHOLD = 0.75` only
- Fast flicks that would cross the wrap point do a single-step jump (no multi-step animation across boundary)
- **Mobile swipe fix:** React registers `touchmove` as passive — `e.preventDefault()` has no effect. Fixed with native `addEventListener('touchmove', handler, { passive: false })`. Gesture direction locked in first 5px (H vs V); only horizontal blocks page scroll.
- "View Profile →" uses `e.stopPropagation()` to prevent the back-flip handler from firing
- **Front face design:** Green gradient avatar zone (230px), white info zone (190px) — name `text-[15px] font-bold`, role badge `text-[11px] px-3 py-1`, style text `text-[11px] mt-2`, stats strip at bottom via `mt-auto`
- `CARD_W = 260, CARD_H = 420, CARD_SPACING = 150`
- Shadow tuned to `0 8px 24px rgba(0,0,0,0.14)` (active) to avoid visible gradient bleed below card

### `src/pages/LiveScoring.jsx`
- `oversLimitOpen` state triggers BottomSheet when `total_legal_balls >= total_overs * 6`
- BottomSheet has "Undo Last Ball" and "End Innings" actions
- Guard: `if (winConfirmOpen) return` prevents conflict with win condition modal
- **Partnership tracker:** `partnershipStats` IIFE computes runs+balls since last wicket; shown as pill below striker indicator
- **Chase meter (2nd innings):** `chaseStats` IIFE computes CRR/RRR/progress; card shown only when `innings_number === 2` and `target` is set; RRR cell turns red when behind
- **Milestone toasts:** `milestonesRef` Set tracks fired toasts; resets on innings change; fires once per batsman 30/50/100 and bowler 3/4/5 wickets
- **Auto MoTM:** When match ends (win condition or manual 2nd innings end), `matchService.autoAssignManOfMatch(id)` is called automatically — fetches all innings/scorecards, scores each player via `calcMotmScore`, saves highest scorer to `matches.man_of_match_id`. No manual picker.
- **Read-only guard:** `useEffect` on `[match]` — if `match.status === 'completed'` and current user is not `kameshwaran26@gmail.com`, redirects to `/matches/${id}/summary` immediately. Only Kamesh can access a completed match in scoring view.
- **MatchResultBanner:** `onClose` navigates to summary (no longer opens MoTM BottomSheet).
- **WK/Bowler conflict:** `handleBowlerSelect` checks if selected bowler === keeper after setting — if so, sets `keeperBowlingPrompt` state which shows a `ConfirmDialog` asking to change keeper. "Change Keeper" opens `keeperModalOpen`; "Keep as Is" dismisses.

### `src/components/player/FormSparkline.jsx`
- Props: `{ history: Array }` — filters batting rows from match history, slices last 10, renders `LineChart` (recharts) of runs
- Custom tooltip shows runs/balls/SR per innings; not-out innings displayed with `*`

### `src/components/match/MomentumGraph.jsx`
- Props: `{ deliveries: Array }` — groups by `over_number`, sums runs (excludes byes/leg-byes), counts wickets
- Bars turn red for overs with ≥1 wicket, green otherwise; tooltip: "Over N: X runs, Y wkt(s)"

### `src/components/player/BatterSRChart.jsx`
- Props: `{ deliveries: Array, batsmanId: string }` — filters by batsman, groups by over, computes SR
- Color scale: green ≥150, blue ≥100, gold ≥50, red <50, gray =0 balls faced

### `src/components/player/HeadToHeadPanel.jsx`
- Props: `{ batsmanId: string }` — fetches via `getHeadToHeadAll()`, list of bowlers with B/R/Dis columns
- Tapping a bowler drills into a 3×2 stat grid (balls, runs, dismissed, SR, dot%, 4s/6s)

### `src/pages/AdminUsers.jsx`
- `friendlyInviteError(msg)` maps raw error strings to user-friendly messages
- Catch-all: "Could not send invite. Please check your SMTP settings or try again later."
- Error extraction from `FunctionsHttpError`: `await error.context?.json?.()` then check `body.error` → `body.code`
- User row layout: avatar left, name + email + role pill stacked in middle column, trash anchored top-right
- Role select has `ROLE_COLORS` for all five roles incl. `player` (teal); fixed `w-24` removed — pill sizes naturally
- ConfirmDialog used for delete confirmation (no inline confirm block in the row)

### `src/pages/Teams.jsx`
- Route: `/teams` (any logged-in user; add requires admin/scorer, delete requires admin)
- Admin/scorer can add teams with optional **Guest team** toggle; guest teams get an amber badge
- Tapping a team card expands it to show a player roster manager — search + tap to add/remove players, saves immediately via `setTeamPlayers`
- Guest toggle shown below the add form (applies to the next team being created)
- Teams auto-populate in match and tournament setup dropdowns; guest teams shown with ★ suffix
- **Rename:** pencil icon on each row enters inline edit mode (input + ✓ / ✕); saving calls `updateTeamName()` which backfills all historical matches
- **Roster filter:** OG / Guest toggle buttons inside the expanded roster panel — mutually exclusive; `rosterFilter` state on the expanded entry (`'' | 'og' | 'guest'`)

### `src/services/teamService.js`
- `listTeams()`: fetches `id, name, is_guest` ordered by name
- `getAllTeamPlayers()`: returns every `team_players` row (`team_id, player_id`) — Teams page builds a `player_id → team_id` map so a player already on one team's default roster is hidden from every other team's roster picker (and excluded from the OG/Guest available counts)
- `addTeam(name, isGuest?)`: inserts team with optional guest flag
- `deleteTeam(id)`: deletes by id; does NOT affect existing matches (team names are plain text on matches)
- `getTeamPlayers(teamId)`: returns `player_id[]` for a team's default roster
- `setTeamPlayers(teamId, playerIds)`: replaces full roster — delete all then insert new batch
- `updateTeamName(id, oldName, newName)`: updates team row then parallel-updates `team1_name` / `team2_name` on all matches that used the old name

### `src/services/playerService.js`
- `deletePlayer(id)`: explicitly deletes from `player_career_stats` and `player_tournament_stats` before hard-delete (belt-and-suspenders alongside cascade migration)
- `deleteAllPlayers()`: same pattern — deletes stats rows for unused players before hard-delete
- `getAllCareerStats()`: fetches all `player_career_stats` rows joined with `players(id, name, photo_url, role)`, ordered by `bat_runs` descending — used by Leaderboard page
- `getDuckHunterCount(playerId)`: 2-round-trip query — wicket deliveries by bowler → batting_scorecards with 0 runs in those innings → cross-reference with Set to count duck dismissals

### `src/services/matchService.js`
- `getDistinctTeamNames()`: distinct team1_name + team2_name from completed matches, sorted
- `getH2HMatches(teamA, teamB)`: two separate queries (each ordering) merged and sorted — Supabase compound `.or()` with AND subclauses is unreliable for this pattern
- `getH2HTopPerformers(matchIds)`: innings IDs → parallel batting + bowling scorecards → aggregate by player → top 3 each
- `autoAssignManOfMatch(matchId)`: collects all innings scorecards + match players → scores each via `calcMotmScore` → writes `man_of_match_id` to match. Non-throwing (wrapped in try/catch).
- `autoAssignManOfSeries(tournamentId)`: queries all completed matches in tournament → aggregates all scorecards → scores each unique player → writes `man_of_series_id` to tournament. Throws on DB error (caller catches).
- Both `autoAssignManOfMatch` and `autoAssignManOfSeries` use `pickMotm()` from cricketUtils.
- `autoAssignManOfMatch` resolves `winningTeam` (1 or 2) from `winning_team_name` vs `team1_name`/`team2_name` and passes it to `pickMotm` for tie-breaking.
- `autoAssignManOfSeries` passes `winningTeam = null` — MoS is purely stats-based across all matches.

### `src/lib/cricketUtils.js` — `pickMotm()` and `calcMotmScore()`
- **`calcMotmScore(playerId, battingCards, bowlingCards, fieldingCards)`** — per-match impact score (used for display in MoTM picker dropdown)
  - Batting: runs×1, fours×1 bonus, sixes×2 bonus, milestones (+5/+15/+30), SR bonus min 6 balls (≥200=+20, ≥150=+12, ≥125=+6), not-out bonus +5 (runs≥10), duck penalty −5
  - Bowling: wickets×25, maidens×6, haul bonus (+10 for 3-fer, +20 for 5-fer), economy bonus min 6 legal balls (≤5=+15, ≤6=+10, ≤8=+5) — applies even with 0 wickets
  - Fielding: catches×8, stumpings×10, run_outs×8
- **`pickMotm(playerIds, battingCards, bowlingCards, fieldingCards, playerTeams, winningTeam)`** — picks best player using full tiebreaker chain: pts → winning team → runs → wickets → SR → economy. Returns null if all players score 0.
- **`calcMotmDetail(playerId, battingCards, bowlingCards)`** — returns `{ runs, wickets, sr, econ }` for tiebreaker comparison (internal use only)

### `src/pages/Leaderboard.jsx`
- Route: `/leaderboard` (any logged-in user)
- Three tabs: **Batting** (runs → avg → SR), **Bowling** (wickets → avg → economy), **MVP** (weighted points)
- Bowling tab shows all players who have bowled at least one legal ball (`bowl_legal_balls > 0`) — not just wicket-takers
- Column headers are tappable to re-sort; second tap reverses direction
- Realtime: subscribes to `postgres_changes UPDATE` on `player_career_stats` — refreshes automatically when an innings completes
- Live indicator (green pulsing dot) shown when any match has `status = 'in_progress'`
- Bottom nav entry: "Rankings" tab with `BarChart2` icon
- **MVP formula:** `runs×0.5 + wickets×20 + fours×1 + sixes×2 + thirties×5 + fifties×10 + hundreds×25 + catches×5 + stumpings×5 + run_outs×3`

### `src/components/match/PlayerMatchCardSheet.jsx`
- Props: `{ open, onClose, player, match, inningsList, batStats, dismissal, bowlStats, bowlMaidens, deliveries }`
- **Satori-based** (not html2canvas) — generates 1080×1920px PNG via `generatePlayerCard()` from `src/lib/generateShareCard.jsx`
- `useEffect([open, player?.id])` generates card on open; revokes previous object URL; shows spinner while generating
- Preview: `<img src={cardUrl}>` in a 440px dark container — the exact exported PNG at display size
- Share flow: blob → `navigator.share({files})` → `navigator.clipboard.write` → download fallback
- "View SR Chart" secondary button opens nested BottomSheet with `BatterSRChart`

### `src/lib/generateShareCard.jsx`
- Exports `generatePlayerCard({ player, match, inningsList, batStats, dismissal, bowlStats })` → PNG Blob
- Uses **satori** (Vercel) to render JSX → SVG → PNG via `canvas.toBlob`. No DOM screenshot — pixel-perfect across all devices
- Font: Inter WOFF (400 + 700) loaded once from jsDelivr CDN, cached in module-level `_fonts`
- Photo: fetched as base64 data URL per-URL, cached in `_photoCache`; gracefully falls back to initials avatar if no photo
- Card is 1080×1920px **light design** (white background); sections: green gradient top band (app name + player's team badge), player identity (avatar left + name/role right), match scores (both teams, 🏆 on winner), green result strip (winning team name + summary), batting stats (Runs/Balls/SR + 4s/6s + dismissal), bowling 2×2 grid (Overs/Wickets top row, Runs/Economy bottom row — hidden when `legal_balls === 0`), footer watermark
- **Player's team** sourced from `player.team` (integer 1/2 written into `playersMap` in Scorecard.jsx from `match_players.team`)
- **Man of the Match badge**: gold "🏆 Man of the Match" pill next to the role pill, shown only when `match.man_of_match.id === player.id`
- **Winner** sourced from `match.winning_team_name`; 🏆 badge shown on winning team score; green result strip shows winning team name + `match.result_summary`
- **Vite config requirement:** `define: { global: 'globalThis', 'process.env': '{}', 'process.version': '"v18.0.0"', 'process.platform': '"browser"' }` — Satori's deps reference Node.js globals that don't exist in the browser
- **Satori gotchas (hard-won):**
  - **No React Fragments** (`<>...</>`) — Satori does not flatten them; a Fragment is treated as an offset flex item and indents its whole subtree. Wrap conditional groups in a real `<div style={{display:'flex',flexDirection:'column'}}>` instead. (This broke bowling-section column alignment until fixed.)
  - Stat columns use explicit `width` + `flexShrink: 0`; an empty/whitespace cell collapses, so use `justifyContent: 'space-between'` to pin the two bowling values to the RUNS / STRIKE-RATE columns (centres 227 / 853 at 1080px width) rather than relying on a spacer cell.
  - Every text container needs `justifyContent: 'center'` + `width: '100%'` to actually centre.
  - **No emoji / special glyphs** — only the loaded Inter WOFF is available, so emoji (🏆) and symbols (★) render as tofu boxes. For icons, embed an inline SVG as a data-URI `<img>` (e.g. `TROPHY_DATA_URL` for the MoTM badge).

### `src/pages/MatchSummary.jsx`
- **Three-tab layout:** SUMMARY | SCORECARD | COMMENTARY — sticky tab bar with underline style
- **Header:** 3-column grid: team1 score (left) · result (center) · team2 score (right)
- **Summary tab:** blue gradient MoTM card (name + bat/bowl stats + avatar); per-team performance block with Top Bat + Top Bowl (avatar + stats); MoTM override dropdown (`canScore`); Share Result (Web Share API → clipboard text)
- **Scorecard tab:** team name tabs switch innings; Google-style rows: avatar + name (C/Wk badges + ★) + dismissal below + R B 4s 6s S/R; yet to bat; fall of wickets (runs/wkts, name, over); bowling O M R W Econ; tap batter to open `PlayerMatchCardSheet`
- **Commentary tab:** per-innings HighlightsFeed sections
- Loads innings list + deliveries (parallel) + scorecards in one useEffect; `playerMeta` + `playersMap` built from matchPlayers
- `scoredPlayers` useMemo must be declared before `if (!match) return null` (Rules of Hooks)

### `src/pages/Scorecard.jsx`
- **Updated InningsBlock:** Google-style layout — player avatar + name (C/Wk + ★ MoTM) + dismissal below name; columns R B 4s 6s S/R (batting) and O M R W Econ (bowling); removed 1s/2s/3s/Dots/Wd/NB columns
- Tap any batsman row → `PlayerMatchCardSheet` opens with performance card preview + Share button + "View SR Chart" secondary
- Bowling rows have a `<Share2>` icon button that opens the same sheet for that bowler
- `openPlayerCard(pid)` helper: flattens all innings deliveries, runs `buildStatsFromDeliveries` across all innings, extracts bat/bowl/dismissal stats for the player
- `MomentumGraph` displayed above each innings block
- **Highlights Feed** (`HighlightsFeed`): collapsible per-innings feed of auto-detected events
- **Over-by-Over table** (`OverByOverTable`): collapsible per-innings table (Ov | Bowler | R | W | Balls), collapsed by default
- `playersMap` state built from `matchPlayers`: `{ [player_id]: { name, photo_url } }` — passed to InningsBlock for name resolution

### `src/pages/TournamentDetail.jsx`
- **Complete Tournament button**: visible when `canManageTournaments && tournament.status !== 'completed' && matches.length > 0 && matches.every(m => m.status === 'completed')`. Calls `autoAssignManOfSeries` then `updateTournament({status:'completed'})` then re-fetches.
- **Man of the Series card**: shown when `tournament.man_of_series` is set (gold Trophy card, same style as MoTM on MatchSummary).
- `getTournament` select includes `man_of_series:man_of_series_id(id, name)` join (migration 017 required).

### `src/pages/HeadToHead.jsx`
- Route: `/h2h` (any logged-in user), accessed via "Compare" chip on Matches page
- Team selector: two dropdowns filtered to exclude each other + swap button (↔)
- Sections: Win/Loss record card (% bar), Avg scores card, Recent results (last 5), Top performers (top 3 batsmen + bowlers)
- `getDistinctTeamNames()` loads team options from completed matches
- `getH2HMatches(teamA, teamB)` fetches both orderings (A vs B + B vs A) separately, merged in JS
- `getH2HTopPerformers(matchIds)` aggregates batting/bowling scorecards by player across all H2H matches

### `src/components/player/PlayerBadges.jsx`
- Props: `{ stats, duckHunterCount, allStats }` — uses `computeBadges()` from cricketUtils
- Always rendered (pass `careerStats || empty` so it shows even for players with no DB stats row)
- All-locked state: shows all 6 chips greyed; some earned: shows earned (green) + "🔒 N locked" chip
- 7 badges: 🏏 Half-centurion, 💯 Centurion, 🎯 Accumulator (dynamic leader in 30s, min 2), 🎳 5-Fer, 🎩 Hat-trick, 🔥 Duck Hunter (5+ duck dismissals), ⚡ Highest SR (dynamic, min 20 balls)
- **Naming note**: Different from local `PlayerBadges` in Scorecard.jsx which shows (C)/(WK) role badges

### `src/components/match/HighlightsFeed.jsx`
- Props: `{ deliveries, playersMap }` — calls `buildHighlights()` from cricketUtils
- Collapses by default; share button: Web Share API → clipboard → textarea execCommand fallback

### `src/components/match/OverByOverTable.jsx`
- Props: `{ deliveries, playersMap }` — groups by `over_number`, collapses by default
- Ball tokens: `W`, `Wd`/`Wd+N`, `Nb`/`Nb+N`, `BN`, `LbN`, or digit
- R column: red if wickets, green if ≥10 runs

### `src/pages/MatchSummary.jsx`
- MoTM shown as gold card with Trophy icon + pts badge (`scoredPlayers` useMemo)
- Off-screen 400px div (`cardRef`) captures rich share card: result, MoTM, top scorer, top bowler
- Single "Share Result" button: Web Share API (mobile) → clipboard copy (desktop) → PNG download fallback
- `scoredPlayers` useMemo: deduped match players scored via `calcMotmScore`, sorted desc — shown in override dropdown with `— N pts` suffix
- `canScore` users see "Override Man of the Match" select; `handleMotmChange` writes directly to `matches.man_of_match_id`
- **Hooks order fix:** `scoredPlayers` useMemo must be declared before `if (!match) return null` to avoid Rules-of-Hooks violation
- `getScorecards` uses `players!player_id(name)` disambiguation — `batting_scorecards` has 3 FK refs to players; plain `players(name)` causes Supabase ambiguity error returning null silently

### `src/components/player/PlayerForm.jsx`
- **Redesigned (June 2026):** replaced dropdowns with pill selectors; `PhotoUploader` inlined directly — no separate component
- **Hero section:** green gradient card with circular avatar (tap-to-change overlay + green camera badge), inline underline name input
- **Playing Role card:** `PillGroup` with 4 emoji pills (Batsman 🏏, Bowler 🎳, All-rounder ⚡, Keeper 🧤) — tap to select/deselect
- **Playing Style card:** batting hand (Right/Left) + bowling style (Right-arm Fast/Medium/Spin, Left-arm Fast/Medium/Spin, Doesn't bowl) as pill groups
- **Account card (admin only):** guest toggle + optional "Link to user account" dropdown (only shown when `!isGuest && appUsers.length > 0`)
- `PillGroup` and `SectionLabel` are local helper components defined in the same file
- Photo upload inlined: 8MB limit, `URL.createObjectURL` preview, hidden file input on the avatar label

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
| `PlayerNew.jsx` | Player-role user could navigate to `/players/new` and hit DB unique constraint error on second profile | On mount, calls `getPlayerByUserId()` — if profile exists, redirects to it; if no linked profile, shows "Ask your admin" screen instead of a create form |
| `PlayerNew.jsx` + `PlayerForm.jsx` + `019_player_claim.sql` | Admin pre-creating a player then inviting that user caused duplicate player rows — name-match claim was ambiguous (two players with same name, different emails) | Removed name-match claim entirely. Player-role users without a linked profile see "Ask your admin to link your account" screen. Admin create form has "Link to user account" dropdown (all unlinked users regardless of role). RLS policy `players_claim_own` retained for direct `user_id` update. |
| `PlayerForm.jsx` + `PlayerEdit.jsx` + `020_guest_player.sql` + `PlayerCarousel.jsx` | No way to add players from opposing teams who have no app account | Added `is_guest` flag + toggle in PlayerForm (admin only). Guest players show amber "Guest" badge on carousel card. Admin can later link a guest to an invited user via the edit page — `is_guest` clears automatically on link. "Link to user account" dropdown only shows on edit when player has no `user_id`. |
| `Players.jsx` | Any admin could trigger "Delete All Players" | Restricted to `kameshwaran26@gmail.com` only (`isSuperAdmin` guard) |
| `MatchSetupStepper.jsx` | Every standalone match created with `status: 'live'` — old matches stayed live forever, home page showed multiple live heroes | Removed hardcoded `status: 'live'` from `createMatch()`; calls `matchService.startMatch()` after innings creation instead. DB default `'upcoming'` applies until scoring begins. |
| `MatchCard.jsx` | Live status chip used `animate-pulse` on text — looked bad; no visual dot indicator | Replaced with green pulsating dot `●` + static "LIVE" text, consistent with Home page hero style |
| `Venues.jsx` | Non-admin users could click venue cards and navigate to edit page (route wall, but confusing UX) | Cards are now plain `<div>` for non-admins; only admins get clickable `<button>` |
| `PlayerEdit.jsx` | Auth check ran after DB fetch — unauthorized users triggered a player data fetch before being redirected | Rewritten to wait for auth loading to complete, then run permission check before fetching player |
| `migrations/012` | `venues` and `tournaments` had no DELETE policy; 8 tables still on blanket `allow_all` from migration 001 | Added DELETE policies for venues/tournaments; replaced `allow_all` with role-scoped policies on all remaining tables |
| `LiveScoring.jsx` | `MatchResultBanner` and MoTM BottomSheet both opened simultaneously — banner's "Continue" navigated without MoTM | Removed `setMotmOpen(true)` from win path; banner's `onClose` now closes banner then opens MoTM |
| `MatchSetupStepper.jsx` | Captain selection was optional — matches could start without captains assigned | `step2Valid` now requires `!!form.team1CaptainId && !!form.team2CaptainId`; dropdowns changed to `"Select captain *"` |
| `BallInputPanel.jsx` | Extras modal did not close or log on tap — two-step confirm UX confused users; iOS Safari nested `position:fixed` clipped modal below screen | Removed Confirm button — tapping run number calls `onExtra` and closes modal immediately; modal rendered via `createPortal(…, document.body)` to escape iOS Safari fixed-parent clipping |
| `BallInputPanel.jsx` | Modal was clipped inside parent `position:fixed` div on iOS Safari — run buttons invisible | Used `createPortal` to render extra selection sheet directly on `document.body` |
| `BottomSheet.jsx` | Content overlapped iPhone home indicator (missing safe-area padding) | Content div: `p-4` → `px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]` |
| `LiveScoring.jsx` | No Ball: selected runs went to `extra_runs` (penalty), never to `runs_off_bat`; chip showed plain "nb" always | `handleExtra`: for No Ball, `runsOffBat = extraRuns`, `finalExtraRuns = 1`; chip now shows "nb+2" when batsman scored |
| `LiveScoring.jsx` | Wide: `Math.max(extraRuns, 1)` meant selecting 1 gave `extra_runs=1` (base only), chip showed "wd" instead of "wd+1" | Changed to `extraRuns + 1` — always adds 1 base penalty; select 0→wd, select 2→wd+2 |
| `MatchSetupStepper.jsx` + `matchStore.js` + `migrations/013` | Free hit always triggered after every no ball — not appropriate for gully cricket | Added `free_hit_on_no_ball boolean default false` column to `matches`; checkbox in Rules step; `newFreeHit` and rehydration gated on `!!match.free_hit_on_no_ball` |
| `ConfirmDialog.jsx` | Buttons missing `type="button"` — defaulted to `type="submit"`, could accidentally submit nearby form | Added `type="button"` to both Cancel and Confirm buttons |
| `AdminUsers.jsx` + `playerService.js` | No way to wipe test data without direct DB access | Added `masterReset()` — deletes all matches (cascades innings/deliveries/scorecards) + career/tournament stats; "Reset All Player Stats" button in Danger Zone visible only to `kameshwaran26@gmail.com`; players and users untouched |
| `PlayerCarousel.jsx` | Rubber band effect on mobile swipe — `e.preventDefault()` had no effect because React registers `touchmove` as passive | Added native `addEventListener('touchmove', handler, { passive: false })`; gesture direction locked in first 5px so vertical scroll still works |
| `PlayerCarousel.jsx` | Carousel had hard edges — swiping past last/first card caused rubber band / dead stop | Implemented circular infinite loop: `circularOffset()` shortest-path math + fast-flick single-step jump at wrap boundary |
| `PlayerCarousel.jsx` | Back face `style` prop duplicated — `backfaceVisibility`/`transform` silently dropped | Merged into single `style` object |
| `PlayerCarousel.jsx` | Large shadow spread (`64px`) created visible gradient band below card | Reduced to `0 8px 24px rgba(0,0,0,0.14)` — blends naturally with page background |
| `PlayerCarousel.jsx` | Card too short on mobile — dead gap in white info zone | Increased `CARD_H` from 360 → 420; bumped text sizes (name `text-[15px]`, role `text-[11px]`, stats `text-base`) to fill extra height |
| `PlayerCarousel.jsx` | No tap-alternative to swipe for non-touch users | Added left/right chevron arrow buttons absolutely positioned at card mid-height |
| `PlayerCarousel.jsx` | No badge visibility on player cards | Added badge strip using `computeBadges`; earned = full color, unearned = grayscale/dim |
| `PlayerCarousel.jsx` | Badge popover always pointed at center of strip regardless of tapped badge | Moved popover inside each badge button (per-badge relative positioning) then refactored to full info-zone overlay to avoid card `overflow-hidden` clipping |
| `PlayerCarousel.jsx` | Tapping badge again to dismiss triggered card flip instead of closing popover | `handleCardClick` checks `activeBadge` first — dismisses overlay without flipping |
| `useRole.js` + `App.jsx` | Captain role had `canManagePlayers: true` — could edit any player's profile | `canManagePlayers` narrowed to admin only; new `canCreatePlayer` flag for admin/scorer/captain/player; viewer blocked at route level |
| `Teams.jsx` + `teamService.js` + `021_team_players.sql` | No way to pre-define a guest team's player roster for auto-fill in match setup | Added `is_guest` flag to teams, `team_players` join table, roster manager UI in Teams page, auto-populate in `MatchSetupStepper` on guest team selection |
| `Teams.jsx` + `teamService.js` | No way to rename a team or update historical match records | Added inline rename (pencil icon → input + confirm/cancel); `updateTeamName()` updates team row then backfills `team1_name`/`team2_name` on all matches |
| `Players.jsx` | Guest filter was buried inside the filter panel — not prominent enough | Replaced with two full-width toggle buttons (OG Players / Guest Players) directly below search bar; `playerTypeFilter` state replaces `guestFilter` boolean |
| `Teams.jsx` | Roster player list showed all players mixed; hard to find non-guest players for non-guest teams | Added OG / Guest mutually-exclusive filter pills inside each team's expanded roster panel (`rosterFilter` state per team in `expanded` map) |
| `Teams.jsx` + `teamService.js` | A player added to one team's default roster still appeared selectable in other teams' rosters | `getAllTeamPlayers()` loads all assignments into an `assignedTo` (player_id→team_id) map on mount; players on another team shown greyed-out/disabled with "In <team>" sublabel (not hidden); map updated live on toggle; OG/Guest counts reflect only available players |
| `MatchSetupStepper.jsx` | Wicket keeper was optional; non-guest teams with rosters weren't auto-populated | Keeper now mandatory in `step2Valid`; `applyGuestTeam` renamed to `applyTeamRoster` — fires for any team in registry (guest or not); resets captain/keeper on team change |
| `TournamentSetup.jsx` | Series match creation had no captain or keeper selection | Added `captainIds` + `keeperIds` state; Captain/Keeper selects per team (shown when squad has players, series only); `canCreateMatches` requires both; `is_captain`/`is_keeper` flags passed to `setMatchPlayers` |
| `MatchSetupStepper.jsx` | Joker section had misaligned subtitle (pushed right via `justify-between`) | Subtitle moved below title as a `<p>` tag |
| `PlayerForm.jsx` | Form was plain dropdowns — poor mobile UX | Full redesign: hero photo section, pill selectors for role/batting/bowling, card sections with icon labels |
| `cricketUtils.js` + `matchService.js` | MoTM auto-assign picked first player alphabetically when all scores were 0 (bestScore=-1 floor); also wrong player on pts tie | Introduced `pickMotm()` with full tiebreaker chain: pts → winning team → runs → wickets → SR → economy. `calcMotmDetail()` extracts tiebreaker stats. Formula also improved: SR min balls 10→6, added ≥200 SR tier (+20), economy bonus now applies even without wickets |
| `matchService.js` `getScorecards` | `batting_scorecards` has 3 FK refs to players (`player_id`, `bowler_id`, `fielder_id`) — `select('*, players(name)')` returned null silently (Supabase ambiguity error) → all MoTM scores showed 0 pts | Changed to `players!player_id(name)` to explicitly disambiguate the join |
| `Leaderboard.jsx` | Bowling tab filtered `bowl_wickets > 0` — bowlers who hadn't taken a wicket were invisible | Changed filter to `bowl_legal_balls > 0` — any bowler who delivered at least one ball appears |
| `MatchSummary.jsx` | `scoredPlayers` useMemo declared after `if (!match) return null` — violated Rules of Hooks, crashed the page | Moved useMemo above the early return |
| `Matches.jsx` | Header buttons overflowed off screen on mobile | "Delete All" → icon-only Trash2; "Compare" → plain text with bg-ink-100; "New" → btn-primary |
| `Teams.jsx` + `teamService.js` + `App.jsx` + `BottomNav.jsx` | No dedicated place to manage team names; team dropdowns in match setup had no suggestions | New `/teams` page (linked in admin sheet in BottomNav); `teamService.js` with `listTeams/addTeam/deleteTeam/getTeamPlayers/setTeamPlayers/updateTeamName`; `MatchSetupStepper` loads `globalTeams` and shows as `<select>` when teams exist; `HeadToHead` merges registered teams with past match teams |
| `LiveScoring.jsx` | Keeper could be selected as bowler with no prompt — WK cannot field and bowl simultaneously | `handleBowlerSelect` checks `bowlerId === keeper` after setting — triggers `keeperBowlingPrompt` ConfirmDialog; "Change Keeper" opens keeper modal; "Keep as Is" dismisses |
| `Players.jsx` + `PlayerCarousel.jsx` + `PlayerVsSheet.jsx` + `playerService.js` | No player-vs-player comparison feature | Added compare mode: ⚔ button toggles mode, carousel cards select instead of flip, `PlayerVsSheet` shows direct matchup (delivery stats) + career side-by-side. Fixed: wides filtered in JS not Supabase neq (NULL exclusion bug). |
| `BottomSheet.jsx` | Background page scrolled behind open sheet on mobile | Added `document.body.style.overflow = 'hidden'` lock via `useEffect([open])`; restored on close. Added `noScroll` prop for sheets that should never scroll internally. |
| `Players.jsx` | "19 of 28" count wrapped inside pill on narrow screens; wouldn't scale to triple digits | Removed pill entirely; count is now inline `tabular-nums whitespace-nowrap` text — plain number when unfiltered, `19 / 28` (bold/lighter) when filtered. |
| `Players.jsx` | Re-tapping a selected player in compare mode showed "Already selected" toast instead of deselecting | `handleSelectForCompare` now deselects on re-tap: clears p1 (promoting p2→p1) or clears p2. |
| `MatchSummary.jsx` | Single-page result view had no scorecard data or commentary — required navigating to separate Scorecard page | Full redesign: 3-tab layout (SUMMARY · SCORECARD · COMMENTARY) with sticky tab bar; Summary shows blue MoTM card + per-team top performers; Scorecard uses Google-style rows (avatar + dismissal below name, R B 4s 6s S/R / O M R W Econ); Commentary shows per-innings HighlightsFeed |
| `Scorecard.jsx` | Batting table had 11 columns (incl. 1s/2s/3s/Dots) with no player photos — too wide for mobile, no visual identity | Updated InningsBlock to Google-style: player avatar in every row, dismissal below name, trimmed to R B 4s 6s S/R (batting) and O M R W Econ (bowling) |
| `PlayerCarousel.jsx` | "Tap" badge clipped by card's `rounded-3xl` corner at `top-3 right-3` | Moved to `top-4 right-4` with slightly more padding; badge now clear of rounded corner. |
| `Scorecard.jsx` + `PlayerMatchCardSheet.jsx` (new) | No way to share individual player performance after a match | Tapping a batsman row or the share icon on a bowling row opens `PlayerMatchCardSheet` — shows a 9:16 performance card preview with player stats + both team scores; "Share Performance" generates 1080×1920px PNG via Satori; shares via Web Share API (mobile) → clipboard → download fallback |
| `PlayerMatchCardSheet.jsx` + `generateShareCard.jsx` | html2canvas produced skewed/inconsistent cards across devices | **Replaced html2canvas with Satori** — renders JSX → SVG → PNG entirely in JS; pixel-perfect on every device; no DOM screenshot. Requires `vite.config.js` `define` block for Node.js globals polyfill. |
| `BallLog.jsx` + `LiveScoring.jsx` | Ball popover showed blank batsman/bowler names — in-session delivery objects only have IDs, no joined name objects | Added `matchPlayers` prop to `BallLog`; `resolveName(id, joinedObj)` helper falls back to `matchPlayers` lookup when joined data is absent |
| `matchStore.js` | App hangs when scoring rapidly — no concurrency lock on `scoreBall()` → double-tap caused two parallel DB writes with same ball number | Added `scoringInProgress: false` state; `scoreBall()` returns null immediately on re-entry; `finally` always clears flag |
| `BallInputPanel.jsx` | No-ball + 6 runs not available — extras run selector capped at 5 for all extra types | `extraRunOptions` function returns `[0,1,2,3,4,6]` for no_ball and `[0,1,2,3,4,5]` for all others; 6 button styled in teal |
| `BallInputPanel.jsx` | No visual feedback while ball is being scored — double-tap possible | Added `disabled` prop; panel shows `opacity-50 pointer-events-none` while `scoringInProgress` |
| `useWinCondition.js` | Wrong team shown as winner when chasing team wins — `team1Name`/`team2Name` passed by match position, not innings batting order | Derive team names from `innings.batting_team` field: `inn1.batting_team === 1 ? team1_name : team2_name`; works regardless of who bats first |
| `matchStore.js` | Batsman end-swap lost on page reload — `swapStriker()` only updated Zustand state, not DB | `swapStriker()` now async; updates last delivery's `striker_after`/`non_striker_after` in DB; store reload reconstructs correctly |
| `StrikerIndicator.jsx` | "Swap striker" button label ambiguous | Renamed to "Swap ends" |
| `MatchSetupStepper.jsx` | Free-text team name inputs bypassed Teams registry — same team stored under different spellings, breaking HeadToHead + rename backfill | When `globalTeams.length > 0`, show registry dropdown + "Other / New team…" option; new names typed via Other are auto-registered via `teamService.addTeam()` on match creation |
| `matchService.js` + `Home.jsx` | Matches listed newest-first — first played match appeared at bottom | Changed `listMatches()` to `ascending: true`; Home "Recent Matches" uses `slice(-3)` to show the 3 most recent in chronological order |
| `Leaderboard.jsx` + `playerService.js` + `matchService.js` + `022_matches_played_counter.sql` | "M" column showed matches where player batted, not total matches in squad — no counter existed for squad participation | Added `matches_played` counter to `player_career_stats`; RPC `increment_matches_played` called atomically on match completion; migration backfills existing matches; leaderboard reads `row.matches_played` — single fast counter, no live query |

## Supabase Realtime Prerequisite
For auto-logout on user removal to work, `app_users` must have Replication enabled:
**Dashboard → Database → Replication → toggle `app_users` on**

---

## Test Suite

**Stack:** Vitest + jsdom + @testing-library/react + @testing-library/user-event + @testing-library/jest-dom  
**Run:** `npm test` (one-shot) · `npm run test:watch` (watch mode)  
**Setup:** `vite.config.js` test block, `src/test-setup.js` (imports jest-dom matchers)

**14 test files, 213 tests — all passing:**

| File | What's tested |
|------|---------------|
| `src/lib/cricketUtils.test.js` | formatOvers, calcCRR/RRR/NRR, calcStrikeRate/Average/Economy, formatBestFigures, isMaiden, detectHatTrick, deriveRunType, applyStrikerSwap, calcWinByWickets/Runs, round, fmt, computeBadges (all 7 badges), calcMotmScore, pickMotm |
| `src/services/scoringService.test.js` | checkWinCondition — all 6 paths (innings 1, win by wickets, last-ball win, win by runs all-out, win by runs overs, tie) |
| `src/hooks/useRole.test.js` | All 5 roles × all capability flags |
| `src/components/scoring/BallInputPanel.test.jsx` | Run buttons, extras, no-ball+6, disabled state, Penalty immediate call, WICKET |
| `src/components/scoring/BallLog.test.jsx` | Chip labels (dot/4/W/wd+N/nb+N/Nb/Lb), 24-chip limit, popover, resolveName fallback |
| `src/components/scoring/StrikerIndicator.test.jsx` | Striker/nonStriker render, Swap ends, retire callback, expand breakdown |
| `src/components/shared/ConfirmDialog.test.jsx` | open/closed state, danger style, confirm/cancel callbacks, disabled, type="button" |
| `src/components/shared/BottomSheet.test.jsx` | open/closed, overflow lock/restore, backdrop/X close, noScroll |
| `src/services/playerService.test.js` | getPlayerMatchCounts — distinct match counting, dedup, empty/null data, multi-player isolation; getPlayerInningsCounts — batting/bowling innings from live scorecard rows, yet_to_bat excluded, 0-legal-ball rows excluded |
| `src/services/matchService.test.js` | incrementMatchesPlayed — correct RPC name + args, throws on DB error; addSubPlayer — inserts with is_substitute=true + is_active=true + subbed_out_player_id, null when omitted, throws on DB error; setPlayerActive — updates is_active on row, throws on error |
| `src/stores/matchStore.test.js` | swapPlayer — sequential order (insert before deactivate), setPlayerActive not called if insert throws, correct subbedOutPlayerId passed, store state updated correctly; swapBack — finds linked sub via subbed_out_player_id not any active sub, throws if no linked active sub, store state updated correctly |
| `src/lib/generateShareCard.test.jsx` | getInitials, calcSR, calcEcon, dismissalText — pure helper functions for Satori card generation |
| `src/services/teamService.test.js` | getAllTeamPlayers — returns rows, empty array on null, throws on DB error |
| `src/pages/Teams.test.jsx` | Roster player filtering: all players shown when no assignments; own-team player not disabled; cross-team player disabled + "In X" label; unassigned player enabled; clicking disabled player does not call setTeamPlayers |

**Bug fix policy:** If tests catch a source logic error, fix the source — never weaken the test assertion.

---

### `src/components/match/PlayerSubSheet.jsx`
- Props: `{ open, onClose, match, matchPlayers, allPlayers, onSwap, onSwapBack }`
- Team tabs (Super Kings / Back Street Boyz) select which team to manage
- **Step 1:** active squad list — tap any player to mark them as "going out"
- **Step 2:** shows outgoing player in red pill + search list of available replacements; "Sub In →" confirms swap; ← Back cancels
- **Benched section:** inactive (subbed-out) players shown with strikethrough + "Swap Back" button to reverse the sub
- Players lazy-loaded from `playerService.listPlayers` on first open (cached in `allPlayers` state in LiveScoring)
- `is_substitute: true`, `is_active: true`, `subbed_out_player_id = outgoing mp.id` on incoming sub; outgoing player set to `is_active: false`
- Sequential write in `swapPlayer`: insert sub first (throws on failure), then deactivate outgoing — prevents squad losing a player on partial failure
- `subbed_out_player_id` (migration 025) links each sub to the exact player they replaced — `swapBack` looks up the linked active sub, not "any active sub", so multiple swaps in one match work correctly
- "Swap Back" button only shown when a linked active sub exists for that specific benched player

## Pending / Known Issues
- Invite emails land in spam for new recipients (Gmail account is new, no domain reputation). Long-term fix: custom domain + proper SPF/DKIM.
