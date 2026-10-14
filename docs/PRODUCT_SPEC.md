# Gaming HQ — Master Product & Design Specification

**Version:** 1.1 — October 13, 2026  
**Status:** Planning complete for first interactive milestone; **application code not yet started**.  
**Repository:** https://github.com/linevs8/gamingcatalog  
**Purpose:** Source of truth across ChatGPT chats, implementation branches and reviews.

> **North star:** Gaming HQ takes mental weight OFF the player. See what you play, decide what to launch, pick up where you left off and keep useful notes — without creating another thing to maintain.

## 1. Product and attention hierarchy — AGREED

Gaming HQ is a private-by-default personal gaming dashboard. Every game lives once in a master Library, may appear in multiple user-created categories, and has one shared workspace. Categories on the Dashboard get visual attention; categories in Shelves are tucked away.

Three levels:
1. **Dashboard (browse):** Compact personalized category cards with cover previews. The ENTIRE category card is one large click target, including the displayed covers.
2. **Expanded category (choose):** See all games with individually remembered Gallery/List view, rank/reorder, add, organize, and open a game.
3. **Game workspace (remember):** Immediately editable Current note and easy Quick Links; optional additional note pages.

There is NO mandatory rotation, backlog, currently-playing, goal, daily routine, or status category. The user creates categories that suit them. Flexible features should never force an onboarding questionnaire.

## 2. Library, categories, Dashboard and Shelves — AGREED

- **All Games / Library** is the permanent master list of user-added games, including uncategorized games. There is one game identity, one collection of notes, one quick-link collection and one metadata override per game.
- **Categories** are fully user-created and editable. Games can be members of any number of categories and have independent manual rankings in each. Renaming a category never duplicates or removes its games.
- **Dashboard** shows user-chosen categories, not preordained system categories. Categories have a manual visual order.
- **Shelves** are out-of-the-way containers for categories, accessed through unobtrusive navigation, not prominent Dashboard cards.
- A category is **either on the Dashboard OR in one named shelf**. Shelves may hold categories; no categories inside categories, shelves inside shelves, or deeper nesting.
- Game membership is independent of a category's Dashboard/Shelf placement. Moving a category to a shelf keeps all its memberships and each game's workspace.
- **No deletion via drag:** Removing a game from a category never removes it from the Library or deletes its notes. Deleting a category never deletes its games.
- The Library is the primary management hub: search, add, bulk assign, remove category memberships and open a game.

**Example:** Warframe can be #4 in Priority and #1 in Solo Main but must always open the SAME Warframe note and links.

## 3. Dashboard — AGREED

- Default theme is a dark, blue-forward **Midnight Blue** with a polished gaming-launcher feel and the calm utility of a notes app.
- A responsive grid of compact, attractive category cards; each has a customizable icon and subtle accent color.
- Each category previews its FIRST FOUR manually ranked games using recognizable cover art. With fewer than four games, show only available games. Responsive treatment may adapt on small screens.
- Previews are ALWAYS covers, even when the expanded category is set to List.
- Clicking ANYWHERE on a Dashboard category card — even on a cover — opens the category, NOT a specific game. No precision-clicking.
- Dashboard displays the categories in the same order as the sidebar organizer. Moving a category changes the Dashboard order.
- Do not display Shelves as Dashboard category cards.
- Easy creation of new category without forced settings.
- Suggested palette, to be visually tested: background #0B1220, surface #152238, raised #20314C, accent #77A9F7, text #E9F0FC.
- Curated alternate themes (e.g. Obsidian, Dusk Violet, Deep Teal) are possible. Theme applies at the account level, not separately to every game.

## 4. Expanded category — AGREED

- Enter by clicking its Dashboard card or via navigation. Browser/back navigation works.
- Each category remembers **Gallery or List** separately, default Gallery.
- Gallery emphasizes recognizable cover artwork. List emphasizes efficient navigation and intelligent short previews of CURRENT notes.
- Manual/custom rank is the default; initial order follows insertion. Optional alternative sorts may include name or update recency.
- Drag-to-reorder inside category OR its expandable sidebar list updates the same per-category order and the Dashboard top-four preview instantly.
- A conveniently placed 'Add games' action exists inside category; also add/organize via Library.
- Click a game to open workspace; hold before dragging.
- For rich-text notes previews: do NOT blindly take first characters or first bullet. Prefer meaningful prose, a meaningful heading plus task-count for checklists, or optionally a user-pinned preview source. Truncate for legibility; hide distracting empty-note filler. Algorithm remains to be tested.

## 5. Library and Add Game — AGREED / TECHNICAL SOURCE PENDING

Library has **two related functions**, not one muddled search:
- **All Games**: Search, browse, filter and organize games the user has ALREADY added. Gallery default and possible List toggle. Manual games work like database games.
- **Add Game**: Search a game database, inspect results, choose correct release/title, then add to user's Library. Automatically populate cover, title and useful metadata when available.
- A fully **manual/custom game** is always an option. Users may override any supplied title, cover or other metadata without losing the workspace.
- Each expanded category directly supports **New game** (creates one master-Library entry automatically assigned to the current category) and **From Library** (adds or removes category membership for existing games without duplicating them or leaving the category).
- A game added to Library need not be assigned to a category immediately.
- Bulk category assignment in Library is desirable.
- One unique user-library entry per chosen game identity. Prevent accidental duplicate additions and support intentional custom distinctions.
- All Games needs to work with 1,000+ entries: search, filtering, responsive images and paginated/virtualized browsing.
- Separate user-library identities from external provider IDs so changing metadata provider won't corrupt notes.

Provider choice: evaluate IGDB as first candidate, SteamGridDB as optional alternate-art provider; do not expose provider secrets in the browser. Verify licenses, terms, throttling, artwork rights and practical API access first. **No external provider has been credentialed yet.**

## 6. Blank first visit — AGREED

- Start with an **empty dashboard** and an unobtrusive create-category and add-game path.
- No forced pre-made categories, no onboarding questionnaire, no forced sign-in.
- Blank state should be friendly and offer the first meaningful action. Guest changes should persist in the current browser.

## 7. Sidebar and navigation — AGREED

- **Narrow sidebar** normally: Dashboard, All Games/Library, Shelves and category access.
- Categories can be expanded within the sidebar to reveal their ordered games; drag in this ordered list updates the category's main representation.
- Sidebar may widen temporarily during organization/drag but returns to its compact default; optional icon-only collapse.
- Do not show hundreds of game entries until user expands a category. Expand-on-drag-hover over destinations after a short delay.
- Browser Back/Forward PLUS visible back/forward navigation must follow actual path (Dashboard → Priority → Kingdom Hearts; or Library → Kingdom Hearts). Don't force return to Dashboard.
- Returning to a previous category should restore meaningful view and scroll position, when practical.
- Sidebar category order and Dashboard order share a single state.
- Breadcrumbs can help but must not be required.
- Note editor Ctrl+Z must undo note edits, not browser navigation.

## 8. Drag-and-drop — AGREED; FEEL NEEDS TESTING

- **Hold, then drag** (initial test around 250 ms; tune for desktop/mobile). Normal clicks open the destination; do not depend on tiny grip handles.
- Pickup slightly elevates/highlights the item in blue. Other items reflow smoothly; drop has a subtle settling animation. Honor reduced-motion preferences.
- Autosave resulting order and offer transient Undo for mistaken moves. Provide keyboard/menu alternatives.
- Drag = MOVE the particular placement, not copy. Game's three-dot Organize menu allows checking membership in multiple categories when desired.
- Within category: reorder at precise target rank.
- Category A → B: remove this occurrence/membership from A, add to B at intended position; unrelated memberships elsewhere remain.
- Library → category: add a membership; the game STILL remains in Library.
- Category → Library: remove membership from SOURCE category only; game remains in master Library, other category memberships unchanged.
- Dashboard category → new Dashboard position: reorder category cards, NEVER nest categories.
- Dashboard category → named Shelf: move entire category into Shelf; reverse drag restores it to Dashboard.
- Hover over Shelves in sidebar during category drag to reveal actual named shelf destinations. Generic 'Shelves' label is not itself ambiguous drop target.
- Hover over a collapsed category during game drag to temporarily expand its contents. Drop on category title can append; drop between games allows precision.
- Invalid drag should cancel safely with no data loss.

## 9. Three-dot context menus — AGREED

Hide infrequent settings here without burying obvious actions:
- **Game**: Organize memberships with checkboxes; edit metadata; change cover; remove from Library (explicit destructive action).
- **Category**: Rename; color/icon; Gallery/List and sort settings; move to shelf; delete category without deleting games.
- **Shelf**: Rename; customize; manage categories; delete shelf with clear safe outcome for contained categories.
- **Notes page**: Rename; reorder; duplicate; delete.
- Important actions (Add Game, add link, edit Current note, open category/game, change basic view) must remain discoverable.

## 10. Game workspace — AGREED

- One shared game workspace wherever that game appears.
- The primary notebook heading defaults to **"Where I left off"** but is directly renameable per game. Empty titles revert to default; existing game notes and other categories are unaffected.
- **Current** page by default with immediately editable, continuous **Notepad** and prominent **Quick Links** area. Do not force users to create blocks or press Save before typing.
- Minimal rich text: bold, italic, underline, headings, preset text colors, bulleted and numbered lists, checkboxes, hyperlinks.
- Ctrl+Z/redo must be reliable, with a separate sensible recovery mechanism for previous note content beyond a closed tab. Persist drafts/autosave without claiming success prematurely.
- Optional named additional note PAGES (Builds, Collectibles, Farming, Story Notes); not in the user's face unless created.
- **Blocks**: potential extra customization later, but the baseline may need ONLY Notepad + Links. Do not commit to generic Notion-like blocks until justified.
- **Quick Links:** 'Add link', paste URL, optionally infer title/favicon when possible, allow manual title/edit/reorder/delete. Important links should be easy to access from game Current view.
- **Session history** may be useful but is secondary/collapsed, not distracting from current notes. Do not confuse game session history with note edit recovery history.
- **Image paste/screenshot attachments**: Deferred pending storage/security/cost feasibility.

## 11. Guest-first, account, syncing and privacy — AGREED DIRECTION

- Guest mode works without account and persists locally in that browser/device. Explain honestly that clearing data can lose guest edits.
- Optional email/Google sign-in later enables cloud save and cross-device sync. Existing guest content must be transferred safely after sign-in, with a merge/replace decision when an account already has data.
- Use auto-save for notes, memberships, ordering, category location, links, themes and layout preferences.
- Never show 'Saved' until the relevant storage operation succeeds. Offline/delayed/failed states should be subtle but truthful.
- Content private by default; social sharing is not required.
- Eventually offer user-readable data export.
- Candidate hosted auth/database: Supabase, with per-user authorization and Row Level Security; verify before shipping.

## 12. Scalability, quality and accessibility

- Test 10, 100 and 1,000+ games, many categories/shelves, long game names and exceptionally long/complex notes.
- Lazy-load artwork, paginate/virtualize large lists, fetch previews instead of full notebooks on Dashboard.
- Scroll and drag must cooperate on touchscreens; preserve accessible keyboard/menu sorting paths.
- Respect reduced-motion settings and legible text contrast across presets/user note colors.
- Make data operations resilient to refresh, tab switching, offline connection, failed remote sync and repeated clicks.
- Protect guest data during sign-in; guard against loss of unrelated memberships when dragging one game.

## 13. Non-goals, future ideas and separately vaulted concept

Not required for initial version: social feed/profiles, friends system, AI recommendations, automated playing time tracking, achievements, platform ownership syncing, endless block types, advanced game-specific objective databases or deeper category nesting.

Potential later additions: 'What should I play?' picker; session snapshots; game-image attachments; alternate themes; richer layout customization; advanced keyboard operations.

**Vaulted, not canceled:** Separate TCG-art-gallery idea inspired by a ~500-card Archidekt 'the gallery' deck. It is NOT part of Gaming HQ's first version.

## 14. Project workflow — AGREED

- Canonical repo: https://github.com/linevs8/gamingcatalog
- Keep this document at docs/PRODUCT_SPEC.md, with technical plan and decision log alongside source.
- Work in small feature branches / pull requests once implementation starts; review each change before merging.
- Report what changed, how it was tested, and potential regressions. Never claim tests or a live deployment without actually checking.
- Existing approved behaviors are durable. If a proposed update conflicts, discuss before changing and record it.
- New ChatGPT conversations should inspect repository's latest documentation and code, rather than guess.

## 15. First implementation sequence — PROPOSED, NOT YET BUILT

1. **Local interactive foundation:** Dashboard, narrow sidebar, blank state, category/shelf management, category Gallery/List, Library + manual Add Game, simple workspace, notes, Quick Links, local saving, browser history and smooth drag + Undo.
2. **Metadata search:** Real database integration, compliant artwork, duplicates/overrides and bulk actions.
3. **Optional accounts:** Guest migration, authentication, secured hosted database, cloud syncing, note recovery and export.
4. **QA/polish:** Large-library performance, mobile usability, accessibility, alternate themes and preview deployment.

**Open technical validation:** credentials/licensing for game provider; UX of actual hold-to-drag sensors; editor storage format/version recovery; data migrations and sync conflict policy; image hosting/licensing; hosting expenses.

**Change log**
- v1.0 — Original shared design specification compiled after planning conversation.
- v1.1 — Correct actual repository; approved separate All Games and Add Game library experiences; approved blank first visit; retained technical decisions as pending validation.
