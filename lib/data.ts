export type Game = {
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  createdAt: number;
};
export type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
  location: string; // "dashboard" or a shelf id
  order: number;
  view: "gallery" | "list";
};
export type Shelf = { id: string; name: string; order: number };
export type Membership = { categoryId: string; gameId: string; order: number };
export type QuickLink = { id: string; gameId: string; title: string; url: string; order: number };
export type Data = {
  version: 1;
  games: Game[];
  categories: Category[];
  shelves: Shelf[];
  memberships: Membership[];
  notes: Record<string, string>;
  /** Optional for compatibility with existing saved guest libraries. */
  noteTitles?: Record<string, string>;
  links: QuickLink[];
};
export const emptyData = (): Data => ({
  version: 1, games: [], categories: [], shelves: [], memberships: [], notes: {}, noteTitles: {}, links: []
});

const DATABASE = "gaming-hq-local";
const KEY = "data";
let pending: Promise<void> = Promise.resolve();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DATABASE, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("snapshots")) req.result.createObjectStore("snapshots");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function fromDb(): Promise<Data | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readonly");
    const request = tx.objectStore("snapshots").get(KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
async function toDb(data: Data): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    tx.objectStore("snapshots").put(data, KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export async function loadData(): Promise<Data> {
  try {
    const value = await fromDb();
    if (value?.version === 1) return value;
  } catch {
    // IndexedDB may be restricted in private browsing; use a small localStorage fallback.
  }
  try {
    const raw = localStorage.getItem("gaming-hq-backup");
    if (raw) {
      const value: Data = JSON.parse(raw);
      if (value.version === 1) return value;
    }
  } catch { /* Nothing to restore. */ }
  return emptyData();
}
export function saveData(data: Data): Promise<void> {
  // Serialize writes, so an older snapshot cannot overwrite a newer one.
  const write = async () => {
    try {
      await toDb(data);
    } catch {
      // Throw if even the fallback fails; never claim a successful save.
      localStorage.setItem("gaming-hq-backup", JSON.stringify(data));
    }
  };
  pending = pending.catch(() => {}).then(write);
  return pending;
}
export function makeId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + "-" + Math.random().toString(36).slice(2);
}
export function validCover(value: string): boolean {
  if (!value) return true;
  try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:"; }
  catch { return false; }
}
export function notePreview(note: string): string {
  const lines = note.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) return "No notes yet";
  const prose = lines.find(x => !/^([-*•]|\d+[.)]|\[[ xX]\]|#)/.test(x));
  if (prose) return prose.length > 110 ? prose.slice(0, 107) + "…" : prose;
  const title = lines.find(x => x.startsWith("#"));
  const tasks = lines.filter(x => /^([-*•]|\d+[.)]|\[[ xX]\])/.test(x));
  if (tasks.length) return (title ? title.replace(/^#+\s*/, "") + " · " : "") + tasks.length + " list items";
  return lines[0].replace(/^#+\s*/, "").slice(0, 110);
}
