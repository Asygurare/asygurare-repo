-- Workspace Search + Analytics (RAG en Postgres) - v2 (FUNCIONAL EN SUPABASE)
-- Pega este archivo en Supabase SQL Editor y ejecútalo.
--
-- Qué agrega:
-- - Extensiones: unaccent, pg_trgm
-- - Búsqueda: FTS (GIN) pero SIN expresiones en índice (evita error IMMUTABLE)
-- - RPCs:
--    - ws_search_customers(q, lim)
--    - ws_search_leads(q, lim)
--    - ws_search_policies(q, lim)
--    - ws_avg_customers_age()
--    - ws_count_customers()
--
-- Importante:
-- - Estas funciones son SECURITY INVOKER (default) para respetar RLS.
-- - Ajusta columnas si tu esquema difiere.

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- NOTA CRÍTICA (por el error que viste):
-- Postgres exige IMMUTABLE en expresiones de índice.
-- Para que sea 100% funcional, este script NO crea índices sobre
-- expresiones. En su lugar:
-- 1) agrega una columna tsvector (search_document)
-- 2) la mantiene con triggers
-- 3) indexa SOLO la columna (GIN(search_document))
-- ------------------------------------------------------------

create or replace function public.immutable_unaccent(input text)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  out text;
begin
  -- 1) Supabase típico: extensions.unaccent(text)
  begin
    execute 'select extensions.unaccent($1::text)' into out using input;
    return out;
  exception when undefined_function then
    null;
  end;

  -- 2) Postgres estándar: unaccent(text)
  begin
    execute 'select unaccent($1::text)' into out using input;
    return out;
  exception when undefined_function then
    null;
  end;

  -- 3) Firma alternativa: (regdictionary, text)
  begin
    execute 'select extensions.unaccent(''unaccent''::regdictionary, $1::text)' into out using input;
    return out;
  exception when undefined_function then
    null;
  end;

  begin
    execute 'select unaccent(''unaccent''::regdictionary, $1::text)' into out using input;
    return out;
  exception when undefined_function then
    return input;
  end;
end;
$$;

-- Limpieza (por si intentaste v1 y creó algo)
drop index if exists public.ws_customers_2_search_tsv_idx;
drop index if exists public.ws_leads_search_tsv_idx;
drop index if exists public.ws_policies_search_tsv_idx;

-- ------------------------------------------------------------
-- Builder: crea search_document desde JSONB (tolerante a columnas)
-- ------------------------------------------------------------
create or replace function public.ws_build_search_document(logical_table text, row_data jsonb)
returns tsvector
language sql
stable
as $$
  select to_tsvector(
    'spanish',
    public.immutable_unaccent(
      case lower(coalesce(logical_table, ''))
        when 'clientes' then concat_ws(
          ' ',
          coalesce(row_data->>'name',''),
          coalesce(row_data->>'last_name',''),
          coalesce(row_data->>'full_name',''),
          coalesce(row_data->>'email',''),
          coalesce(row_data->>'phone',''),
          coalesce(row_data->>'status',''),
          coalesce(row_data->>'insurance_type',''),
          coalesce(row_data->>'ocupation',''),
          coalesce(row_data->>'notes','')
        )
        when 'leads' then concat_ws(
          ' ',
          coalesce(row_data->>'name',''),
          coalesce(row_data->>'last_name',''),
          coalesce(row_data->>'full_name',''),
          coalesce(row_data->>'email',''),
          coalesce(row_data->>'phone',''),
          coalesce(row_data->>'stage',''),
          coalesce(row_data->>'status',''),
          coalesce(row_data->>'insurance_type',''),
          coalesce(row_data->>'notes','')
        )
        when 'polizas' then concat_ws(
          ' ',
          coalesce(row_data->>'policy_number',''),
          coalesce(row_data->>'insurance_company',''),
          coalesce(row_data->>'category',''),
          coalesce(row_data->>'status','')
        )
        else concat_ws(' ', row_data::text)
      end
    )
  );
$$;

-- ------------------------------------------------------------
-- Columnas + triggers + índices (NO expresiones)
-- ------------------------------------------------------------

-- CLIENTES
alter table if exists public."WS_CUSTOMERS_2"
  add column if not exists search_document tsvector;

create or replace function public.trg_ws_customers_2_search_document()
returns trigger
language plpgsql
as $$
begin
  new.search_document := public.ws_build_search_document('clientes', to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists ws_customers_2_set_search_document on public."WS_CUSTOMERS_2";
create trigger ws_customers_2_set_search_document
before insert or update on public."WS_CUSTOMERS_2"
for each row execute function public.trg_ws_customers_2_search_document();

update public."WS_CUSTOMERS_2"
set search_document = public.ws_build_search_document('clientes', to_jsonb("WS_CUSTOMERS_2"))
where search_document is null;

create index if not exists ws_customers_2_search_document_idx
on public."WS_CUSTOMERS_2"
using gin (search_document);

create index if not exists ws_customers_2_email_trgm_idx
on public."WS_CUSTOMERS_2"
using gin (email gin_trgm_ops);

create index if not exists ws_customers_2_phone_trgm_idx
on public."WS_CUSTOMERS_2"
using gin (phone gin_trgm_ops);

-- LEADS
alter table if exists public."WS_LEADS"
  add column if not exists search_document tsvector;

create or replace function public.trg_ws_leads_search_document()
returns trigger
language plpgsql
as $$
begin
  new.search_document := public.ws_build_search_document('leads', to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists ws_leads_set_search_document on public."WS_LEADS";
create trigger ws_leads_set_search_document
before insert or update on public."WS_LEADS"
for each row execute function public.trg_ws_leads_search_document();

update public."WS_LEADS"
set search_document = public.ws_build_search_document('leads', to_jsonb("WS_LEADS"))
where search_document is null;

create index if not exists ws_leads_search_document_idx
on public."WS_LEADS"
using gin (search_document);

create index if not exists ws_leads_email_trgm_idx
on public."WS_LEADS"
using gin (email gin_trgm_ops);

create index if not exists ws_leads_phone_trgm_idx
on public."WS_LEADS"
using gin (phone gin_trgm_ops);

-- POLICIES
alter table if exists public."WS_POLICIES"
  add column if not exists search_document tsvector;

create or replace function public.trg_ws_policies_search_document()
returns trigger
language plpgsql
as $$
begin
  new.search_document := public.ws_build_search_document('polizas', to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists ws_policies_set_search_document on public."WS_POLICIES";
create trigger ws_policies_set_search_document
before insert or update on public."WS_POLICIES"
for each row execute function public.trg_ws_policies_search_document();

update public."WS_POLICIES"
set search_document = public.ws_build_search_document('polizas', to_jsonb("WS_POLICIES"))
where search_document is null;

create index if not exists ws_policies_search_document_idx
on public."WS_POLICIES"
using gin (search_document);

create index if not exists ws_policies_policy_number_trgm_idx
on public."WS_POLICIES"
using gin (policy_number gin_trgm_ops);

-- -------------------------
-- RPCs: búsqueda
-- -------------------------

create or replace function public.ws_search_customers(q text, lim int default 10)
returns table (
  id uuid,
  name text,
  last_name text,
  phone text,
  email text,
  age int,
  birthday date,
  status text,
  insurance_type text,
  created_at timestamptz,
  updated_at timestamptz,
  rank real
)
language sql
stable
as $$
  with p as (
    select
      nullif(trim(q), '') as qq,
      greatest(1, least(coalesce(lim, 10), 50)) as ll
  ),
  query as (
    select
      plainto_tsquery('spanish', public.immutable_unaccent((select qq from p))) as tsq,
      (select qq from p) as qq,
      (select ll from p) as ll
  )
  select
    c.id,
    c.name,
    c.last_name,
    c.phone,
    c.email,
    c.age,
    c.birthday::date,
    c.status,
    c.insurance_type,
    c.created_at,
    c.updated_at,
    ts_rank_cd(c.search_document, (select tsq from query)) as rank
  from public."WS_CUSTOMERS_2" c
  where (select qq from query) is not null
    and (
      c.search_document @@ (select tsq from query)
      or c.phone ilike ('%' || (select qq from query) || '%')
      or c.email ilike ('%' || (select qq from query) || '%')
    )
  order by rank desc nulls last, c.updated_at desc nulls last, c.created_at desc nulls last
  limit (select ll from query);
$$;


create or replace function public.ws_search_leads(q text, lim int default 10)
returns table (
  id uuid,
  name text,
  last_name text,
  full_name text,
  phone text,
  email text,
  stage text,
  status text,
  insurance_type text,
  updated_at timestamptz,
  created_at timestamptz,
  rank real
)
language sql
stable
as $$
  with p as (
    select
      nullif(trim(q), '') as qq,
      greatest(1, least(coalesce(lim, 10), 50)) as ll
  ),
  query as (
    select
      plainto_tsquery('spanish', public.immutable_unaccent((select qq from p))) as tsq,
      (select qq from p) as qq,
      (select ll from p) as ll
  )
  select
    l.id,
    l.name,
    l.last_name,
    concat_ws(' ', l.name, l.last_name) as full_name,
    l.phone,
    l.email,
    l.stage,
    l.status,
    l.insurance_type,
    l.updated_at,
    l.created_at,
    ts_rank_cd(l.search_document, (select tsq from query)) as rank
  from public."WS_LEADS" l
  where (select qq from query) is not null
    and (
      l.search_document @@ (select tsq from query)
      or l.phone ilike ('%' || (select qq from query) || '%')
      or l.email ilike ('%' || (select qq from query) || '%')
    )
  order by rank desc nulls last, l.updated_at desc nulls last, l.created_at desc nulls last
  limit (select ll from query);
$$;


create or replace function public.ws_search_policies(q text, lim int default 10)
returns table (
  id uuid,
  policy_number text,
  insurance_company text,
  category text,
  status text,
  total_premium numeric,
  effective_date date,
  expiry_date date,
  customer_id uuid,
  created_at timestamptz,
  rank real
)
language sql
stable
as $$
  with p as (
    select
      nullif(trim(q), '') as qq,
      greatest(1, least(coalesce(lim, 10), 50)) as ll
  ),
  query as (
    select
      plainto_tsquery('spanish', public.immutable_unaccent((select qq from p))) as tsq,
      (select qq from p) as qq,
      (select ll from p) as ll
  )
  select
    pz.id,
    pz.policy_number,
    pz.insurance_company,
    pz.category,
    pz.status,
    pz.total_premium,
    pz.effective_date::date,
    pz.expiry_date::date,
    pz.customer_id,
    pz.created_at,
    ts_rank_cd(pz.search_document, (select tsq from query)) as rank
  from public."WS_POLICIES" pz
  where (select qq from query) is not null
    and (
      pz.search_document @@ (select tsq from query)
      or pz.policy_number ilike ('%' || (select qq from query) || '%')
    )
  order by rank desc nulls last, pz.created_at desc nulls last
  limit (select ll from query);
$$;

-- -------------------------
-- RPCs: analytics exactas
-- -------------------------

create or replace function public.ws_avg_customers_age()
returns table (
  average_age numeric,
  sample_size int
)
language sql
stable
as $$
  with ages as (
    select
      case
        when c.age is not null and c.age between 0 and 120 then c.age::numeric
        when c.birthday is not null then
          case
            when date_part('year', age(c.birthday::date)) between 0 and 120
              then date_part('year', age(c.birthday::date))::numeric
            else null
          end
        else null
      end as a
    from public."WS_CUSTOMERS_2" c
  )
  select
    round(avg(a)::numeric, 1) as average_age,
    count(a)::int as sample_size
  from ages
  where a is not null;
$$;

create or replace function public.ws_count_customers()
returns table (count int)
language sql
stable
as $$
  select count(*)::int as count from public."WS_CUSTOMERS_2";
$$;

