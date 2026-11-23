import type { Data, Game } from "./data";

export function libraryPage(games: Game[], query: string, requestedPage: number, pageSize = 80) {
  const needle = query.trim().toLocaleLowerCase();
  const filtered = games.filter(game =>
    (game.title + " " + game.subtitle).toLocaleLowerCase().includes(needle))
    .sort((a,b) => a.title.localeCompare(b.title));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(totalPages, Math.max(1, Math.floor(requestedPage) || 1));
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  return { filtered, visible, safePage, totalPages };
}

/** Permanently delete selected master-library identities and only their dependent content. */
export function removeLibraryGames(data: Data, ids: ReadonlySet<string>): Data {
  const owned = new Set(data.games.filter(game => ids.has(game.id)).map(game => game.id));
  if (!owned.size) return data;
  const notes = { ...data.notes };
  const noteTitles = { ...(data.noteTitles || {}) };
  const notePages = { ...(data.notePages || {}) };
  const deletedNotePages = { ...(data.deletedNotePages || {}) };
  const noteRevisions = { ...(data.noteRevisions || {}) };
  for (const id of owned) {
    delete notes[id];
    delete noteTitles[id];
    delete notePages[id];
    delete deletedNotePages[id];
  }
  for (const key of Object.keys(noteRevisions)) {
    if ([...owned].some(id => key.startsWith(id + "/"))) delete noteRevisions[key];
  }
  return {
    ...data, notes, noteTitles, notePages, deletedNotePages, noteRevisions,
    games: data.games.filter(game => !owned.has(game.id)),
    memberships: data.memberships.filter(member => !owned.has(member.gameId)),
    links: data.links.filter(link => !owned.has(link.gameId)),
  };
}
