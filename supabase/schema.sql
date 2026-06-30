-- FacultySync schema — multi-tenant by office_id.
-- Mirrors dental-saas (clinic_id -> office_id, patient -> student,
-- appointment -> booking, doctor -> professor, service -> meeting_type).
--
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project,
-- then run supabase/seed.sql.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- offices (the tenant; ≙ clinics)
-- ---------------------------------------------------------------------------
create table if not exists public.offices (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  professor_name text not null,
  office_phone  text,
  twilio_number text unique,           -- the number students call; resolves the tenant
  greeting      text,
  feedback_link text,
  api_key       text,                  -- legacy/back-compat shared secret (Vapi uses VAPI_WEBHOOK_SECRET)
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- students (≙ patients)
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id                uuid primary key default gen_random_uuid(),
  office_id         uuid not null references public.offices(id) on delete cascade,
  full_name         text not null,
  student_id_number text not null,
  phone             text,
  created_at        timestamptz not null default now(),
  unique (office_id, student_id_number)
);

-- ---------------------------------------------------------------------------
-- meeting_types (≙ services). Duration resolved server-side from here.
-- ---------------------------------------------------------------------------
create table if not exists public.meeting_types (
  id               uuid primary key default gen_random_uuid(),
  office_id        uuid not null references public.offices(id) on delete cascade,
  name             text not null,
  duration_minutes int not null default 15
);

-- ---------------------------------------------------------------------------
-- office_hours (≙ doctor_schedules). day_of_week: 0=Mon … 6=Sun.
--   No rows for a day (but rows exist for others) = day off.
--   No rows at all = unrestricted.
-- ---------------------------------------------------------------------------
create table if not exists public.office_hours (
  id          uuid primary key default gen_random_uuid(),
  office_id   uuid not null references public.offices(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null
);

-- ---------------------------------------------------------------------------
-- office_blocks (≙ google_calendar_blocks). Busy intervals = unavailable.
-- Powers the dashboard "block slots" feature.
-- ---------------------------------------------------------------------------
create table if not exists public.office_blocks (
  id         uuid primary key default gen_random_uuid(),
  office_id  uuid not null references public.offices(id) on delete cascade,
  start_time timestamptz not null,
  end_time   timestamptz not null,
  reason     text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- bookings (≙ appointments)
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  office_id            uuid not null references public.offices(id) on delete cascade,
  student_name         text not null,
  student_id_number    text not null,
  student_phone        text,
  meeting_type         text not null,
  topic                text,
  slot_time            timestamptz not null,
  end_time             timestamptz not null,
  duration_minutes     int not null,
  student_id           uuid references public.students(id) on delete set null,
  source               text not null default 'voice',  -- 'voice' | 'dashboard' | ...
  reminder_24h_sent    boolean not null default false,
  reminder_morning_sent boolean not null default false,
  feedback_sent        boolean not null default false,
  cancelled            boolean not null default false,
  cancel_token         text unique,
  created_at           timestamptz not null default now()
);

create index if not exists bookings_office_slot_idx
  on public.bookings (office_id, slot_time)
  where cancelled = false;
create index if not exists bookings_office_student_idx
  on public.bookings (office_id, student_id_number);

-- ---------------------------------------------------------------------------
-- faqs (new) — for the FAQ intent
-- ---------------------------------------------------------------------------
create table if not exists public.faqs (
  id                uuid primary key default gen_random_uuid(),
  office_id         uuid not null references public.offices(id) on delete cascade,
  question_keywords text not null,   -- comma/space separated keywords to match against
  answer            text not null
);

-- ---------------------------------------------------------------------------
-- staff_profiles — auth/identity. id = auth.users.id.
-- ---------------------------------------------------------------------------
create table if not exists public.staff_profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  full_name text not null,
  role      text not null default 'owner' check (role in ('owner','assistant')),
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- invitations — owner/staff onboarding
-- ---------------------------------------------------------------------------
create table if not exists public.invitations (
  id         uuid primary key default gen_random_uuid(),
  office_id  uuid not null references public.offices(id) on delete cascade,
  email      text not null,
  role       text not null default 'owner' check (role in ('owner','assistant')),
  token      text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- office_registration_requests (≙ clinic_registration_requests). No password.
-- ---------------------------------------------------------------------------
create table if not exists public.office_registration_requests (
  id             uuid primary key default gen_random_uuid(),
  office_name    text not null,
  professor_name text not null,
  owner_email    text not null,
  owner_phone    text,
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Webhooks/cron use the service-role client (bypasses RLS). Dashboard server
-- code scopes by office_id from the authenticated staff_profiles row. These
-- policies let a logged-in staff member read/write only their own office's data.
-- ---------------------------------------------------------------------------
alter table public.offices              enable row level security;
alter table public.students             enable row level security;
alter table public.meeting_types        enable row level security;
alter table public.office_hours         enable row level security;
alter table public.office_blocks        enable row level security;
alter table public.bookings             enable row level security;
alter table public.faqs                 enable row level security;
alter table public.staff_profiles       enable row level security;
alter table public.invitations          enable row level security;

-- Helper: the office_id of the current auth user.
create or replace function public.current_office_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select office_id from public.staff_profiles where id = auth.uid() and is_active
$$;

-- A staff member can see their own profile row.
drop policy if exists staff_self on public.staff_profiles;
create policy staff_self on public.staff_profiles
  for select using (id = auth.uid());

-- Per-office tables: full access scoped to the user's office.
do $$
declare t text;
begin
  foreach t in array array['offices','students','meeting_types','office_hours','office_blocks','bookings','faqs','invitations']
  loop
    execute format('drop policy if exists office_scope on public.%I', t);
    if t = 'offices' then
      execute format($f$create policy office_scope on public.%I
        for all using (id = public.current_office_id())
        with check (id = public.current_office_id())$f$, t);
    else
      execute format($f$create policy office_scope on public.%I
        for all using (office_id = public.current_office_id())
        with check (office_id = public.current_office_id())$f$, t);
    end if;
  end loop;
end $$;
