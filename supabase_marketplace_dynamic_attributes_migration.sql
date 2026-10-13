-- Run once in the Supabase SQL editor to enable structured marketplace product
-- attributes and volume variants. Safe to rerun; existing catalog and order
-- records remain unchanged.

ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS selected_volume TEXT;

-- Seller pickup and contact details are admin-only. Active marketplace item
-- rows are publicly readable, so these fields must not be stored in the public
-- item attributes JSONB.
CREATE TABLE IF NOT EXISTS public.marketplace_item_seller_details (
  item_id UUID PRIMARY KEY REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  shop_name TEXT,
  pickup_address TEXT,
  city TEXT,
  pincode TEXT,
  contact_number TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.marketplace_item_seller_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketplace_item_seller_details'
      AND policyname = 'marketplace_seller_details_admin_all'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "marketplace_seller_details_admin_all"
        ON public.marketplace_item_seller_details
        FOR ALL
        USING (auth.email() IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com'))
        WITH CHECK (auth.email() IN ('tiwarijhumki@gmail.com', 'textilevikhyat@gmail.com'))
    $policy$;
  END IF;
END $$;
