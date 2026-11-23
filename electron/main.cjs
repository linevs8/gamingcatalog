// Playquill native Windows shell. Next.js runs in an Electron utility
// process, not by launching the portable .exe again as in the original build.
const { app, BrowserWindow, dialog, shell, utilityProcess, ipcMain } = require("electron");
const fs = require("node:fs");
const net = require("node:net");
const http = require("node:http");
const path = require("node:path");

const smokeMode = process.argv.includes("--playquill-smoke-test");
const smokeReportArg = process.argv.find(arg => arg.startsWith("--playquill-smoke-report="));
const smokeReportFile = smokeReportArg ? smokeReportArg.slice("--playquill-smoke-report=".length) : null;
const MAX_STARTUP_MS = 60000;

let server = null;
let serverExited = false;
let serverExitMessage = "";
let mainWindow = null;
let starting = true;
let shuttingDown = false;
let homeURL = "";
let logFile = "";

// Unlike IndexedDB, this data lives under Electron's stable userData directory,
// not the randomly assigned localhost origin used by the Next.js server.
const DATA_LIMIT_BYTES = 30 * 1024 * 1024;
function dataPath() { return path.join(app.getPath("userData"), "library.json"); }
function validSender(event) {
  try {
    const frameUrl = new URL(event.senderFrame.url);
    return frameUrl.origin === homeURL && frameUrl.hostname === "127.0.0.1";
  } catch { return false; }
}
function loadNativeLibrary(event) {
  if (!validSender(event)) throw new Error("Untrusted Playquill data request");
  try {
    const raw = fs.readFileSync(dataPath(), "utf8");
    if (Buffer.byteLength(raw) > DATA_LIMIT_BYTES) throw new Error("Library file exceeds 30 MB");
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.games) || !Array.isArray(data.categories)) {
      throw new Error("Invalid Playquill library file");
    }
    return data;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    log("Library load error: " + error);
    throw error;
  }
}
function saveNativeLibrary(event, data) {
  if (!validSender(event)) throw new Error("Untrusted Playquill data request");
  if (!data || data.version !== 1 || !Array.isArray(data.games) || !Array.isArray(data.categories)) {
    throw new Error("Invalid Playquill library payload");
  }
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized) > DATA_LIMIT_BYTES) throw new Error("Library exceeds 30 MB");
  const filename = dataPath();
  const temp = filename + ".tmp";
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(temp, serialized, "utf8");
  fs.renameSync(temp, filename);
  return true;
}
ipcMain.handle("playquill:load", event => loadNativeLibrary(event));
ipcMain.handle("playquill:save", (event, data) => saveNativeLibrary(event, data));
// Synchronous flush guards against closing within the autosave debounce window.
ipcMain.on("playquill:save-sync", (event, data) => {
  try { event.returnValue = saveNativeLibrary(event, data); }
  catch (error) { log("Final save failed: " + error); event.returnValue = false; }
});

function log(message) {
  const line = "[" + new Date().toISOString() + "] " + String(message) + "\n";
  try {
    if (logFile) fs.appendFileSync(logFile, line, "utf8");
  } catch { /* Logging must never prevent startup */ }
  try { process.stdout.write(line); } catch { /* GUI apps may not have stdout */ }
}
function reportSmoke(result) {
  if (!smokeReportFile) return;
  try {
    fs.mkdirSync(path.dirname(smokeReportFile), { recursive: true });
    fs.writeFileSync(smokeReportFile, JSON.stringify(result, null, 2), "utf8");
  } catch (error) { log("Failed writing smoke report: " + error); }
}
function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  log("STARTUP FAILURE: " + message);
  reportSmoke({ ok: false, error: message, serverExitMessage, logFile });
  if (!smokeMode) dialog.showErrorBox("Playquill couldn't start", message + "\n\nDiagnostic log:\n" + logFile);
  app.exit(1);
}
function serverDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app-server")
    : path.join(__dirname, "..", ".next", "standalone");
}
function pickFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Unable to allocate a loopback port"));
        return;
      }
      probe.close(err => err ? reject(err) : resolve(address.port));
    });
  });
}
function getLocal(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 2200 }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        if (body.length < 400000) body += chunk;
      });
      response.on("end", () => resolve({ status: response.statusCode || 0, body }));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Server request timed out")));
  });
}
async function checkServer() {
  const root = await getLocal(homeURL + "/");
  if (root.status !== 200 || !root.body.includes("<title>Playquill</title>")) {
    throw new Error("Local server did not return the Playquill application");
  }
  const match = root.body.match(/href="(\/_next\/static\/css\/[^"]+\.css)"/);
  if (!match) throw new Error("Playquill's stylesheet is missing");
  const sheet = await getLocal(homeURL + match[1]);
  if (sheet.status !== 200 || !sheet.body.includes(".app-shell")) {
    throw new Error("Playquill's stylesheet failed to load");
  }
  return { html: root.status, css: sheet.status, cssPath: match[1] };
}
async function waitForReady() {
  const start = Date.now();
  let previous = "";
  while (Date.now() - start < MAX_STARTUP_MS) {
    if (serverExited) throw new Error("Local server stopped during startup: " + serverExitMessage);
    try { return await checkServer(); }
    catch (error) { previous = String(error); }
    await new Promise(resolve => setTimeout(resolve, 450));
  }
  throw new Error("Local server didn't become ready in 60 seconds. " +
    (serverExitMessage || previous) + "\nSee " + logFile);
}
function startServer(port) {
  const directory = serverDirectory();
  const entrypoint = path.join(directory, "server.js");
  if (!fs.existsSync(entrypoint)) {
    throw new Error("The bundled Next.js server.js is missing: " + entrypoint);
  }
  const staticAssets = path.join(directory, ".next", "static");
  if (!fs.existsSync(staticAssets)) {
    throw new Error("The bundled Next.js static assets are missing: " + staticAssets);
  }
  log("Starting local Next.js using Electron utilityProcess at " + directory);
  const env = {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  server = utilityProcess.fork(entrypoint, [], {
    cwd: directory,
    env,
    stdio: "pipe",
    serviceName: "Playquill local server",
  });
  server.stdout?.on("data", chunk => log("[Next] " + String(chunk).trimEnd()));
  server.stderr?.on("data", chunk => log("[Next error] " + String(chunk).trimEnd()));
  server.on("spawn", () => log("Next utility process spawned"));
  server.on("exit", code => {
    serverExited = true;
    serverExitMessage = "exit code " + code;
    log("Next utility process exited: " + serverExitMessage);
    if (!starting && !shuttingDown) {
      dialog.showErrorBox("Playquill server stopped", "The local server stopped unexpectedly.\n\nLog:\n" + logFile);
      app.quit();
    }
  });
}
function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Playquill",
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    show: false,
    center: true,
    backgroundColor: "#0c0e11",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  let shown = false;
  const show = () => {
    if (shown || !mainWindow || mainWindow.isDestroyed()) return;
    shown = true;
    mainWindow.show();
  };
  mainWindow.once("ready-to-show", show);
  mainWindow.webContents.once("did-finish-load", show);
  mainWindow.webContents.on("did-fail-load", (_event, code, detail, url) => {
    log("Renderer failed to load " + url + ": " + code + " " + detail);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== homeURL && !url.startsWith(homeURL + "/")) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
  void mainWindow.loadURL(homeURL + "/");
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    try {
      logFile = path.join(app.getPath("userData"), "startup.log");
      log("Playquill boot, packaged=" + app.isPackaged + ", smoke=" + smokeMode);
      const port = await pickFreePort();
      homeURL = "http://127.0.0.1:" + port;
      startServer(port);
      const status = await waitForReady();
      log("Local server healthy: " + JSON.stringify(status));
      starting = false;
      if (smokeMode) {
        reportSmoke({ ok: true, ...status, packaged: app.isPackaged });
        app.quit();
      } else {
        createWindow();
      }
    } catch (error) {
      fail(error);
    }
  });
  app.on("before-quit", () => {
    shuttingDown = true;
    if (server) {
      try { server.kill(); } catch (error) { log("Server kill failed: " + error); }
    }
  });
  app.on("window-all-closed", () => { if (!smokeMode) app.quit(); });
}
