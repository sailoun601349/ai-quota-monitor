const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexQuota", {
  getQuota: () => ipcRenderer.invoke("quota:get"),
  getDeepSeekBalance: () => ipcRenderer.invoke("deepseek:balance"),
  getDailyData: () => ipcRenderer.invoke("daily:get"),
  setDailyData: (data) => ipcRenderer.invoke("daily:set", data),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  close: () => ipcRenderer.invoke("window:close"),
  getAlwaysOnTop: () => ipcRenderer.invoke("window:alwaysOnTop:get"),
  setAlwaysOnTop: (value) => ipcRenderer.invoke("window:alwaysOnTop:set", value),
  openCodex: () => ipcRenderer.invoke("external:openCodex"),
  // Settings
  getDeepSeekKey: () => ipcRenderer.invoke("settings:getKey"),
  setDeepSeekKey: (key) => ipcRenderer.invoke("settings:setKey", key),
  closeSettings: () => ipcRenderer.invoke("settings:close"),
  onRefresh: (callback) => {
    ipcRenderer.on("quota:refresh", callback);
  },
  onAlwaysOnTopChanged: (callback) => {
    ipcRenderer.on("window:alwaysOnTopChanged", (_event, value) => callback(value));
  }
});
