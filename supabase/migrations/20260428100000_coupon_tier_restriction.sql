-- Migration: Add allowed_tiers to coupons table
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS allowed_tiers text[];

-- Comment: This column stores an array of tier names that the coupon applies to.
-- If NULL, it applies to all tiers in the scoped event (or all events if global).
