export type IgdbGame = {
  provider: "igdb";
  providerId: number;
  title: string;
  coverUrl: string;
  releaseYear: number | null;
  platforms: string[];
  subtitle: string;
};

export type IgdbRawGame = {
  id?: unknown;
  name?: unknown;
  cover?: { image_id?: unknown } | number | null;
  first_release_date?: unknown;
  platforms?: Array<{ name?: unknown }> | number[] | null;
};

export function safeSearchQuery(raw: string): string | null {
  const query = raw.trim().replace(/\s+/g, " ");
  if (query.length < 2 || query.length > 80) return null;
  if (/[\u0000-\u001f\u007f]/.test(query)) return null;
  return query;
}

export function buildGamesQuery(query: string): string {
  // IGDB APICalypse supports quoted string search; escape to prevent
  // user input from adding statements or field filters.
  const escaped = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return 'search "' + escaped + '"; fields id,name,cover.image_id,first_release_date,platforms.name; limit 20;';
}

export function mapIgdbGame(raw: IgdbRawGame): IgdbGame | null {
  if (!Number.isSafeInteger(raw.id) || Number(raw.id) <= 0 ||
      typeof raw.name !== "string" || !raw.name.trim()) return null;
  const platforms = Array.isArray(raw.platforms)
    ? [...new Set(raw.platforms.map(p =>
      p && typeof p === "object" && "name" in p && typeof p.name === "string" ? p.name.trim() : ""
    ).filter(Boolean))].slice(0, 4)
    : [];
  const stamp = typeof raw.first_release_date === "number" ? raw.first_release_date : NaN;
  const year = Number.isFinite(stamp) && stamp > -50000000000 && stamp < 100000000000
    ? new Date(stamp * 1000).getUTCFullYear() : null;
  const releaseYear = year && year >= 1950 && year <= 2200 ? year : null;
  const imageId = raw.cover && typeof raw.cover === "object" && typeof raw.cover.image_id === "string"
    && /^[a-zA-Z0-9_-]{2,90}$/.test(raw.cover.image_id) ? raw.cover.image_id : null;
  const coverUrl = imageId ? 'https://images.igdb.com/igdb/image/upload/t_cover_big/' + imageId + '.jpg' : "";
  const subtitle = [releaseYear ? String(releaseYear) : "", platforms.slice(0,2).join(", ")].filter(Boolean).join(" · ");
  return {
    provider: "igdb",
    providerId: Number(raw.id),
    title: raw.name.trim().slice(0, 200),
    coverUrl,
    releaseYear,
    platforms,
    subtitle
  };
}
