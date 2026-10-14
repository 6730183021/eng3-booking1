-- =============================================================================
-- ENG3 Room Booking — 02 Functions, triggers & RPCs
-- All writes to bookings go through these SECURITY DEFINER functions, so the
-- rules below are enforced in the database — not just in the UI.
-- Errors are raised with a machine code in MESSAGE and Thai text in HINT.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers (used by RLS policies and RPCs)
-- ---------------------------------------------------------------------------
create or replace function public.app_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select role in ('staff', 'approver', 'super_admin') from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.is_approver()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select role in ('approver', 'super_admin') from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.is_profile_complete(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
      when p.role = 'student' then
        nullif(trim(p.full_name), '') is not null
        and p.student_id is not null
        and nullif(trim(p.department), '') is not null
        and p.year_of_study is not null
        and nullif(trim(p.phone), '') is not null
        and p.privacy_accepted_at is not null
      else nullif(trim(p.full_name), '') is not null
    end
    from public.profiles p where p.id = p_user_id), false)
$$;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.booking_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- New user → profile. Rejects e-mails outside the allowed domains
-- (unless the address is on the staff allow-list).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_email   text := lower(new.email);
  v_local   text := split_part(lower(new.email), '@', 1);
  v_domain  text := split_part(lower(new.email), '@', 2);
  v_role    public.user_role;
  v_domains text[];
begin
  select role into v_role from public.staff_members where email = v_email;
  select allowed_email_domains into v_domains from public.booking_settings limit 1;

  if v_role is null and not (v_domain = any (v_domains)) then
    raise exception 'EMAIL_DOMAIN_NOT_ALLOWED'
      using hint = 'ระบบรองรับเฉพาะอีเมลนิสิต @student.chula.ac.th เท่านั้น';
  end if;

  insert into public.profiles (id, email, role, full_name, student_id)
  values (
    new.id,
    v_email,
    coalesce(v_role, 'student'),
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
    -- Chula student e-mail = <รหัสนิสิต 10 หลัก>@student.chula.ac.th
    case when v_local ~ '^[0-9]{10}$' then v_local end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.role in sync with the staff allow-list
create or replace function public.sync_staff_role()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.profiles set role = 'student' where email = old.email;
    return old;
  end if;
  update public.profiles set role = new.role where email = new.email;
  return new;
end $$;

create trigger staff_members_sync
  after insert or update or delete on public.staff_members
  for each row execute function public.sync_staff_role();

-- ---------------------------------------------------------------------------
-- room_slots mirror (drives the real-time floor plan)
-- ---------------------------------------------------------------------------
create or replace function public.sync_room_slot()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status in ('holding', 'submitted', 'in_review', 'approved') then
    insert into public.room_slots (booking_id, room_id, starts_at, ends_at, state, hold_expires_at)
    values (
      new.id, new.room_id, new.starts_at, new.ends_at,
      case new.status when 'holding' then 'held' when 'approved' then 'approved' else 'pending' end,
      new.hold_expires_at
    )
    on conflict (booking_id) do update
      set room_id = excluded.room_id,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          state = excluded.state,
          hold_expires_at = excluded.hold_expires_at;
  else
    delete from public.room_slots where booking_id = new.id;
  end if;
  return new;
end $$;

create trigger bookings_sync_slot
  after insert or update of status, starts_at, ends_at, room_id, hold_expires_at on public.bookings
  for each row execute function public.sync_room_slot();
-- (DELETE is handled by ON DELETE CASCADE on room_slots.booking_id)

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function public.log_booking_event(
  p_booking_id uuid, p_action text,
  p_from public.booking_status, p_to public.booking_status, p_note text default null)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.booking_events (booking_id, actor_id, action, from_status, to_status, note)
  values (p_booking_id, auth.uid(), p_action, p_from, p_to, p_note)
$$;

-- Booking rules (ข้อ 3.3). Raises on the first violated rule.
create or replace function public.assert_booking_rules(
  p_room_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  s         public.booking_settings;
  r         public.rooms;
  v_start   timestamp;   -- local (Bangkok) wall-clock time
  v_end     timestamp;
  v_block   public.room_blocks;
begin
  select * into s from public.booking_settings limit 1;
  select * into r from public.rooms where id = p_room_id;

  if not found then
    raise exception 'ROOM_NOT_FOUND' using hint = 'ไม่พบห้องที่เลือก';
  end if;
  if r.status <> 'active' then
    raise exception 'ROOM_MAINTENANCE'
      using hint = 'ห้องนี้ปิดปรับปรุง ไม่เปิดให้จอง' || coalesce(' (' || r.status_note || ')', '');
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'INVALID_RANGE' using hint = 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม';
  end if;
  if p_ends_at - p_starts_at > make_interval(mins => s.max_duration_minutes) then
    raise exception 'DURATION_TOO_LONG'
      using hint = format('จองได้สูงสุดครั้งละ %s นาที', s.max_duration_minutes);
  end if;
  if (extract(epoch from p_starts_at)::bigint % (s.slot_minutes * 60)) <> 0
     or (extract(epoch from p_ends_at)::bigint % (s.slot_minutes * 60)) <> 0 then
    raise exception 'SLOT_MISALIGNED'
      using hint = format('เวลาต้องเป็นช่วงละ %s นาที', s.slot_minutes);
  end if;
  if p_starts_at < now() + make_interval(hours => s.min_lead_hours) then
    raise exception 'LEAD_TIME_TOO_SHORT'
      using hint = format('ต้องจองล่วงหน้าอย่างน้อย %s ชั่วโมง', s.min_lead_hours);
  end if;
  if p_starts_at > now() + make_interval(days => s.max_advance_days) then
    raise exception 'TOO_FAR_AHEAD'
      using hint = format('จองล่วงหน้าได้ไม่เกิน %s วัน', s.max_advance_days);
  end if;

  v_start := p_starts_at at time zone s.timezone;
  v_end   := p_ends_at   at time zone s.timezone;
  if v_start::date <> v_end::date
     or v_start::time < s.open_time
     or v_end::time   > s.close_time then
    raise exception 'OUTSIDE_OPEN_HOURS'
      using hint = format('อาคารเปิดให้จอง %s–%s น.',
                          to_char(s.open_time, 'HH24:MI'), to_char(s.close_time, 'HH24:MI'));
  end if;
  if not (extract(isodow from v_start)::int = any (s.open_days)) then
    raise exception 'CLOSED_DAY' using hint = 'วันที่เลือกอาคารไม่เปิดให้จอง';
  end if;

  select * into v_block
  from public.room_blocks b
  where (b.room_id = p_room_id or b.room_id is null)
    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  limit 1;
  if found then
    raise exception 'ROOM_BLOCKED' using hint = 'ช่วงเวลานี้ปิดการจอง: ' || v_block.reason;
  end if;
end $$;

-- Validates and writes the form fields of a booking (used by submit & edit)
create or replace function public.apply_booking_form(p_booking_id uuid, p_form jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_capacity  int;
  v_activity  text := nullif(trim(p_form ->> 'activity_name'), '');
  v_type      text := nullif(trim(p_form ->> 'activity_type'), '');
  v_purpose   text := nullif(trim(p_form ->> 'purpose'), '');
  v_phone     text := nullif(trim(p_form ->> 'contact_phone'), '');
  v_attendees int;
begin
  if (p_form ->> 'attendees') ~ '^[0-9]{1,5}$' then
    v_attendees := (p_form ->> 'attendees')::int;
  end if;

  if v_activity is null or v_type is null or v_purpose is null or v_phone is null
     or v_attendees is null or v_attendees < 1 then
    raise exception 'FORM_INCOMPLETE' using hint = 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน';
  end if;

  select r.capacity into v_capacity
  from public.bookings b join public.rooms r on r.id = b.room_id
  where b.id = p_booking_id;

  if v_attendees > v_capacity then
    raise exception 'OVER_CAPACITY'
      using hint = format('ห้องนี้รองรับได้สูงสุด %s คน', v_capacity);
  end if;

  update public.bookings set
    activity_name = v_activity,
    activity_type = v_type,
    purpose       = v_purpose,
    attendees     = v_attendees,
    organization  = nullif(trim(p_form ->> 'organization'), ''),
    advisor_name  = nullif(trim(p_form ->> 'advisor_name'), ''),
    contact_phone = v_phone,
    equipment     = coalesce(
                      (select array_agg(e) from jsonb_array_elements_text(
                         case when jsonb_typeof(p_form -> 'equipment') = 'array'
                              then p_form -> 'equipment' else '[]'::jsonb end) e),
                      '{}'),
    extra_notes   = nullif(trim(p_form ->> 'extra_notes'), '')
  where id = p_booking_id;
end $$;

-- =============================================================================
-- RPCs (called from the app)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) hold_slot — PESSIMISTIC LOCK (ข้อ 3.1)
--    Locks a room/time range for the caller for `hold_minutes` while they fill
--    the form. Two students racing for the same slot: exactly one wins.
--    Layers of protection:
--      a) pg_advisory_xact_lock(room) serialises concurrent attempts per room
--      b) explicit overlap check → friendly SLOT_LOCKED / SLOT_TAKEN errors
--      c) EXCLUDE constraint → the hard guarantee, even if (a)/(b) are bypassed
-- ---------------------------------------------------------------------------
create or replace function public.hold_slot(
  p_room_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  s          public.booking_settings;
  v_active   int;
  v_conflict public.bookings;
  v_row      public.bookings;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'กรุณาเข้าสู่ระบบ';
  end if;
  if not public.is_profile_complete(v_uid) then
    raise exception 'PROFILE_INCOMPLETE' using hint = 'กรุณากรอกข้อมูลส่วนตัวให้ครบก่อนจอง';
  end if;

  select * into s from public.booking_settings limit 1;
  perform public.assert_booking_rules(p_room_id, p_starts_at, p_ends_at);

  select count(*) into v_active from public.bookings
  where user_id = v_uid and status in ('submitted', 'in_review', 'approved') and ends_at > now();
  if v_active >= s.max_active_bookings then
    raise exception 'TOO_MANY_ACTIVE_BOOKINGS'
      using hint = format('มีการจองที่ยังไม่สิ้นสุดได้ไม่เกิน %s รายการ', s.max_active_bookings);
  end if;

  -- anti-griefing: a student cannot keep a slot yellow forever by re-locking it
  if (select count(*) from public.hold_log
      where user_id = v_uid and created_at > now() - interval '60 minutes') >= 10 then
    raise exception 'TOO_MANY_HOLDS' using hint = 'ล็อกห้องบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
  end if;
  if (select count(*) from public.hold_log h
      where h.user_id = v_uid and h.room_id = p_room_id
        and h.created_at > now() - interval '30 minutes'
        and tstzrange(h.starts_at, h.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')) >= 2 then
    raise exception 'HOLD_COOLDOWN'
      using hint = 'คุณล็อกช่วงเวลานี้ไปแล้ว 2 ครั้งโดยไม่ได้ส่งคำร้อง กรุณารอ 30 นาทีเพื่อให้ผู้อื่นมีโอกาสจอง';
  end if;

  -- (a) one attempt per room at a time; released automatically at COMMIT/ROLLBACK
  perform pg_advisory_xact_lock(hashtextextended('eng3-room:' || p_room_id::text, 0));

  -- a student can hold only one slot at a time → release their previous hold
  delete from public.bookings where user_id = v_uid and status = 'holding';
  -- expired holds on this room no longer block anyone
  delete from public.bookings
  where room_id = p_room_id and status = 'holding' and hold_expires_at <= now();

  -- (b) friendly conflict detection
  select * into v_conflict
  from public.bookings b
  where b.room_id = p_room_id
    and b.status in ('holding', 'submitted', 'in_review', 'approved')
    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  order by (b.status = 'holding') desc
  limit 1;

  if found then
    if v_conflict.status = 'holding' then
      raise exception 'SLOT_LOCKED'
        using hint   = 'มีผู้ใช้อื่นกำลังทำรายการจองช่วงเวลานี้อยู่ กรุณารอหรือเลือกเวลาอื่น',
              detail = to_char(v_conflict.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    else
      raise exception 'SLOT_TAKEN' using hint = 'ช่วงเวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น';
    end if;
  end if;

  -- (c) the EXCLUDE constraint still guards this insert
  begin
    insert into public.bookings (room_id, user_id, starts_at, ends_at, status, hold_expires_at)
    values (p_room_id, v_uid, p_starts_at, p_ends_at, 'holding',
            now() + make_interval(mins => s.hold_minutes))
    returning * into v_row;
    insert into public.hold_log (user_id, room_id, starts_at, ends_at)
    values (v_uid, p_room_id, p_starts_at, p_ends_at);
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using hint = 'ช่วงเวลานี้เพิ่งถูกจองไปเมื่อสักครู่ กรุณาเลือกเวลาอื่น';
  end;

  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 2) release_hold — student gives up the lock (closes form / picks another room)
-- ---------------------------------------------------------------------------
create or replace function public.release_hold(p_booking_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.bookings
  where id = p_booking_id and user_id = auth.uid() and status = 'holding'
$$;

-- ---------------------------------------------------------------------------
-- 3) submit_booking — turns a valid hold into a submitted request + doc number
-- ---------------------------------------------------------------------------
create or replace function public.submit_booking(p_booking_id uuid, p_form jsonb)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  s      public.booking_settings;
  b      public.bookings;
  p      public.profiles;
  v_year int;
  v_no   int;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or b.user_id is distinct from v_uid then
    raise exception 'BOOKING_NOT_FOUND'
      using hint = 'การล็อกห้องนี้ถูกยกเลิกแล้ว (หมดเวลา หรือมีการล็อกห้องใหม่จากอีกแท็บ) กรุณาเลือกห้องอีกครั้ง';
  end if;
  if b.status <> 'holding' then
    raise exception 'INVALID_STATUS' using hint = 'รายการนี้ถูกส่งไปแล้ว';
  end if;
  if b.hold_expires_at <= now() then
    raise exception 'HOLD_EXPIRED' using hint = 'หมดเวลาทำรายการ กรุณาเลือกห้องและเวลาใหม่อีกครั้ง';
  end if;

  perform public.apply_booking_form(b.id, p_form);

  select * into s from public.booking_settings limit 1;
  select * into p from public.profiles where id = v_uid;

  v_year := extract(year from now() at time zone s.timezone)::int + 543;   -- พ.ศ.
  insert into public.doc_counters as c (year, last_no) values (v_year, 1)
  on conflict (year) do update set last_no = c.last_no + 1
  returning last_no into v_no;

  update public.bookings set
    status          = 'submitted',
    hold_expires_at = null,
    submitted_at    = now(),
    doc_no          = format('ENG3-%s-%s', v_year, lpad(v_no::text, 5, '0')),
    requester       = jsonb_build_object(
                        'full_name', p.full_name, 'student_id', p.student_id,
                        'department', p.department, 'year_of_study', p.year_of_study,
                        'phone', p.phone, 'email', p.email)
  where id = b.id
  returning * into b;

  perform public.log_booking_event(b.id, 'submitted', 'holding', 'submitted');
  return b;
end $$;

-- ---------------------------------------------------------------------------
-- 4) update_booking_details — edit form fields ≥ cancel_before_hours ahead.
--    Any edit sends the request back to "submitted" for re-review.
--    (Changing room/time = cancel + book again.)
-- ---------------------------------------------------------------------------
create or replace function public.update_booking_details(p_booking_id uuid, p_form jsonb)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  s      public.booking_settings;
  b      public.bookings;
  v_from public.booking_status;
begin
  select * into s from public.booking_settings limit 1;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or b.user_id is distinct from auth.uid() then
    raise exception 'BOOKING_NOT_FOUND' using hint = 'ไม่พบรายการจอง';
  end if;
  if b.status not in ('submitted', 'in_review', 'approved') then
    raise exception 'INVALID_STATUS' using hint = 'รายการนี้แก้ไขไม่ได้แล้ว';
  end if;
  if b.starts_at - now() < make_interval(hours => s.cancel_before_hours) then
    raise exception 'EDIT_WINDOW_PASSED'
      using hint = format('แก้ไขได้ก่อนเวลาใช้ห้องอย่างน้อย %s ชั่วโมง', s.cancel_before_hours);
  end if;

  v_from := b.status;
  perform public.apply_booking_form(b.id, p_form);

  update public.bookings set
    status = 'submitted', review_started_at = null,
    reviewed_by = null, reviewer_name = null, reviewed_at = null, review_note = null
  where id = b.id
  returning * into b;

  perform public.log_booking_event(b.id, 'edited', v_from, 'submitted', 'แก้ไขข้อมูลคำร้อง');
  return b;
end $$;

-- ---------------------------------------------------------------------------
-- 5) cancel_booking — by the student, ≥ cancel_before_hours ahead
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  s      public.booking_settings;
  b      public.bookings;
  v_from public.booking_status;
begin
  select * into s from public.booking_settings limit 1;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or b.user_id is distinct from auth.uid() then
    raise exception 'BOOKING_NOT_FOUND' using hint = 'ไม่พบรายการจอง';
  end if;
  if b.status not in ('submitted', 'in_review', 'approved') then
    raise exception 'INVALID_STATUS' using hint = 'รายการนี้ยกเลิกไม่ได้';
  end if;
  -- Not yet approved → cancel any time before the start (no staff work committed yet).
  -- Approved → must respect cancel_before_hours so staff are not surprised.
  if b.starts_at <= now() then
    raise exception 'CANCEL_WINDOW_PASSED' using hint = 'เลยเวลาใช้ห้องแล้ว ยกเลิกไม่ได้';
  end if;
  if b.status = 'approved' and b.starts_at - now() < make_interval(hours => s.cancel_before_hours) then
    raise exception 'CANCEL_WINDOW_PASSED'
      using hint = format('รายการที่อนุมัติแล้วยกเลิกได้ก่อนเวลาใช้ห้องอย่างน้อย %s ชั่วโมง กรุณาติดต่อเจ้าหน้าที่', s.cancel_before_hours);
  end if;

  v_from := b.status;
  update public.bookings set
    status = 'cancelled', cancelled_at = now(), cancel_reason = nullif(trim(p_reason), '')
  where id = b.id
  returning * into b;

  perform public.log_booking_event(b.id, 'cancelled', v_from, 'cancelled', p_reason);
  return b;
end $$;

-- ---------------------------------------------------------------------------
-- 6) review_booking — approver workflow
--    start_review : submitted → in_review
--    approve      : submitted | in_review → approved
--    reject       : submitted | in_review → rejected   (note required)
--    revoke       : approved → cancelled                (note required)
-- ---------------------------------------------------------------------------
create or replace function public.review_booking(p_booking_id uuid, p_action text, p_note text default null)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  b      public.bookings;
  v_from public.booking_status;
  v_note text := nullif(trim(p_note), '');
  v_name text := (select full_name from public.profiles where id = auth.uid());
begin
  if not public.is_approver() then
    raise exception 'FORBIDDEN' using hint = 'เฉพาะผู้อนุมัติเท่านั้น';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using hint = 'ไม่พบรายการจอง';
  end if;
  v_from := b.status;

  if p_action = 'start_review' then
    if b.status <> 'submitted' then
      raise exception 'INVALID_STATUS' using hint = 'รายการนี้ไม่ได้อยู่ในสถานะส่งเรื่องแล้ว';
    end if;
    update public.bookings set status = 'in_review', review_started_at = now(), reviewed_by = auth.uid(), reviewer_name = v_name
    where id = b.id returning * into b;

  elsif p_action = 'approve' then
    if b.status not in ('submitted', 'in_review') then
      raise exception 'INVALID_STATUS' using hint = 'รายการนี้อนุมัติไม่ได้';
    end if;
    update public.bookings set status = 'approved', reviewed_by = auth.uid(), reviewer_name = v_name,
           reviewed_at = now(), review_note = v_note
    where id = b.id returning * into b;

  elsif p_action = 'reject' then
    if b.status not in ('submitted', 'in_review') then
      raise exception 'INVALID_STATUS' using hint = 'รายการนี้ปฏิเสธไม่ได้';
    end if;
    if v_note is null then
      raise exception 'NOTE_REQUIRED' using hint = 'กรุณาระบุเหตุผลที่ไม่อนุมัติ';
    end if;
    update public.bookings set status = 'rejected', reviewed_by = auth.uid(), reviewer_name = v_name,
           reviewed_at = now(), review_note = v_note
    where id = b.id returning * into b;

  elsif p_action = 'revoke' then
    if b.status <> 'approved' then
      raise exception 'INVALID_STATUS' using hint = 'เพิกถอนได้เฉพาะรายการที่อนุมัติแล้ว';
    end if;
    if v_note is null then
      raise exception 'NOTE_REQUIRED' using hint = 'กรุณาระบุเหตุผลที่เพิกถอน';
    end if;
    update public.bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = v_note,
           reviewed_by = auth.uid(), reviewer_name = v_name, review_note = v_note
    where id = b.id returning * into b;

  else
    raise exception 'INVALID_ACTION' using hint = 'คำสั่งไม่ถูกต้อง';
  end if;

  perform public.log_booking_event(
    b.id,
    case p_action when 'start_review' then 'review_started' when 'approve' then 'approved'
                  when 'reject' then 'rejected' else 'revoked' end,
    v_from, b.status, v_note);
  return b;
end $$;

-- ---------------------------------------------------------------------------
-- 7) mark_room_task — staff confirms "opened" / "closed" (evidence trail)
-- ---------------------------------------------------------------------------
create or replace function public.mark_room_task(p_booking_id uuid, p_action text)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  b public.bookings;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using hint = 'เฉพาะเจ้าหน้าที่เท่านั้น';
  end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or b.status <> 'approved' then
    raise exception 'INVALID_STATUS' using hint = 'เปิด–ปิดห้องได้เฉพาะรายการที่อนุมัติแล้ว';
  end if;

  if p_action = 'open' then
    if b.opened_at is not null then
      raise exception 'ALREADY_DONE' using hint = 'บันทึกการเปิดห้องไปแล้ว';
    end if;
    update public.bookings set opened_at = now(), opened_by = auth.uid()
    where id = b.id returning * into b;
    perform public.log_booking_event(b.id, 'room_opened', b.status, b.status);

  elsif p_action = 'close' then
    if b.opened_at is null then
      raise exception 'NOT_OPENED' using hint = 'ยังไม่ได้บันทึกการเปิดห้อง';
    end if;
    if b.closed_at is not null then
      raise exception 'ALREADY_DONE' using hint = 'บันทึกการปิดห้องไปแล้ว';
    end if;
    update public.bookings set closed_at = now(), closed_by = auth.uid()
    where id = b.id returning * into b;
    perform public.log_booking_event(b.id, 'room_closed', b.status, b.status);

  else
    raise exception 'INVALID_ACTION' using hint = 'คำสั่งไม่ถูกต้อง';
  end if;
  return b;
end $$;

-- ---------------------------------------------------------------------------
-- 8) expire_stale_holds — run every minute by pg_cron (see 04_cron.sql)
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_holds()
returns int
language plpgsql security definer set search_path = ''
as $$
declare v_count int;
begin
  delete from public.bookings where status = 'holding' and hold_expires_at <= now();
  get diagnostics v_count = row_count;
  delete from public.hold_log where created_at < now() - interval '1 day';
  return v_count;
end $$;
