import { type Data, type Game, makeId, validCover } from "./data";

export type GamesImport = { format: "playquill-games"; version: 1; games: { title: string; subtitle?: string; coverUrl?: string }[] };

export function parseGamesImport(raw: unknown): GamesImport["games"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Expected a Playquill games JSON object.");
  const value = raw as Record<string, unknown>;
  if (value.format !== "playquill-games" || value.version !== 1 || !Array.isArray(value.games)) {
    throw new Error("Not a Playquill games-only file. Use format: playquill-games, version: 1.");
  }
  if (value.games.length > 30000) throw new Error("Too many games (maximum 30,000).");
  return value.games.map((entry, i) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Invalid game #" + (i + 1));
    const item = entry as Record<string, unknown>;
    if (typeof item.title !== "string" || !item.title.trim() || item.title.length > 300 ||
        (item.subtitle !== undefined && (typeof item.subtitle !== "string" || item.subtitle.length > 500)) ||
        (item.coverUrl !== undefined && (typeof item.coverUrl !== "string" || !validCover(item.coverUrl)))) {
      throw new Error("Invalid game #" + (i + 1) + ". Check its title and cover URL.");
    }
    return { title: item.title.trim(), subtitle: typeof item.subtitle === "string" ? item.subtitle.trim() : "",
      coverUrl: typeof item.coverUrl === "string" ? item.coverUrl.trim() : "" };
  });
}

function titleKey(title: string) { return title.normalize("NFKC").trim().replace(/\\s+/g, " ").toLocaleLowerCase(); }

/** Import only games; preserve categories, shelves, notes, links and memberships. */
export function mergeImportedGames(data: Data, entries: GamesImport["games"]): { data: Data; added: number; skipped: number } {
  const known = new Set(data.games.map(game => titleKey(game.title)));
  const additions: Game[] = [];
  let skipped = 0;
  for (const item of entries) {
    const key = titleKey(item.title);
    if (known.has(key)) { skipped++; continue; }
    known.add(key);
    additions.push({ id: makeId(), title: item.title, subtitle: item.subtitle || "", coverUrl: item.coverUrl || "", createdAt: Date.now() });
  }
  return { data: { ...data, games: [...data.games, ...additions] }, added: additions.length, skipped };
}
