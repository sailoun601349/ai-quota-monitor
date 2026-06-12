const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, screen } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { getQuota } = require("./quota-service");
const { getDeepSeekBalance } = require("./deepseek-service");

// ---- Config file helpers (persists API keys etc.) ---- //
function getConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}
function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf8");
    return JSON.parse(raw);
  } catch (_) { return {}; }
}
function writeConfig(cfg) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), "utf8");
}

// ---- Daily tracking storage (persists across restarts) ---- //
function getDailyFilePath() {
  return path.join(app.getPath("userData"), "ds_daily.json");
}
function readDailyData() {
  try {
    const raw = fs.readFileSync(getDailyFilePath(), "utf8");
    return JSON.parse(raw);
  } catch (_) { return null; }
}
function writeDailyData(data) {
  fs.writeFileSync(getDailyFilePath(), JSON.stringify(data), "utf8");
}

// Set config directory to .ai-quota-monitor
app.setPath("userData", path.join(app.getPath("appData"), ".ai-quota-monitor"));

let mainWindow;
let settingsWindow;
let trayMenuWindow;
let tray;
let isAlwaysOnTop = true;
const DEFAULT_REGIONS = { codex: true, deepseek: true };
let regionVisibility = { ...DEFAULT_REGIONS };

function createWindow() {
  const iconPath = path.join(__dirname, "../../assets/icon.ico");
  mainWindow = new BrowserWindow({
    width: 310,
    height: 155,
    minWidth: 310,
    minHeight: 32,
    icon: iconPath,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: isAlwaysOnTop,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    // Send initial region visibility to renderer
    mainWindow.webContents.send("region:visibilityChanged", regionVisibility);
    placeWindowTopRight();
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  const iconPath = path.join(__dirname, "../../assets/icon.ico");
  settingsWindow = new BrowserWindow({
    width: 380,
    height: 200,
    icon: iconPath,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    parent: mainWindow,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, "../renderer/settings.html"));

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function createTrayMenuWindow() {
  if (trayMenuWindow) {
    trayMenuWindow.close();
    trayMenuWindow = null;
  }

  trayMenuWindow = new BrowserWindow({
    width: 132,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  trayMenuWindow.loadFile(path.join(__dirname, "../renderer/traymenu.html"));

  trayMenuWindow.once("ready-to-show", () => {
    // Send initial state
    sendTrayMenuState();
    // Position near tray icon
    positionTrayMenu();
    trayMenuWindow.show();
    trayMenuWindow.focus();
    // Delay blur listener to avoid immediate fire on Windows
    setTimeout(() => {
      if (trayMenuWindow) {
        trayMenuWindow.on("blur", () => closeTrayMenu());
      }
    }, 150);
  });
}

function positionTrayMenu() {
  if (!trayMenuWindow || !tray) return;
  try {
    const trayBounds = tray.getBounds();
    const menuBounds = trayMenuWindow.getBounds();
    const display = screen.getPrimaryDisplay();
    const { workArea } = display;

    // Position menu above tray icon, right-aligned to tray icon's right edge
    let x = Math.round(trayBounds.x + trayBounds.width - menuBounds.width);
    let y = Math.round(trayBounds.y - menuBounds.height - 4);

    // Clamp to work area
    if (y < workArea.y) y = Math.round(trayBounds.y + trayBounds.height + 4);
    if (x < workArea.x) x = workArea.x + 4;
    if (x + menuBounds.width > workArea.x + workArea.width) {
      x = workArea.x + workArea.width - menuBounds.width - 4;
    }

    trayMenuWindow.setPosition(x, y);
  } catch (_) { /* tray bounds unavailable */ }
}

function closeTrayMenu() {
  if (trayMenuWindow) {
    trayMenuWindow.close();
    trayMenuWindow = null;
  }
}

function sendTrayMenuState() {
  if (!trayMenuWindow) return;
  const state = {
    windowVisible: mainWindow?.isVisible() ?? false,
    isPinned: isAlwaysOnTop,
    regions: { ...regionVisibility }
  };
  trayMenuWindow.webContents.send("traymenu:stateUpdated", state);
}

function getTrayMenuState() {
  return {
    windowVisible: mainWindow?.isVisible() ?? false,
    isPinned: isAlwaysOnTop,
    regions: { ...regionVisibility }
  };
}

function positionWindowTopRight(w, h) {
  if (!mainWindow) return;
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;
  mainWindow.setPosition(
    Math.round(workArea.x + workArea.width - w - 24),
    Math.round(workArea.y + 24)
  );
}

function placeWindowTopRight() {
  if (!mainWindow) return;
  const { width, height } = mainWindow.getBounds();
  positionWindowTopRight(width, height);
}

function createTray() {
  const iconPath = path.join(__dirname, "../../assets/icon.ico");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("AI 额度监控");
  // Right-click: show custom HTML tray menu
  tray.on("right-click", () => createTrayMenuWindow());
  tray.on("click", toggleWindow);
}

function loadRegionVisibility() {
  const cfg = readConfig();
  // New generic format takes precedence; fall back to legacy keys
  if (cfg.regionVisibility) {
    regionVisibility = { ...DEFAULT_REGIONS, ...cfg.regionVisibility };
  } else {
    if (cfg.hasOwnProperty("codexRegionVisible")) {
      regionVisibility.codex = Boolean(cfg.codexRegionVisible);
    }
    if (cfg.hasOwnProperty("deepseekRegionVisible")) {
      regionVisibility.deepseek = Boolean(cfg.deepseekRegionVisible);
    }
  }
}

function setRegionVisibility(region, visible) {
  regionVisibility[region] = Boolean(visible);
  // Persist in generic format
  const cfg = readConfig();
  cfg.regionVisibility = Object.assign(cfg.regionVisibility || {}, regionVisibility);
  // Clean up legacy keys on save
  delete cfg.codexRegionVisible;
  delete cfg.deepseekRegionVisible;
  writeConfig(cfg);
  // Notify main window renderer
  mainWindow?.webContents.send("region:visibilityChanged", regionVisibility);
  // Notify tray menu (if open)
  sendTrayMenuState();
}

function setAlwaysOnTop(value) {
  isAlwaysOnTop = Boolean(value);
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(isAlwaysOnTop);
    mainWindow.webContents.send("window:alwaysOnTopChanged", isAlwaysOnTop);
  }
  sendTrayMenuState();
  return isAlwaysOnTop;
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
  sendTrayMenuState();
}

function openSettings() {
  createSettingsWindow();
}

// ---- Tray menu action dispatcher (generic region toggles) ---- //
function handleTrayMenuAction(action) {
  // Generic region toggle: "toggle-<region>" (e.g. toggle-codex, toggle-deepseek, …)
  if (action.startsWith("toggle-") && action !== "toggle-window" && action !== "toggle-pin") {
    const region = action.slice(7); // strip "toggle-" prefix
    if (regionVisibility.hasOwnProperty(region)) {
      setRegionVisibility(region, !regionVisibility[region]);
      // Don't close — user may want to toggle more
      return;
    }
  }

  switch (action) {
    case "toggle-window":
      toggleWindow();
      closeTrayMenu();
      break;
    case "refresh":
      mainWindow?.webContents.send("quota:refresh");
      closeTrayMenu();
      break;
    case "settings":
      openSettings();
      closeTrayMenu();
      break;
    case "toggle-pin":
      setAlwaysOnTop(!isAlwaysOnTop);
      closeTrayMenu();
      break;
    case "quit":
      app.quit();
      break;
  }
}

app.whenReady().then(() => {
  // Load saved region visibility before creating tray
  loadRegionVisibility();

  createWindow();
  createTray();

  // ---- Quota & Balance ---- //
  const userDataPath = app.getPath("userData");
  ipcMain.handle("quota:get", async () => getQuota());
  ipcMain.handle("deepseek:balance", async () => getDeepSeekBalance(userDataPath));

  // ---- Daily tracking ---- //
  ipcMain.handle("daily:get", () => readDailyData());
  ipcMain.handle("daily:set", (_event, data) => writeDailyData(data));

  // ---- Window controls ---- //
  ipcMain.handle("window:minimize", () => mainWindow?.hide());
  ipcMain.handle("window:close", () => app.quit());
  ipcMain.handle("window:alwaysOnTop:get", () => isAlwaysOnTop);
  ipcMain.handle("window:alwaysOnTop:set", (_event, value) => setAlwaysOnTop(value));
  ipcMain.handle("window:setHeight", (_event, height) => {
    if (!mainWindow) return;
    const newHeight = Math.ceil(height);
    const display = screen.getPrimaryDisplay();
    const { workArea } = display;
    const x = Math.round(workArea.x + workArea.width - 310 - 24);
    const y = Math.round(workArea.y + 24);
    // Atomic setBounds — single call, no getBounds read-back that could pick up stale size
    mainWindow.setBounds({ x, y, width: 310, height: newHeight });
  });

  // ---- Region visibility ---- //
  ipcMain.handle("region:visibility:get", () => regionVisibility);

  // ---- Tray menu ---- //
  ipcMain.handle("traymenu:getState", () => getTrayMenuState());
  ipcMain.handle("traymenu:action", (_event, action) => {
    handleTrayMenuAction(action);
  });
  ipcMain.handle("traymenu:close", () => closeTrayMenu());

  // ---- Settings ---- //
  ipcMain.handle("settings:getKey", () => {
    const cfg = readConfig();
    return cfg.deepseekKey || "";
  });
  ipcMain.handle("settings:setKey", (_event, key) => {
    const cfg = readConfig();
    cfg.deepseekKey = (key || "").trim();
    writeConfig(cfg);
    // Trigger a refresh so the new key takes effect
    mainWindow?.webContents.send("quota:refresh");
    return true;
  });
  ipcMain.handle("settings:close", () => {
    if (settingsWindow) {
      settingsWindow.close();
      settingsWindow = null;
    }
  });

  // ---- External ---- //
  ipcMain.handle("external:openCodex", () => {
    shell.openPath(path.join(process.env.LOCALAPPDATA || "", "OpenAI", "Codex", "bin", "codex.exe"));
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
