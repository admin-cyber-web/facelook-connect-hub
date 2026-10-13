-- Marketplace delivery contact, ETA, and product snapshot details for order tracking.
-- Run once in the Supabase SQL editor before using the new tracking fields.

ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS item_image_url TEXT,
  ADD COLUMN IF NOT EXISTS item_details TEXT,
  ADD COLUMN IF NOT EXISTS delivery_partner_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_partner_phone TEXT,
  ADD COLUMN IF NOT EXISTS estimated_delivery_at TIMESTAMPTZ;
