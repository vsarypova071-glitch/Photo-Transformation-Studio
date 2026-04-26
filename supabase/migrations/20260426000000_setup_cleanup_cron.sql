-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing schedule if any (safe to re-run)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orders-every-15min') THEN
    PERFORM cron.unschedule('cleanup-orders-every-15min');
  END IF;
END $$;

-- Schedule cleanup-orders edge function every 15 minutes
SELECT cron.schedule(
  'cleanup-orders-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hzdbacnjmsrvksholixe.supabase.co/functions/v1/cleanup-orders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZGJhY25qbXNydmtzaG9saXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzc0NzIsImV4cCI6MjA4NTkxMzQ3Mn0.nEjnW9y7GQTaJfs-v_A7Z82DHFaukKo5IkzmYArRKLw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
