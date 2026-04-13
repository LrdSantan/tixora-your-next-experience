ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS user_name text DEFAULT 'Anonymous';
