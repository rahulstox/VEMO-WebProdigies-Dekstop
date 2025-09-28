import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  systemPreferences,
} from "electron";
import { fileURLToPath } from "node:url";
import { autoUpdater } from "electron-updater";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
let studio: BrowserWindow | null;
let floatingWebCam: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    width: 500,
    height: 600,
    minHeight: 600,
    minWidth: 300,
    hasShadow: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: true,
    icon: path.join(process.env.VITE_PUBLIC, "opal-logo.svg"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  studio = new BrowserWindow({
    width: 400,
    minHeight: 70,
    minWidth: 300,
    maxWidth: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  floatingWebCam = new BrowserWindow({
    width: 200,
    height: 200,
    minHeight: 200,
    maxHeight: 200,
    minWidth: 200,
    maxWidth: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    focusable: true,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "screen-saver", 1);
  studio.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  studio.setAlwaysOnTop(true, "screen-saver", 1);
  floatingWebCam.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingWebCam.setAlwaysOnTop(true, "screen-saver", 1);

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  studio.webContents.on("did-finish-load", () => {
    studio?.webContents.send(
      "main-process-message",
      new Date().toLocaleString()
    );
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    studio.loadURL(`${import.meta.env.VITE_APP_URL}/studio.html`);
    floatingWebCam.loadURL(`${import.meta.env.VITE_APP_URL}/webcam.html`);
  } else {
    win.loadURL(`file://${path.join(RENDERER_DIST, "index.html")}`);
    studio.loadURL(`file://${path.join(RENDERER_DIST, "studio.html")}`);
    floatingWebCam.loadURL(`file://${path.join(RENDERER_DIST, "webcam.html")}`);
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
    studio = null;
    floatingWebCam = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// App ready hone ke baad hi saare listeners register honge
app.whenReady().then(() => {
  // Single, correct handler for "getSources"
  ipcMain.handle("getSources", async () => {
    try {
      console.log("getSources called from renderer");

      if (process.platform === "darwin") {
        const status = systemPreferences.getMediaAccessStatus("screen");
        if (status !== "granted") {
        //   const success = await systemPreferences.askForMediaAccess("screen");
        //   if (!success) {
        //     console.log("Screen recording permission denied by user.");
        //     return {
        //       error: "PERMISSION_DENIED",
        //       message: "Permission was denied.",
        //     };
        //   }
         }
      }

      const sources = await desktopCapturer.getSources({
        thumbnailSize: { height: 100, width: 150 },
        fetchWindowIcons: true,
        types: ["screen", "window"],
      });

      console.log("Found sources:", sources.length);
      sources.forEach((source, index) => {
        console.log(`Source ${index}:`, {
          id: source.id,
          name: source.name,
          type: source.id.startsWith("screen:") ? "screen" : "window",
        });
      });

      // Return serializable minimal data plus a friendly name
      const sanitized = sources.map((s, idx) => ({
        id: s.id,
        name: s.id.startsWith("screen:")
          ? `Screen ${idx + 1}${s.name && s.name !== "" ? ` (${s.name})` : ""}`
          : s.name || `Window ${idx + 1}`,
        type: s.id.startsWith("screen:") ? "screen" : "window",
      }));
      return sanitized;
    } catch (error) {
      console.error("Error in getSources:", error);
      return [];
    }
  });

  // Other handlers
  ipcMain.on("closeApp", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  ipcMain.on("media-sources", (_, payload) => {
    studio?.webContents.send("profile-received", payload);
  });

  ipcMain.on("resize-studio", (_, payload) => {
    if (payload.shrink) {
      studio?.setSize(400, 100);
    } else {
      studio?.setSize(400, 250);
    }
  });

  ipcMain.on("hide-plugin", (_, payload) => {
    win?.webContents.send("hide-plugin", payload);
  });

  createWindow();
   autoUpdater.checkForUpdatesAndNotify();
});
