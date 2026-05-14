-- Add foreign key relationship from events to profiles to enable Supabase joins
ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS events_organizer_id_profiles_fkey;

ALTER TABLE public.events
ADD CONSTRAINT events_organizer_id_profiles_fkey
FOREIGN KEY (organizer_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;
