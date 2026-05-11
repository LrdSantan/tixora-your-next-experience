-- Add bio and avatar_url columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Ensure avatars bucket exists (if possible via SQL, though usually done via UI/CLI)
-- This is more for reference as bucket creation is often a different flow
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;

-- RLS policies for avatars (example)
-- CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);
