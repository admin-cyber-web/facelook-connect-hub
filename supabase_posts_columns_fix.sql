-- ============================================================
-- Migration: Add missing columns to the 'posts' table
-- Run this once in your Supabase SQL editor.
-- All statements are idempotent (IF NOT EXISTS / no-op on re-run).
-- ============================================================

-- 1. post_type — distinguishes 'fame' (regular) | 'quote' | 'snap' | 'hook' | etc.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'fame';

-- 2. media_type — 'image' | 'video' | 'voice' | 'text'
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_type TEXT;

-- 3. SEO columns (used by CreatePost → generatePostSEO)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS meta_title TEXT;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS meta_description TEXT;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS seo_keywords TEXT[];

-- ============================================================
-- Optional index — fast lookup by post_type (e.g. quotes feed)
-- ============================================================
CREATE INDEX IF NOT EXISTS posts_post_type_idx
  ON public.posts (post_type, created_at DESC);
