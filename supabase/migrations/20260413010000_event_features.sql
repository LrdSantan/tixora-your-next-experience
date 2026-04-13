-- 1. Remove admin approval flow and update statuses
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        JOIN pg_class ON conrelid = pg_class.oid
        JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
        JOIN pg_attribute ON attrelid = pg_class.oid AND attnum = ANY(conkey)
        WHERE pg_class.relname = 'events'
        AND pg_namespace.nspname = 'public'
        AND pg_attribute.attname = 'status'
        AND contype = 'c'
    LOOP
        EXECUTE 'ALTER TABLE public.events DROP CONSTRAINT ' || quote_ident(constraint_name);
    END LOOP;
END;
$$;

ALTER TABLE public.events ALTER COLUMN status SET DEFAULT 'active';

UPDATE public.events 
SET status = 'active' 
WHERE status IN ('pending', 'approved');

ALTER TABLE public.events 
ADD CONSTRAINT events_status_check 
CHECK (status IN ('active', 'suspended', 'deleted', 'expired', 'rejected', 'pending'));

-- Update RLS policy for events
DROP POLICY IF EXISTS "Public read approved events" ON public.events;
CREATE POLICY "Public read active events" 
  ON public.events FOR SELECT 
  USING (status = 'active');

-- 2. Create Coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric not null check (discount_value > 0),
  max_uses integer,
  uses_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active coupons" 
  ON public.coupons FOR SELECT 
  USING (is_active = true);

CREATE POLICY "Admin manage all coupons" 
  ON public.coupons FOR ALL 
  TO authenticated 
  USING ((auth.jwt() ->> 'email') = 'yusufquadir50@gmail.com');

-- 3. Modify tickets table for coupons
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_id uuid references public.coupons(id) on delete set null;

-- 4. Create Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read reviews" 
  ON public.reviews FOR SELECT 
  USING (true);

CREATE POLICY "Users insert own reviews" 
  ON public.reviews FOR INSERT 
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND exists (
      select 1 from public.tickets t 
      where t.user_id = auth.uid() 
      and t.event_id = reviews.event_id
    )
  );

CREATE POLICY "Users update own reviews" 
  ON public.reviews FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own reviews" 
  ON public.reviews FOR DELETE 
  TO authenticated 
  USING (user_id = auth.uid());
