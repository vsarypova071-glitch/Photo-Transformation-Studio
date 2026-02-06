-- Fix RLS policies to deny direct client access
-- All operations go through edge function with service role key

-- Drop overly permissive policies on user_credits
DROP POLICY IF EXISTS "Users can view their own credits" ON public.user_credits;

-- Create restrictive policy - only authenticated users can see their own data
CREATE POLICY "Users can view own credits only"
ON public.user_credits FOR SELECT
USING (auth.uid()::text = user_id);

-- Drop overly permissive policies on code_redemptions
DROP POLICY IF EXISTS "Users can view their own redemptions" ON public.code_redemptions;

-- Create restrictive policy - only authenticated users can see their own redemptions
CREATE POLICY "Users can view own redemptions only"
ON public.code_redemptions FOR SELECT
USING (auth.uid()::text = user_id);