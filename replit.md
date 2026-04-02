# Facelook - Social App

## Project Overview
A social media app called "Facelook" built with React, Vite, TypeScript, and Tailwind CSS. The app features a glassmorphism design aesthetic and includes sections for Fame Feed, Face (profile), Flame (groups), Flicks, Film (stories), and Fun (memes/entertainment).

## Architecture
- **Frontend only** — pure React SPA (single-page application), no backend server
- **Routing**: React Router v6
- **State management**: TanStack React Query
- **UI**: Radix UI primitives + shadcn/ui components + Tailwind CSS
- **Animations**: Framer Motion
- **Dev server**: Vite on port 5000

## Key Files & Structure
- `src/App.tsx` — root component with routing
- `src/pages/Index.tsx` — main page with feature switching via GolSlider
- `src/pages/NotFound.tsx` — 404 page
- `src/components/` — all UI components (Header, GolSlider, ConnectionPanel, FameFeed, FlicksFeed, MatchmakingSection, NavLink, plus shadcn/ui in `ui/`)
- `src/hooks/` — custom hooks (use-mobile, use-toast)
- `vite.config.ts` — Vite config (host: 0.0.0.0, port: 5000)

## Running the App
- Development: `npm run dev` (port 5000)
- Build: `npm run build`

## Movie Mania Game (Task Section)
- **Location**: GolSlider → "Task" tab
- **File**: `src/components/MovieGame.tsx`, `src/data/gameData.ts`
- **50 Indian movies** (Bollywood + South) with poster, emojis, hint, jumbled title
- **5 Rounds per match**: Blur Poster → Missing Letters → Actor's Eyes → Emoji Guess → Jumbled Name
- **Matchmaking**: Supabase `game_sessions` table + Realtime subscriptions
- **Points**: -10 entry fee (profiles.fame_points), +18 winner, +2 admin_earnings per match
- **Sound effects**: Mixkit CDN (correct taali, wrong buzz, match found)
- **Requires Supabase table**:
  ```sql
  create table game_sessions (
    id uuid primary key default gen_random_uuid(),
    host_id uuid references profiles(id),
    guest_id uuid references profiles(id),
    status text default 'waiting',
    host_score int default 0,
    guest_score int default 0,
    current_round int default 1,
    movie_indices int[] default '{}',
    winner_id uuid references profiles(id),
    created_at timestamptz default now()
  );
  alter table game_sessions enable row level security;
  create policy "allow all" on game_sessions for all using (true);
  ```
  Also add `admin_earnings` table if not present:
  ```sql
  create table if not exists admin_earnings (
    id uuid primary key default gen_random_uuid(),
    session_id uuid,
    amount int,
    reason text,
    created_at timestamptz default now()
  );
  ```

## Migration Notes (Lovable → Replit)
- Removed `lovable-tagger` plugin from `vite.config.ts` (Lovable-specific, not needed on Replit)
- Updated Vite server host to `0.0.0.0` for Replit's proxied preview
- Port set to 5000 (required for Replit webview)
