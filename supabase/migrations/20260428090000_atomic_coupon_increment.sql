-- Migration: Atomic coupon validation and increment in finalize_purchase_after_payment
-- This ensures that coupons are properly validated, their usage count is incremented atomically,
-- and the total amount paid is verified against the discounted price.

CREATE OR REPLACE FUNCTION public.finalize_purchase_after_payment(
  p_user_id uuid,
  p_reference text,
  p_verified_amount_kobo bigint,
  p_items jsonb,
  p_guest_name text DEFAULT NULL,
  p_guest_email text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL,
  p_recipient_email text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier_line record;
  tier_rec public.ticket_tiers%rowtype;
  expected_total bigint := 0;
  result_rows jsonb;
  i int;
  generated_code text;
  v_user_id uuid;
  
  -- Coupon variables
  v_coupon_rec record;
  v_discount_amount bigint := 0;
  v_coupon_id uuid := NULL;
  v_cart_has_event boolean := false;
BEGIN
  IF p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'invalid reference';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no items';
  END IF;

  -- Check if reference already exists (idempotency guard)
  IF EXISTS (SELECT 1 FROM public.tickets WHERE reference = p_reference LIMIT 1) THEN
    -- ... (idempotency logic same as before)
    IF EXISTS (
      SELECT 1 FROM public.tickets
      WHERE reference = p_reference
      AND (
        (user_id IS NOT NULL AND user_id IS DISTINCT FROM p_user_id) OR
        (user_id IS NULL AND guest_email IS DISTINCT FROM p_guest_email)
      )
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'reference already used';
    END IF;

    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'ticket_code', t.ticket_code,
          'reference', t.reference,
          'amount_paid', t.amount_paid,
          'quantity', t.quantity,
          'qr_token', t.qr_token,
          'event_title', e.title,
          'tier_name', tt.name,
          'venue', e.venue,
          'city', e.city,
          'date', e.date,
          'time', e.time
        )
        ORDER BY t.created_at
      ),
      '[]'::jsonb
    )
    INTO result_rows
    FROM public.tickets t
    JOIN public.events e ON e.id = t.event_id
    JOIN public.ticket_tiers tt ON tt.id = t.tier_id
    WHERE t.reference = p_reference;

    RETURN jsonb_build_object('tickets', result_rows);
  END IF;

  -- Validate stock and calculate base expected total
  FOR tier_line IN
    SELECT
      (el.value->>'tier_id')::uuid as tid,
      (el.value->>'quantity')::int as qty
    FROM jsonb_array_elements(p_items) AS el
    ORDER BY (el.value->>'tier_id')::text
  LOOP
    IF tier_line.qty IS NULL OR tier_line.qty <= 0 THEN
      RAISE EXCEPTION 'invalid quantity';
    END IF;

    SELECT * INTO tier_rec
    FROM public.ticket_tiers
    WHERE id = tier_line.tid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'tier not found';
    END IF;

    IF tier_rec.remaining_quantity < tier_line.qty THEN
      RAISE EXCEPTION 'insufficient stock';
    END IF;

    expected_total := expected_total + (tier_rec.price::bigint * 100 * tier_line.qty);
  END LOOP;

  -- Coupon Processing
  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    -- Find and lock the coupon for update
    SELECT * INTO v_coupon_rec 
    FROM public.coupons 
    WHERE upper(code) = upper(trim(p_coupon_code)) 
      AND is_active = true 
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or inactive coupon code';
    END IF;

    IF v_coupon_rec.expires_at IS NOT NULL AND v_coupon_rec.expires_at < now() THEN
      RAISE EXCEPTION 'This coupon has expired';
    END IF;

    IF v_coupon_rec.max_uses IS NOT NULL AND v_coupon_rec.uses_count >= v_coupon_rec.max_uses THEN
      RAISE EXCEPTION 'the coupon has reached its usage limit';
    END IF;

    -- Scoping check
    IF v_coupon_rec.event_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(p_items) AS el
        JOIN public.ticket_tiers tt ON tt.id = (el.value->>'tier_id')::uuid
        WHERE tt.event_id = v_coupon_rec.event_id
      ) INTO v_cart_has_event;
      
      IF NOT v_cart_has_event THEN
        RAISE EXCEPTION 'This coupon is not valid for the items in your cart';
      END IF;
    END IF;

    -- Calculate discount
    IF v_coupon_rec.discount_type = 'percentage' THEN
      v_discount_amount := (expected_total * v_coupon_rec.discount_value / 100)::bigint;
    ELSE
      v_discount_amount := (v_coupon_rec.discount_value * 100)::bigint;
    END IF;

    v_coupon_id := v_coupon_rec.id;
    
    -- Increment uses_count atomically
    UPDATE public.coupons 
    SET uses_count = uses_count + 1 
    WHERE id = v_coupon_id;
  END IF;

  -- Underpayment check (account for discount)
  -- Allow a small margin for rounding if necessary, but here we expect exact match or overpayment.
  IF expected_total > 0 AND p_verified_amount_kobo < (expected_total - v_discount_amount) THEN
    RAISE EXCEPTION 'Underpayment detected: expected % (with discount %), paid %', (expected_total - v_discount_amount), v_discount_amount, p_verified_amount_kobo;
  END IF;

  -- Determine the effective user_id
  IF p_recipient_email IS NOT NULL AND trim(p_recipient_email) <> '' THEN
    v_user_id := NULL;
  ELSE
    v_user_id := p_user_id;
  END IF;

  -- Insert individual ticket rows
  FOR tier_line IN
    SELECT
      (el.value->>'tier_id')::uuid as tid,
      (el.value->>'quantity')::int as qty
    FROM jsonb_array_elements(p_items) AS el
    ORDER BY (el.value->>'tier_id')::text
  LOOP
    SELECT * INTO tier_rec FROM public.ticket_tiers WHERE id = tier_line.tid FOR UPDATE;

    UPDATE public.ticket_tiers
    SET remaining_quantity = remaining_quantity - tier_line.qty
    WHERE id = tier_line.tid;

    FOR i IN 1..tier_line.qty LOOP
      generated_code := 'TIX-' || upper(substring(gen_random_uuid()::text, 1, 8));

      INSERT INTO public.tickets (
        user_id,
        event_id,
        tier_id,
        reference,
        amount_paid,
        quantity,
        status,
        ticket_code,
        guest_name,
        guest_email,
        guest_phone,
        recipient_email,
        coupon_code,
        coupon_id
      ) VALUES (
        v_user_id,
        tier_rec.event_id,
        tier_line.tid,
        p_reference,
        -- If we have multiple items, how do we distribute the discount?
        -- For simplicity, we record the tier price, but the total paid is what matters.
        -- Actually, the current RPC records (tier_rec.price * 100).
        -- We'll keep that, as amount_paid per ticket usually reflects the face value.
        (tier_rec.price::bigint * 100)::integer,
        1,
        'confirmed',
        generated_code,
        p_guest_name,
        p_guest_email,
        p_guest_phone,
        CASE
          WHEN p_recipient_email IS NOT NULL AND trim(p_recipient_email) <> ''
          THEN lower(trim(p_recipient_email))
          ELSE NULL
        END,
        p_coupon_code,
        v_coupon_id
      );
    END LOOP;
  END LOOP;

  -- Return results
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'ticket_code', t.ticket_code,
        'reference', t.reference,
        'amount_paid', t.amount_paid,
        'quantity', t.quantity,
        'qr_token', t.qr_token,
        'event_title', e.title,
        'tier_name', tt.name,
        'venue', e.venue,
        'city', e.city,
        'date', e.date,
        'time', e.time
      )
      ORDER BY t.created_at
    ),
    '[]'::jsonb
  )
  INTO result_rows
  FROM public.tickets t
  JOIN public.events e ON e.id = t.event_id
  JOIN public.ticket_tiers tt ON tt.id = t.tier_id
  WHERE t.reference = p_reference;

  RETURN jsonb_build_object('tickets', result_rows);
END;
$$;
