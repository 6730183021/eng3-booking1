-- =============================================================================
-- ENG3 Room Booking — 01 Schema
-- ระบบจองห้อง อาคาร 3 คณะวิศวกรรมศาสตร์ จุฬาฯ (MVP)
-- =============================================================================

create extension if not exists btree_gist;   -- needed for the overlap (EXCLUDE) constraint

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'staff', 'approver', 'super_admin');

-- holding    = ล็อกชั่วคราวระหว่างกรอกฟอร์ม (5–10 นาที)  → สีเหลืองบนแผนผัง
-- submitted  = ส่งเรื่องแล้ว                              → สีแดง (ช่วงเวลาถูกกันไว้)
-- in_review  = เจ้าหน้าที่กำลังตรวจสอบ                     → สีแดง
-- approved   = อนุมัติแล้ว                                 → สีแดง
-- rejected / cancelled = ปล่อยช่วงเวลาคืน                   → ว่าง
create type public.booking_status as enum (
  'holding', 'submitted', 'in_review', 'approved', 'rejected', 'cancelled'
);

create type public.room_status as enum ('active', 'maintenance');

-- ---------------------------------------------------------------------------
-- Booking rules (single row, editable by super_admin)
-- ---------------------------------------------------------------------------
create table public.booking_settings (
  id                    boolean primary key default true check (id),
  min_lead_hours        int     not null default 12  check (min_lead_hours >= 0),
  max_duration_minutes  int     not null default 180 check (max_duration_minutes > 0),
  slot_minutes          int     not null default 30  check (slot_minutes in (15, 30, 60)),
  open_time             time    not null default '08:00',
  close_time            time    not null default '20:00',
  open_days             int[]   not null default '{1,2,3,4,5,6}',  -- ISO: 1=จันทร์ … 7=อาทิตย์
  hold_minutes          int     not null default 10  check (hold_minutes between 1 and 30),
  cancel_before_hours   int     not null default 24  check (cancel_before_hours >= 0),
  max_advance_days      int     not null default 60  check (max_advance_days > 0),
  max_active_bookings   int     not null default 5   check (max_active_bookings > 0),
  allowed_email_domains text[]  not null default '{student.chula.ac.th}',
  timezone              text    not null default 'Asia/Bangkok',
  updated_at            timestamptz not null default now(),
  constraint booking_settings_hours check (open_time < close_time)
);
insert into public.booking_settings default values;

-- ---------------------------------------------------------------------------
-- Staff allow-list → role is assigned automatically on first login
-- ---------------------------------------------------------------------------
create table public.staff_members (
  email      text primary key check (email = lower(email)),
  role       public.user_role not null check (role <> 'student'),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique,
  role          public.user_role not null default 'student',
  full_name     text,
  student_id    text check (student_id is null or student_id ~ '^[0-9]{10}$'),
  department    text,
  year_of_study smallint check (year_of_study between 1 and 8),
  phone         text,
  privacy_accepted_at timestamptz,   -- PDPA notice acknowledged (onboarding)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Floors & rooms (the floor plan is data, not code)
-- ---------------------------------------------------------------------------
create table public.floors (
  floor    smallint primary key,
  label    text  not null,
  -- non-bookable shapes drawn on the plan: corridor, stairs, lift, restroom, lobby, office
  -- [{ "type": "stairs", "x": 20, "y": 30, "w": 90, "h": 110, "label": "บันได" }, …]
  features jsonb not null default '[]'::jsonb
);

create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,               -- e.g. 3-201
  name        text not null,
  floor       smallint not null references public.floors (floor) on update cascade,
  capacity    int  not null check (capacity > 0),
  facilities  text[] not null default '{}',       -- keys, see src/lib/constants.ts
  status      public.room_status not null default 'active',
  status_note text,
  -- position on the floor plan (SVG viewBox = 1000 × 560)
  map_x       int not null default 0,
  map_y       int not null default 0,
  map_w       int not null default 120 check (map_w > 0),
  map_h       int not null default 120 check (map_h > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index rooms_floor_idx on public.rooms (floor);

-- Temporary closures (exam, repair). room_id NULL = whole building.
create table public.room_blocks (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid references public.rooms (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint room_blocks_range check (ends_at > starts_at)
);
create index room_blocks_range_idx on public.room_blocks using gist (tstzrange(starts_at, ends_at, '[)'));

-- ---------------------------------------------------------------------------
-- Bookings — the single source of truth
-- ---------------------------------------------------------------------------
-- Document numbers restart every Buddhist-era year: ENG3-2569-00001, ENG3-2570-00001 …
create table public.doc_counters (
  year    int primary key,
  last_no int not null
);

create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  doc_no            text unique,                       -- ENG3-2569-00001 (assigned on submit)
  room_id           uuid not null references public.rooms (id),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  status            public.booking_status not null default 'holding',
  hold_expires_at   timestamptz,

  -- form data (for the official document)
  activity_name     text,
  activity_type     text,
  purpose           text,
  attendees         int check (attendees > 0),
  organization      text,
  advisor_name      text,
  contact_phone     text,
  equipment         text[] not null default '{}',
  extra_notes       text,
  requester         jsonb,   -- snapshot of the requester profile at submit time

  -- workflow
  submitted_at      timestamptz,
  review_started_at timestamptz,
  reviewed_by       uuid references public.profiles (id) on delete set null,
  reviewer_name     text,    -- snapshot for the document (students cannot read staff profiles)
  reviewed_at       timestamptz,
  review_note       text,
  cancelled_at      timestamptz,
  cancel_reason     text,

  -- operations (open / close the room)
  opened_at         timestamptz,
  opened_by         uuid references public.profiles (id) on delete set null,
  closed_at         timestamptz,
  closed_by         uuid references public.profiles (id) on delete set null,
  reminder_sent_at  timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint bookings_valid_range check (ends_at > starts_at),

  -- ★ The core concurrency guarantee: Postgres itself refuses two "live" bookings
  --   whose time ranges overlap in the same room — no matter how many requests race.
  constraint bookings_no_overlap exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('holding', 'submitted', 'in_review', 'approved'))
);
create index bookings_user_idx   on public.bookings (user_id, starts_at desc);
create index bookings_queue_idx  on public.bookings (status, submitted_at);
create index bookings_starts_idx on public.bookings (starts_at);

-- ---------------------------------------------------------------------------
-- room_slots — public, privacy-safe mirror of live bookings (no names / purposes).
-- Every logged-in user can read it, and the floor plan subscribes to it in real time.
-- Maintained only by trigger (see 02_functions).
-- ---------------------------------------------------------------------------
create table public.room_slots (
  booking_id      uuid primary key references public.bookings (id) on delete cascade,
  room_id         uuid not null references public.rooms (id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  state           text not null check (state in ('held', 'pending', 'approved')),
  hold_expires_at timestamptz
);
create index room_slots_starts_idx on public.room_slots (starts_at);

-- ---------------------------------------------------------------------------
-- Audit trail — every status change / open / close, with who & when
-- ---------------------------------------------------------------------------
create table public.booking_events (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,  -- submitted | edited | review_started | approved | rejected | revoked | cancelled | room_opened | room_closed
  from_status public.booking_status,
  to_status   public.booking_status,
  note        text,
  created_at  timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

-- ---------------------------------------------------------------------------
-- Hold log — every successful lock, used to stop one user from re-locking the
-- same slot forever (lock griefing) and to rate-limit hold attempts.
-- ---------------------------------------------------------------------------
create table public.hold_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  room_id    uuid not null references public.rooms (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_at timestamptz not null default now()
);
create index hold_log_user_idx on public.hold_log (user_id, created_at desc);
