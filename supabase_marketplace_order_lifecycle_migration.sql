-- Marketplace order cancellation and customer notification lifecycle.
-- Apply this migration in Supabase before relying on cancellation or order notifications.

ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS item_image_url text;

-- Keep UPI orders in manual verification until an admin confirms payment, while allowing
-- customers to cancel an unshipped order and preventing cancellation after shipment begins.
CREATE OR REPLACE FUNCTION public.enforce_marketplace_payment_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_method NOT IN ('COD', 'UPI') THEN
      RAISE EXCEPTION 'Unsupported marketplace payment method'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.payment_method = 'UPI' THEN
      NEW.utr_id := NULLIF(BTRIM(COALESCE(NEW.utr_id, '')), '');
      IF NEW.utr_id IS NULL THEN
        RAISE EXCEPTION 'A UTR is required for UPI marketplace orders'
          USING ERRCODE = '23514';
      END IF;
      NEW.status := 'Verification Pending';
    ELSE
      NEW.utr_id := NULL;
      NEW.status := 'Pending';
    END IF;

    IF NEW.item_image_url IS NULL AND NEW.item_id IS NOT NULL THEN
      SELECT NULLIF(BTRIM(image_url), '')
        INTO NEW.item_image_url
        FROM public.marketplace_items
       WHERE id = NEW.item_id;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    RAISE EXCEPTION 'Marketplace payment method cannot be changed after order creation'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.utr_id IS DISTINCT FROM OLD.utr_id THEN
    RAISE EXCEPTION 'Submitted marketplace UTR cannot be changed after order creation'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'Cancelled' AND NEW.status IS DISTINCT FROM 'Cancelled' THEN
    RAISE EXCEPTION 'A cancelled marketplace order cannot be reopened'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'Cancelled'
     AND OLD.status IN ('Shipped', 'In Transit', 'At Regional Hub', 'Out for Delivery', 'Delivered') THEN
    RAISE EXCEPTION 'A marketplace order cannot be cancelled after shipment begins'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.payment_method = 'UPI'
     AND OLD.status IN ('Pending', 'Verification Pending')
     AND NEW.status NOT IN ('Pending', 'Verification Pending', 'Confirmed', 'Cancelled') THEN
    RAISE EXCEPTION 'UPI order must be confirmed after payment verification before shipping'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.payment_method = 'UPI'
     AND OLD.status = 'Confirmed'
     AND NEW.status IN ('Pending', 'Verification Pending') THEN
    RAISE EXCEPTION 'A verified UPI order cannot return to payment verification'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_payment_verification_guard ON public.marketplace_orders;
CREATE TRIGGER marketplace_payment_verification_guard
  BEFORE INSERT OR UPDATE ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_marketplace_payment_verification();

-- Users can only cancel their own order, and only while it is still pre-shipment.
-- Direct order updates remain restricted by the existing marketplace RLS policies.
CREATE OR REPLACE FUNCTION public.cancel_marketplace_order(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.marketplace_orders%ROWTYPE;
  v_order_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to cancel this order'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_order
    FROM public.marketplace_orders
   WHERE id = p_order_id
     AND user_id = auth.uid()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not owned by the current user'
      USING ERRCODE = '42501';
  END IF;

  IF v_order.status = 'Cancelled' THEN
    RETURN v_order.id;
  END IF;

  IF v_order.status IN ('Shipped', 'In Transit', 'At Regional Hub', 'Out for Delivery', 'Delivered') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled because shipment has begun'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.marketplace_orders
     SET status = 'Cancelled'
   WHERE id = v_order.id
   RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_marketplace_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_marketplace_order(uuid) TO authenticated;

-- The order image is snapshotted so later product edits/deletion do not erase notification media.
CREATE OR REPLACE FUNCTION public.notify_marketplace_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_thumbnail_url text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_event := 'created';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := 'status';
  ELSIF NEW.current_location IS DISTINCT FROM OLD.current_location THEN
    v_event := 'location';
  ELSE
    RETURN NEW;
  END IF;

  v_thumbnail_url := NULLIF(BTRIM(NEW.item_image_url), '');
  IF v_thumbnail_url IS NULL AND NEW.item_id IS NOT NULL THEN
    SELECT NULLIF(BTRIM(image_url), '')
      INTO v_thumbnail_url
      FROM public.marketplace_items
     WHERE id = NEW.item_id;
  END IF;

  INSERT INTO public.notifications (
    notifier_id,
    actor_id,
    type,
    entity_id,
    entity_type,
    content,
    is_read
  )
  VALUES (
    NEW.user_id,
    NULL,
    'marketplace_order',
    NEW.id,
    'marketplace_order',
    jsonb_build_object(
      'kind', 'marketplace_order',
      'event', v_event,
      'item_title', NEW.item_title,
      'status', NEW.status,
      'tracking_code', NEW.tracking_code,
      'current_location', NEW.current_location,
      'thumbnail_url', v_thumbnail_url
    )::text,
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_order_notification_changes ON public.marketplace_orders;
CREATE TRIGGER marketplace_order_notification_changes
  AFTER INSERT OR UPDATE ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_marketplace_order_change();
