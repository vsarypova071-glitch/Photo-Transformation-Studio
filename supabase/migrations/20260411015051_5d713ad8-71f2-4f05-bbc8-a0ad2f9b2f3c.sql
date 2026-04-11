
CREATE OR REPLACE FUNCTION public.debit_balance(p_account_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE credit_accounts
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = p_account_id
    AND balance >= p_amount
  RETURNING balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_balance(p_account_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE credit_accounts
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = p_account_id
  RETURNING balance INTO new_balance;

  RETURN COALESCE(new_balance, -1);
END;
$$;
