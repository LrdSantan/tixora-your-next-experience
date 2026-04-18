-- Multi-day event support
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_multi_day BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_days JSONB DEFAULT '[]';

CREATE TABLE IF NOT EXISTS public.ticket_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  scan_date DATE DEFAULT CURRENT_DATE,
  scanner_id UUID REFERENCES auth.users(id),
  UNIQUE (ticket_id, scan_date)
);

-- Enable RLS
ALTER TABLE public.ticket_scans ENABLE ROW LEVEL SECURITY;

-- Allow organizers and team members to read scans for their events
CREATE POLICY "Organizers read scans of their own events" 
  ON public.ticket_scans FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ticket_scans.event_id
      AND (
        e.organizer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.organizer_team_members tm
          WHERE tm.organizer_id = e.organizer_id
          AND tm.member_id = auth.uid()
          AND tm.status = 'accepted'
        )
      )
    )
  );

-- Allow organizers and team members to insert scans
CREATE POLICY "Organizers insert scans for their events" 
  ON public.ticket_scans FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ticket_scans.event_id
      AND (
        e.organizer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.organizer_team_members tm
          WHERE tm.organizer_id = e.organizer_id
          AND tm.member_id = auth.uid()
          AND tm.status = 'accepted'
        )
      )
    )
  );
