// Next.js standalone output excludes static files and public assets.
// Copy both into the server bundle before packaging Electron.
const fs = require("node:fs");
const path = require("node:path");

const cwd = process.cwd();
const serverDir = path.join(cwd, ".next", "standalone");
const serverEntrypoint = path.join(serverDir, "server.js");
if (!fs.existsSync(serverEntrypoint)) {
  console.error("Missing standalone server. Run npm run build first.");
  process.exit(1);
}
const sources = [
  [path.join(cwd, ".next", "static"), path.join(serverDir, ".next", "static")],
  [path.join(cwd, "public"), path.join(serverDir, "public")],
];
for (const [source, destination] of sources) {
  if (!fs.existsSync(source)) continue;
  fs.cpSync(source, destination, { recursive: true, force: true });
}
console.log("Playquill standalone assets prepared");
