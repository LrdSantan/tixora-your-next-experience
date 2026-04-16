-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  bank_code text,
  bank_name text,
  account_number text,
  account_name text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 2. Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Update ticket_resells status constraint
ALTER TABLE public.ticket_resells 
DROP CONSTRAINT IF EXISTS status_check;

ALTER TABLE public.ticket_resells 
ADD CONSTRAINT status_check CHECK (status IN ('pending', 'completed', 'cancelled', 'paid'));

-- 4. Create admin payout queue view
CREATE OR REPLACE VIEW public.admin_payout_queue AS
SELECT 
  tr.id AS resell_id,
  tr.created_at AS request_date,
  tr.completed_at AS sold_date,
  tr.refund_amount,
  p.full_name AS seller_name,
  p.account_number,
  p.bank_name,
  p.account_name,
  tr.status
FROM public.ticket_resells tr
JOIN public.profiles p ON p.id = tr.requested_by
WHERE tr.status = 'completed' -- 'completed' means sold, but not yet 'paid'
ORDER BY tr.completed_at ASC;

-- 5. Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Admin can view all profiles
CREATE POLICY "Admin can view all profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING ((auth.jwt() ->> 'email') = 'yusufquadir50@gmail.com');

-- 6. Grant access to service_role (needed for view/triggers)
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.admin_payout_queue TO service_role;
