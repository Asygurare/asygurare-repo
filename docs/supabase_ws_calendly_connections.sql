-- WS_CALENDLY_CONNECTIONS
-- Guarda tokens OAuth de Calendly por usuario para integración de calendario.

create table if not exists public."WS_CALENDLY_CONNECTIONS" (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'calendly',
  provider_email text,
  calendly_user_uri text,
  organization_uri text,
  scope text,
  token_type text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ws_calendly_connections_user_id_idx
  on public."WS_CALENDLY_CONNECTIONS"(user_id);

-- RLS
alter table public."WS_CALENDLY_CONNECTIONS" enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_CALENDLY_CONNECTIONS'
      and policyname = 'Users can read own calendly connection'
  ) then
    create policy "Users can read own calendly connection"
      on public."WS_CALENDLY_CONNECTIONS"
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_CALENDLY_CONNECTIONS'
      and policyname = 'Users can upsert own calendly connection'
  ) then
    create policy "Users can upsert own calendly connection"
      on public."WS_CALENDLY_CONNECTIONS"
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

