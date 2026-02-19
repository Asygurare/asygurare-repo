-- Firma de correo por usuario + bucket de logos ("tu-logo")
-- Ejecutar en Supabase SQL Editor.

create table if not exists public."WS_EMAIL_SIGNATURES" (
  user_id uuid primary key references auth.users(id) on delete cascade,
  signature_name text not null default 'Tu firma de correo',
  include_signature boolean not null default true,
  logo_path text,
  logo_url text,
  phone text,
  footer_text text,
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at_ws_email_signatures()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_ws_email_signatures on public."WS_EMAIL_SIGNATURES";
create trigger trg_set_updated_at_ws_email_signatures
before update on public."WS_EMAIL_SIGNATURES"
for each row
execute function public.set_updated_at_ws_email_signatures();

alter table public."WS_EMAIL_SIGNATURES" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_EMAIL_SIGNATURES'
      and policyname = 'select_own_email_signature'
  ) then
    create policy select_own_email_signature
      on public."WS_EMAIL_SIGNATURES"
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_EMAIL_SIGNATURES'
      and policyname = 'insert_own_email_signature'
  ) then
    create policy insert_own_email_signature
      on public."WS_EMAIL_SIGNATURES"
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_EMAIL_SIGNATURES'
      and policyname = 'update_own_email_signature'
  ) then
    create policy update_own_email_signature
      on public."WS_EMAIL_SIGNATURES"
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Bucket publico para que el logo sea visible en los correos de Gmail.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'tu-logo',
  'tu-logo',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where not exists (
  select 1
  from storage.buckets
  where id = 'tu-logo'
);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_read_tu_logo'
  ) then
    create policy public_read_tu_logo
      on storage.objects
      for select
      using (bucket_id = 'tu-logo');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'insert_own_tu_logo'
  ) then
    create policy insert_own_tu_logo
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'tu-logo'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'update_own_tu_logo'
  ) then
    create policy update_own_tu_logo
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'tu-logo'
        and split_part(name, '/', 1) = auth.uid()::text
      )
      with check (
        bucket_id = 'tu-logo'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'delete_own_tu_logo'
  ) then
    create policy delete_own_tu_logo
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'tu-logo'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;
end $$;
