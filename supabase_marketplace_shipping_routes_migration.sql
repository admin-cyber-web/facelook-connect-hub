-- Run once in the Supabase SQL editor to enable product/order route tracking.
-- These statements are safe to re-run and leave historical order data unchanged.

ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS source_city TEXT;

ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS source_city TEXT,
  ADD COLUMN IF NOT EXISTS destination_city TEXT,
  ADD COLUMN IF NOT EXISTS current_location TEXT;

CREATE INDEX IF NOT EXISTS marketplace_orders_user_created_idx
  ON public.marketplace_orders (user_id, created_at DESC);
