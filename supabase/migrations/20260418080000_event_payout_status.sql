-- Add payout_status column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'unpaid';

-- Add index for better performance on status filtering
CREATE INDEX IF NOT EXISTS idx_events_payout_status ON public.events(payout_status);

-- Update RLS if necessary (usually admins have full access, which they do in this project)
