-- Tabla para guardar conexión Gmail por usuario (Supabase Auth)
-- Recomendado ejecutar en Supabase SQL Editor.

create table if not exists public."WS_GMAIL_CONNECTIONS" (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'google',
  provider_email text,
  scope text,
  token_type text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public."WS_GMAIL_CONNECTIONS" enable row level security;

-- El usuario solo puede ver su conexión
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'WS_GMAIL_CONNECTIONS' and policyname = 'select_own_gmail_connection'
  ) then
    create policy select_own_gmail_connection
      on public."WS_GMAIL_CONNECTIONS"
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- El usuario solo puede crear/actualizar su conexión
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'WS_GMAIL_CONNECTIONS' and policyname = 'upsert_own_gmail_connection'
  ) then
    create policy upsert_own_gmail_connection
      on public."WS_GMAIL_CONNECTIONS"
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'WS_GMAIL_CONNECTIONS' and policyname = 'update_own_gmail_connection'
  ) then
    create policy update_own_gmail_connection
      on public."WS_GMAIL_CONNECTIONS"
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- El usuario solo puede borrar su conexión
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'WS_GMAIL_CONNECTIONS' and policyname = 'delete_own_gmail_connection'
  ) then
    create policy delete_own_gmail_connection
      on public."WS_GMAIL_CONNECTIONS"
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

