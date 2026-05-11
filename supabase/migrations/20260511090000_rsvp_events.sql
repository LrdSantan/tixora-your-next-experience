-- RSVP Event Type Support
-- Adds event_type + rsvp_limit to events, is_rsvp to tickets, and submit_rsvp RPC.

-- ── 1. Events table ──────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'ticketed'
    CHECK (event_type IN ('ticketed', 'rsvp')),
  ADD COLUMN IF NOT EXISTS rsvp_limit integer DEFAULT NULL
    CHECK (rsvp_limit IS NULL OR rsvp_limit > 0);

-- ── 2. Tickets table ─────────────────────────────────────────────────────────
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS is_rsvp boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tickets_is_rsvp ON public.tickets (is_rsvp);

-- ── 3. submit_rsvp RPC ───────────────────────────────────────────────────────
-- Callable by anon and authenticated (same pattern as guest checkout).
-- Handles: capacity check, duplicate guard, tier decrement, ticket insert.

CREATE OR REPLACE FUNCTION public.submit_rsvp(
  p_event_id  uuid,
  p_user_id   uuid,   -- NULL for guest/unauthenticated
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
  -- Get and lock the RSVP placeholder tier for this event
  SELECT * INTO v_tier
  FROM   public.ticket_tiers
  WHERE  event_id = p_event_id
  ORDER  BY created_at
  LIMIT  1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  -- Capacity check (skip if unlimited = 999999)
  IF v_tier.remaining_quantity <= 0 THEN
    RAISE EXCEPTION 'fully_booked';
  END IF;

  -- Duplicate guard — logged-in user
  IF p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tickets
    WHERE  event_id = p_event_id
    AND    user_id  = p_user_id
    AND    is_rsvp  = true
  ) THEN
    RAISE EXCEPTION 'already_rsvpd';
  END IF;

  -- Duplicate guard — guest by email
  IF p_user_id IS NULL AND p_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tickets
    WHERE  event_id    = p_event_id
    AND    guest_email = p_email
    AND    is_rsvp     = true
  ) THEN
    RAISE EXCEPTION 'already_rsvpd';
  END IF;

  -- Decrement capacity
  UPDATE public.ticket_tiers
  SET    remaining_quantity = remaining_quantity - 1
  WHERE  id = v_tier.id;

  -- Generate codes
  v_code := 'RSVP-' || upper(substring(gen_random_uuid()::text, 1, 8));
  v_ref  := 'RSVP-' || upper(substring(gen_random_uuid()::text, 1, 12));

  -- Insert ticket
  INSERT INTO public.tickets (
    user_id, event_id, tier_id, reference, amount_paid,
    quantity, status, ticket_code, is_rsvp,
    guest_name, guest_email, source
  ) VALUES (
    p_user_id,
    p_event_id,
    v_tier.id,
    v_ref,
    0,
    1,
    'confirmed',
    v_code,
    true,
    p_name,
    p_email,
    'rsvp'
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

-- Grant to both anon (guest RSVP) and authenticated
GRANT EXECUTE ON FUNCTION public.submit_rsvp(uuid, uuid, text, text) TO anon, authenticated;
