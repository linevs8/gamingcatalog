import { NextRequest, NextResponse } from "next/server";

type IndexRecord = { name: string };
type GameRecord = {
  id: number;
  name?: string;
  summary?: string;
  cover?: { url?: string };
  platforms?: number[];
  release_dates?: Array<{ y?: number }>;
};
type PlatformRecord = { name?: string };

const BASES = [
  "https://app.lizardbyte.dev/GameDB/",
  "https://raw.githubusercontent.com/LizardByte/GameDB/gh-pages/"
];

async function databaseJson<T>(path: string): Promise<T> {
  for (const base of BASES) {
    try {
      const response = await fetch(base + path, {
        next: { revalidate: 60 * 60 * 24 },
        signal: AbortSignal.timeout(8000)
      });
      if (response.ok) return (await response.json()) as T;
    } catch { /* Try the mirror. */ }
  }
  throw new Error("The external game catalog is temporarily unavailable.");
}

export function normalizeTitle(title: string): string {
  return title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchScore(title: string, query: string): number {
  const value = normalizeTitle(title);
  if (value === query) return 1000;
  if (value.startsWith(query + " ")) return 600 - Math.min(value.length - query.length, 100);
  if (value.startsWith(query)) return 500 - Math.min(value.length - query.length, 100);
  const words = query.split(" ").filter(Boolean);
  const titleWords = value.split(" ");
  let position = 0;
  let gap = 0;
  for (const word of words) {
    const index = titleWords.findIndex((candidate, i) => i >= position && (candidate === word || candidate.startsWith(word)));
    if (index < 0) return -1;
    gap += index - position;
    position = index + 1;
  }
  return 300 - gap * 12 - Math.min(titleWords.length - words.length, 60);
}

function coverUrl(raw?: string): string {
  if (!raw) return "";
  const url = raw.startsWith("//") ? "https:" + raw : raw;
  if (!url.startsWith("https://images.igdb.com/")) return "";
  return url.replace("/t_thumb/", "/t_cover_big/");
}

export async function GET(request: NextRequest) {
  const input = (request.nextUrl.searchParams.get("q") || "").slice(0, 100);
  const query = normalizeTitle(input);
  if (query.length < 2) return NextResponse.json({ results: [], message: "Type at least two characters." });
  const initial = query.replace(/[^a-z0-9]/g, "").slice(0, 2);
  if (!initial) return NextResponse.json({ results: [] });
  const bucket = initial.length === 1 ? initial : initial.slice(0, 2);
  try {
    const index = await databaseJson<Record<string, IndexRecord>>("buckets/" + bucket + ".json");
    const matches = Object.entries(index)
      .map(([id, game]) => ({ id, title: game.name, score: matchScore(game.name, query) }))
      .filter(game => game.score >= 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 24);

    // Enrich only visible matches; don't download artwork for thousands of search hits.
    const [platforms, details] = await Promise.all([
      databaseJson<Record<string, PlatformRecord>>("platforms/all.json").catch((): Record<string, PlatformRecord> => ({})),
      Promise.all(matches.map(async match => {
        try { return await databaseJson<GameRecord>("games/" + match.id + ".json"); }
        catch { return null; }
      }))
    ]);

    const results = matches.map((match, index) => {
      const detailsForGame = details[index];
      const platformNames = (detailsForGame?.platforms || []).map(id => platforms[String(id)]?.name).filter((name): name is string => Boolean(name));
      const years = (detailsForGame?.release_dates || []).map(release => release.y).filter((year): year is number => typeof year === "number");
      const year = years.length ? Math.min(...years) : undefined;
      return {
        id: "gamedb:" + match.id,
        title: detailsForGame?.name || match.title,
        coverUrl: coverUrl(detailsForGame?.cover?.url),
        subtitle: [platformNames.slice(0, 3).join(", "), year].filter(Boolean).join(" · "),
        description: detailsForGame?.summary || "",
        platforms: platformNames,
        year,
        source: "GameDB / IGDB"
      };
    });
    return NextResponse.json({ results, source: "LizardByte GameDB" }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=3600" }
    });
  } catch {
    return NextResponse.json({ results: [], error: "Game search is temporarily unavailable. You can still add a game manually." }, { status: 503 });
  }
}
