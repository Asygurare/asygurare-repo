-- WS_CALENDLY_EVENT_TASKS
-- Mapea eventos de Calendly -> tareas de WS_TASKS para evitar duplicados.

create table if not exists public."WS_CALENDLY_EVENT_TASKS" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_uri text not null,
  task_id uuid not null, 
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, event_uri),
  unique(user_id, task_id)
);

create index if not exists ws_calendly_event_tasks_user_event_idx
  on public."WS_CALENDLY_EVENT_TASKS"(user_id, event_uri);

create index if not exists ws_calendly_event_tasks_user_task_idx
  on public."WS_CALENDLY_EVENT_TASKS"(user_id, task_id);

-- RLS
alter table public."WS_CALENDLY_EVENT_TASKS" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_CALENDLY_EVENT_TASKS'
      and policyname = 'Users can manage own calendly event tasks'
  ) then
    create policy "Users can manage own calendly event tasks"
      on public."WS_CALENDLY_EVENT_TASKS"
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

