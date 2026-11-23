# Playquill optional cloud library

This feature is **opt-in**. Guests continue to use IndexedDB/localStorage and JSON backups. Cloud backup is never required to browse or edit a game journal.

## Implementation

The preview app uses the public Supabase URL and publishable (or legacy anon) key. These are safe browser credentials **only because database Row Level Security is enforced**. Never put a service-role secret in `NEXT_PUBLIC_` environment variables.

The Supabase project previously named Gaming HQ was restored and this schema applied via a migration:

```sql
create table public.playquill_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint playquill_snapshot_is_object check (jsonb_typeof(data) = 'object'),
  constraint playquill_snapshot_size_limit check (octet_length(data::text) <= 25000000)
);
alter table public.playquill_snapshots enable row level security;
revoke all on public.playquill_snapshots from anon;
grant select, insert, update, delete on public.playquill_snapshots to authenticated;

create policy playquill_select_own on public.playquill_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy playquill_insert_own on public.playquill_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy playquill_update_own on public.playquill_snapshots
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy playquill_delete_own on public.playquill_snapshots
  for delete to authenticated using ((select auth.uid()) = user_id);
```

The policies were checked against the live project; Supabase security advisors showed no warnings at the time of setup.

## Setup for a new deployment

Configure the following **Preview** environment variables in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project's HTTPS URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — public client API key. Existing deployments may use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead.
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` only after configuring a Google OAuth provider.

Under Supabase Authentication URL Configuration, allow the exact Vercel preview origin and local development return URLs. Set email provider and/or Google provider only after reviewing their sign-in configurations. The app uses an email magic link. Google sign-in stays hidden until deliberately enabled.

## Safe cloud migration

1. Export a JSON backup of the **current device** first.
2. Open Preferences → Optional cloud library and sign in.
3. Click **Check cloud library**. If an account already has a copy, Playquill will not replace either copy automatically.
4. Choose **Upload** to replace the cloud copy with the local library, or **Restore** to replace the local library with the cloud copy. Both require confirmation.
5. After a deliberate upload or restore, optionally enable **automatic cloud backup on this device**.

Automatic cloud backup waits for successful local saves and uses an optimistic **revision precondition**. If another device updated the cloud copy first, the update returns no row, the auto-backup feature pauses, and the local library is preserved. Explicit user reconciliation is required. Automatic background restoration is intentionally **not** performed, to avoid overwriting unsaved editor content. A device that is offline retains local edits; if upload fails, auto-backup pauses instead of falsely reporting success.

Only one snapshot is stored per authenticated user, with a 25 MB database safety cap. Cloud copy versioning is a separate future feature; keep periodic JSON exports. This is user-private storage, not a multiuser shared library.

## Release gate

The server table and RLS policies are verified and the feature has passed a Next.js build, but live email redirect, Google OAuth, desktop runtime, multi-device conflict, offline transitions, and real mobile browser workflows still require hands-on acceptance testing. Do **not** treat this as production-ready until those tests pass.
