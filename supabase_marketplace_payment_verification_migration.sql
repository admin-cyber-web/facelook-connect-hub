-- Keep UPI orders pending until an admin has matched the submitted transaction.
-- Apply this migration in Supabase before relying on database-side enforcement.
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
