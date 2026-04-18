-- Enable tracking coupon event scoping
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Drop existing permissive/organizer scope policies
DROP POLICY IF EXISTS "Allow all on coupons" ON public.coupons;
DROP POLICY IF EXISTS "Organizers insert own coupons" ON public.coupons;
DROP POLICY IF EXISTS "Organizers update own coupons" ON public.coupons;
DROP POLICY IF EXISTS "Organizers delete own coupons" ON public.coupons;
DROP POLICY IF EXISTS "Organizers and team members read own coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admin manage all coupons" ON public.coupons;

-- Organizers can only insert coupons for their own events
CREATE POLICY "Organizers can create coupons for their events"
ON public.coupons FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  event_id IN (SELECT id FROM public.events WHERE organizer_id = auth.uid())
);

-- Organizers can only view their own coupons
CREATE POLICY "Organizers can view their own coupons"
ON public.coupons FOR SELECT
USING (created_by = auth.uid());

-- Organizers can update their own coupons
CREATE POLICY "Organizers can update their own coupons"
ON public.coupons FOR UPDATE
USING (created_by = auth.uid());

-- Organizers can delete their own coupons
CREATE POLICY "Organizers can delete their own coupons"
ON public.coupons FOR DELETE
USING (created_by = auth.uid());

-- Anyone can read active coupons to validate at checkout
DROP POLICY IF EXISTS "Public read active coupons" ON public.coupons;
CREATE POLICY "Public can validate coupons"
ON public.coupons FOR SELECT
USING (true);
