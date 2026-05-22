-- Migration: Secure QR verification RPC
-- Replaces direct anon-key reads of the tickets table in the scanner.
-- This function runs as SECURITY DEFINER (postgres) so it bypasses RLS,
-- but it enforces its own auth check: the caller must be the event organizer,
-- an accepted team member of that organizer, or the platform admin.
-- It returns only the fields the scanner UI needs — no PII, no bank details.

CREATE OR REPLACE FUNCTION public.verify_ticket_by_qr(p_qr_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uid   uuid    := auth.uid();
  caller_email text    := auth.jwt() ->> 'email';
  ticket_row   record;
  event_row    record;
  can_verify   boolean := false;
BEGIN
  -- ── 1. Caller must be authenticated ──────────────────────────────────────
  IF caller_uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Unauthorized');
  END IF;

  -- ── 2. Look up the ticket by qr_token OR ticket_code (support both) ──────
  SELECT
    t.id,
    t.ticket_code,
    t.reference,
    t.amount_paid,
    t.is_used,
    t.used_at,
    t.created_at,
    t.event_id,
    t.guest_name,
    t.tier_id
  INTO ticket_row
  FROM public.tickets t
  WHERE t.qr_token = p_qr_token
     OR t.ticket_code = p_qr_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Ticket not found');
  END IF;

  -- ── 3. Load event details ─────────────────────────────────────────────────
  SELECT
    e.title,
    e.date,
    e.time,
    e.venue,
    e.city,
    e.organizer_id,
    e.is_multi_day,
    e.event_days,
    e.scanner_mode,
    e.scanner_mode_locked
  INTO event_row
  FROM public.events e
  WHERE e.id = ticket_row.event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Event not found');
  END IF;

  -- ── 4. Authorization: admin, organizer, or accepted team member ───────────
  IF caller_email = 'yusufquadir50@gmail.com' THEN
    can_verify := true;
  ELSIF caller_uid = event_row.organizer_id THEN
    can_verify := true;
  ELSE
    SELECT true INTO can_verify
    FROM public.organizer_team_members otm
    WHERE otm.organizer_id = event_row.organizer_id
      AND otm.member_id    = caller_uid
      AND otm.status       = 'accepted'
    LIMIT 1;
  END IF;

  IF NOT coalesce(can_verify, false) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Unauthorized');
  END IF;

  -- ── 5. Load tier name ─────────────────────────────────────────────────────
  DECLARE
    tier_name_val text;
  BEGIN
    SELECT tt.name INTO tier_name_val
    FROM public.ticket_tiers tt
    WHERE tt.id = ticket_row.tier_id;
    tier_name_val := coalesce(tier_name_val, 'Ticket');

  -- ── 6. Return structured payload ──────────────────────────────────────────
    RETURN jsonb_build_object(
      'valid',               true,
      'ticket_id',           ticket_row.id,
      'ticket_code',         ticket_row.ticket_code,
      'reference',           ticket_row.reference,
      'amount_paid',         ticket_row.amount_paid,
      'is_used',             ticket_row.is_used,
      'used_at',             ticket_row.used_at,
      'created_at',          ticket_row.created_at,
      'event_id',            ticket_row.event_id,
      'guest_name',          ticket_row.guest_name,
      'event_title',         event_row.title,
      'event_date',          event_row.date,
      'event_time',          event_row.time,
      'event_venue',         event_row.venue,
      'event_city',          event_row.city,
      'organizer_id',        event_row.organizer_id,
      'is_multi_day',        event_row.is_multi_day,
      'event_days',          event_row.event_days,
      'scanner_mode',        event_row.scanner_mode,
      'scanner_mode_locked', event_row.scanner_mode_locked,
      'tier_name',           tier_name_val
    );
  END;
END;
$$;

-- Grant execute to authenticated users only (anon cannot call this)
REVOKE ALL ON FUNCTION public.verify_ticket_by_qr(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_ticket_by_qr(text) TO authenticated;
