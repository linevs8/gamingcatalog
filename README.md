# Playquill 🎮

**A personal journal for your games.** A warm, charcoal-toned home for the games you're playing, the games you might return to, and the little things you want to remember.

Instead of a forced backlog or "daily rotation" system, **you** create the categories that make sense to you. The dashboard stays visual and clean; useful notes are only a click or two away.

> **Prototype milestone:** This is a locally saved, usable prototype—not a production-ready or cloud-synced product. See [Vercel deployment history](https://vercel.com/) for the current preview; GitHub and the hosted preview may require separate account access.

## What's usable in this milestone

- **Dashboard:** Empty start, fully custom categories, whole-card navigation and four top-ranked game-cover previews.
- **Library:** Search **IGDB** to add titles, artwork and basic release/platform metadata when credentials are configured; or create manual entries. Browse Gallery/List, search your saved collection, edit details/cover, and assign games to multiple categories. Existing imported IGDB entries are reused rather than duplicated.
- **Categories & Shelves:** No deep nesting; custom colors and icons, independent Gallery/List views, rename, reorganization, shelves, and safe shelf deletion that moves categories back to Dashboard without deleting games.
- **Drag & drop:** Drag from the card surface to move/reorder games and categories, drop onto sidebar destinations or named Shelves, with an **Undo** action. Sidebar arrows remain as an alternative.
- **Game workspaces:** A **rich-text notebook** (bold, italics, headings, underline, link, color, bullets, numbering, checklists), a per-game renameable Current heading, optional extra note pages, checkpoint/restore history, and editable Quick Links.
- **Guest saving & customization:** Browser-local autosave, Playquill Noir plus optional themes, plus **JSON export/import** to move your data between browser origins.
- **Navigation:** Narrow collapsible sidebar, browser Back/Forward, real links and shareable route structure.

## November 20, 2026 catch-up branch

- Search the cross-platform LizardByte GameDB catalog (cover art and metadata, including Pokémon and Tekken), with manual fallback. The external index is a snapshot and may have missing entries.
- Historical experiment: rich-text game descriptions were later removed to keep personal notebooks first.
- Collapse the Game Library, select several games and bulk add/remove category memberships.
- Reorder and duplicate note pages, and restore pages from Recently deleted (limited to 30 per game).
- Existing category/game drag-and-drop and Undo are retained.
- These historical November 20 changes were merged and subsequently revised in Playquill. The third-party catalog and images are subject to their respective terms and availability.

## README TODO implementation status (November 23, 2026)

These improvements are on the `feature/readme-todos-before-desktop-2026-11-23` review branch. They have **not** been merged into the desktop release. The existing Playquill web preview remains unchanged.

- **Live IGDB search:** The integrated GameDB + IGDB route is implemented and returned game search results in a real preview check (including Zelda). Preview credentials exist; use manual entry if a provider is offline. Review artwork usage and licensing before any commercial or public release.
- **Optional sign-in and secure cloud library:** Email magic-link sign-in, optional Google provider UI, private authenticated per-user snapshots, explicit local/cloud upload or restore, and opt-in automatic cloud backup with revision conflict detection. Supabase Row Level Security policies and a 25 MB data limit were applied and checked. Google sign-in stays disabled until an OAuth provider is configured. Users must explicitly reconcile their library before enabling automatic backup; cloud copies never silently overwrite local notes.
- **Large-library performance:** Gallery/List library browsing now displays 80 games per page instead of rendering the entire collection. Added select-page, bulk category assignment/removal, and confirmed bulk deletion that also cleans up only the deleted games' note histories and links. Added pure regression tests with 1,200 games.
- **Note recovery:** Existing manual versions and recently deleted note pages remain. New automatic snapshots capture the prior note content periodically during editing, preserving up to 20 per note and allowing restoration.
- **Accessibility and mobile polish:** More responsive pagination, touch-sized controls, a scrollable settings panel, and existing keyboard/reduced-motion protections. Automated TypeScript, data-invariant, and build checks support review, but do not substitute for physical-device testing.

**Acceptance tests still required before marking these TODOs fully complete:** An actual email sign-in round trip with configured allowed redirects; Google OAuth configuration if desired; multi-device cloud upload and revision-conflict testing; offline/error recovery; 1,000+ library scroll and keyboard QA in real browsers; mobile/touch testing; and the IGDB provider's published usage/licensing review. No claim of completed hands-on device testing is made here.

**Desktop build on hold:** The initial Windows executable failed to launch its local server. Automatic EXE builds are disabled in the TODO branch. Fix and smoke-test that runtime only after the web features have passed acceptance.

**Important:** This remains a **local-first prototype**, not a production-grade personal cloud service. Clearing browser storage can erase guest data. **Export your backup before switching to a different Vercel preview URL**; each preview hostname has its own browser storage. Rich-text notes convert from legacy plain text when edited; retained legacy notes remain readable.

## Validation

The GitHub Actions workflow runs TypeScript checking, pure organization invariants, and a Next.js production build. Automated CI passing does not substitute for clicking through real browsers and touch devices.

## Enable live IGDB game search

The server-side Twitch token exchange, image URLs, rate limiting, and duplicate protection are in this milestone. **No credentials are committed to GitHub.** IGDB's free API is intended for noncommercial use; review its licensing and attribution requirements before opening the site to broader use.

1. Create a **Confidential** application at [Twitch Developer Console](https://dev.twitch.tv/console), with Twitch two-factor authentication enabled. The redirect URL is not used for this app; IGDB suggests `http://localhost` during setup.
2. Copy `.env.example` to `.env.local` for local development. Put your app's **Client ID** in `IGDB_CLIENT_ID` and its **Client Secret** in `IGDB_CLIENT_SECRET`. Never prefix these with `NEXT_PUBLIC_`.
3. In **Vercel → gamingcatalog → Settings → Environment Variables**, create `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` for **Preview**, and Production later if appropriate. Save and redeploy after configuring. Existing deployments do not automatically inherit newly added variables.
4. Open **Import games** for unified GameDB/IGDB results, or choose **Add manually**.

The browser contacts `/api/catalog` and `/api/igdb/search`. Tokens and secrets stay on the Next.js server. The backend uses a short search-result cache and honors IGDB's 4 requests/sec limit using a lightweight per-instance guard. For broader public usage, add a shared rate limiter/abuse protection before launch.

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

The project uses Next.js (App Router), TypeScript, Lucide icons, and CSS design tokens. GameDB search and manual entries require no external API keys; live IGDB requires configured Twitch credentials.

## Project docs

- [Master Product Specification](docs/PRODUCT_SPEC.md) — what we agreed on, including UX rules and deferred ideas.
- [Technical Plan](docs/TECHNICAL_PLAN.md) — intended architecture, provider cautions and build sequence.

## Development approach

Small, reviewable changes. Preserve what already works; don't introduce new user-facing complexity unless it actually makes playing games easier.

Built together, one thoughtful iteration at a time. 💙

## Windows desktop edition

The source includes an experimental Electron wrapper for a portable Windows `.exe`, but the first executable did not launch successfully. Do not treat it as a working release. Read [DESKTOP.md](DESKTOP.md) for the Windows build instructions, GitHub Actions workflow, and how to import your existing browser library. The EXE project is paused until the README TODO acceptance tests and Windows startup validation pass.

See [Cloud Sync Setup](docs/CLOUD_SYNC.md) for auth/RLS and safe library migration details.
