-- Retain 90 days of analytics logs; older rows are operational noise.
-- Requires pg_cron extension: Supabase Dashboard → Database → Extensions → pg_cron.
CREATE OR REPLACE FUNCTION delete_old_analytics_logs()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM "Analytics_Logs" WHERE created_at < NOW() - INTERVAL '90 days';
$$;

-- Schedule daily at 03:00 UTC.
SELECT cron.schedule(
  'delete-old-analytics-logs',
  '0 3 * * *',
  $$ SELECT delete_old_analytics_logs(); $$
);
