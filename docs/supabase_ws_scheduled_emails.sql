-- Programacion de correos Gmail (por usuario)
-- Ejecutar en Supabase SQL Editor.

create table if not exists public."WS_SCHEDULED_EMAILS" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text,
  recipients jsonb not null default '[]'::jsonb,
  subject text not null,
  text text,
  html text,
  scheduled_for timestamptz not null,
  timezone text not null default 'America/Mexico_City',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'partial', 'failed', 'cancelled')),
  attempted_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ws_scheduled_emails_user_created
  on public."WS_SCHEDULED_EMAILS" (user_id, created_at desc);

create index if not exists idx_ws_scheduled_emails_status_schedule
  on public."WS_SCHEDULED_EMAILS" (status, scheduled_for asc);

create or replace function public.set_updated_at_ws_scheduled_emails()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_ws_scheduled_emails on public."WS_SCHEDULED_EMAILS";
create trigger trg_set_updated_at_ws_scheduled_emails
before update on public."WS_SCHEDULED_EMAILS"
for each row
execute function public.set_updated_at_ws_scheduled_emails();

alter table public."WS_SCHEDULED_EMAILS" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'WS_SCHEDULED_EMAILS' and policyname = 'select_own_scheduled_emails'
  ) then
    create policy select_own_scheduled_emails
      on public."WS_SCHEDULED_EMAILS"
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'WS_SCHEDULED_EMAILS' and policyname = 'insert_own_scheduled_emails'
  ) then
    create policy insert_own_scheduled_emails
      on public."WS_SCHEDULED_EMAILS"
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'WS_SCHEDULED_EMAILS' and policyname = 'update_own_scheduled_emails'
  ) then
    create policy update_own_scheduled_emails
      on public."WS_SCHEDULED_EMAILS"
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
