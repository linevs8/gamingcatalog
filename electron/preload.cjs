const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("playquillDesktop", {
  load: () => ipcRenderer.invoke("playquill:load"),
  save: data => ipcRenderer.invoke("playquill:save", data),
  restore: data => ipcRenderer.invoke("playquill:restore", data),
  saveSync: data => ipcRenderer.sendSync("playquill:save-sync", data),
  focusWindow: () => ipcRenderer.send("playquill:focus-window"),
  checkUpdate: force => ipcRenderer.invoke("playquill:check-update",force === true),
  downloadUpdate: () => ipcRenderer.invoke("playquill:download-update"),
  installUpdate: () => ipcRenderer.invoke("playquill:install-update"),
  onUpdateProgress: callback => {
    const listener = (_event,percent) => callback(percent);
    ipcRenderer.on("playquill:update-progress",listener);
    return () => ipcRenderer.removeListener("playquill:update-progress",listener);
  },
  openReleases: () => ipcRenderer.invoke("playquill:open-releases"),
  openBackups: () => ipcRenderer.invoke("playquill:open-backups")
});
