# Gaming HQ 🎮

**Your games, your space.** A calm, midnight-blue home for the games you're playing, the games you might return to, and the little things you want to remember.

Instead of a forced backlog or "daily rotation" system, **you** create the categories that make sense to you. The dashboard stays visual and clean; useful notes are only a click or two away.

> **Early development:** This is the first interactive slice, not a finished or deployed product.

## What works in this branch

- **Blank-slate dashboard** with attractive, whole-card clickable category previews (up to four top-ranked covers each).
- **All Games Library** with search, Gallery/List layouts, manual game addition, optional cover URLs and category assignment.
- **Your own categories**, custom icons/colors, category location on Dashboard or in a Shelf, plus independent Gallery/List views.
- **Multiple memberships:** A game can appear in many categories with one shared workspace and set of notes.
- **Shelves** stay outside the main dashboard and contain categories (no deeper nesting).
- **Game workspaces** with per-game renameable note headings (default "Where I left off"), immediately editable plain-text current notes and addable quick links.
- **Browser Back/Forward** using real URLs; narrow expandable sidebar.
- **Guest-first local autosaving** using IndexedDB (localStorage fallback if unavailable).

### What comes next

Real IGDB-powered search and cover metadata; smooth hold-and-drag reordering/moving with Undo; rich text (bold, italics, color, checklists), additional notes pages and history; optional authentication and secure sync.

**Important:** Notes are currently **plain text**, and ranking is done via small sidebar up/down controls. We intentionally haven't implemented the final drag gesture, rich-text editor, or cloud sync in this slice. Guest data stays in the same browser/device and can be lost if its storage is cleared.

## Run locally

Requires Node.js 20+ and npm.

~~~bash
npm install
npm run dev
~~~

Open [http://localhost:3000](http://localhost:3000).

Check TypeScript with:

~~~bash
npm run lint
~~~

The project uses Next.js (App Router), TypeScript, Lucide icons, and CSS design tokens. No external API keys are needed for this first manual-entry version.

## Project docs

- [Master Product Specification](docs/PRODUCT_SPEC.md) — what we agreed on, including UX rules and deferred ideas.
- [Technical Plan](docs/TECHNICAL_PLAN.md) — intended architecture, provider cautions and build sequence.

## Development approach

Small, reviewable changes. Preserve what already works; don't introduce new user-facing complexity unless it actually makes playing games easier.

Built together, one thoughtful iteration at a time. 💙
