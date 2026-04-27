-- ============================================================
-- Migration: recipient_email column + guest account linking
-- ============================================================

-- 1. Add recipient_email to tickets
--    Stores the friend's email when a ticket is bought for someone else.
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS recipient_email text;
CREATE INDEX IF NOT EXISTS tickets_recipient_email_idx ON public.tickets (recipient_email);

-- 2. Update RLS so authenticated users can see:
--      a) tickets they own (user_id = auth.uid())
--      b) tickets bought for them (recipient_email = auth.email())
DROP POLICY IF EXISTS "Users read own tickets" ON public.tickets;
CREATE POLICY "Users read own tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR lower(recipient_email) = lower(auth.email())
  );

-- 3. Replace finalize_purchase_after_payment to support recipient_email
CREATE OR REPLACE FUNCTION public.finalize_purchase_after_payment(
  p_user_id uuid,
  p_reference text,
  p_verified_amount_kobo bigint,
  p_items jsonb,
  p_guest_name text DEFAULT NULL,
  p_guest_email text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL,
  p_recipient_email text DEFAULT NULL
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

  -- Validate stock and calculate expected total
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

  -- Underpayment check (free tickets allowed when expected_total = 0)
  IF expected_total > 0 AND p_verified_amount_kobo < expected_total THEN
    RAISE EXCEPTION 'Underpayment detected';
  END IF;

  -- Determine the effective user_id for ticket rows:
  -- • If buying for a friend (p_recipient_email set) → tickets belong to no one yet
  --   (null user_id), the post-purchase-guest-setup function will link them later.
  -- • Otherwise use the supplied p_user_id (buyer or null for guests).
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
        recipient_email
      ) VALUES (
        v_user_id,
        tier_rec.event_id,
        tier_line.tid,
        p_reference,
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
        END
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
