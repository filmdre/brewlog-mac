-- Cafecito account data. Run this once in Supabase SQL Editor.
-- The Notion database remains the shared café directory; this table stores only
-- each signed-in person's private journal state.

create table if not exists public.brewlog_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"favorites":{},"ratings":{},"visits":[],"lists":[],"likes":{}}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.brewlog_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists brewlog_profiles_username_unique
  on public.brewlog_profiles (lower(username));

alter table public.brewlog_profiles enable row level security;

drop policy if exists "Users can read their own Cafecito profile" on public.brewlog_profiles;
create policy "Users can read their own Cafecito profile"
  on public.brewlog_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own Cafecito profile" on public.brewlog_profiles;
create policy "Users can create their own Cafecito profile"
  on public.brewlog_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own Cafecito profile" on public.brewlog_profiles;
create policy "Users can update their own Cafecito profile"
  on public.brewlog_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.brewlog_state enable row level security;

drop policy if exists "Users can read their own Cafecito state" on public.brewlog_state;
create policy "Users can read their own Cafecito state"
  on public.brewlog_state for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own Cafecito state" on public.brewlog_state;
create policy "Users can create their own Cafecito state"
  on public.brewlog_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own Cafecito state" on public.brewlog_state;
create policy "Users can update their own Cafecito state"
  on public.brewlog_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.touch_brewlog_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists brewlog_state_updated_at on public.brewlog_state;
create trigger brewlog_state_updated_at
before update on public.brewlog_state
for each row execute function public.touch_brewlog_state();
