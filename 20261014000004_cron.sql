-- =============================================================================
-- ENG3 Room Booking — 04 Scheduled jobs (pg_cron, available on every Supabase project)
-- Releases holds that timed out, so the floor plan turns from yellow back to
-- green within a minute even if the student just closed the browser tab.
-- (hold_slot also clears expired holds on the room it touches, and the UI hides
--  expired holds immediately, so this job is a clean-up — not the only safeguard.)
-- =============================================================================
create extension if not exists pg_cron;

select cron.schedule(
  'eng3-expire-holds',
  '* * * * *',
  $$ select public.expire_stale_holds(); $$
);
