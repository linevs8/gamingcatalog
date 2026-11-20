# Gaming HQ — Technical Foundation (proposed)

**Date:** 2026-10-13
**Status:** Recommended architecture, pending implementation test. Source of product decisions: [PRODUCT_SPEC.md](./PRODUCT_SPEC.md).

## Choices

| Concern | Recommended | Reason |
| --- | --- | --- |
| Frontend | Next.js + TypeScript + Tailwind CSS | Typed app and server-side routes available for protected game-data requests |
| UI | React components + small design tokens | Dark midnight-blue default with easy theme variants |
| Drag-and-drop | dnd-kit (evaluate current supported API when installing) | Sortable interactions, pointer/touch/keyboard sensors, motion |
| Notes editor | Tiptap React + StarterKit and color extension | Document-like editing; built-in history support to test with Ctrl+Z/redo |
| Guest storage | IndexedDB with versioned schema | Stores structured games, categories, order, settings and notes locally; better room than localStorage |
| Cloud storage and login (later) | Supabase Postgres + Auth, Row Level Security | Email/Google sign-in and per-user ownership; explicit secure migration required |
| External game metadata | IGDB, **conditional on credentials and licensing** | Search, covers and metadata; use a server-side adapter, not browser calls |
| Alternate art (later) | SteamGridDB, **conditional on rights/terms** | Artwork overrides and variety |
| Hosting | Vercel, user connects GitHub repo | Preview deployments per branch; production setup after the first locally tested slice |

## Critical IGDB constraints to resolve

Official documentation: https://api-docs.igdb.com/

- Requires a Twitch Developer account, application Client ID/Secret, and OAuth client-credentials flow.
- Official docs state free API access for **noncommercial** use; commercial activity needs partnership.
- API is not intended to be called directly from browser (CORS). Never expose client secret to browser; implement server adapter.
- Published rate limit: 4 requests per second, max 8 outstanding requests. Cache and throttle.
- Artwork/display attribution and usage conditions need review before public release.
- Until credentials and terms are resolved, include **manual Add Game** and local demo fixture support, keeping the adapter swappable.
- Do not claim live IGDB search works until it is exercised with real credentials.

## Data model sketch

- `games`: user-owned game instances (unique ID), optional provider/provider_id, user title/art/metadata overrides, created/updated.
- `categories`: unique ID, name, color, icon, location (`dashboard` or shelf ID), rank, view mode, sort mode.
- `shelves`: unique ID, name, rank.
- `category_games`: category ID + game ID, rank; unique pair; independent rank within each category.
- `note_pages`: game ID, page ID, name, rank, rich document JSON, updated.
- `quick_links`: game ID, link ID, title, URL, rank.
- `settings`: theme, sidebar state, preferences.
- `note_revisions` (later): bounded recovery snapshots separate from in-game session history.
- `accounts`/ownership (later): map guest-local IDs to signed-in Supabase user IDs.

**Invariant:** Games never duplicate just because they appear in multiple categories. Drop to Library removes one source membership; never removes the master game. Deleting any category must not cascade-delete games or notes.

## Core UX implementation principles

- Routes like `/`, `/library`, `/shelves`, `/category/[id]`, `/game/[id]` give correct Back/Forward and deep links.
- Maintain scroll restoration and context with careful client state; don't fake navigation using only modal views.
- One narrow sidebar and accessible drag destinations. Hold gesture must not break click-to-open, scroll or touch.
- Dashboard cover previews are entire-card navigation to category, not links to games.
- Debounced durable autosave + local draft-first note persistence + explicit save state. Notes history/undo tested independently from browser navigation.
- Formatting stored structurally (editor JSON), never merely HTML scraped for previews.
- Preview extraction uses meaningful note blocks and checklist counts; fail gracefully for rich or unusually long documents.
- Do not read/load every note body on dashboard; use cached lightweight summaries.
- Guest-to-account migration will need idempotent merge handling and RLS tests before launch.

## First coded vertical slice

1. Empty Dashboard and blue theme tokens; narrow sidebar / browser routes.
2. Add manual game to Library, create category, assign game; persistence across reloads.
3. Category as whole-click Dashboard card showing four top-ranked covers; open expanded Gallery/List; open shared game.
4. Current rich-text note and add/edit Quick Links; prove editing and local autosave survive reload.
5. Hold-and-drag rank changes and move between categories/shelves with clear Undo, working for pointer and keyboard.
6. Add metadata search adapter and account/cloud work only after foundations pass these acceptance tests.

## Before a public launch

- Verify API provider licensing and image rights; prevent secret exposure.
- Decide private/public GitHub repository (currently public).
- Test rich-text undo/redo, recovery, multi-tab edits, back-forward, responsive/mobile touch, accessibility, large-library performance.
- Configure Supabase per-user ownership/RLS and migration; never equate GitHub/Vercel deployment with secure user storage.
- Keep code changes in reviewable branches and document any departures from Product Spec.

## Milestone status (Oct 21, 2026)

Rich text via Tiptap 2, DnD Kit 6/10 with a shared pure organization data layer, and JSON data export/import are now implemented in the feature branch. Automated unit tests preserve multiple category memberships on moves and protect notes from category deletion. The automated build runs `npm run lint`, `npm run test`, `npm run build`. Cloud auth, automatic cover lookup/metadata and deployment Git linking remain deferred until configured. Preview URLs have distinct browser storage; tell testers to use backup import/export.

## IGDB implementation status (October 21, 2026)

The secure Next.js server route is `app/api/igdb/search/route.ts`; it exchanges Twitch confidential-app credentials for a cached OAuth access token, searches `/v4/games`, and returns a minimized/sanitized `IgdbGame[]` to the browser. UI: `components/IGDBSearch.tsx`; integrated into Add Game with manual fallback and IGDB-ID duplicate protection. Images are fetched directly from the published IGDB CDN without proxying secrets.

Deployment requirement: server-only `IGDB_CLIENT_ID` + `IGDB_CLIENT_SECRET` (Vercel Preview env vars). Not set in the existing project at time of implementation. Server returns `NOT_CONFIGURED` without exposing any token, and UI continues to offer manual entry. Live upstream credentials and search responses cannot be verified before configuration.

Provider caveats: official 4 req/sec and 8 parallel request limit; local per-instance request throttling is not sufficient for a popular shared multi-instance deployment. Confirm noncommercial licensing, image/attribution terms, and public access controls before using commercially.
