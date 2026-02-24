-- WS_CALCOM_EVENT_TASKS
-- Mapea bookings de Cal.com -> tareas de WS_TASKS para evitar duplicados.

create table if not exists public."WS_CALCOM_EVENT_TASKS" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_uid text not null,
  task_id uuid not null,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, booking_uid),
  unique(user_id, task_id)
);

create index if not exists ws_calcom_event_tasks_user_booking_idx
  on public."WS_CALCOM_EVENT_TASKS"(user_id, booking_uid);

create index if not exists ws_calcom_event_tasks_user_task_idx
  on public."WS_CALCOM_EVENT_TASKS"(user_id, task_id);

-- RLS
alter table public."WS_CALCOM_EVENT_TASKS" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_CALCOM_EVENT_TASKS'
      and policyname = 'Users can manage own calcom event tasks'
  ) then
    create policy "Users can manage own calcom event tasks"
      on public."WS_CALCOM_EVENT_TASKS"
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
