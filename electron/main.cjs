// Playquill native Windows shell. Next.js runs in an Electron utility
// process, not by launching the portable .exe again as in the original build.
const { app, BrowserWindow, dialog, shell, utilityProcess, ipcMain, screen } = require("electron");
const fs = require("node:fs");
const net = require("node:net");
const http = require("node:http");
const path = require("node:path");
const os = require("node:os");
const { snapshotLibrary, validSnapshot, atomicWrite } = require("./backups.cjs");

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
    if (!validSnapshot(raw)) {
      throw new Error("Invalid Playquill library file");
    }
    return data;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    log("Library load error: " + error);
    throw error;
  }
}
function saveNativeLibrary(event, data, allowRepair = false) {
  if (!validSender(event)) throw new Error("Untrusted Playquill data request");
  if (!data || data.version !== 1 || !Array.isArray(data.games) || !Array.isArray(data.categories)) {
    throw new Error("Invalid Playquill library payload");
  }
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized) > DATA_LIMIT_BYTES) throw new Error("Library exceeds 30 MB");
  const filename = dataPath();
  if (!validSnapshot(serialized)) throw new Error("Invalid library snapshot");
  let previous = null;
  try { previous = fs.readFileSync(filename,"utf8"); } catch(error) { if(error.code !== "ENOENT") throw error; }
  if (previous === serialized) return true;
  if (previous !== null && !validSnapshot(previous)) {
    if (!allowRepair) throw new Error("Existing library is damaged; restore a backup from Preferences");
    const folder = path.join(app.getPath("userData"),"backups");
    fs.mkdirSync(folder,{recursive:true});
    // Keep the damaged original intact for possible recovery, then restore explicitly.
    fs.copyFileSync(filename,path.join(folder,"damaged-"+Date.now()+".json"),fs.constants.COPYFILE_EXCL);
    previous = null;
  }
  // Capture a recoverable version before replacing a valid saved library.
  try {
    if (previous !== null) {
      snapshotLibrary(app.getPath("userData"), previous);
      atomicWrite(path.join(app.getPath("userData"),"backups","previous.json"),previous);
    }
  } catch (error) { log("Backup failed: " + error); }
  atomicWrite(filename, serialized);
  if (previous === null) {
    try { snapshotLibrary(app.getPath("userData"),serialized); } catch(error) { log("Initial backup failed: " + error); }
  }
  return true;
}
ipcMain.on("playquill:focus-window", event => {
  if (!validSender(event) || !mainWindow || mainWindow.isDestroyed()) return;
  if (event.sender !== mainWindow.webContents) return;
  // Recover renderer input focus following native dialogs and window switches.
  if (mainWindow.isFocused() && !mainWindow.webContents.isFocused()) mainWindow.webContents.focus();
});
const RELEASES = "https://github.com/linevs8/gamingcatalog/releases";
const {releaseAsset,latestRelease,downloadAsset,verifyStaged} = require("./updater.cjs");
let updateCache = null;
let updateRequest = null;
let stagedUpdate = null;
let updateDownloading = false;
let updateInstalling = false;
function canUpdate() {
  return process.platform === "win32" && app.isPackaged && !smokeMode && !process.env.PORTABLE_EXECUTABLE_FILE;
}
function requireUpdateSender(event) {
  if (!validSender(event) || !mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents)
    throw Error("Untrusted update request");
}
async function checkForUpdate(force = false) {
  const current = app.getVersion();
  const result = {current, available:false, latest:null, error:null};
  if (!canUpdate()) return {...result,error:process.env.PORTABLE_EXECUTABLE_FILE?"Install the Setup edition to enable in-app updates.":null};
  if (!force && updateCache && Date.now() - updateCache.time < 6*60*60*1000) return updateCache.result;
  if (updateRequest) return updateRequest;
  updateRequest = (async () => {
    try {
      const release = await latestRelease(current);
      if (!release) return {...result,error:"No published release yet."};
      const asset = releaseAsset(release,current);
      const tag = typeof release.tag_name === "string" && /^v\d+\.\d+\.\d+$/.test(release.tag_name) ? release.tag_name.slice(1) : null;
      const checked = {...result,available:!!asset,latest:asset?.latest || tag,error:!asset && tag!==current?"No newer verified installer is available.":null};
      updateCache = {time:Date.now(),result:checked};
      return checked;
    } catch(error) {
      return {...result,error:"Unable to check for updates."};
    }
  })();
  try {return await updateRequest;} finally {updateRequest = null;}
}
ipcMain.handle("playquill:check-update", (event, force) => {
  requireUpdateSender(event);
  return checkForUpdate(force === true);
});
ipcMain.handle("playquill:download-update", async event => {
  requireUpdateSender(event);
  if (!canUpdate()) throw Error("In-app updates require the installed Setup edition.");
  if (updateDownloading || updateInstalling) throw Error("An update is already in progress.");
  updateDownloading = true;
  const progress = percent => {
    if (!event.sender.isDestroyed()) event.sender.send("playquill:update-progress",percent);
  };
  try {
    const asset = releaseAsset(await latestRelease(app.getVersion()),app.getVersion());
    if (!asset) throw Error("No newer verified installer is available.");
    if (stagedUpdate?.asset.sha256 === asset.sha256 && await verifyStaged(stagedUpdate)) return {latest:asset.latest};
    if (stagedUpdate) {
      await fs.promises.rm(stagedUpdate.root,{recursive:true,force:true}).catch(()=>{});
      stagedUpdate = null;
    }
    // Only versioned installers with a trusted GitHub asset digest may be staged.
    let lastPercent=-1;
    stagedUpdate = await downloadAsset(asset,app.getPath("temp"),percent=>{
      if(percent!==lastPercent){lastPercent=percent;progress(percent);}
    });
    return {latest:asset.latest};
  } finally {updateDownloading = false;}
});
ipcMain.handle("playquill:install-update", async event => {
  requireUpdateSender(event);
  if (!canUpdate() || updateDownloading || updateInstalling || !stagedUpdate)
    throw Error("Download an update first.");
  updateInstalling = true;
  try {
    const choice = await dialog.showMessageBox(mainWindow,{
      type:"warning",title:"Update Playquill",
      message:"Install Playquill "+stagedUpdate.asset.latest+"?",
      detail:"Downloaded from the official GitHub release and checked against its SHA-256 digest. This is an unsigned developer build; Windows may show security or installation prompts. Playquill will close during setup. Your local library will be backed up.",
      buttons:["Install update","Not now"],defaultId:1,cancelId:1,noLink:true
    });
    if (choice.response!==0) return false;
    // Verify again just before opening; never run a modified staged file.
    if (!await verifyStaged(stagedUpdate)) throw Error("The installer changed after download. Download it again.");
    const raw = fs.readFileSync(dataPath(),"utf8");
    if (!validSnapshot(raw)) throw Error("Your library cannot be backed up. Export your library before updating.");
    const backup = path.join(app.getPath("userData"),"backups","before-update-"+app.getVersion()+".json");
    if (!fs.existsSync(backup)) atomicWrite(backup,raw);
    const error = await shell.openPath(stagedUpdate.file);
    if (error) throw Error("Windows could not open the installer: "+error);
    // Let the IPC response settle before the normal close/save path runs.
    setTimeout(()=>app.quit(),250);
    return true;
  } finally {updateInstalling=false;}
});
ipcMain.handle("playquill:open-releases", event => {
  if (!validSender(event)) throw Error("Untrusted release request");
  return shell.openExternal(RELEASES);
});
ipcMain.handle("playquill:open-backups", async event => {
  if (!validSender(event)) throw Error("Untrusted backup request");
  const folder = path.join(app.getPath("userData"),"backups");
  fs.mkdirSync(folder,{recursive:true});
  const error = await shell.openPath(folder);
  if (error) throw Error(error);
});
ipcMain.handle("playquill:load", event => loadNativeLibrary(event));
ipcMain.handle("playquill:save", (event, data) => saveNativeLibrary(event, data));
ipcMain.handle("playquill:restore", (event, data) => saveNativeLibrary(event, data, true));
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
  // Theme changes must be palette-only. Verify the installed renderer, not a CSS mock.
  await click(".preference-button");
  await wait("Preferences visible", "!!document.querySelector('.modal-backdrop:not([hidden]) .preferences-dialog')");
  const paletteColors = new Set();
  let firstGeometry = null;
  for (const theme of ["midnight","obsidian","violet","teal"]) {
    await click(".theme-preview-"+theme);
    await wait("theme applied "+theme, "document.querySelector('.app-shell').classList.contains('theme-"+theme+"')");
    const sample = await run(`(() => {
      const get = selector => getComputedStyle(document.querySelector(selector));
      return {
        background:get(".main-shell").backgroundColor,
        accent:get(".app-shell").getPropertyValue("--accent").trim(),
        geometry:[get(".sidebar").width,get(".topbar").height,get(".main-content").padding,get(".dashboard-screen h1").fontFamily,get(".dashboard-screen h1").fontSize,get(".dashboard-size-picker").height]
      };
    })()`);
    if (!sample.background || !sample.accent) throw Error("Theme palette missing");
    paletteColors.add(sample.background+"|"+sample.accent);
    const geometry = JSON.stringify(sample.geometry);
    if (firstGeometry === null) firstGeometry = geometry;
    else if (geometry !== firstGeometry) throw Error("Theme changed layout: "+theme);
  }
  if (paletteColors.size !== 4) throw Error("Theme palettes are not distinct");
  await click(".theme-preview-midnight");
  await wait("default theme restored", "document.querySelector('.app-shell').classList.contains('theme-midnight')");
  await click('[aria-label="Close preferences"]');
  await wait("preferences closed", "!!document.querySelector('.modal-backdrop[hidden] .preferences-dialog')");
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
  const backupNames = fs.readdirSync(path.join(app.getPath("userData"),"backups"));
  if (!backupNames.some(name=>/^\d{4}-\d{2}-\d{2}\.json$/.test(name))) throw Error("Native backup missing");
  await wc.loadURL(homeURL + "/library");
  await wait("game restored from native storage", "Array.from(document.querySelectorAll('.game-tile-copy strong')).some(e=>e.textContent==='Playquill test game')");
  return { searchFocus: true, manualAdd: true, nativeSave: true, reloadRestore: true, localBackup: true, themeConsistency: true };
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
