-- Templates de correo por usuario (asesores)
-- Ejecutar en Supabase SQL Editor.

create table if not exists public."WS_EMAIL_TEMPLATES" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'otro'
    check (category in ('temporal', 'asesor', 'seguimiento', 'propuesta', 'otro')),
  subject text not null,
  html text,
  text text,
  attachments jsonb not null default '[]'::jsonb,
  tag_label text not null default 'prospectos'
    check (tag_label in ('prospectos', 'clientes', 'polizas', 'cumpleanos', 'eventos', 'personalizar')),
  tag_color text not null default '#93c5fd',
  tag_custom_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public."WS_EMAIL_TEMPLATES"
  add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public."WS_EMAIL_TEMPLATES"
  add column if not exists tag_label text not null default 'prospectos';
alter table public."WS_EMAIL_TEMPLATES"
  add column if not exists tag_color text not null default '#93c5fd';
alter table public."WS_EMAIL_TEMPLATES"
  add column if not exists tag_custom_label text;

create index if not exists idx_ws_email_templates_user_updated
  on public."WS_EMAIL_TEMPLATES" (user_id, updated_at desc);

create or replace function public.set_updated_at_ws_email_templates()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_ws_email_templates on public."WS_EMAIL_TEMPLATES";
create trigger trg_set_updated_at_ws_email_templates
before update on public."WS_EMAIL_TEMPLATES"
for each row
execute function public.set_updated_at_ws_email_templates();

alter table public."WS_EMAIL_TEMPLATES" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_EMAIL_TEMPLATES'
      and policyname = 'select_own_email_templates'
  ) then
    create policy select_own_email_templates
      on public."WS_EMAIL_TEMPLATES"
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- Bucket de documentos/imagenes para plantillas (max 2 archivos por plantilla en UI).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'email-template-assets',
  'email-template-assets',
  true,
  10485760,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where not exists (
  select 1 from storage.buckets where id = 'email-template-assets'
);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_read_email_template_assets'
  ) then
    create policy public_read_email_template_assets
      on storage.objects
      for select
      using (bucket_id = 'email-template-assets');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'insert_own_email_template_assets'
  ) then
    create policy insert_own_email_template_assets
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'email-template-assets'
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
      and policyname = 'update_own_email_template_assets'
  ) then
    create policy update_own_email_template_assets
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'email-template-assets'
        and split_part(name, '/', 1) = auth.uid()::text
      )
      with check (
        bucket_id = 'email-template-assets'
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
      and policyname = 'delete_own_email_template_assets'
  ) then
    create policy delete_own_email_template_assets
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'email-template-assets'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_EMAIL_TEMPLATES'
      and policyname = 'insert_own_email_templates'
  ) then
    create policy insert_own_email_templates
      on public."WS_EMAIL_TEMPLATES"
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_EMAIL_TEMPLATES'
      and policyname = 'update_own_email_templates'
  ) then
    create policy update_own_email_templates
      on public."WS_EMAIL_TEMPLATES"
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'WS_EMAIL_TEMPLATES'
      and policyname = 'delete_own_email_templates'
  ) then
    create policy delete_own_email_templates
      on public."WS_EMAIL_TEMPLATES"
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
