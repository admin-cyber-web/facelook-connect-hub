# Flicks - Social App

## Project Overview
A social media and entertainment platform called "Flicks" built with React 18, Vite, TypeScript, Tailwind CSS, and Supabase. Features: Fame Feed, Flicks (TikTok-style reels), Chat Messenger Ecosystem, Movie Game (KBC Quiz), Snapy Studio, Flicks Frame (charity wall), and MAGNET viral chain system.

## MAGNET System (MagnetSystem.tsx)
Viral chain-reaction feature with infinite depth. Integrated on Flick posts, Hook page posts, and Circle posts.
- **Chain**: Users magnet their friends into a post; each friend can magnet their own friends (recursive tree)
- **Reach counter**: Live realtime count via Supabase postgres_changes channel  
- **Creator's Voice**: Owner sets a sticky status/warning message broadcast instantly to all viewers via Supabase broadcast channel
- **Trace view**: Visualizes the chain tree by depth level (owner also gets Kill/Mute controls per branch)
- **Magnet Bridge**: Owner can open a direct chat with the last person in the chain
- **DB tables**: `magnet_chains` (recursive `parent_magnet_id` FK), `post_magnet_voice` — SQL in `supabase_magnet_tables.sql`
- **Key exports**: `MagnetButton`, `CreatorVoice`, `useMagnet` hook

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

## Flicks (Reels) Upgrade — Viral Engagement Engine
- **File**: `src/components/FlicksFeed.tsx` (complete rewrite)
- **Functional buttons**:
  - ❤️ **Like** — upserts to `likes` table + updates `likes_count`, toggleable, plays Pop sound, spring scale animation on tap
  - 💬 **Comments** — opens a slide-up drawer with real comment list from DB + input to post new ones (plays Swoosh on send)
  - 📤 **Share** — `navigator.share()` + increments `shares_count` in DB, plays Swoosh
- **Luck-Based Viral Logic** (`getLuckFactor`, `getBonusEngagement`):
  - Each post gets a deterministic luck score (1-10) derived from its UUID — stable across sessions
  - 0-1hr old: shows 100% real DB counts only
  - 1hr+: adds seeded bonus engagement based on luck:
    - Luck 1-4: +50-100 likes, 200-500 views
    - Luck 5-8: +100-500 likes, 600-2K views
    - Luck 9-10: **VIRAL** 🔥 — 500-5K likes, 1K-10K views, orange "Viral" badge shown
- **Human-Pattern Live Ticker**: when the card is active, a background timer fires at irregular intervals (800-3000ms) and adds irregular increments [0,0,2,0,0,5,1,0,3...] to simulate real viewer activity
- **K-formatting**: `formatCount` — 1200 → "1.2K", 12000 → "12K", 1.5M → "1.5M"
- **Verified badges**: Posts with luck ≥ 6 show a blue `BadgeCheck` icon (Lucide) next to the author name; others show a simpler blue ✓ circle
- **Comment Drawer**: slide-up sheet (65vh) with comment list, avatar initials, real-time insert to Supabase on send

## Reaction System with Sound Effects (new)
- **Files**: `src/components/ReactionBar.tsx`, `src/hooks/useSoundEffects.ts`, `supabase_reactions_setup.sql`
- **Chat Reactions**: Long-press (600ms) on any chat message opens a floating emoji bar (❤️ 👍 😂 🔥 😮). Reaction bubbles shown below the bubble with a counter. Powered by `message_reactions` Supabase table.
- **Comment Reactions**: "😊 React" button on every comment opens the emoji bar. Reaction bubbles shown below comment text. Powered by `comment_reactions` Supabase table.
- **Sound Effects**: Web Audio API (no external deps, zero delay)
  - Pop/click sound on any emoji reaction (chat or comment)
  - Swoosh/sent sound when posting a comment
  - Pop sound also fires for existing post reactions (FameFeed likes)
- **Visual Polish**: Framer Motion spring animations on bar open/close, emoji scale-on-hover (1.5×), reaction bubble bounce-in
- **Data Persistence**: Supabase realtime subscriptions keep reactions live; run `supabase_reactions_setup.sql` to create the tables
- **Supabase tables needed**: `message_reactions (id, message_id, user_id, emoji, created_at)` and `comment_reactions (id, comment_id, user_id, emoji, created_at)` — both with UNIQUE on (entity_id, user_id)

## Migration Notes (Lovable → Replit)
- Removed `lovable-tagger` plugin from `vite.config.ts` (Lovable-specific, not needed on Replit)
- Updated Vite server host to `0.0.0.0` for Replit's proxied preview
- Port set to 5000 (required for Replit webview)
