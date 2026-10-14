-- =============================================================================
-- OPTIONAL: call the app's reminder endpoint every 10 minutes from Supabase
-- (use this instead of Vercel Cron if you are on Vercel's Hobby plan, which
--  only allows daily cron jobs).
-- 1) Database → Extensions → enable "pg_net"
-- 2) Replace the URL and the secret (same value as CRON_SECRET in the app)
-- =============================================================================
create extension if not exists pg_net;

select cron.schedule(
  'eng3-open-room-reminders',
  '*/10 * * * *',
  $$
  select net.http_get(
    url     := 'https://YOUR-APP.vercel.app/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);
