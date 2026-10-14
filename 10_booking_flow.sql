-- =============================================================================
-- Booking logic tests (plain SQL, run by supabase/tests/run-local-tests.sh)
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

-- ---------------------------------------------------------------- helpers
create schema tests;
create function tests.expect_error(p_sql text, p_code text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_code then
      raise notice 'PASS  expected error %', p_code;
      return;
    end if;
    raise exception 'FAIL  expected %, got: %', p_code, sqlerrm;
  end;
  raise exception 'FAIL  expected %, but the statement succeeded', p_code;
end $$;

create function tests.check(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if coalesce(p_ok, false) then raise notice 'PASS  %', p_msg;
  else raise exception 'FAIL  %', p_msg; end if;
end $$;

create function tests.as_user(p_uid uuid) returns void
language sql as $$ select set_config('request.jwt.claim.sub', p_uid::text, false) $$;

grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

-- ---------------------------------------------------------------- users
insert into public.staff_members (email, role) values
  ('approver@chula.ac.th', 'approver'),
  ('staff@chula.ac.th', 'staff');

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '6530000021@student.chula.ac.th', '{"full_name":"สมชาย ใจดี"}'),
  ('22222222-2222-2222-2222-222222222222', '6530000121@student.chula.ac.th', '{"full_name":"สมหญิง รักเรียน"}'),
  ('33333333-3333-3333-3333-333333333333', 'approver@chula.ac.th', '{"full_name":"อ.ผู้อนุมัติ"}'),
  ('44444444-4444-4444-4444-444444444444', 'staff@chula.ac.th', '{"full_name":"เจ้าหน้าที่อาคาร"}');

select tests.check((select role = 'approver' from public.profiles where email = 'approver@chula.ac.th'),
                   'staff allow-list assigns role on sign-up');
select tests.check((select student_id = '6530000021' from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
                   'student id is derived from the Chula e-mail');
select tests.expect_error(
  $q$ insert into auth.users (email) values ('someone@gmail.com') $q$, 'EMAIL_DOMAIN_NOT_ALLOWED');

-- ---------------------------------------------------------------- test data
-- a bookable day: ≥ 2 days ahead, Mon–Sat
select d from generate_series((now() at time zone 'Asia/Bangkok')::date + 2,
                              (now() at time zone 'Asia/Bangkok')::date + 9, interval '1 day') g(d)
where extract(isodow from d) <= 6 limit 1 \gset
select id as room from public.rooms where code = '3-208' \gset
select capacity as cap from public.rooms where code = '3-208' \gset
select ((:'d'::date + time '10:00') at time zone 'Asia/Bangkok') as t10,
       ((:'d'::date + time '11:00') at time zone 'Asia/Bangkok') as t11,
       ((:'d'::date + time '12:00') at time zone 'Asia/Bangkok') as t12,
       ((:'d'::date + time '13:00') at time zone 'Asia/Bangkok') as t13,
       ((:'d'::date + time '14:00') at time zone 'Asia/Bangkok') as t14,
       ((:'d'::date + time '07:00') at time zone 'Asia/Bangkok') as t07,
       ((:'d'::date + time '10:10') at time zone 'Asia/Bangkok') as t1010 \gset

-- ================================================================ student A
set role authenticated;
select tests.as_user('11111111-1111-1111-1111-111111111111');

select tests.expect_error(format('select public.hold_slot(%L,%L,%L)', :'room', :'t10', :'t12'), 'PROFILE_INCOMPLETE');
update public.profiles set department = 'วิศวกรรมอุตสาหการ', year_of_study = 3, phone = '0812345678'
where id = auth.uid();
select tests.check(not public.is_profile_complete(auth.uid()), 'profile incomplete until the privacy notice is accepted');
update public.profiles set privacy_accepted_at = now() where id = auth.uid();
select tests.check(public.is_profile_complete(auth.uid()), 'profile complete after onboarding');
select tests.expect_error($q$ update public.profiles set role = 'super_admin' where id = auth.uid() $q$,
                          'permission denied for table profiles');
select tests.expect_error($q$ update public.profiles set student_id = '6599999921' where id = auth.uid() $q$,
                          'permission denied for table profiles');

-- rules
select tests.expect_error(format('select public.hold_slot(%L,%L,%L)', :'room', :'t10', :'t14'), 'DURATION_TOO_LONG');
select tests.expect_error(format('select public.hold_slot(%L,%L,%L)', :'room', :'t07', :'t10'), 'OUTSIDE_OPEN_HOURS');
select tests.expect_error(format('select public.hold_slot(%L,%L,%L)', :'room', :'t1010', :'t11'), 'SLOT_MISALIGNED');
select tests.expect_error(format('select public.hold_slot(%L,%L,%L)', :'room',
  date_trunc('hour', now()) + interval '2 hours', date_trunc('hour', now()) + interval '3 hours'), 'LEAD_TIME_TOO_SHORT');
select tests.expect_error($q$ insert into public.bookings (room_id, user_id, starts_at, ends_at)
                              values (gen_random_uuid(), auth.uid(), now(), now() + interval '1 hour') $q$,
                          'permission denied for table bookings');

-- A locks 10:00–12:00
select id as hold_a from public.hold_slot(:'room', :'t10', :'t12') \gset
select tests.check((select state = 'held' from public.room_slots where booking_id = :'hold_a'),
                   'hold appears as "held" in room_slots (yellow on the map)');

-- ================================================================ student B
select tests.as_user('22222222-2222-2222-2222-222222222222');
reset role;
update public.profiles set department = 'วิศวกรรมเครื่องกล', year_of_study = 2, phone = '0899999999',
       privacy_accepted_at = now()
where id = '22222222-2222-2222-2222-222222222222';
set role authenticated;

select tests.expect_error(format('select public.hold_slot(%L,%L,%L)', :'room', :'t10', :'t12'), 'SLOT_LOCKED');
select tests.expect_error(format('select public.hold_slot(%L,%L,%L)', :'room', :'t11', :'t13'), 'SLOT_LOCKED');
select tests.check((select count(*) = 0 from public.bookings where id = :'hold_a'),
                   'RLS: B cannot read A''s booking');
select tests.check((select count(*) = 1 from public.room_slots where booking_id = :'hold_a'),
                   'RLS: B can see the anonymous slot');
-- back-to-back is fine ('[)' ranges)
select id as hold_b from public.hold_slot(:'room', :'t12', :'t14') \gset
select tests.check(:'hold_b' is not null, 'adjacent slot 12:00–14:00 can be held');
select public.release_hold(:'hold_b');
select tests.check((select count(*) = 0 from public.room_slots where booking_id = :'hold_b'),
                   'released hold disappears from room_slots');

-- ================================================================ A submits
select tests.as_user('11111111-1111-1111-1111-111111111111');
select tests.expect_error(format($q$ select public.submit_booking(%L, '{"activity_name":"ติว"}') $q$, :'hold_a'), 'FORM_INCOMPLETE');
select tests.expect_error(format($q$ select public.submit_booking(%L, %L) $q$, :'hold_a',
  jsonb_build_object('activity_name','ติวสอบ','activity_type','study','purpose','ติวหนังสือ',
                     'attendees', :cap + 1, 'contact_phone','0812345678')), 'OVER_CAPACITY');
select doc_no, status from public.submit_booking(:'hold_a',
  '{"activity_name":"ติวสอบกลางภาค IE","activity_type":"study","purpose":"ติวหนังสือกลุ่ม",
    "attendees":"12","contact_phone":"0812345678","equipment":["projector","mic"]}') \gset
select tests.check(:'status' = 'submitted' and :'doc_no' ~ '^ENG3-25[0-9]{2}-00001$',
                   format('submitted with document number %s (yearly counter)', :'doc_no'));
select tests.check((select state = 'pending' from public.room_slots where booking_id = :'hold_a'),
                   'submitted booking shows as "pending" (red on the map)');
select tests.check((select requester ->> 'student_id' = '6530000021' from public.bookings where id = :'hold_a'),
                   'requester snapshot stored for the document');
select tests.expect_error(format('select public.review_booking(%L, %L)', :'hold_a', 'approve'), 'FORBIDDEN');

-- B still cannot take it after A submitted
select tests.as_user('22222222-2222-2222-2222-222222222222');
select tests.expect_error(format('select public.hold_slot(%L,%L,%L)', :'room', :'t10', :'t11'), 'SLOT_TAKEN');

-- ================================================================ approver
select tests.as_user('33333333-3333-3333-3333-333333333333');
select tests.check((select count(*) = 1 from public.bookings where id = :'hold_a'), 'approver can read the request');
select tests.expect_error(format('select public.review_booking(%L, %L)', :'hold_a', 'reject'), 'NOTE_REQUIRED');
select public.review_booking(:'hold_a', 'start_review');
select tests.check((select status = 'in_review' from public.bookings where id = :'hold_a'), 'status → in_review');
select public.review_booking(:'hold_a', 'approve', 'อนุมัติ');
select tests.check((select status = 'approved' from public.bookings where id = :'hold_a'), 'status → approved');
select tests.check((select state = 'approved' from public.room_slots where booking_id = :'hold_a'), 'slot → approved');

-- ================================================================ staff (open / close)
select tests.as_user('44444444-4444-4444-4444-444444444444');
select tests.expect_error(format('select public.review_booking(%L, %L)', :'hold_a', 'approve'), 'FORBIDDEN');
select tests.expect_error(format('select public.mark_room_task(%L, %L)', :'hold_a', 'close'), 'NOT_OPENED');
select public.mark_room_task(:'hold_a', 'open');
select public.mark_room_task(:'hold_a', 'close');
select tests.check((select opened_at is not null and closed_at is not null from public.bookings where id = :'hold_a'),
                   'open/close recorded');
select tests.check((select array_agg(action order by id) = '{submitted,review_started,approved,room_opened,room_closed}'
                    from public.booking_events where booking_id = :'hold_a'), 'full audit trail recorded');

-- ================================================================ expiry
-- B holds 13:00–14:00, the hold times out, A can then take it
select tests.as_user('22222222-2222-2222-2222-222222222222');
select id as hold_b2 from public.hold_slot(:'room', :'t13', :'t14') \gset
reset role;
update public.bookings set hold_expires_at = now() - interval '1 second' where id = :'hold_b2';
set role authenticated;
select tests.as_user('11111111-1111-1111-1111-111111111111');
select id as hold_a2 from public.hold_slot(:'room', :'t13', :'t14') \gset
select tests.check(:'hold_a2' is not null, 'expired hold no longer blocks the slot');
select tests.as_user('22222222-2222-2222-2222-222222222222');
select tests.expect_error(format($q$ select public.submit_booking(%L, '{}') $q$, :'hold_b2'), 'BOOKING_NOT_FOUND');

-- ================================================================ cancel window
select tests.as_user('11111111-1111-1111-1111-111111111111');
select public.submit_booking(:'hold_a2',
  '{"activity_name":"ประชุมชมรม","activity_type":"club","purpose":"ประชุม","attendees":5,"contact_phone":"0812345678"}');
select tests.check((select status = 'cancelled' from public.cancel_booking(:'hold_a2', 'เปลี่ยนแผน')),
                   'student can cancel ≥ 24h ahead');
reset role;
update public.booking_settings set cancel_before_hours = 24 * 30;
set role authenticated;
select tests.expect_error(format('select public.cancel_booking(%L)', :'hold_a'), 'CANCEL_WINDOW_PASSED');
-- a request that is not approved yet can still be cancelled inside the window
select id as hold_a3 from public.hold_slot(:'room', :'t13', :'t14') \gset
select public.submit_booking(:'hold_a3',
  '{"activity_name":"ประชุมกลุ่ม","activity_type":"meeting","purpose":"ประชุม","attendees":3,"contact_phone":"0812345678"}');
select tests.check((select status = 'cancelled' from public.cancel_booking(:'hold_a3')),
                   'not-yet-approved request can be cancelled even inside the approved-cancel window');
reset role;
update public.booking_settings set cancel_before_hours = 24;

-- ================================================================ anti-griefing
select id as room209 from public.rooms where code = '3-209' \gset
set role authenticated;
select tests.as_user('22222222-2222-2222-2222-222222222222');
select public.release_hold(id) from public.hold_slot(:'room209', :'t13', :'t14');
select public.release_hold(id) from public.hold_slot(:'room209', :'t13', :'t14');
select tests.expect_error(format('select public.hold_slot(%L,%L,%L)', :'room209', :'t13', :'t14'), 'HOLD_COOLDOWN');
reset role;

-- ================================================================ blocks
select id as room101 from public.rooms where code = '3-101' \gset
insert into public.room_blocks (room_id, starts_at, ends_at, reason)
values (:'room101', :'t10', :'t12', 'สอบปลายภาค');
set role authenticated;
select tests.expect_error(format('select public.hold_slot(%L,%L,%L)', :'room101', :'t11', :'t12'), 'ROOM_BLOCKED');
reset role;
select id as room404 from public.rooms where code = '3-404' \gset
set role authenticated;
select tests.expect_error(format('select public.hold_slot(%L,%L,%L)', :'room404', :'t10', :'t11'), 'ROOM_MAINTENANCE');

reset role;
\echo '\n✔ booking flow tests passed'
