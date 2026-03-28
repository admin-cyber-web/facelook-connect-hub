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

## Migration Notes (Lovable → Replit)
- Removed `lovable-tagger` plugin from `vite.config.ts` (Lovable-specific, not needed on Replit)
- Updated Vite server host to `0.0.0.0` for Replit's proxied preview
- Port set to 5000 (required for Replit webview)
