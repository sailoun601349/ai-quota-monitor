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
  // Region visibility
  getRegionVisibility: () => ipcRenderer.invoke("region:visibility:get"),
  setHeight: (height) => ipcRenderer.invoke("window:setHeight", height),
  onRefresh: (callback) => {
    ipcRenderer.on("quota:refresh", callback);
  },
  onAlwaysOnTopChanged: (callback) => {
    ipcRenderer.on("window:alwaysOnTopChanged", (_event, value) => callback(value));
  },
  onRegionVisibilityChanged: (callback) => {
    ipcRenderer.on("region:visibilityChanged", (_event, visibility) => callback(visibility));
  },
  // Tray menu
  trayMenuAction: (action) => ipcRenderer.invoke("traymenu:action", action),
  getTrayMenuState: () => ipcRenderer.invoke("traymenu:getState"),
  closeTrayMenu: () => ipcRenderer.invoke("traymenu:close"),
  onTrayMenuStateUpdated: (callback) => {
    ipcRenderer.on("traymenu:stateUpdated", (_event, state) => callback(state));
  }
});
