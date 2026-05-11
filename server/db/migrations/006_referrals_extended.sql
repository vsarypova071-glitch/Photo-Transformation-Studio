-- Migration 006: extend referrals system for Phase 4 (за ENABLE_REFERRALS).
-- Все изменения ADDITIVE: ALTER ADD COLUMN IF NOT EXISTS, NULL/DEFAULT.
-- Старые таблицы и данные не трогаются. Старый webhook продолжает работать
-- байт-в-байт как сейчас (новые поля игнорируются если ENABLE_REFERRALS=false).

-- ============================================================================
-- 1. credit_accounts.referral_code — публичный 6-char код реферера.
-- Lazy-генерация при GET /api/referrals/me. UNIQUE INDEX только для не-NULL.
-- ============================================================================
ALTER TABLE credit_accounts ADD COLUMN IF NOT EXISTS referral_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_accounts_referral_code
  ON credit_accounts(referral_code) WHERE referral_code IS NOT NULL;

-- ============================================================================
-- 2. referrals — добавляем referral_code (какой код использовался при оплате)
-- и order_id (для аудита и идемпотентности).
-- Существующее UNIQUE на referee_key уже даёт anti-abuse:
-- один и тот же referee не получит бонус для двух разных рефереров.
-- ============================================================================
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_order_id ON referrals(order_id);

-- ============================================================================
-- 3. orders.referral_code — фиксируем код, использованный при создании заказа.
-- Это позволяет webhook надёжно начислить бонус, не завися от YooKassa metadata.
-- ============================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_code TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON orders(referral_code) WHERE referral_code IS NOT NULL;

-- ============================================================================
-- 4. referrals.status: расширяем CHECK constraint.
-- В миграции 002 был ('pending','granted','revoked'). По бизнес-логике
-- Phase 4 нужны: 'pending' (фронт track), 'granted' (бонус начислен),
-- 'rejected' (audit-row для self-referral / unknown code).
-- 'revoked' оставляем для будущего (отзыв уже выданного бонуса при
-- мошенничестве/чарджбэке). Делаем ALTER идемпотентно: DROP CONSTRAINT
-- IF EXISTS + ADD с расширенным набором значений.
-- ============================================================================
DO $$ BEGIN
  ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
  ALTER TABLE referrals ADD CONSTRAINT referrals_status_check
    CHECK (status IN ('pending','granted','rejected','revoked'));
END $$;

-- ============================================================================
-- Sanity
-- ============================================================================
DO $$
DECLARE n_cols INTEGER;
BEGIN
  SELECT count(*) INTO n_cols FROM information_schema.columns
   WHERE table_schema = 'public'
     AND ((table_name='credit_accounts' AND column_name='referral_code')
       OR (table_name='referrals' AND column_name IN ('referral_code','order_id'))
       OR (table_name='orders' AND column_name='referral_code'));
  RAISE NOTICE 'Migration 006: referral columns present = % (expect 4)', n_cols;
END $$;

-- ============================================================================
-- ROLLBACK (вручную):
--   ALTER TABLE orders DROP COLUMN IF EXISTS referral_code;
--   ALTER TABLE referrals DROP COLUMN IF EXISTS order_id;
--   ALTER TABLE referrals DROP COLUMN IF EXISTS referral_code;
--   ALTER TABLE credit_accounts DROP COLUMN IF EXISTS referral_code;
-- ============================================================================
