# Cricket Scorer

A mobile-first cricket match scoring web app — players, venues, tournaments, ball-by-ball live scoring, scorecards, and career/tournament stats.

## Tech stack

React 18 + Vite, Tailwind CSS, Supabase (Postgres + Storage), Zustand, React Router v6, React Hook Form + Zod, Lucide icons, react-hot-toast, date-fns, recharts, html2canvas (loaded from CDN for sharing).

## 1. Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run the contents of `supabase/migrations/001_initial.sql`. This creates all 14 tables, indexes, RLS policies, and the two RPC functions (`record_delivery`, `update_player_career_stats`).
3. Create a public storage bucket named `player-photos` (Storage → New bucket → Public).
4. Copy your project URL and anon key from Settings → API.

## 2. Environment variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Local development

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## 4. Build

```bash
npm run build
npm run preview   # serve the production build locally
```

## 5. Deployment

Deploy the `dist/` output to any static host (Vercel, Netlify, Cloudflare Pages). Set the two `VITE_SUPABASE_*` env vars in your host's dashboard — they're inlined at build time.

## Project structure

```
src/
  components/   scoring/, match/, tournament/, player/, shared/
  pages/        route-level screens
  stores/       Zustand state (matchStore, tournamentStore, playerStore)
  services/     Supabase data access (one file per domain + scoringService)
  hooks/        useMatch, useScoring, useJoker, useOfflineSync, useWinCondition, usePlayerStats
  lib/          supabase client, cricketUtils (pure cricket math)
supabase/migrations/001_initial.sql   full schema + RPCs
```

## How scoring works

- Every delivery is written atomically through the `record_delivery` Postgres RPC: it inserts the ball, updates the innings totals, and upserts the batting/bowling/fielding scorecards in one transaction.
- **Undo** deletes the last delivery and recomputes all scorecards + innings totals from the remaining deliveries for that innings (`scoringService.recomputeInnings`) — this guarantees consistency without needing complex inverse-math.
- When an innings is marked complete, `update_player_career_stats(innings_id)` upserts `player_career_stats` and, if the match belongs to a tournament, `player_tournament_stats`.
- **Offline scoring**: deliveries are queued to `localStorage` when `navigator.onLine` is false and flushed automatically on reconnect (`useOfflineSync`).

## Notes

- RLS policies are wide-open (`using (true)`) since this is a single-tenant scorer tool with no auth layer. Add Supabase Auth + tightened policies before exposing it publicly to untrusted users.
- Player photo uploads are capped at 2MB client-side before hitting Supabase Storage.
