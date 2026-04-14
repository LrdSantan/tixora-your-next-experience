-- Fix RLS policies for organizer_team_members
-- This resolves net::ERR_CONNECTION_CLOSED by simplifying and clarifying access paths.

-- 1. Drop old restrictive or potentially circular policies
DROP POLICY IF EXISTS "Organizers manage their team members" ON public.organizer_team_members;
DROP POLICY IF EXISTS "Members read their team memberships" ON public.organizer_team_members;

-- 2. Create a unified SELECT policy for organizers and members
-- Allows reading if:
-- a) You are the organizer who created the record
-- b) You are the user explicitly linked via member_id
-- c) You are the guest invited via email
CREATE POLICY "Organizers and members can read team rows"
  ON public.organizer_team_members FOR SELECT
  TO authenticated
  USING (
    organizer_id = auth.uid() OR 
    member_id = auth.uid() OR 
    email = (auth.jwt() ->> 'email')
  );

-- 3. Create management policies for organizers (Insert, Update, Delete)
CREATE POLICY "Organizers can insert team members"
  ON public.organizer_team_members FOR INSERT
  TO authenticated
  WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "Organizers can update team members"
  ON public.organizer_team_members FOR UPDATE
  TO authenticated
  USING (organizer_id = auth.uid());

CREATE POLICY "Organizers can delete team members"
  ON public.organizer_team_members FOR DELETE
  TO authenticated
  USING (organizer_id = auth.uid());

-- 4. Keep the existing status update policy for members (already good, but re-applying for clarity)
DROP POLICY IF EXISTS "Members update their own status" ON public.organizer_team_members;
CREATE POLICY "Members update their own status" 
  ON public.organizer_team_members FOR UPDATE
  TO authenticated
  USING (email = (auth.jwt() ->> 'email') OR member_id = auth.uid())
  WITH CHECK (
    (email = (auth.jwt() ->> 'email') OR member_id = auth.uid()) 
    AND (status = 'accepted' OR status = 'pending')
  );
