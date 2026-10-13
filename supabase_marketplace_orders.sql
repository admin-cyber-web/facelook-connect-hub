-- ═══════════════════════════════════════════════════════════════════════════
--  MARKETPLACE ORDERS  +  Sizes/Colors  —  run once in Supabase SQL editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add sizes & colors to existing products table
ALTER TABLE marketplace_items
  ADD COLUMN IF NOT EXISTS sizes  TEXT,   -- comma-separated: "S,M,L,XL"
  ADD COLUMN IF NOT EXISTS colors TEXT;   -- comma-separated: "Red,Blue,Black"

-- Shipping origin is set by the seller on each product.
ALTER TABLE marketplace_items
  ADD COLUMN IF NOT EXISTS source_city TEXT;

-- 2. Orders table
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code   TEXT        NOT NULL UNIQUE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      TEXT,
  user_name       TEXT,
  phone           TEXT,
  address         TEXT,
  source_city     TEXT,
  destination_city TEXT,
  current_location TEXT,
  item_id         UUID        REFERENCES marketplace_items(id) ON DELETE SET NULL,
  item_title      TEXT        NOT NULL,
  item_price      TEXT,
  selected_size   TEXT,
  selected_color  TEXT,
  payment_method  TEXT        NOT NULL DEFAULT 'COD',  -- 'COD' | 'UPI'
  utr_id          TEXT,
  status          TEXT        NOT NULL DEFAULT 'Pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add route fields to existing installations without changing historical rows.
ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS source_city TEXT,
  ADD COLUMN IF NOT EXISTS destination_city TEXT,
  ADD COLUMN IF NOT EXISTS current_location TEXT;

CREATE INDEX IF NOT EXISTS marketplace_orders_user_created_idx
  ON marketplace_orders (user_id, created_at DESC);

-- 3. Row-level security
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert their own order
CREATE POLICY "orders_insert"
  ON marketplace_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can read only their own orders
CREATE POLICY "orders_select_own"
  ON marketplace_orders FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read ALL orders
CREATE POLICY "orders_admin_read"
  ON marketplace_orders FOR SELECT
  USING (auth.email() IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com'));

-- Admins can update order status
CREATE POLICY "orders_admin_update"
  ON marketplace_orders FOR UPDATE
  USING  (auth.email() IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com'))
  WITH CHECK (auth.email() IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com'));

-- 4. Realtime (safe to run even if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
