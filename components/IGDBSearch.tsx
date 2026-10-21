"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Gamepad2, Search } from "lucide-react";
import type { IgdbGame } from "@/lib/igdb";

type Props = {
  onSelect: (game: IgdbGame) => void;
  existingIds: number[];
};

type State =
  | { status: "idle"; games: IgdbGame[] }
  | { status: "loading"; games: IgdbGame[] }
  | { status: "results"; games: IgdbGame[] }
  | { status: "error"; games: IgdbGame[]; message: string; code: string };

export default function IGDBSearch({ onSelect, existingIds }: Props) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle", games: [] });
  const existing = useMemo(() => new Set(existingIds), [existingIds]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2 || normalized.length > 80) {
      setState({ status: "idle", games: [] });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState({ status: "loading", games: [] });
      try {
        const response = await fetch("/api/igdb/search?q=" + encodeURIComponent(normalized), {
          signal: controller.signal, cache: "no-store"
        });
        const payload: unknown = await response.json();
        if (controller.signal.aborted) return;
        const body = payload && typeof payload === "object" ? payload as {
          games?: IgdbGame[]; error?: string; code?: string;
        } : {};
        if (!response.ok || !Array.isArray(body.games)) {
          setState({
            status: "error", games: [],
            message: body.error || "Game search is temporarily unavailable.",
            code: body.code || "UNKNOWN"
          });
          return;
        }
        setState({ status: "results", games: body.games });
      } catch {
        if (!controller.signal.aborted) setState({
          status: "error", games: [], message: "Couldn't connect to game search. Try again shortly.", code: "NETWORK"
        });
      }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  return <div className="igdb-search">
    <label className="igdb-query-label" htmlFor="igdb-query">Search IGDB games</label>
    <div className="igdb-query">
      <Search size={18}/>
      <input id="igdb-query" autoFocus value={query} maxLength={80} type="search"
        placeholder="Kingdom Hearts, Warframe, Final Fantasy…"
        onChange={e => setQuery(e.target.value)}/>
    </div>
    {state.status === "idle" &&
      <p className="igdb-help">Enter at least two characters to find official game titles and covers.</p>}
    {state.status === "loading" && <p className="igdb-help" role="status">Searching games…</p>}
    {state.status === "error" && <div className="igdb-error" role="status">
      <strong>{state.code === "NOT_CONFIGURED" ? "Search setup needed" : "Search unavailable"}</strong>
      <p>{state.message}</p>
      <p>You can still switch to <strong>Manual entry</strong> above.</p>
    </div>}
    {state.status === "results" && !state.games.length &&
      <p className="igdb-help">No matches found. Try a different title or use manual entry.</p>}
    {state.games.length > 0 &&
      <div className="igdb-results" aria-label="IGDB game search results">
        {state.games.map(game => {
          const alreadyAdded = existing.has(game.providerId);
          return <button className="igdb-result" type="button" key={game.providerId}
            title={alreadyAdded ? "Use existing Library entry" : "Add to your Library"}
            onClick={() => onSelect(game)}>
            <div className="igdb-result-cover">
              {game.coverUrl ?
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.coverUrl} alt="" loading="lazy"/> :
                <Gamepad2 size={22}/>}
            </div>
            <span className="igdb-result-copy">
              <strong>{game.title}</strong>
              <span>{game.subtitle || "Game"}</span>
            </span>
            <span className={alreadyAdded ? "igdb-added" : "igdb-select"}>
              {alreadyAdded ? <><Check size={14}/> In Library</> : "Add"}
            </span>
          </button>;
        })}
      </div>}
    <p className="igdb-attribution">Game data and covers provided by <a href="https://www.igdb.com/" target="_blank" rel="noopener noreferrer">IGDB</a>.</p>
  </div>;
}
