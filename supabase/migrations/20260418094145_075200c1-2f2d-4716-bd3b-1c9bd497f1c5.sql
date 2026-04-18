-- 1. Создаём таблицу generations для метаданных каждой генерации
CREATE TABLE public.generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_key TEXT NOT NULL,
  style_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  debit_tx_id UUID,
  error_message TEXT,
  is_full_body BOOLEAN DEFAULT false,
  custom_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Индексы для быстрого поиска по юзеру и статусу
CREATE INDEX idx_generations_customer_key ON public.generations(customer_key);
CREATE INDEX idx_generations_status ON public.generations(status);
CREATE INDEX idx_generations_created_at ON public.generations(created_at DESC);

-- Триггер для updated_at
CREATE TRIGGER update_generations_updated_at
BEFORE UPDATE ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: полный запрет прямого доступа (только service role через edge functions)
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all direct access to generations"
ON public.generations
FOR ALL
USING (false);

-- 2. Добавляем credits_purchased в orders (для миграции старых заказов и трекинга пополнений)
ALTER TABLE public.orders
ADD COLUMN credits_purchased INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.credits_purchased IS 'Сколько кредитов начислено на баланс кошелька при успешной оплате этого заказа';
COMMENT ON TABLE public.generations IS 'Метаданные каждой генерации фото в модели кошелька. Сами фото НЕ хранятся (152-ФЗ): отдаются юзеру в ответе и удаляются из памяти.';