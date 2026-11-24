const fs = require("node:fs");
const path = require("node:path");

const KEEP_DAYS = 14;
const MAX_BYTES = 30 * 1024 * 1024;
function validSnapshot(raw) {
  if (Buffer.byteLength(raw) > MAX_BYTES) return false;
  try {
    const d = JSON.parse(raw);
    return d?.version === 1 && ["games","categories","shelves","memberships","links"].every(k => Array.isArray(d[k])) && d.notes && typeof d.notes === "object" && !Array.isArray(d.notes);
  } catch { return false; }
}
function atomicWrite(file, contents) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, contents, {encoding:"utf8", mode:0o600});
  fs.renameSync(tmp, file);
}
// Preserve the last good state before the first write each UTC day.
// A new library gets its first snapshot after its first successful save.
function snapshotLibrary(directory, raw, now = new Date()) {
  if (!validSnapshot(raw)) return false;
  const folder = path.join(directory, "backups");
  const file = path.join(folder, now.toISOString().slice(0,10) + ".json");
  if (!fs.existsSync(file)) atomicWrite(file, raw);
  const snapshots = fs.readdirSync(folder).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().reverse();
  for (const old of snapshots.slice(KEEP_DAYS)) fs.unlinkSync(path.join(folder, old));
  return true;
}
module.exports = {snapshotLibrary,validSnapshot,atomicWrite};
