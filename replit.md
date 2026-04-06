# Facelook - Social App

## Project Overview
A social media and entertainment platform called "Facelook" built with React 18, Vite, TypeScript, Tailwind CSS, and Supabase. Features: Fame Feed, Flicks (TikTok-style reels), Chat Messenger Ecosystem, Movie Game (KBC Quiz), Snapy Studio, and Facelook Frame (charity wall).

## Messenger Ecosystem (ChatSystem.tsx) — v2
Full-screen messenger with 6 modules:
1. **Bottom Nav** — 4 tabs: Chat 💬, Story 📖, Alert 🔔, Menu ☰ (with badges)
2. **Full-Screen Chat** — Bold text-lg bubbles, ArrowLeft back, in-chat search, profile DP + status light (green blink = online, red = offline)
3. **Triple Theme** — 💧 Water (sky gradient + frosted glass), 🌿 Nature (beige/green + leaf bubbles), ⚪ Plain White (minimal); persisted to localStorage; switcher in chat header + settings
4. **Stealth & Privacy** — 3-dot → Hide chat (stored in localStorage); Menu > Archive to view/unhide. Message Requests folder in Menu > Requests. Active Status toggle (OFF = show red dot)
5. **Sound, Smoke & Fun** — Web Audio API sounds (send/receive/delete tones); smoke particle animation on delete; Emoji War (🥊😂💩🔥 grid → fullscreen blast animation)
6. **Settings** — Bio/School/Location from `profiles` table with save; Mute/Unmute per chat; Active Status toggle

## UI Design System (latest)
- **Theme**: Light/white native-app feel. Background `#f0f2f5` (Facebook-gray), white cards, dark gray text
- **FameFeed**: Fully light themed — white post cards, `text-gray-800/900`, 2-line clamp (threshold 90 chars) with "...more"/"...less" toggle; image always below caption text
- **Header**: Logo + Tiranga flag + (sm+) search bar | Home button + Bell + Settings gear + Avatar on right. Home → setActiveFeature("Fame"), Settings → setActiveFeature("Settings")
- **Bottom nav (GolSlider)**: 5-tab flat nav — Flicks, Fun, Task, Flame, Snapy — spring pill animation; Flame → Frame overlay, Fun → video call overlay
- **Fame home**: Feature cards (red Fun Call, blue Frame) → People You May Know horizontal scroll (2× bigger 76px square avatars) → Flicks strip (3× taller portrait cards showing real DB posts) → FameFeed
- **Flicks strip**: Real posts from `posts` table (videos shown with play icon, images shown as thumbnails), width = 1/3 viewport, ~9:16 aspect ratio

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

## KBC Quiz Battle (Task Section)
- **Location**: GolSlider → "Task" tab
- **Files**: `src/components/MovieGame.tsx`, `src/data/quizData.ts`
- **40 questions** across 4 categories: 🎬 Bollywood, 🔢 Math, 🦅 Birds, 🎵 Trending Songs
- **10 rounds per match** — questions deterministically shuffled from session ID (same order for both players)
- **Scoring**: Fast answer (≤15s) = +18, Slow answer (>15s) = +10, Wrong = 0
- **Global sync**: Host drives round progression via `game_sessions.round_start_time` + `current_round`; Guest follows via Supabase Realtime + 3s polling fallback
- **Audio**: Preloaded correct/wrong/match/BGM sounds (Mixkit CDN) via Audio refs
- **UI**: KBC-style dark purple/blue gradient, circular red countdown timer, A/B/C/D option buttons, reveal animations
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
