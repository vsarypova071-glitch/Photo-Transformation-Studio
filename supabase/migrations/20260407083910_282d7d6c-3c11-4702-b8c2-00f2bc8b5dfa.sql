
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_session_id TEXT NOT NULL,
  tariff_id TEXT NOT NULL,
  photos_count INTEGER NOT NULL,
  price INTEGER NOT NULL,
  payment_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  style_ids TEXT[] NOT NULL DEFAULT '{}',
  original_image TEXT,
  custom_prompt TEXT,
  is_full_body BOOLEAN DEFAULT false,
  generation_status TEXT NOT NULL DEFAULT 'waiting',
  results TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all direct access to orders" ON public.orders FOR ALL USING (false);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
