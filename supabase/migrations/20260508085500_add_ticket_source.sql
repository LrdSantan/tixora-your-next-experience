-- Add source and payment_reference columns to tickets table for RSVP and alternative payment support
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'paystack',
ADD COLUMN IF NOT EXISTS payment_reference text DEFAULT NULL;

-- Create an index for the source column
CREATE INDEX IF NOT EXISTS idx_tickets_source ON public.tickets(source);
