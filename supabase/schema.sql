-- =====================================================================
-- AI Orbit — base de données des comptes (Supabase)
-- À coller une fois dans Supabase → SQL Editor → New query → Run.
-- Sécurité : Row Level Security sur toutes les tables, chaque utilisateur
-- ne voit et ne modifie que ses propres lignes.
-- =====================================================================

-- Profil (nom affiché + préférences synchronisées)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profil : lecture et écriture par son propriétaire" on public.profiles;
create policy "profil : lecture et écriture par son propriétaire" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Profil créé automatiquement à l'inscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Liste de suivi (favoris)
create table if not exists public.watchlist (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ticker text not null check (char_length(ticker) between 1 and 16),
  note text check (char_length(note) <= 200),
  added_at timestamptz not null default now(),
  primary key (user_id, ticker)
);
alter table public.watchlist enable row level security;
drop policy if exists "liste : lignes du propriétaire" on public.watchlist;
create policy "liste : lignes du propriétaire" on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Alertes de prix
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ticker text not null check (char_length(ticker) between 1 and 16),
  kind text not null check (kind in ('above', 'below', 'move')),
  value numeric not null check (value > 0),
  active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.alerts enable row level security;
drop policy if exists "alertes : lignes du propriétaire" on public.alerts;
create policy "alertes : lignes du propriétaire" on public.alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Portefeuilles virtuels (« Mon ETF IA »), partageables en lecture seule
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  positions jsonb not null,           -- [{ ticker, weight, entry_price }]
  bench jsonb,                        -- référence : indice AI Orbit à la création { ticker: [poids, prix] }
  is_public boolean not null default false,
  share_slug text unique check (share_slug ~ '^[a-z0-9]{6,16}$'),
  created_at timestamptz not null default now()
);
alter table public.portfolios enable row level security;
drop policy if exists "portefeuilles : lignes du propriétaire" on public.portfolios;
create policy "portefeuilles : lignes du propriétaire" on public.portfolios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "portefeuilles : lecture publique si partagé" on public.portfolios;
create policy "portefeuilles : lecture publique si partagé" on public.portfolios
  for select using (is_public = true);

-- Garde-fous : limites par utilisateur
create or replace function public.enforce_row_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n integer; lim integer := tg_argv[0]::integer;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= lim then
    raise exception 'Limite atteinte (% maximum)', lim;
  end if;
  return new;
end;
$$;
drop trigger if exists watchlist_limit on public.watchlist;
create trigger watchlist_limit before insert on public.watchlist for each row execute function public.enforce_row_limit('300');
drop trigger if exists alerts_limit on public.alerts;
create trigger alerts_limit before insert on public.alerts for each row execute function public.enforce_row_limit('50');
drop trigger if exists portfolios_limit on public.portfolios;
create trigger portfolios_limit before insert on public.portfolios for each row execute function public.enforce_row_limit('20');
