-- Feature Flags Migration
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Public can read all flags (used by the frontend to check if features are active)
DROP POLICY IF EXISTS "Public read feature flags" ON public.feature_flags;
CREATE POLICY "Public read feature flags"
  ON public.feature_flags FOR SELECT
  USING (true);

-- Admin can manage all flags
DROP POLICY IF EXISTS "Admin manage feature flags" ON public.feature_flags;
CREATE POLICY "Admin manage feature flags"
  ON public.feature_flags FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'yusufquadir50@gmail.com');

-- Seed default feature flags
INSERT INTO public.feature_flags (key, label, description, is_enabled) VALUES
  ('ticket_reselling', 'Ticket Reselling', 'Allow users to list their tickets for resale on the marketplace.', true),
  ('guest_checkout', 'Guest Checkout', 'Allow users to purchase tickets without creating an account.', true),
  ('rsvp_events', 'RSVP Events', 'Allow organizers to create free RSVP-style events.', true),
  ('waitlist', 'Waitlist Feature', 'Allow users to join a waitlist when a ticket tier is sold out.', true),
  ('blog', 'Blog / Editorial', 'Show the Tixora blog section in navigation and homepage.', true),
  ('event_reviews', 'Event Reviews', 'Allow attendees to leave reviews on events they attended.', true)
ON CONFLICT (key) DO NOTHING;
