const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = 41771;
const URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;
let mainWindow = null;
let stopping = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  function serverRoot() {
    return app.isPackaged
      ? path.join(process.resourcesPath, "app-server")
      : path.join(__dirname, "..", ".next", "standalone");
  }

  function beginServer() {
    const workingDirectory = serverRoot();
    const entrypoint = path.join(workingDirectory, "server.js");
    if (!fs.existsSync(entrypoint)) {
      throw new Error("The local Playquill server was not included in this build.");
    }
    // In an Electron distribution, its executable doubles as Node when this
    // environment variable is set. No external Node installation is necessary.
    serverProcess = spawn(process.execPath, [entrypoint], {
      cwd: workingDirectory,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: String(PORT),
      },
    });
    serverProcess.on("error", (error) => console.error("Playquill server error:", error));
    serverProcess.stdout?.on("data", (chunk) => process.stdout.write(chunk));
    serverProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  }

  function serverAvailable() {
    return new Promise((resolve) => {
      const request = http.get(URL, { timeout: 1250 }, (response) => {
        response.resume();
        resolve(response.statusCode >= 200 && response.statusCode < 500);
      });
      request.on("error", () => resolve(false));
      request.on("timeout", () => { request.destroy(); resolve(false); });
    });
  }

  async function waitForServer() {
    // Poll startup rather than loading an empty window during Next.js boot.
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (serverProcess && serverProcess.exitCode !== null) break;
      if (await serverAvailable()) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("Playquill's local server did not start. Port 41771 may be occupied.");
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 900,
      minHeight: 620,
      title: "Playquill",
      show: false,
      backgroundColor: "#0c0e11",
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
      return { action: "deny" };
    });
    mainWindow.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith(URL + "/") && url !== URL) {
        event.preventDefault();
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
      }
    });

    mainWindow.once("ready-to-show", () => mainWindow?.show());
    mainWindow.on("closed", () => { mainWindow = null; });
    mainWindow.loadURL(URL);
  }

  app.whenReady().then(async () => {
    try {
      // Never display an unrelated service that happens to occupy our port.
      if (await serverAvailable()) {
        throw new Error("Port 41771 is in use. Close the conflicting service before starting Playquill.");
      }
      beginServer();
      await waitForServer();
      createWindow();
    } catch (error) {
      dialog.showErrorBox("Playquill couldn't start", String(error));
      app.quit();
    }
  });

  app.on("before-quit", () => {
    if (stopping) return;
    stopping = true;
    if (serverProcess && serverProcess.exitCode === null) serverProcess.kill();
  });
  app.on("window-all-closed", () => app.quit());
}
