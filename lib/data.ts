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
export type NotePage = { id: string; title: string; content: string; order: number };
export type ThemeName = "midnight" | "obsidian" | "violet" | "teal";
export type Data = {
  version: 1;
  games: Game[];
  categories: Category[];
  shelves: Shelf[];
  memberships: Membership[];
  notes: Record<string, string>;
  /** Optional for compatibility with existing saved guest libraries. */
  noteTitles?: Record<string, string>;
  notePages?: Record<string, NotePage[]>;
  theme?: ThemeName;
  links: QuickLink[];
};
export const emptyData = (): Data => ({
  version: 1, games: [], categories: [], shelves: [], memberships: [], notes: {}, noteTitles: {}, notePages: {}, theme: "midnight", links: []
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
  // 'rhq:' distinguishes Tiptap HTML from older plain text notes.
  const html = note.startsWith("rhq:") ? note.slice(4) : "";
  if (html) {
    const asText = html
      .replace(/<(\/p|\/h[1-6]|\/li|br|\/blockquote)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const lines = asText.split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
    const count = (html.match(/data-type="taskItem"/g) || []).length;
    if (!lines.length) return count ? count + " checklist items" : "No notes yet";
    const text = lines[0];
    const summary = count ? text + " · " + count + " checklist items" : text;
    return summary.length > 110 ? summary.slice(0, 107) + "…" : summary;
  }
  const lines = note.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) return "No notes yet";
  const prose = lines.find(x => !/^([-*•]|\d+[.)]|\[[ xX]\]|#)/.test(x));
  if (prose) return prose.length > 110 ? prose.slice(0, 107) + "…" : prose;
  const title = lines.find(x => x.startsWith("#"));
  const tasks = lines.filter(x => /^([-*•]|\d+[.)]|\[[ xX]\])/.test(x));
  if (tasks.length) return (title ? title.replace(/^#+\s*/, "") + " · " : "") + tasks.length + " list items";
  return lines[0].replace(/^#+\s*/, "").slice(0, 110);
}
/** Portable JSON backup. Validate before replacing an existing guest library. */
export function validateImport(raw: unknown): Data {
  if (!raw || typeof raw !== "object") throw new Error("Not a Gaming HQ export.");
  const d = raw as Partial<Data>;
  if (d.version !== 1 || !Array.isArray(d.games) || !Array.isArray(d.categories) ||
      !Array.isArray(d.shelves) || !Array.isArray(d.memberships) ||
      !Array.isArray(d.links) || !d.notes || typeof d.notes !== "object") {
    throw new Error("This file isn't a supported Gaming HQ backup.");
  }
  if (d.games.length > 30000 || d.categories.length > 10000) throw new Error("Backup exceeds import safety limits.");
  for(const g of d.games) {
    if (!g || typeof g.id !== "string" || typeof g.title !== "string" ||
        typeof g.coverUrl !== "string" || typeof g.subtitle !== "string") throw new Error("Invalid game record in backup.");
  }
  for(const c of d.categories) {
    if (!c || typeof c.id !== "string" || typeof c.name !== "string" || typeof c.location !== "string") throw new Error("Invalid category record in backup.");
  }
  return {
    ...emptyData(), ...d,
    noteTitles: d.noteTitles || {}, notePages: d.notePages || {},
    theme: ["midnight","obsidian","violet","teal"].includes(d.theme || "") ? d.theme : "midnight"
  } as Data;
}
