-- WS_GOALS: generic goals system for the Workspace
-- Paste this in Supabase SQL Editor.

-- Ensure UUID generator exists (usually enabled by default in Supabase).
create extension if not exists "pgcrypto";

create table if not exists public."WS_GOALS" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  title text not null,

  -- Metric keys supported by the UI (extend as needed)
  -- Examples:
  -- - leads.pipeline_value_active
  -- - leads.new_count
  -- - tasks.done_count
  -- - tasks.calls_done
  -- - payments.collected
  -- - policies.premium_total
  -- - policies.renewals_30d
  metric text not null,

  -- Presentation format for the UI
  -- count | currency | percent | number
  format text not null default 'count',

  -- Target for the period / snapshot
  target_value numeric not null default 0,

  -- Period semantics
  -- month | week | custom | always
  period_type text not null default 'month',

  -- Optional: convenience for month goals (YYYY-MM)
  month_year text null,

  -- Optional: explicit window (used for week/custom)
  start_at timestamptz null,
  end_at timestamptz null,

  -- Optional filters (JSON) reserved for future use
  scope jsonb null,

  status text not null default 'active', -- active | archived

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists ws_goals_user_id_idx on public."WS_GOALS" (user_id);
create index if not exists ws_goals_user_period_idx on public."WS_GOALS" (user_id, period_type, month_year);
create index if not exists ws_goals_user_window_idx on public."WS_GOALS" (user_id, start_at, end_at);

-- RLS
alter table public."WS_GOALS" enable row level security;

drop policy if exists "WS_GOALS_select_own" on public."WS_GOALS";
create policy "WS_GOALS_select_own"
on public."WS_GOALS"
for select
using (auth.uid() = user_id);

drop policy if exists "WS_GOALS_insert_own" on public."WS_GOALS";
create policy "WS_GOALS_insert_own"
on public."WS_GOALS"
for insert
with check (auth.uid() = user_id);

drop policy if exists "WS_GOALS_update_own" on public."WS_GOALS";
create policy "WS_GOALS_update_own"
on public."WS_GOALS"
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "WS_GOALS_delete_own" on public."WS_GOALS";
create policy "WS_GOALS_delete_own"
on public."WS_GOALS"
for delete
using (auth.uid() = user_id);

-- Optional: keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ws_goals_updated_at on public."WS_GOALS";
create trigger trg_ws_goals_updated_at
before update on public."WS_GOALS"
for each row execute function public.set_updated_at();

