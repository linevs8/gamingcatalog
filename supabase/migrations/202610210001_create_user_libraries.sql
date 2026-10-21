-- Gaming HQ: one private snapshot per authenticated user.
-- Apply in the Supabase SQL Editor or via Supabase migrations.
create table if not exists public.user_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_libraries enable row level security;
revoke all on table public.user_libraries from anon;
revoke all on table public.user_libraries from authenticated;
grant select, insert, update, delete on table public.user_libraries to authenticated;

drop policy if exists "Read own library" on public.user_libraries;
drop policy if exists "Create own library" on public.user_libraries;
drop policy if exists "Update own library" on public.user_libraries;
drop policy if exists "Delete own library" on public.user_libraries;

create policy "Read own library"
  on public.user_libraries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Create own library"
  on public.user_libraries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own library"
  on public.user_libraries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Delete own library"
  on public.user_libraries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- The user_id primary key is already indexed and directly supports RLS lookups.
-- Never expose the database service-role key to clients.
