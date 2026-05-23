-- Platform Alerts Migration
CREATE TABLE IF NOT EXISTS public.platform_alerts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  type text not null check (type in ('warning', 'info', 'error', 'success')),
  is_active boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS
ALTER TABLE public.platform_alerts ENABLE ROW LEVEL SECURITY;

-- Public can read active alerts
DROP POLICY IF EXISTS "Public read alerts" ON public.platform_alerts;
CREATE POLICY "Public read alerts"
  ON public.platform_alerts FOR SELECT
  USING (true);

-- Admin manage all alerts
DROP POLICY IF EXISTS "Admin manage all alerts" ON public.platform_alerts;
CREATE POLICY "Admin manage all alerts"
  ON public.platform_alerts FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'yusufquadir50@gmail.com');
