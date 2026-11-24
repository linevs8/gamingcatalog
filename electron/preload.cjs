const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("playquillDesktop", {
  load: () => ipcRenderer.invoke("playquill:load"),
  save: data => ipcRenderer.invoke("playquill:save", data),
  restore: data => ipcRenderer.invoke("playquill:restore", data),
  saveSync: data => ipcRenderer.sendSync("playquill:save-sync", data),
  focusWindow: () => ipcRenderer.send("playquill:focus-window"),
  checkUpdate: force => ipcRenderer.invoke("playquill:check-update",force === true),
  openReleases: () => ipcRenderer.invoke("playquill:open-releases"),
  openBackups: () => ipcRenderer.invoke("playquill:open-backups")
});
