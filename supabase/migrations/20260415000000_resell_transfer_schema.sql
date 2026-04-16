-- Add resell and transfer columns to tickets table
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS resell_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS resell_requested_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transfer_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transfer_token text UNIQUE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transfer_token_expires_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_owner_email text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transferred_to_email text DEFAULT NULL;

-- Create ticket_resells table
CREATE TABLE IF NOT EXISTS public.ticket_resells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id),
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  new_buyer_id uuid REFERENCES auth.users(id),
  original_amount numeric NOT NULL,
  refund_amount numeric NOT NULL,
  fee_percentage numeric NOT NULL,
  fee_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT status_check CHECK (status IN ('pending', 'completed', 'cancelled'))
);

-- Enable RLS for ticket_resells
ALTER TABLE public.ticket_resells ENABLE ROW LEVEL SECURITY;

-- RLS policies for ticket_resells
CREATE POLICY "Users can view their own resell requests" 
ON public.ticket_resells FOR SELECT 
USING (auth.uid() = requested_by);

CREATE POLICY "Users can create their own resell requests" 
ON public.ticket_resells FOR INSERT 
WITH CHECK (auth.uid() = requested_by);

-- Create ticket_transfers table
CREATE TABLE IF NOT EXISTS public.ticket_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id),
  from_user_id uuid NOT NULL REFERENCES auth.users(id),
  to_email text,
  method text NOT NULL,
  transfer_token text UNIQUE NOT NULL,
  fee_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT method_check CHECK (method IN ('email', 'link')),
  CONSTRAINT transfer_status_check CHECK (status IN ('pending', 'completed', 'cancelled', 'expired'))
);

-- Enable RLS for ticket_transfers
ALTER TABLE public.ticket_transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies for ticket_transfers
CREATE POLICY "Users can view transfers they sent" 
ON public.ticket_transfers FOR SELECT 
USING (auth.uid() = from_user_id);

CREATE POLICY "Users can create transfers" 
ON public.ticket_transfers FOR INSERT 
WITH CHECK (auth.uid() = from_user_id);

-- index for performance on status checks and tokens
CREATE INDEX IF NOT EXISTS idx_tickets_resell_status ON public.tickets(resell_status);
CREATE INDEX IF NOT EXISTS idx_tickets_transfer_status ON public.tickets(transfer_status);
CREATE INDEX IF NOT EXISTS idx_tickets_transfer_token ON public.tickets(transfer_token);
CREATE INDEX IF NOT EXISTS idx_ticket_resells_status ON public.ticket_resells(status);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_token ON public.ticket_transfers(transfer_token);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_status ON public.ticket_transfers(status);
