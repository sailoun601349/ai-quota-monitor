const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, screen } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { getQuota } = require("./quota-service");
const { getDeepSeekBalance } = require("./deepseek-service");

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

let mainWindow;
let tray;
let isAlwaysOnTop = true;

function createWindow() {
  const iconPath = path.join(__dirname, "../../assets/icon.ico");
  mainWindow = new BrowserWindow({
    width: 340,
    height: 155,
    minWidth: 340,
    minHeight: 155,
    icon: iconPath,
    frame: false,
    transparent: true,
    resizable: false,
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
    placeWindowTopRight();
  });
}

function placeWindowTopRight() {
  if (!mainWindow) return;
  const display = screen.getPrimaryDisplay();
  const { width, height } = mainWindow.getBounds();
  const { workArea } = display;
  mainWindow.setBounds({
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + 24,
    width,
    height
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "../../assets/icon.ico");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("Codex Quota Widget");
  rebuildTrayMenu();
  tray.on("click", toggleWindow);
}

function rebuildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示/隐藏", click: toggleWindow },
      { label: "刷新额度", click: () => mainWindow?.webContents.send("quota:refresh") },
      {
        label: isAlwaysOnTop ? "取消置顶" : "置顶",
        click: () => setAlwaysOnTop(!isAlwaysOnTop)
      },
      { type: "separator" },
      { label: "退出", click: () => app.quit() }
    ])
  );
}

function setAlwaysOnTop(value) {
  isAlwaysOnTop = Boolean(value);
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(isAlwaysOnTop);
    mainWindow.webContents.send("window:alwaysOnTopChanged", isAlwaysOnTop);
  }
  rebuildTrayMenu();
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
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  ipcMain.handle("quota:get", async () => getQuota());
  ipcMain.handle("deepseek:balance", async () => getDeepSeekBalance());
  ipcMain.handle("daily:get", () => readDailyData());
  ipcMain.handle("daily:set", (_event, data) => writeDailyData(data));
  ipcMain.handle("window:minimize", () => mainWindow?.hide());
  ipcMain.handle("window:close", () => app.quit());
  ipcMain.handle("window:alwaysOnTop:get", () => isAlwaysOnTop);
  ipcMain.handle("window:alwaysOnTop:set", (_event, value) => setAlwaysOnTop(value));
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
