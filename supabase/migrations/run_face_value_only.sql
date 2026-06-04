-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- URL: https://supabase.com/dashboard/project/hxvgoavigoopcgbmvltf/sql/new
-- ============================================================

-- 1. Add face_value column to tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS face_value integer;

-- 2. Backfill existing tickets: use their tier's price as face_value
--    Falls back to amount_paid for any orphaned tickets
UPDATE public.tickets t
SET face_value = COALESCE(
  (SELECT (tt.price * 100)::integer FROM public.ticket_tiers tt WHERE tt.id = t.tier_id),
  t.amount_paid
)
WHERE t.face_value IS NULL;

-- 3. Update finalize_purchase_after_payment to populate face_value on new purchases
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
  expected_total_kobo bigint := 0;
  result_rows jsonb;
  i int;
  generated_code text;
  v_user_id uuid;

  -- Coupon variables
  v_coupon_rec record;
  v_total_discount_amount_kobo bigint := 0;
  v_coupon_id uuid := NULL;
  v_cart_has_event boolean := false;
  v_cart_has_allowed_tier boolean := false;
  v_total_requested_tickets int := 0;
  v_remaining_uses int;
  v_tickets_to_discount int := 0;
  v_discounted_counter int := 0;
  v_this_ticket_discount_kobo bigint;
  v_tier_price_kobo bigint;
  v_amount_to_pay_for_this_ticket_kobo bigint;
BEGIN
  IF p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'invalid reference';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no items';
  END IF;

  -- Idempotency guard
  IF EXISTS (SELECT 1 FROM public.tickets WHERE reference = p_reference LIMIT 1) THEN
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
          'face_value', t.face_value,
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

  -- Total requested tickets
  SELECT sum((el.value->>'quantity')::int)
  INTO v_total_requested_tickets
  FROM jsonb_array_elements(p_items) AS el;

  -- Coupon validation
  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
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

    IF v_coupon_rec.max_uses IS NULL THEN
      v_tickets_to_discount := v_total_requested_tickets;
    ELSE
      v_remaining_uses := v_coupon_rec.max_uses - v_coupon_rec.uses_count;
      v_tickets_to_discount := least(v_total_requested_tickets, v_remaining_uses);
    END IF;

    v_coupon_id := v_coupon_rec.id;
  END IF;

  -- First loop: validate stock + calculate expected total + discount
  v_discounted_counter := 0;
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

    v_tier_price_kobo := (tier_rec.price::bigint * 100);

    IF v_coupon_id IS NOT NULL THEN
      IF v_coupon_rec.event_id IS NULL OR tier_rec.event_id = v_coupon_rec.event_id THEN
        v_cart_has_event := true;
        IF v_coupon_rec.allowed_tiers IS NULL OR tier_rec.name = ANY(v_coupon_rec.allowed_tiers) THEN
          v_cart_has_allowed_tier := true;
        END IF;
      END IF;
    END IF;

    FOR i IN 1..tier_line.qty LOOP
      expected_total_kobo := expected_total_kobo + v_tier_price_kobo;

      IF v_discounted_counter < v_tickets_to_discount THEN
        IF v_coupon_rec.event_id IS NULL OR tier_rec.event_id = v_coupon_rec.event_id THEN
          IF v_coupon_rec.allowed_tiers IS NULL OR tier_rec.name = ANY(v_coupon_rec.allowed_tiers) THEN
            IF v_coupon_rec.discount_type = 'percentage' THEN
              v_this_ticket_discount_kobo := (v_tier_price_kobo * v_coupon_rec.discount_value / 100)::bigint;
            ELSE
              v_this_ticket_discount_kobo := (v_coupon_rec.discount_value * 100)::bigint;
            END IF;
            IF v_this_ticket_discount_kobo > v_tier_price_kobo THEN
              v_this_ticket_discount_kobo := v_tier_price_kobo;
            END IF;
            v_total_discount_amount_kobo := v_total_discount_amount_kobo + v_this_ticket_discount_kobo;
            v_discounted_counter := v_discounted_counter + 1;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Final coupon checks
  IF v_coupon_id IS NOT NULL THEN
    IF v_coupon_rec.event_id IS NOT NULL AND NOT v_cart_has_event THEN
      RAISE EXCEPTION 'This coupon is not valid for the items in your cart';
    END IF;
    IF v_coupon_rec.allowed_tiers IS NOT NULL AND NOT v_cart_has_allowed_tier THEN
      RAISE EXCEPTION 'This coupon is not valid for the selected ticket type';
    END IF;
    IF v_discounted_counter = 0 AND v_total_requested_tickets > 0 THEN
      RAISE EXCEPTION 'This coupon cannot be applied to your selection';
    END IF;
  END IF;

  -- Underpayment check
  IF expected_total_kobo > 0 AND p_verified_amount_kobo < (expected_total_kobo - v_total_discount_amount_kobo) THEN
    RAISE EXCEPTION 'Underpayment detected: expected % (with % discount), paid %',
      (expected_total_kobo - v_total_discount_amount_kobo), v_total_discount_amount_kobo, p_verified_amount_kobo;
  END IF;

  -- Atomically increment coupon uses
  IF v_coupon_id IS NOT NULL AND v_discounted_counter > 0 THEN
    UPDATE public.coupons
    SET uses_count = uses_count + v_discounted_counter
    WHERE id = v_coupon_id;
  END IF;

  -- Effective user_id (NULL for gifted/recipient tickets)
  IF p_recipient_email IS NOT NULL AND trim(p_recipient_email) <> '' THEN
    v_user_id := NULL;
  ELSE
    v_user_id := p_user_id;
  END IF;

  -- Second loop: insert tickets with face_value populated
  v_discounted_counter := 0;
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

    v_tier_price_kobo := (tier_rec.price::bigint * 100);

    FOR i IN 1..tier_line.qty LOOP
      v_this_ticket_discount_kobo := 0;

      IF v_coupon_id IS NOT NULL AND v_discounted_counter < v_tickets_to_discount THEN
        IF v_coupon_rec.event_id IS NULL OR tier_rec.event_id = v_coupon_rec.event_id THEN
          IF v_coupon_rec.allowed_tiers IS NULL OR tier_rec.name = ANY(v_coupon_rec.allowed_tiers) THEN
            IF v_coupon_rec.discount_type = 'percentage' THEN
              v_this_ticket_discount_kobo := (v_tier_price_kobo * v_coupon_rec.discount_value / 100)::bigint;
            ELSE
              v_this_ticket_discount_kobo := (v_coupon_rec.discount_value * 100)::bigint;
            END IF;
            IF v_this_ticket_discount_kobo > v_tier_price_kobo THEN
              v_this_ticket_discount_kobo := v_tier_price_kobo;
            END IF;
            v_discounted_counter := v_discounted_counter + 1;
          END IF;
        END IF;
      END IF;

      v_amount_to_pay_for_this_ticket_kobo := v_tier_price_kobo - v_this_ticket_discount_kobo;
      generated_code := 'TIX-' || upper(substring(gen_random_uuid()::text, 1, 8));

      INSERT INTO public.tickets (
        user_id, event_id, tier_id, reference,
        amount_paid, face_value,
        quantity, status, ticket_code,
        guest_name, guest_email, guest_phone,
        recipient_email, coupon_code, coupon_id
      ) VALUES (
        v_user_id,
        tier_rec.event_id,
        tier_line.tid,
        p_reference,
        v_amount_to_pay_for_this_ticket_kobo::integer,
        v_tier_price_kobo::integer,   -- <-- face value = original tier price in kobo
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
        'face_value', t.face_value,
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

-- 4. Update submit_rsvp to populate face_value
CREATE OR REPLACE FUNCTION public.submit_rsvp(
  p_event_id  uuid,
  p_user_id   uuid,
  p_name      text,
  p_email     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier      public.ticket_tiers%rowtype;
  v_code      text;
  v_ref       text;
  v_ticket_id uuid;
BEGIN
  SELECT * INTO v_tier
  FROM   public.ticket_tiers
  WHERE  event_id = p_event_id
  ORDER  BY created_at
  LIMIT  1
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found'; END IF;
  IF v_tier.remaining_quantity <= 0 THEN RAISE EXCEPTION 'fully_booked'; END IF;

  IF p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tickets
    WHERE event_id = p_event_id AND user_id = p_user_id AND is_rsvp = true
  ) THEN RAISE EXCEPTION 'already_rsvpd'; END IF;

  IF p_user_id IS NULL AND p_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tickets
    WHERE event_id = p_event_id AND guest_email = p_email AND is_rsvp = true
  ) THEN RAISE EXCEPTION 'already_rsvpd'; END IF;

  UPDATE public.ticket_tiers SET remaining_quantity = remaining_quantity - 1 WHERE id = v_tier.id;

  v_code := 'RSVP-' || upper(substring(gen_random_uuid()::text, 1, 8));
  v_ref  := 'RSVP-' || upper(substring(gen_random_uuid()::text, 1, 12));

  INSERT INTO public.tickets (
    user_id, event_id, tier_id, reference,
    amount_paid, face_value,
    quantity, status, ticket_code, is_rsvp,
    guest_name, guest_email, source
  ) VALUES (
    p_user_id, p_event_id, v_tier.id, v_ref,
    0,
    (v_tier.price::bigint * 100)::integer,   -- face value even for free RSVP
    1, 'confirmed', v_code, true,
    p_name, p_email, 'rsvp'
  )
  RETURNING id INTO v_ticket_id;

  RETURN jsonb_build_object(
    'ticket_id',   v_ticket_id,
    'ticket_code', v_code,
    'reference',   v_ref,
    'tier_id',     v_tier.id
  );
END;
$$;
