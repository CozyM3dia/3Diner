-- Retain 90 days of analytics logs; older rows are operational noise.
-- Requires pg_cron extension: Supabase Dashboard → Database → Extensions → pg_cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION delete_old_analytics_logs()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM "Analytics_Logs" WHERE created_at < NOW() - INTERVAL '90 days';
$$;

-- Unschedule first to ensure idempotent re-runs (supabase db reset, etc.)
SELECT cron.unschedule('delete-old-analytics-logs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-old-analytics-logs');

-- Schedule daily at 03:00 UTC.
SELECT cron.schedule(
  'delete-old-analytics-logs',
  '0 3 * * *',
  $$ SELECT delete_old_analytics_logs(); $$
);
