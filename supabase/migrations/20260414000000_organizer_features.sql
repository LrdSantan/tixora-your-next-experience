-- 1. Modify coupons table
ALTER TABLE public.coupons 
  ADD COLUMN IF NOT EXISTS event_id uuid references public.events(id) on delete cascade,
  ADD COLUMN IF NOT EXISTS organizer_id uuid references auth.users(id) on delete cascade;

-- Update RLS for coupons
DROP POLICY IF EXISTS "Public read active coupons" ON public.coupons;
CREATE POLICY "Public read active coupons" 
  ON public.coupons FOR SELECT 
  USING (is_active = true);

DROP POLICY IF EXISTS "Admin manage all coupons" ON public.coupons;
CREATE POLICY "Admin manage all coupons" 
  ON public.coupons FOR ALL 
  TO authenticated 
  USING ((auth.jwt() ->> 'email') = 'yusufquadir50@gmail.com');

DROP POLICY IF EXISTS "Organizers insert own coupons" ON public.coupons;
CREATE POLICY "Organizers insert own coupons" 
  ON public.coupons FOR INSERT
  TO authenticated
  WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Organizers update own coupons" ON public.coupons;
CREATE POLICY "Organizers update own coupons" 
  ON public.coupons FOR UPDATE
  TO authenticated
  USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Organizers delete own coupons" ON public.coupons;
CREATE POLICY "Organizers delete own coupons" 
  ON public.coupons FOR DELETE
  TO authenticated
  USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Organizers and team members read own coupons" ON public.coupons;
CREATE POLICY "Organizers and team members read own coupons"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (
    organizer_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.organizer_team_members otm
      WHERE otm.organizer_id = coupons.organizer_id
      AND otm.member_id = auth.uid()
      AND otm.status = 'accepted'
    )
  );

-- 2. Create organizer_team_members table
CREATE TABLE IF NOT EXISTS public.organizer_team_members (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid references auth.users(id) on delete cascade not null,
  member_id uuid references auth.users(id) on delete cascade,
  email text not null,
  status text check (status in ('pending', 'accepted')) default 'pending',
  created_at timestamptz not null default now(),
  unique (organizer_id, email)
);

ALTER TABLE public.organizer_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organizers manage their team members" ON public.organizer_team_members;
CREATE POLICY "Organizers manage their team members" 
  ON public.organizer_team_members FOR ALL
  TO authenticated
  USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Members read their team memberships" ON public.organizer_team_members;
CREATE POLICY "Members read their team memberships" 
  ON public.organizer_team_members FOR SELECT
  TO authenticated
  USING (member_id = auth.uid() OR email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Members update their own status" ON public.organizer_team_members;
CREATE POLICY "Members update their own status" 
  ON public.organizer_team_members FOR UPDATE
  TO authenticated
  USING (email = (auth.jwt() ->> 'email') OR member_id = auth.uid())
  WITH CHECK ((email = (auth.jwt() ->> 'email') OR member_id = auth.uid()) AND (status = 'accepted' OR status = 'pending'));

-- 3. Update mark_ticket_used RPC
CREATE OR REPLACE FUNCTION public.mark_ticket_used(p_ticket_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_email text;
  caller_uid uuid;
  updated_row public.tickets%rowtype;
  can_mark boolean := false;
BEGIN
  -- Authenticate caller
  caller_email := auth.jwt() ->> 'email';
  caller_uid := auth.uid();

  IF caller_email = 'yusufquadir50@gmail.com' THEN
    can_mark := true;
  ELSE
    -- Check if user is organizer or team member
    SELECT true INTO can_mark
    FROM public.tickets t
    JOIN public.events e ON e.id = t.event_id
    LEFT JOIN public.organizer_team_members otm ON otm.organizer_id = e.organizer_id AND otm.member_id = caller_uid AND otm.status = 'accepted'
    WHERE t.ticket_code = p_ticket_code
    AND (e.organizer_id = caller_uid OR otm.id IS NOT NULL);
  END IF;

  IF NOT coalesce(can_mark, false) THEN
    RAISE EXCEPTION 'Unauthorized: You are not authorized to mark this ticket as used';
  END IF;

  -- Check if already used
  IF EXISTS (SELECT 1 FROM public.tickets WHERE ticket_code = p_ticket_code AND is_used = true) THEN
    RAISE EXCEPTION 'Ticket already used';
  END IF;

  -- Update row
  UPDATE public.tickets
  SET is_used = true, used_at = now()
  WHERE ticket_code = p_ticket_code
  RETURNING * INTO updated_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  RETURN jsonb_build_object(
    'id', updated_row.id,
    'ticket_code', updated_row.ticket_code,
    'is_used', updated_row.is_used,
    'used_at', updated_row.used_at
  );
END;
$$;
