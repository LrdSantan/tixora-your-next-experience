-- Enable guest checkout by making user_id nullable and adding contact columns
ALTER TABLE public.tickets ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_phone text;

-- Update the jsonb mapping for finalize_purchase_after_payment to include guest fields
CREATE OR REPLACE FUNCTION public.finalize_purchase_after_payment(
  p_user_id uuid,
  p_reference text,
  p_verified_amount_kobo bigint,
  p_items jsonb,
  p_guest_name text DEFAULT NULL,
  p_guest_email text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL
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
BEGIN
  IF p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'invalid reference';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no items';
  END IF;

  -- Check if reference already exists
  IF EXISTS (SELECT 1 FROM public.tickets WHERE reference = p_reference LIMIT 1) THEN
    -- If it exists, verify it belongs to the same user or was a guest purchase by the same guest email
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

    -- Return existing tickets
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

  -- Calculate expected total and verify stock
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

  -- Insert tickets
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
        guest_phone
      ) VALUES (
        p_user_id,
        tier_rec.event_id,
        tier_line.tid,
        p_reference,
        (tier_rec.price::bigint * 100)::integer,
        1,
        'confirmed',
        generated_code,
        p_guest_name,
        p_guest_email,
        p_guest_phone
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
