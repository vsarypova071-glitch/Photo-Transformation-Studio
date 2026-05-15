-- Migration 002: foundation for CLUB subscription system.
-- Все изменения ADDITIVE: новые поля NULL/DEFAULT, новые таблицы — отдельные.
-- Применять идемпотентно (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
--
-- Запуск:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_club_phase.sql
--
-- Откат: см. db/migrations/002_club_phase.rollback.sql (создать перед prod-запуском).

-- ============================================================================
-- 1. Расширения существующих таблиц
-- ============================================================================

-- ORDERS: kind / discount / price_before_discount / subscription_id
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'package';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_before_discount INTEGER;
-- subscription_id добавится после CREATE TABLE subscriptions (см. ниже).

-- CREDIT_ACCOUNTS: club mirror + last grant
ALTER TABLE credit_accounts ADD COLUMN IF NOT EXISTS club_status TEXT;        -- 'active' / 'grace' / 'past_due' / 'canceled' / NULL
ALTER TABLE credit_accounts ADD COLUMN IF NOT EXISTS last_grant_at TIMESTAMPTZ;

-- CREDIT_TRANSACTIONS: lot tracking — у каждого начисления свой expires_at + источник
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;     -- NULL = не сгорает (legacy и админские)
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS source TEXT;                -- 'package_basic' | 'package_standard' | 'package_premium' | 'club_grant' | 'referral_bonus' | 'manual' | 'expired'
-- индексы для FIFO debit и expire-cron
CREATE INDEX IF NOT EXISTS idx_credit_transactions_account_type
  ON credit_transactions(account_id, type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_expires_at
  ON credit_transactions(expires_at) WHERE expires_at IS NOT NULL;

-- Добавляем 'expired' в список допустимых type'ов
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'credit_transactions'
      AND constraint_name LIKE '%credit_transactions%type%check%'
  ) THEN
    ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
  END IF;
  ALTER TABLE credit_transactions
    ADD CONSTRAINT credit_transactions_type_check
    CHECK (type IN ('credit','debit','refund','refund_partial','expired'));
END $$;

-- GENERATIONS: archive support
ALTER TABLE generations ADD COLUMN IF NOT EXISTS final_image_filename TEXT;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS final_image_url TEXT;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS preview_url TEXT;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_generations_expires_at
  ON generations(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- 2. Новые таблицы
-- ============================================================================

-- 2.1 Каталог стилей (заменяет src/lib/constants.ts).
-- legacy_category — то что было в коде ('realistic' и т.д.).
-- category — новые маркетинговые категории CLUB ('Instagram' / 'Tinder' / ...),
-- заполняется руками или через админ-API когда будет готов.
CREATE TABLE IF NOT EXISTS styles (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  preview_url     TEXT,                -- nullable — frontend имеет bundle-fallback по id
  category        TEXT,                -- 'Instagram' | 'Tinder' | 'Business' | 'Luxury' | 'Anime' | 'Cinematic' | 'Fashion' | 'Avatar'
  legacy_category TEXT,                -- старое 'realistic' и т.п. — для миграции
  prompt          TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  club_only       BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_styles_active_category ON styles(active, category);
CREATE INDEX IF NOT EXISTS idx_styles_club_only ON styles(club_only) WHERE club_only = true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_styles_updated_at') THEN
    CREATE TRIGGER trg_styles_updated_at BEFORE UPDATE ON styles
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- 2.2 Подписки (CLUB и будущие планы).
-- recurring billing включается только когда ENABLE_SUBSCRIPTIONS=true.
CREATE TABLE IF NOT EXISTS subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_key                TEXT NOT NULL UNIQUE,
  plan                        TEXT NOT NULL DEFAULT 'club',
  status                      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','grace','past_due','canceled','expired')),
  current_period_start        TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end          TIMESTAMPTZ NOT NULL,
  cancel_at_period_end        BOOLEAN NOT NULL DEFAULT false,
  yookassa_payment_method_id  TEXT,                  -- saved card from YooKassa (recurring)
  last_billing_payment_id     TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated_at') THEN
    CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- Добавляем FK на orders.subscription_id (отложенный — после создания subscriptions)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2.3 Журнал событий подписок (append-only).
CREATE TABLE IF NOT EXISTS subscription_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,        -- 'created' | 'renewed' | 'grant_credits' | 'failed_charge' | 'canceled' | 'reactivated'
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscription_events_sub ON subscription_events(subscription_id, created_at DESC);

-- 2.4 Daily quota (лимит 15 генераций / сутки / customer_key).
CREATE TABLE IF NOT EXISTS daily_usage (
  customer_key      TEXT NOT NULL,
  usage_date        DATE NOT NULL,
  generations_count INTEGER NOT NULL DEFAULT 0 CHECK (generations_count >= 0),
  PRIMARY KEY (customer_key, usage_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage(usage_date);

-- 2.5 Реферальная система (включится позже под флагом).
CREATE TABLE IF NOT EXISTS referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_key  TEXT NOT NULL,
  referee_key   TEXT NOT NULL UNIQUE,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','granted','revoked')),
  redeemed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_key);

-- 2.6 Weekly drops — куратор-подборки.
CREATE TABLE IF NOT EXISTS weekly_drops (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_iso             TEXT NOT NULL UNIQUE,        -- '2026-W19'
  releases_at_club     TIMESTAMPTZ NOT NULL,
  releases_at_free     TIMESTAMPTZ NOT NULL,
  style_ids            TEXT[] NOT NULL DEFAULT '{}',
  is_published         BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_weekly_drops_releases_club ON weekly_drops(releases_at_club);

-- ============================================================================
-- 3. Подсчёт остатка по lot'у (для FIFO debit) — view, чтобы не пересобирать каждый раз вручную.
-- "Остаток lot'а" = amount kredit'а минус все что уже списали или сгорело по этому lot'у.
-- В Phase 3 вернёмся и сделаем настоящий lot tracking; сейчас view просто
-- даёт читать список activе credits c expires_at.
-- ============================================================================

CREATE OR REPLACE VIEW v_active_credit_lots AS
SELECT
  ct.id          AS lot_id,
  ct.account_id,
  ct.amount,
  ct.expires_at,
  ct.source,
  ct.created_at
FROM credit_transactions ct
WHERE ct.type = 'credit'
  AND (ct.expires_at IS NULL OR ct.expires_at > now())
ORDER BY
  ct.expires_at NULLS LAST,
  ct.created_at;

-- ============================================================================
-- 4. Done. Проверка: что добавилось
-- ============================================================================

DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('styles','subscriptions','subscription_events','daily_usage','referrals','weekly_drops');
  RAISE NOTICE 'Migration 002: club tables present = %', n;
END $$;
