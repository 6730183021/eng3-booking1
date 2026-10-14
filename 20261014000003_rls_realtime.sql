-- =============================================================================
-- ENG3 Room Booking — 03 Row Level Security, grants & Realtime
-- Principle: clients may READ what they are allowed to see; every WRITE to
-- bookings goes through the RPCs in 02_functions.sql.
-- =============================================================================

alter table public.booking_settings enable row level security;
alter table public.staff_members    enable row level security;
alter table public.profiles         enable row level security;
alter table public.floors           enable row level security;
alter table public.rooms            enable row level security;
alter table public.room_blocks      enable row level security;
alter table public.bookings         enable row level security;
alter table public.room_slots       enable row level security;
alter table public.booking_events   enable row level security;
alter table public.doc_counters     enable row level security;   -- internal: no policies
alter table public.hold_log         enable row level security;   -- internal: no policies

-- Nothing for anonymous visitors
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------- settings
create policy "settings: read" on public.booking_settings
  for select to authenticated using (true);
create policy "settings: super admin edits" on public.booking_settings
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------- staff allow-list
create policy "staff_members: super admin" on public.staff_members
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------- profiles
create policy "profiles: read own / staff reads all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Column-level: a student can never change their own e-mail, role or student ID
-- (student_id comes from the verified Chula e-mail, so official documents can be trusted)
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, department, year_of_study, phone, privacy_accepted_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------- floors & rooms
create policy "floors: read" on public.floors for select to authenticated using (true);
create policy "floors: super admin" on public.floors
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "rooms: read" on public.rooms for select to authenticated using (true);
create policy "rooms: super admin" on public.rooms
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------- blocks
create policy "blocks: read" on public.room_blocks for select to authenticated using (true);
create policy "blocks: approver manages" on public.room_blocks
  for all to authenticated using (public.is_approver()) with check (public.is_approver());

-- ---------------------------------------------------------------- bookings
create policy "bookings: owner or staff reads" on public.bookings
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.bookings from authenticated;   -- RPC only

-- ---------------------------------------------------------------- public slot mirror
create policy "room_slots: read" on public.room_slots for select to authenticated using (true);
revoke insert, update, delete on public.room_slots from authenticated;

-- ---------------------------------------------------------------- audit trail
create policy "events: owner or staff reads" on public.booking_events
  for select to authenticated using (
    public.is_staff()
    or exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid())
  );
revoke insert, update, delete on public.booking_events from authenticated;
revoke all on public.doc_counters, public.hold_log from authenticated;

-- ---------------------------------------------------------------- function grants
revoke execute on all functions in schema public from public, anon;

-- internal helpers: not callable from the API
revoke execute on function public.apply_booking_form(uuid, jsonb)          from authenticated;
revoke execute on function public.log_booking_event(uuid, text, public.booking_status, public.booking_status, text) from authenticated;
revoke execute on function public.expire_stale_holds()                     from authenticated;
revoke execute on function public.handle_new_user()                        from authenticated;
revoke execute on function public.sync_staff_role()                        from authenticated;
revoke execute on function public.sync_room_slot()                         from authenticated;

grant execute on function
  public.app_role(), public.is_staff(), public.is_approver(), public.is_super_admin(),
  public.is_profile_complete(uuid),
  public.assert_booking_rules(uuid, timestamptz, timestamptz),
  public.hold_slot(uuid, timestamptz, timestamptz),
  public.release_hold(uuid),
  public.submit_booking(uuid, jsonb),
  public.update_booking_details(uuid, jsonb),
  public.cancel_booking(uuid, text),
  public.review_booking(uuid, text, text),
  public.mark_room_task(uuid, text)
to authenticated;

-- ---------------------------------------------------------------- Realtime
-- Realtime respects the RLS policies above: students receive changes to
-- room_slots (anonymous occupancy) and to their own bookings only.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime
      add table public.room_slots, public.bookings, public.room_blocks, public.rooms;
  end if;
end $$;
