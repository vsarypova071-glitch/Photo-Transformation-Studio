-- Drop overly permissive policies
DROP POLICY IF EXISTS "System can insert user credits" ON public.user_credits;
DROP POLICY IF EXISTS "System can update user credits" ON public.user_credits;

-- These operations will be done via edge function with service role key
-- No direct client INSERT/UPDATE needed