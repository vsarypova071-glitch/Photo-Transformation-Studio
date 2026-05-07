-- Migration: MVP schema for Beget VPS
-- Run once: psql $DATABASE_URL -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Кошелёк клиента (анонимный, идентифицируется по customer_key)
CREATE TABLE IF NOT EXISTS credit_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_key  TEXT UNIQUE NOT NULL,
  email         TEXT,
  balance       INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Заказы (оплата + генерация)
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_session_id   TEXT NOT NULL,
  customer_key      TEXT,
  tariff_id         TEXT NOT NULL,
  photos_count      INTEGER NOT NULL,
  price             INTEGER NOT NULL,
  payment_id        TEXT,
  payment_status    TEXT NOT NULL DEFAULT 'pending',
  generation_status TEXT NOT NULL DEFAULT 'waiting',
  style_ids         TEXT[] NOT NULL DEFAULT '{}',
  original_image    TEXT,
  custom_prompt     TEXT,
  is_full_body      BOOLEAN NOT NULL DEFAULT false,
  results           TEXT[] NOT NULL DEFAULT '{}',
  credits_purchased INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_key ON orders(customer_key);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id   ON orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at DESC);

-- Лог транзакций (неизменяемый)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
  order_id         UUID REFERENCES orders(id) ON DELETE SET NULL,
  type             TEXT NOT NULL CHECK (type IN ('credit','debit','refund','refund_partial')),
  amount           INTEGER NOT NULL CHECK (amount > 0),
  idempotency_key  TEXT UNIQUE,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Генерации (Studio mode — одна генерация = 1 кредит)
CREATE TABLE IF NOT EXISTS generations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_key  TEXT NOT NULL,
  style_id      TEXT,
  status        TEXT NOT NULL CHECK (status IN ('running','done','error')),
  debit_tx_id   UUID REFERENCES credit_transactions(id),
  error_message TEXT,
  is_full_body  BOOLEAN NOT NULL DEFAULT false,
  custom_prompt TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generations_customer_key ON generations(customer_key);
CREATE INDEX IF NOT EXISTS idx_generations_created_at   ON generations(created_at DESC);

-- Триггер: обновлять updated_at автоматически
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_updated_at') THEN
    CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_credit_accounts_updated_at') THEN
    CREATE TRIGGER trg_credit_accounts_updated_at BEFORE UPDATE ON credit_accounts
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generations_updated_at') THEN
    CREATE TRIGGER trg_generations_updated_at BEFORE UPDATE ON generations
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- Атомарное списание кредитов (возвращает новый баланс или -1 если недостаточно)
CREATE OR REPLACE FUNCTION debit_balance(p_account_id UUID, p_amount INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_balance INTEGER;
BEGIN
  UPDATE credit_accounts
    SET balance = balance - p_amount, updated_at = now()
    WHERE id = p_account_id AND balance >= p_amount
    RETURNING balance INTO v_balance;
  RETURN COALESCE(v_balance, -1);
END; $$;

-- Атомарный возврат кредитов
CREATE OR REPLACE FUNCTION refund_balance(p_account_id UUID, p_amount INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_balance INTEGER;
BEGIN
  UPDATE credit_accounts
    SET balance = balance + p_amount, updated_at = now()
    WHERE id = p_account_id
    RETURNING balance INTO v_balance;
  RETURN COALESCE(v_balance, -1);
END; $$;
