// Playquill native Windows shell. Next.js runs in an Electron utility
// process, not by launching the portable .exe again as in the original build.
const { app, BrowserWindow, dialog, shell, utilityProcess, ipcMain, screen } = require("electron");
const fs = require("node:fs");
const net = require("node:net");
const http = require("node:http");
const path = require("node:path");
const os = require("node:os");

const smokeMode = process.argv.includes("--playquill-smoke-test");
const smokeReportArg = process.argv.find(arg => arg.startsWith("--playquill-smoke-report="));
const smokeReportFile = smokeReportArg ? smokeReportArg.slice("--playquill-smoke-report=".length) : null;
const MAX_STARTUP_MS = 60000;
// A smoke test must never write to the real user library.
const smokeProfile = smokeMode ? fs.mkdtempSync(path.join(os.tmpdir(), "playquill-ui-test-")) : null;
if (smokeProfile) app.setPath("userData", smokeProfile);

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
ipcMain.on("playquill:focus-window", event => {
  if (!validSender(event) || !mainWindow || mainWindow.isDestroyed()) return;
  if (event.sender !== mainWindow.webContents) return;
  // Recover renderer input focus following native dialogs and window switches.
  if (mainWindow.isFocused() && !mainWindow.webContents.isFocused()) mainWindow.webContents.focus();
});
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
  reportSmoke({ ok: false, error: message, serverExitMessage, logFile, smokeProfile });
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
    // The official hosted service keeps IGDB credentials server-side. Never bundle the secret.
    PLAYQUILL_IGDB_PROXY_ORIGIN: "https://gamingcatalog.vercel.app",
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
  let geometry = {};
  try {
    const state = JSON.parse(fs.readFileSync(path.join(app.getPath("userData"),"window-state.json"),"utf8"));
    const b = state.bounds;
    if (b && [b.x,b.y,b.width,b.height].every(Number.isFinite) && b.width >= 900 && b.height >= 620 && b.width <= 10000 && b.height <= 10000) {
      const visible = screen.getAllDisplays().some(d => {
        const a = d.workArea;
        return Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>100 && Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>100;
      });
      if (visible) geometry = {...b, maximized: state.maximized === true};
    }
  } catch { /* First launch or an outdated monitor arrangement. */ }
  mainWindow = new BrowserWindow({
    title: "Playquill",
    width: geometry.width || 1440,
    height: geometry.height || 900,
    ...(geometry.x === undefined ? {} : {x:geometry.x,y:geometry.y}),
    minWidth: 900,
    minHeight: 620,
    show: false,
    center: geometry.x === undefined,
    backgroundColor: "#0c0e11",
    autoHideMenuBar: true,
    titleBarStyle: "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.removeMenu();
  let shown = false;
  const show = () => {
    if (shown || !mainWindow || mainWindow.isDestroyed()) return;
    shown = true;
    if (geometry.maximized) mainWindow.maximize();
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
  mainWindow.on("focus", () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isFocused()) mainWindow.webContents.focus();
  });
  mainWindow.on("close", () => {
    if (!mainWindow || mainWindow.isDestroyed() || smokeMode) return;
    try { fs.writeFileSync(path.join(app.getPath("userData"),"window-state.json"),JSON.stringify({bounds:mainWindow.getNormalBounds(),maximized:mainWindow.isMaximized()})); }
    catch (error) { log("Could not save window size: " + error); }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
  return mainWindow.loadURL(homeURL + "/");
}

// Exercise the actual packaged renderer and native IPC, not just its HTTP server.
async function runRendererSmoke() {
  const wc = mainWindow.webContents;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const run = code => wc.executeJavaScript(code, true);
  const wait = async (description, code, timeout = 12000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      try { if (await run(code)) return; } catch { /* Renderer may be navigating. */ }
      await sleep(120);
    }
    throw new Error("Renderer smoke test failed: " + description);
  };
  const click = async selector => {
    await wait("click target " + selector, "!!document.querySelector(" + JSON.stringify(selector) + ")");
    await run("document.querySelector(" + JSON.stringify(selector) + ").click()");
  };
  await wait("library loaded", "!document.querySelector('.main-content .loading') && !!document.querySelector('.dashboard-screen')");
  await click('.nav a[href="/library"]');
  await wait("All Games screen", "!!document.querySelector('.library-screen .blank-state button.primary')");
  const search = '.catalog-dialog input[type="search"]';
  for (const value of ["9", "H"]) {
    await click(".library-screen .blank-state button.primary");
    await wait("search has focus", "document.activeElement === document.querySelector(" + JSON.stringify(search) + ")");
    mainWindow.focus();
    wc.focus();
    await wc.insertText(value);
    await wait("search accepts typing", "document.querySelector(" + JSON.stringify(search) + ")?.value === " + JSON.stringify(value));
    await run("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    await wait("search closes on Escape", "!document.querySelector('.catalog-dialog')");
  }
  await click(".library-screen .blank-state button.primary");
  await wait("manual add available", "!!document.querySelector('.catalog-dialog .dialog-fields button.secondary')");
  await click(".catalog-dialog .dialog-fields button.secondary");
  await wait("manual title input available", "!!document.querySelector('.dialog input[placeholder=\"Game title\"]')");
  await run("document.querySelector('.dialog input[placeholder=\"Game title\"]').focus()");
  await wc.insertText("Playquill test game");
  await wait("title accepts typing", "document.querySelector('.dialog input[placeholder=\"Game title\"]')?.value === 'Playquill test game'");
  await click(".dialog-footer button.primary");
  await wait("game visible", "Array.from(document.querySelectorAll('.game-tile-copy strong')).some(e=>e.textContent==='Playquill test game')");
  const until = Date.now() + 10000;
  let saved = false;
  while (Date.now() < until) {
    try { saved = JSON.parse(fs.readFileSync(dataPath(),"utf8")).games.some(g => g.title === "Playquill test game"); } catch {}
    if (saved) break;
    await sleep(150);
  }
  if (!saved) throw new Error("Renderer smoke test failed: library file did not persist");
  await wc.loadURL(homeURL + "/library");
  await wait("game restored from native storage", "Array.from(document.querySelectorAll('.game-tile-copy strong')).some(e=>e.textContent==='Playquill test game')");
  return { searchFocus: true, manualAdd: true, nativeSave: true, reloadRestore: true };
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
        await createWindow();
        const ui = await runRendererSmoke();
        reportSmoke({ ok: true, ...status, ...ui, packaged: app.isPackaged, smokeProfile });
        app.quit();
      } else {
        await createWindow();
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
