-- Log de correos enviados por Gmail (por usuario)
-- Ejecutar en Supabase SQL Editor.

create table if not exists public."WS_GMAIL_SENT_EMAILS" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  to_email text not null,
  subject text,
  audience text,
  gmail_message_id text,
  created_at timestamptz not null default now()
);

alter table public."WS_GMAIL_SENT_EMAILS" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'WS_GMAIL_SENT_EMAILS' and policyname = 'select_own_gmail_sent_emails'
  ) then
    create policy select_own_gmail_sent_emails
      on public."WS_GMAIL_SENT_EMAILS"
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'WS_GMAIL_SENT_EMAILS' and policyname = 'insert_own_gmail_sent_emails'
  ) then
    create policy insert_own_gmail_sent_emails
      on public."WS_GMAIL_SENT_EMAILS"
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

