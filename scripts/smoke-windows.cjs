// Windows desktop runtime acceptance test. A successful electron-builder build
// alone is insufficient: start the actual packaged Playquill.exe and require a
// locally served Next.js HTML/CSS, renderer focus, manual add and native persistence.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const exe = path.resolve(process.argv[2] || "dist/win-unpacked/Playquill.exe");
if (process.platform !== "win32") {
  console.error("This smoke test runs on a Windows build agent.");
  process.exit(1);
}
if (!fs.existsSync(exe)) {
  console.error("Packaged executable not found: " + exe);
  process.exit(1);
}
const report = path.join(os.tmpdir(), "playquill-smoke-" + process.pid + ".json");
const args = [
  "--playquill-smoke-test",
  "--playquill-smoke-report=" + report,
];
const proc = spawn(exe, args, { windowsHide: true, stdio: "ignore" });
const timeout = setTimeout(() => {
  console.error("Playquill desktop smoke test timed out");
  proc.kill();
}, 150000);
proc.once("error", error => {
  clearTimeout(timeout);
  console.error("Could not launch packaged Playquill:", error);
  process.exitCode = 1;
});
proc.once("exit", (code, signal) => {
  clearTimeout(timeout);
  let result;
  try { result = JSON.parse(fs.readFileSync(report, "utf8")); }
  catch (error) {
    console.error("Packaged Playquill never reported a successful startup", error);
    process.exitCode = 1;
    return;
  } finally {
    try { fs.unlinkSync(report); } catch {}
  }
  console.log("Playquill packaged runtime report:", JSON.stringify(result));
  if (!result.ok && result.logFile) {
    try {
      const diagnostic = fs.readFileSync(result.logFile, "utf8");
      console.error("=== PLAYQUILL STARTUP LOG ===\\n" + diagnostic.slice(-15000));
    } catch (error) {
      console.error("Could not read startup log:", error);
    }
  }
  if (code !== 0 || signal || !result.ok || result.html !== 200 ||
      result.css !== 200 || result.packaged !== true || !result.searchFocus || !result.manualAdd || !result.nativeSave || !result.reloadRestore || !result.localBackup) {
    process.exitCode = 1;
  }
  if (result.smokeProfile && path.dirname(result.smokeProfile) === os.tmpdir() && path.basename(result.smokeProfile).startsWith('playquill-ui-test-')) {
    try { fs.rmSync(result.smokeProfile, {recursive:true,force:true}); } catch {}
  }
});
