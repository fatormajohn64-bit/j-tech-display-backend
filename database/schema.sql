-- ============================================================
-- J-Tech Display — Database Schema (Phase 6)
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS /
-- OR REPLACE / DROP POLICY IF EXISTS before CREATE POLICY).
-- ============================================================

create extension if not exists pgcrypto; -- provides gen_random_uuid()

-- ------------------------------------------------------------
-- profiles
-- One row per authenticated user. Mirrors the Google identity
-- Supabase Auth already captured (see the trigger near the
-- bottom of this file) — routes/users.js reads/updates this.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- user_settings
-- One row per user. Column defaults mirror DEFAULT_SETTINGS in
-- routes/settings.js — kept in sync deliberately, so a fresh row
-- (however it gets created) always matches the app's own idea of
-- "default".
-- ------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'dark'
    check (theme in ('light', 'dark', 'system')),
  wallpaper_quality text not null default 'high'
    check (wallpaper_quality in ('low', 'medium', 'high', 'original')),
  preferred_orientation text not null default 'portrait'
    check (preferred_orientation in ('portrait', 'landscape', 'square')),
  autoplay_feed boolean not null default true,
  data_saver boolean not null default false,
  show_download_button boolean not null default true,
  show_source boolean not null default true,
  preferred_categories text[] not null default '{}',
  hide_categories text[] not null default '{}',
  feed_mode text not null default 'discover'
    check (feed_mode in ('discover', 'following', 'trending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- favorites
-- Stores a full snapshot of the wallpaper (wallpaper_data), not
-- just its id — provider content can change or disappear, and a
-- user's favorites should keep showing what they favorited.
-- ------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  wallpaper_id text not null,
  wallpaper_data jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, wallpaper_id)
);

create index if not exists favorites_user_id_created_at_idx
  on public.favorites (user_id, created_at desc);

-- ------------------------------------------------------------
-- wallpaper_history
-- "Recently viewed" — one row per (user, wallpaper), most recent
-- view timestamp wins. Not an infinite append-only log, since the
-- app only ever needs "what did this user recently look at" for
-- the recommendation layer described in the product spec.
-- ------------------------------------------------------------
create table if not exists public.wallpaper_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  wallpaper_id text not null,
  wallpaper_data jsonb not null,
  viewed_at timestamptz not null default now(),
  unique (user_id, wallpaper_id)
);

create index if not exists wallpaper_history_user_id_viewed_at_idx
  on public.wallpaper_history (user_id, viewed_at desc);

-- ------------------------------------------------------------
-- updated_at auto-maintenance
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Auto-provision profile + default settings on first sign-in.
-- Supabase inserts into auth.users the moment someone completes
-- the Google OAuth flow — this trigger mirrors that into our own
-- tables immediately, so a brand-new Google sign-in already has a
-- profile and settings row before the app ever calls the API.
-- (routes/users.js and routes/settings.js also lazily create these
-- rows if missing, as a safety net for any user created before
-- this trigger existed — the two approaches don't conflict.)
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', '')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Row Level Security — every table, every user, own rows only.
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.favorites enable row level security;
alter table public.wallpaper_history enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id);

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id);

drop policy if exists "wallpaper_history_select_own" on public.wallpaper_history;
create policy "wallpaper_history_select_own" on public.wallpaper_history
  for select using (auth.uid() = user_id);

drop policy if exists "wallpaper_history_insert_own" on public.wallpaper_history;
create policy "wallpaper_history_insert_own" on public.wallpaper_history
  for insert with check (auth.uid() = user_id);

drop policy if exists "wallpaper_history_update_own" on public.wallpaper_history;
create policy "wallpaper_history_update_own" on public.wallpaper_history
  for update using (auth.uid() = user_id);

drop policy if exists "wallpaper_history_delete_own" on public.wallpaper_history;
create policy "wallpaper_history_delete_own" on public.wallpaper_history
  for delete using (auth.uid() = user_id);
