-- Automations config and execution logs
create table if not exists public."WS_AUTOMATIONS" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  key text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ws_automations_key_check check (
    key in (
      'birthday_prospects_email',
      'birthday_customers_email',
      'policy_renewal_notice_email',
      'birthday_prospects_notify',
      'birthday_customers_notify',
      'policy_renewal_notice_notify'
    )
  ),
  unique (user_id, key)
);

create table if not exists public."WS_AUTOMATION_LOGS" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  automation_key text not null,
  target_table text not null,
  target_id text not null,
  status text not null default 'ok',
  message text null,
  run_date date not null default (now() at time zone 'utc')::date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ws_automation_logs_status_check check (status in ('ok', 'skipped', 'error')),
  unique (user_id, automation_key, target_table, target_id, run_date)
);

create index if not exists idx_ws_automations_user_key
  on public."WS_AUTOMATIONS" (user_id, key);

create index if not exists idx_ws_automation_logs_user_created
  on public."WS_AUTOMATION_LOGS" (user_id, created_at desc);

create or replace function public.set_updated_at_ws_automations()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_updated_at_ws_automations on public."WS_AUTOMATIONS";
create trigger trg_set_updated_at_ws_automations
before update on public."WS_AUTOMATIONS"
for each row
execute function public.set_updated_at_ws_automations();

alter table public."WS_AUTOMATIONS" enable row level security;
alter table public."WS_AUTOMATION_LOGS" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'WS_AUTOMATIONS' and policyname = 'select_own_automations'
  ) then
    create policy select_own_automations
      on public."WS_AUTOMATIONS"
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'WS_AUTOMATIONS' and policyname = 'upsert_own_automations'
  ) then
    create policy upsert_own_automations
      on public."WS_AUTOMATIONS"
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'WS_AUTOMATION_LOGS' and policyname = 'select_own_automation_logs'
  ) then
    create policy select_own_automation_logs
      on public."WS_AUTOMATION_LOGS"
      for select
      using (auth.uid() = user_id);
  end if;
end $$;
