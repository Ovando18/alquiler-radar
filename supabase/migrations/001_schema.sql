-- =====================================================================
-- AlquilerRadar España — Schema Supabase (PostgreSQL 15+)
-- Execute no SQL Editor do Supabase ou via `supabase db push`.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. authorized_users — controle de assinantes (Hotmart / manual)
-- ---------------------------------------------------------------------
create table if not exists public.authorized_users (
  id                   uuid primary key default gen_random_uuid(),
  email                text not null unique,
  name                 text,
  status               text not null default 'ativo'
                       check (status in ('ativo', 'suspenso', 'pendente')),
  role                 text not null default 'user'
                       check (role in ('user', 'admin')),
  origem               text not null default 'hotmart'
                       check (origem in ('hotmart', 'manual')),
  data_expiracao       timestamptz,
  hotmart_transaction  text,
  plan_name            text,
  offer_code           text,
  -- Controle de sessão única: o último login "reivindica" a sessão.
  active_session_id    text,
  last_login_at        timestamptz,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint email_lowercase check (email = lower(email))
);

create index if not exists authorized_users_status_idx on public.authorized_users (status, data_expiracao);

-- ---------------------------------------------------------------------
-- 2. webhook_logs — todo payload recebido da Hotmart
-- ---------------------------------------------------------------------
create table if not exists public.webhook_logs (
  id               bigint generated always as identity primary key,
  source           text not null default 'hotmart',
  event            text,
  email            text,
  transaction      text,
  hottok_valid     boolean not null default false,
  payload          jsonb not null,
  processing_status text not null default 'received'
                   check (processing_status in ('received', 'processed', 'ignored', 'error', 'unauthorized')),
  error_message    text,
  received_at      timestamptz not null default now()
);

create index if not exists webhook_logs_received_idx on public.webhook_logs (received_at desc);
create index if not exists webhook_logs_email_idx on public.webhook_logs (email);

-- ---------------------------------------------------------------------
-- 3. search_cache — resultados por hash(filtros + portal)
--    Cache por portal: se um portal falhar, apenas ele é refeito.
-- ---------------------------------------------------------------------
create table if not exists public.search_cache (
  cache_key     text primary key,           -- sha256(filtros normalizados + portal)
  filters_hash  text not null,              -- sha256(filtros normalizados)
  portal        text not null,
  filters       jsonb not null,
  results       jsonb not null default '[]'::jsonb,
  result_count  integer not null default 0,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index if not exists search_cache_expires_idx on public.search_cache (expires_at);
create index if not exists search_cache_filters_idx on public.search_cache (filters_hash);

-- ---------------------------------------------------------------------
-- 4. saved_properties — favoritos + notas pessoais
-- ---------------------------------------------------------------------
create table if not exists public.saved_properties (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  property_key  text not null,               -- id do grupo deduplicado
  data          jsonb not null,              -- snapshot do anúncio
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, property_key)
);

-- ---------------------------------------------------------------------
-- 5. saved_searches — buscas salvas / alertas
-- ---------------------------------------------------------------------
create table if not exists public.saved_searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  filters     jsonb not null,
  last_run_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. scraping_usage — contador de requisições ao ZenRows / ScraperAPI
-- ---------------------------------------------------------------------
create table if not exists public.scraping_usage (
  id          bigint generated always as identity primary key,
  provider    text not null,           -- zenrows | scraperapi | direct | playwright | cache
  portal      text not null,
  url         text,
  success     boolean not null,
  status_code integer,
  duration_ms integer,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists scraping_usage_created_idx on public.scraping_usage (created_at desc);

-- ---------------------------------------------------------------------
-- 7. hotmart_offers — duração (dias) por código de oferta
-- ---------------------------------------------------------------------
create table if not exists public.hotmart_offers (
  offer_code  text primary key,
  label       text not null,
  days        integer not null check (days > 0)
);

insert into public.hotmart_offers (offer_code, label, days) values
  ('MENSAL',     'Plano Mensal',     30),
  ('TRIMESTRAL', 'Plano Trimestral', 90),
  ('ANUAL',      'Plano Anual',      365)
on conflict (offer_code) do nothing;

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists authorized_users_touch on public.authorized_users;
create trigger authorized_users_touch before update on public.authorized_users
  for each row execute function public.touch_updated_at();

drop trigger if exists saved_properties_touch on public.saved_properties;
create trigger saved_properties_touch before update on public.saved_properties
  for each row execute function public.touch_updated_at();

-- E-mail do JWT atual (minúsculo)
create or replace function public.current_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- É admin? SECURITY DEFINER evita recursão de RLS em authorized_users.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.authorized_users
    where email = public.current_email() and role = 'admin' and status = 'ativo'
  )
$$;

-- Tem assinatura ativa?
create or replace function public.has_active_access() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.authorized_users
    where email = public.current_email()
      and status = 'ativo'
      and (role = 'admin' or data_expiracao > now())
  )
$$;

-- Limpeza periódica do cache (agende com pg_cron, se disponível):
--   select cron.schedule('purge-cache', '0 * * * *', 'select public.purge_expired_cache()');
create or replace function public.purge_expired_cache() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.search_cache where expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================
-- Row Level Security
-- O service_role (webhook, admin API, microserviço Python) ignora RLS.
-- =====================================================================
alter table public.authorized_users  enable row level security;
alter table public.webhook_logs      enable row level security;
alter table public.search_cache      enable row level security;
alter table public.saved_properties  enable row level security;
alter table public.saved_searches    enable row level security;
alter table public.scraping_usage    enable row level security;
alter table public.hotmart_offers    enable row level security;

-- authorized_users: usuário lê apenas a própria linha; admin lê tudo.
-- Escritas apenas via service_role (rotas /api/admin e webhook).
drop policy if exists au_select_own on public.authorized_users;
create policy au_select_own on public.authorized_users
  for select to authenticated
  using (email = public.current_email() or public.is_admin());

-- webhook_logs: somente admin (leitura)
drop policy if exists wl_admin_read on public.webhook_logs;
create policy wl_admin_read on public.webhook_logs
  for select to authenticated using (public.is_admin());

-- scraping_usage: somente admin (leitura)
drop policy if exists su_admin_read on public.scraping_usage;
create policy su_admin_read on public.scraping_usage
  for select to authenticated using (public.is_admin());

-- hotmart_offers: admin
drop policy if exists ho_admin_read on public.hotmart_offers;
create policy ho_admin_read on public.hotmart_offers
  for select to authenticated using (public.is_admin());

-- search_cache: nenhuma policy => inacessível para anon/authenticated.

-- saved_properties: dono, e só com assinatura ativa
drop policy if exists sp_owner_all on public.saved_properties;
create policy sp_owner_all on public.saved_properties
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_active_access());

-- saved_searches: dono, e só com assinatura ativa
drop policy if exists ss_owner_all on public.saved_searches;
create policy ss_owner_all on public.saved_searches
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_active_access());

-- ---------------------------------------------------------------------
-- Primeiro admin (troque o e-mail e execute uma vez):
-- insert into public.authorized_users (email, name, role, origem, status, data_expiracao)
-- values ('voce@exemplo.com', 'Admin', 'admin', 'manual', 'ativo', now() + interval '100 years')
-- on conflict (email) do update set role = 'admin', status = 'ativo';
-- ---------------------------------------------------------------------
