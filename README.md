# Gaming HQ 🎮

**Your games, your space.** A calm, midnight-blue home for the games you're playing, the games you might return to, and the little things you want to remember.

Instead of a forced backlog or "daily rotation" system, **you** create the categories that make sense to you. The dashboard stays visual and clean; useful notes are only a click or two away.

> **Prototype milestone:** This is a locally saved, usable prototype—not a production-ready or cloud-synced product. See [Vercel deployment history](https://vercel.com/) for the current preview; GitHub and the hosted preview may require separate account access.

## What's usable in this milestone

- **Dashboard:** Empty start, fully custom categories, whole-card navigation and four top-ranked game-cover previews.
- **Library:** Search **IGDB** to add titles, artwork and basic release/platform metadata when credentials are configured; or create manual entries. Browse Gallery/List, search your saved collection, edit details/cover, and assign games to multiple categories. Existing imported IGDB entries are reused rather than duplicated.
- **Categories & Shelves:** No deep nesting; custom colors and icons, independent Gallery/List views, rename, reorganization, shelves, and safe shelf deletion that moves categories back to Dashboard without deleting games.
- **Drag & drop:** Hold briefly to move/reorder games and categories, drop onto sidebar destinations or named Shelves, with an **Undo** action. Sidebar arrows remain as an alternative.
- **Game workspaces:** A **rich-text notebook** (bold, italics, headings, underline, link, color, bullets, numbering, checklists), a per-game renameable Current heading, optional extra note pages, checkpoint/restore history, and editable Quick Links.
- **Saving & accounts:** Guest autosave, optional email sign-in and cloud sync (once Supabase is configured), explicit first-sync migration, Midnight Blue and three optional themes, and JSON export/import.
- **Navigation:** Narrow collapsible sidebar, browser Back/Forward, real links and shareable route structure.

## What is still planned

- Live IGDB search requires Twitch app credentials and compliance with IGDB's data/artwork terms. The UI and secure route are implemented, but until credentials are set, only manual creation works.
- Complete and verify production Supabase configuration, OAuth provider setup, Row Level Security and cross-device synchronization.
- Further performance/accessibility/mobile QA, advanced bulk actions, enhanced note recovery and polish.

**Important:** This remains a **local-first prototype**, not a production-grade personal cloud service. Clearing browser storage can erase guest data. **Export your backup before switching to a different Vercel preview URL**; each preview hostname has its own browser storage. Rich-text notes convert from legacy plain text when edited; retained legacy notes remain readable.

## Validation

The GitHub Actions workflow runs TypeScript checking, pure organization invariants, and a Next.js production build. Automated CI passing does not substitute for clicking through real browsers and touch devices.

## Optional Gaming HQ account

Use **Sign in** at the top right to save your library to an account instead of this browser only. Email magic links are supported, and Google sign-in can be enabled once its OAuth provider is configured. Existing guest content is never silently replaced: the first sign-in asks whether to keep the cloud copy, upload the guest copy, or combine both.

**Setup is required before live sign-in works:** connect a Supabase project, apply the private RLS migration, configure the project's URL and browser publishable key in Vercel Preview, and redeploy. See [Account & Cloud Setup](docs/SUPABASE_SETUP.md). Until then guest mode works normally.

## Enable live IGDB game search

The interface, server-side Twitch token exchange, image URLs, rate limiting, and duplicate protection are in this milestone. **No credentials are committed to GitHub.** IGDB's free API is intended for noncommercial use; review its licensing and attribution requirements before opening the site to broader use.

1. Create a **Confidential** application at [Twitch Developer Console](https://dev.twitch.tv/console), with Twitch two-factor authentication enabled. The redirect URL is not used for this app; IGDB suggests `http://localhost` during setup.
2. Copy `.env.example` to `.env.local` for local development. Put your app's **Client ID** in `IGDB_CLIENT_ID` and its **Client Secret** in `IGDB_CLIENT_SECRET`. Never prefix these with `NEXT_PUBLIC_`.
3. In **Vercel → gamingcatalog → Settings → Environment Variables**, create `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` for **Preview**, and Production later if appropriate. Save and redeploy after configuring. Existing deployments do not automatically inherit newly added variables.
4. Search for a game with **Add Game → Search IGDB**, or switch to **Manual entry** at any time.

The browser only contacts `/api/igdb/search`. Tokens and secrets stay on the Next.js server. The backend uses a short search-result cache and honors IGDB's 4 requests/sec limit using a lightweight per-instance guard. For broader public usage, add a shared rate limiter/abuse protection before launch.

Docs: [Official IGDB API](https://api-docs.igdb.com/). Game data and covers are attributed to IGDB in the search interface.

## Run locally

Requires Node.js 20+ and npm.

~~~bash
npm install
npm run dev
~~~

Open [http://localhost:3000](http://localhost:3000).

Check TypeScript and run tests with:

~~~bash
npm run lint
npm run test
npm run build
~~~

The project uses Next.js (App Router), TypeScript, Lucide icons, and CSS design tokens. No external API keys are needed for this first manual-entry version.

## Project docs

- [Master Product Specification](docs/PRODUCT_SPEC.md) — what we agreed on, including UX rules and deferred ideas.
- [Technical Plan](docs/TECHNICAL_PLAN.md) — intended architecture, provider cautions and build sequence.

## Development approach

Small, reviewable changes. Preserve what already works; don't introduce new user-facing complexity unless it actually makes playing games easier.

Built together, one thoughtful iteration at a time. 💙
