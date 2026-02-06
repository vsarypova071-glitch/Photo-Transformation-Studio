-- Deny all direct INSERT/UPDATE/DELETE on sensitive tables
-- All operations go through edge function with service role key

-- access_codes: Deny all client operations (admin only via service role)
CREATE POLICY "Deny insert on access_codes"
ON public.access_codes FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update on access_codes"
ON public.access_codes FOR UPDATE
USING (false);

CREATE POLICY "Deny delete on access_codes"
ON public.access_codes FOR DELETE
USING (false);

-- code_redemptions: Deny all client operations
CREATE POLICY "Deny insert on code_redemptions"
ON public.code_redemptions FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update on code_redemptions"
ON public.code_redemptions FOR UPDATE
USING (false);

CREATE POLICY "Deny delete on code_redemptions"
ON public.code_redemptions FOR DELETE
USING (false);

-- user_credits: Deny all client INSERT/UPDATE/DELETE
CREATE POLICY "Deny insert on user_credits"
ON public.user_credits FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update on user_credits"
ON public.user_credits FOR UPDATE
USING (false);

CREATE POLICY "Deny delete on user_credits"
ON public.user_credits FOR DELETE
USING (false);