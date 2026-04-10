
-- Credit accounts: one per customer
CREATE TABLE public.credit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_key text NOT NULL,
  email text,
  balance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_accounts_customer_key_unique UNIQUE (customer_key),
  CONSTRAINT credit_accounts_balance_non_negative CHECK (balance >= 0)
);

-- Enable RLS — block all direct access, only service_role via edge functions
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all direct access to credit_accounts"
  ON public.credit_accounts FOR ALL
  USING (false);

-- Credit transactions: immutable log
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.credit_accounts(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('credit', 'debit', 'refund')),
  amount integer NOT NULL CHECK (amount > 0),
  idempotency_key text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_transactions_idempotency_unique UNIQUE (idempotency_key)
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all direct access to credit_transactions"
  ON public.credit_transactions FOR ALL
  USING (false);

-- Add customer_key to orders table for linking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_key text;

-- Trigger for updated_at on credit_accounts
CREATE TRIGGER update_credit_accounts_updated_at
  BEFORE UPDATE ON public.credit_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
