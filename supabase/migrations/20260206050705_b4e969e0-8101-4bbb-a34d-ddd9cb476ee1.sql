-- Create users table for storing credits and plan information
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'FREE',
  remaining_credits INTEGER NOT NULL DEFAULT 0,
  allowed_styles_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create access_codes table for storing valid codes
CREATE TABLE public.access_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL,
  credits INTEGER NOT NULL,
  styles_limit INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create code_redemptions table to track usage
CREATE TABLE public.code_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES public.access_codes(id),
  user_id TEXT NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(code_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_credits - users can only read their own data
CREATE POLICY "Users can view their own credits"
ON public.user_credits FOR SELECT
USING (true);

CREATE POLICY "System can insert user credits"
ON public.user_credits FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update user credits"
ON public.user_credits FOR UPDATE
USING (true);

-- RLS policies for access_codes - no direct client access (handled by edge function)
CREATE POLICY "No direct access to access codes"
ON public.access_codes FOR SELECT
USING (false);

-- RLS policies for code_redemptions - users can view their own redemptions
CREATE POLICY "Users can view their own redemptions"
ON public.code_redemptions FOR SELECT
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the access codes into database (server-side only)
INSERT INTO public.access_codes (code, plan_type, credits, styles_limit) VALUES
  ('CODE-START-777', 'START', 5, 3),
  ('CODE-PREM-888', 'PREMIUM', 15, 8),
  ('CODE-VIP-999', 'VIP', 40, 100);