-- Migration: Refined atomic coupon logic for finalize_purchase_after_payment
-- Corrected behavior:
-- 1. max_uses counts individual tickets, not transactions.
-- 2. Partial Application: Discount applies to min(requested_tickets, remaining_uses).
-- 3. uses_count increments by the number of tickets covered.
-- 4. Underpayment check reflects partial discount.
-- 5. Blocking: If uses_count >= max_uses initially, block the coupon.

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

  -- Check if reference already exists (idempotency guard)
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

  -- 1. Calculate total requested tickets
  SELECT sum((el.value->>'quantity')::int)
  INTO v_total_requested_tickets
  FROM jsonb_array_elements(p_items) AS el;

  -- 2. Coupon Validation & Partial Application Logic
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

    -- Block if no uses left at all
    IF v_coupon_rec.max_uses IS NOT NULL AND v_coupon_rec.uses_count >= v_coupon_rec.max_uses THEN
      RAISE EXCEPTION 'the coupon has reached its usage limit';
    END IF;

    -- Calculate how many tickets can be discounted
    IF v_coupon_rec.max_uses IS NULL THEN
      v_tickets_to_discount := v_total_requested_tickets;
    ELSE
      v_remaining_uses := v_coupon_rec.max_uses - v_coupon_rec.uses_count;
      v_tickets_to_discount := least(v_total_requested_tickets, v_remaining_uses);
    END IF;

    v_coupon_id := v_coupon_rec.id;
  END IF;

  -- 3. First Loop: Validate stock and calculate expected total + discount
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
    
    -- Check event scoping if coupon is present
    IF v_coupon_id IS NOT NULL AND v_coupon_rec.event_id IS NOT NULL THEN
      IF tier_rec.event_id = v_coupon_rec.event_id THEN
        v_cart_has_event := true;
      END IF;
    END IF;

    -- Calculate expected total and discount for this tier
    FOR i IN 1..tier_line.qty LOOP
      expected_total_kobo := expected_total_kobo + v_tier_price_kobo;
      
      -- Apply discount if applicable to this ticket
      -- Note: If the coupon is event-scoped, we only discount tickets for that event.
      -- If it's NOT event-scoped, we discount any ticket until v_tickets_to_discount is reached.
      IF v_discounted_counter < v_tickets_to_discount THEN
        IF v_coupon_rec.event_id IS NULL OR tier_rec.event_id = v_coupon_rec.event_id THEN
          IF v_coupon_rec.discount_type = 'percentage' THEN
            v_this_ticket_discount_kobo := (v_tier_price_kobo * v_coupon_rec.discount_value / 100)::bigint;
          ELSE
            v_this_ticket_discount_kobo := (v_coupon_rec.discount_value * 100)::bigint;
          END IF;
          
          -- Cap discount at ticket price
          IF v_this_ticket_discount_kobo > v_tier_price_kobo THEN
            v_this_ticket_discount_kobo := v_tier_price_kobo;
          END IF;
          
          v_total_discount_amount_kobo := v_total_discount_amount_kobo + v_this_ticket_discount_kobo;
          v_discounted_counter := v_discounted_counter + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- 4. Final Coupon validation checks
  IF v_coupon_id IS NOT NULL THEN
    -- If scoped to an event, ensure at least one item was from that event
    IF v_coupon_rec.event_id IS NOT NULL AND NOT v_cart_has_event THEN
      RAISE EXCEPTION 'This coupon is not valid for the items in your cart';
    END IF;
    
    -- If no tickets were discounted (e.g. all tickets were non-scoped), this is also an error
    IF v_discounted_counter = 0 AND v_total_requested_tickets > 0 THEN
       RAISE EXCEPTION 'This coupon cannot be applied to your selection';
    END IF;
  END IF;

  -- 5. Underpayment check (reflect partial discount)
  IF expected_total_kobo > 0 AND p_verified_amount_kobo < (expected_total_kobo - v_total_discount_amount_kobo) THEN
    RAISE EXCEPTION 'Underpayment detected: expected % (with % discount), paid %', 
      (expected_total_kobo - v_total_discount_amount_kobo), v_total_discount_amount_kobo, p_verified_amount_kobo;
  END IF;

  -- 6. Update uses_count atomically by the number of tickets actually discounted
  IF v_coupon_id IS NOT NULL AND v_discounted_counter > 0 THEN
    UPDATE public.coupons 
    SET uses_count = uses_count + v_discounted_counter 
    WHERE id = v_coupon_id;
  END IF;

  -- Determine the effective user_id
  IF p_recipient_email IS NOT NULL AND trim(p_recipient_email) <> '' THEN
    v_user_id := NULL;
  ELSE
    v_user_id := p_user_id;
  END IF;

  -- 7. Second Loop: Insert tickets with correct amount_paid per row
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
      
      -- Determine discount for THIS specific ticket row
      IF v_coupon_id IS NOT NULL AND v_discounted_counter < v_tickets_to_discount THEN
        IF v_coupon_rec.event_id IS NULL OR tier_rec.event_id = v_coupon_rec.event_id THEN
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

      v_amount_to_pay_for_this_ticket_kobo := v_tier_price_kobo - v_this_ticket_discount_kobo;
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
        v_amount_to_pay_for_this_ticket_kobo::integer,
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
