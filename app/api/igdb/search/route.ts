import { NextRequest, NextResponse } from "next/server";
import { buildGamesQuery, mapIgdbGame, safeSearchQuery, type IgdbRawGame, type IgdbGame } from "@/lib/igdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let tokenCache: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;
const resultCache = new Map<string, { expiresAt: number; items: IgdbGame[] }>();
let lastUpstreamRequest = 0;

function errorResponse(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, {
    status, headers: { "Cache-Control": "no-store" }
  });
}

async function token(): Promise<string> {
  const clientId = process.env.IGDB_CLIENT_ID;
  const secret = process.env.IGDB_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("NOT_CONFIGURED");
  if (tokenCache && tokenCache.expiresAt > Date.now() + 120_000) return tokenCache.value;
  if (tokenRequest) return tokenRequest;
  tokenRequest = (async () => {
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        grant_type: "client_credentials"
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error("AUTH_FAILED");
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("access_token" in body) ||
        typeof body.access_token !== "string" || !("expires_in" in body) ||
        typeof body.expires_in !== "number") throw new Error("AUTH_FAILED");
    tokenCache = {
      value: body.access_token,
      expiresAt: Date.now() + Math.max(0, body.expires_in - 120) * 1000
    };
    return tokenCache.value;
  })();
  try { return await tokenRequest; }
  finally { tokenRequest = null; }
}

async function gamesFromIgdb(query: string): Promise<IgdbGame[]> {
  const accessToken = await token();
  const now = Date.now();
  // A lightweight per-instance guard, along with client debounce + a short cache,
  // reduces the risk of exceeding IGDB's 4 req/s limit. Distributed quotas
  // should be added if usage grows beyond a small personal site.
  if (now - lastUpstreamRequest < 280) throw new Error("BUSY");
  lastUpstreamRequest = now;
  const response = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": process.env.IGDB_CLIENT_ID!,
      Authorization: "Bearer " + accessToken,
      "Content-Type": "text/plain",
      Accept: "application/json"
    },
    body: buildGamesQuery(query),
    cache: "no-store",
    signal: AbortSignal.timeout(9000)
  });
  if (response.status === 429) throw new Error("BUSY");
  if (response.status === 401) {
    tokenCache = null;
    throw new Error("AUTH_FAILED");
  }
  if (!response.ok) throw new Error("UPSTREAM_FAILED");
  const raw: unknown = await response.json();
  if (!Array.isArray(raw)) throw new Error("UPSTREAM_FAILED");
  return raw.slice(0,20).map(row => mapIgdbGame(row as IgdbRawGame))
    .filter((item): item is IgdbGame => item !== null);
}

export async function GET(request: NextRequest) {
  const query = safeSearchQuery(request.nextUrl.searchParams.get("q") ?? "");
  if (!query) return errorResponse("Enter at least 2 characters (maximum 80).", "INVALID_QUERY", 400);
  if (!process.env.IGDB_CLIENT_ID || !process.env.IGDB_CLIENT_SECRET) {
    return errorResponse("Game search hasn't been connected yet. You can still add games manually.", "NOT_CONFIGURED", 503);
  }
  const key = query.toLowerCase();
  const cached = resultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ games: cached.items }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const games = await gamesFromIgdb(query);
    resultCache.set(key, { expiresAt: Date.now() + 90_000, items: games });
    if (resultCache.size > 100) resultCache.delete(resultCache.keys().next().value!);
    return NextResponse.json({ games }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "";
    if (reason === "BUSY") return new NextResponse(JSON.stringify({
      error: "Search is busy. Try again in a moment.", code: "RATE_LIMITED"
    }), { status: 429, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Retry-After": "1" } });
    if (reason === "AUTH_FAILED") return errorResponse("IGDB credentials need to be checked.", "AUTH_FAILED", 503);
    return errorResponse("IGDB search is temporarily unavailable. Manual entry still works.", "UPSTREAM_UNAVAILABLE", 502);
  }
}
