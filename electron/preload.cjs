const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("playquillDesktop", {
  load: () => ipcRenderer.invoke("playquill:load"),
  save: data => ipcRenderer.invoke("playquill:save", data),
  saveSync: data => ipcRenderer.sendSync("playquill:save-sync", data),
  focusWindow: () => ipcRenderer.send("playquill:focus-window")
});
