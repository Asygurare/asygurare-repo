-- WS_CALCOM_CONNECTIONS
-- Guarda tokens OAuth de Cal.com por usuario para integracion de calendario.

create table if not exists public."WS_CALCOM_CONNECTIONS" (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'calcom',
  provider_email text,
  calcom_user_id text,
  calcom_username text,
  organization_id text,
  token_type text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ws_calcom_connections_user_id_idx
  on public."WS_CALCOM_CONNECTIONS"(user_id);

-- RLS
alter table public."WS_CALCOM_CONNECTIONS" enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_CALCOM_CONNECTIONS'
      and policyname = 'Users can read own calcom connection'
  ) then
    create policy "Users can read own calcom connection"
      on public."WS_CALCOM_CONNECTIONS"
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_CALCOM_CONNECTIONS'
      and policyname = 'Users can upsert own calcom connection'
  ) then
    create policy "Users can upsert own calcom connection"
      on public."WS_CALCOM_CONNECTIONS"
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
