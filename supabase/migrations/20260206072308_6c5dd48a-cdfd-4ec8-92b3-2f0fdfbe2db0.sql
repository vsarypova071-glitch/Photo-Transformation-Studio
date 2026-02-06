-- Add expiration column to access_codes for time-limited code validity
ALTER TABLE public.access_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;