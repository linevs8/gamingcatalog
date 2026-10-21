# Accounts and Cloud Sync Setup

Gaming HQ supports guest mode without any credentials. To enable optional accounts and cross-device saving, use **Supabase Auth + Postgres with row-level security**.

## 1. Create or connect a Supabase project

Open https://supabase.com/dashboard and create a project (or connect the Supabase app in ChatGPT). Never paste database passwords, secret keys, or service-role keys into this repository or chat.

Apply the SQL migration:
\`supabase/migrations/202610210001_create_user_libraries.sql\`

Use the Supabase SQL Editor or Supabase CLI migrations. This creates one snapshot per authenticated user, with SELECT/INSERT/UPDATE/DELETE policies restricted to \`auth.uid() = user_id\`. **Do not disable Row Level Security**.

Verify user A cannot SELECT or overwrite user B's snapshot before enabling the site broadly.

## 2. Configure the public browser connection

In Supabase **Project Settings → API** find:
- **Project URL**
- **Publishable key** (or legacy \`anon\` key)

In Vercel **gamingcatalog → Settings → Environment Variables** add:

| Name | Value | Environment |
|---|---|---|
| \`NEXT_PUBLIC_SUPABASE_URL\` | Supabase project URL | Preview |
| \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` | Supabase publishable/anon key | Preview |
| \`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED\` | \`false\` initially | Preview |

The browser key is deliberately public; the database is protected by RLS. **Never use the service_role or secret key** in \`NEXT_PUBLIC_\` variables.

Redeploy the Preview deployment after setting variables. Vercel environment variables only apply to newly created deployments.

## 3. Enable email magic links

In Supabase **Authentication → Providers → Email**, enable email sign-in. In **Authentication → URL Configuration**, set the Site URL to your canonical site and add these Redirect URLs, for example:

- \`https://gamingcatalog-preview.vercel.app/**\`
- \`https://gamingcatalog.vercel.app/**\`
- \`http://localhost:3000/**\` (development only)

After changing redirects, send a magic link and follow it on the same browser/device that requested it. For real public usage, configure a custom SMTP sender rather than relying on Supabase's limited default email service.

## 4. Optional Google sign-in

Enable Google under **Supabase Authentication → Providers**. Create Google OAuth credentials in Google Cloud following Supabase's provider instructions and add the redirect URI **supplied by Supabase** to Google (not the Gaming HQ homepage). Set \`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true\` in Vercel and redeploy. The Google button remains hidden until this is configured.

## 5. First sign-in

- **Guest with no existing cloud data:** Upload your guest library, or continue without an account.
- **Guest and cloud both contain data:** Use cloud / Combine libraries / Replace cloud with guest. None of these choices silently removes the guest copy.
- **Authenticated user with no guest data:** The account's private cloud library loads automatically.

After connection, local guest storage is not overwritten with account data. Cloud updates use a revision check so stale devices cannot silently replace recent changes. If a conflict occurs, export a JSON backup before troubleshooting.

## 6. Test checklist

- Sign in by email link, then refresh and verify your account stays signed in.
- Add a game, category, and note. Verify the cloud record and reload.
- Sign out and confirm the original guest library returns.
- Sign in on another browser and verify your games and notes sync.
- Test combining two libraries with duplicate IGDB IDs, differing notes and categories.
- Verify another Supabase user cannot read or update your row.
- Test an offline edit/conflicting device version (should show a warning, not overwrite).

## Operational limits

The first sync implementation uses a **single per-user JSON snapshot** (appropriate for an early personal catalog). Updates are debounced/polled in-browser and depend on network connectivity. It is not yet a robust collaborative/offline-first conflict-free sync engine. Large multi-device libraries will eventually benefit from normalized server-side entities and finer-grained conflict resolution.

The Supabase project has to be connected and configured before this feature can be verified end-to-end. CI can check frontend builds and pure merge rules, **not** the deployed database's RLS behavior.
