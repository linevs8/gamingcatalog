# Gaming HQ 🎮

**Your games, your space.** A calm, midnight-blue home for the games you're playing, the games you might return to, and the little things you want to remember.

Instead of a forced backlog or "daily rotation" system, **you** create the categories that make sense to you. The dashboard stays visual and clean; useful notes are only a click or two away.

> **Prototype milestone:** This is a locally saved, usable prototype—not a production-ready or cloud-synced product. See [Vercel deployment history](https://vercel.com/) for the current preview; GitHub and the hosted preview may require separate account access.

## What's usable in this milestone

- **Dashboard:** Empty start, fully custom categories, whole-card navigation and four top-ranked game-cover previews.
- **Library:** Add games manually, browse Gallery/List, search your collection, edit title/details/cover, and assign games to any number of categories. Games stay unique; notes are shared across categories.
- **Categories & Shelves:** No deep nesting; custom colors and icons, independent Gallery/List views, rename, reorganization, shelves, and safe shelf deletion that moves categories back to Dashboard without deleting games.
- **Drag & drop:** Hold briefly to move/reorder games and categories, drop onto sidebar destinations or named Shelves, with an **Undo** action. Sidebar arrows remain as an alternative.
- **Game workspaces:** A **rich-text notebook** (bold, italics, headings, underline, link, color, bullets, numbering, checklists), a per-game renameable Current heading, optional extra note pages, checkpoint/restore history, and editable Quick Links.
- **Guest saving & customization:** Browser-local autosave, Midnight Blue plus three optional themes, plus **JSON export/import** to move your data between browser origins.
- **Navigation:** Narrow collapsible sidebar, browser Back/Forward, real links and shareable route structure.

## What is still planned

- External automatic game search and cover metadata (requires approved API credentials/licensing).
- Optional account sign-in, secure cloud synchronization, and multi-device data.
- Further performance/accessibility/mobile QA, advanced bulk actions, enhanced note recovery and polish.

**Important:** This remains a **local-first prototype**, not a production-grade personal cloud service. Clearing browser storage can erase guest data. **Export your backup before switching to a different Vercel preview URL**; each preview hostname has its own browser storage. Rich-text notes convert from legacy plain text when edited; retained legacy notes remain readable.

## Validation

The GitHub Actions workflow runs TypeScript checking, pure organization invariants, and a Next.js production build. Automated CI passing does not substitute for clicking through real browsers and touch devices.

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
