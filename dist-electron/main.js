import { app as l, BrowserWindow as d, ipcMain as a, systemPreferences as w, desktopCapturer as f } from "electron";
import { fileURLToPath as g } from "node:url";
import n from "node:path";
const p = n.dirname(g(import.meta.url));
process.env.APP_ROOT = n.join(p, "..");
const h = process.env.VITE_DEV_SERVER_URL, R = n.join(process.env.APP_ROOT, "dist-electron"), m = n.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = h ? n.join(process.env.APP_ROOT, "public") : m;
let o, e, i;
function u() {
  o = new d({
    width: 500,
    height: 600,
    minHeight: 600,
    minWidth: 300,
    hasShadow: !1,
    frame: !1,
    transparent: !0,
    alwaysOnTop: !0,
    focusable: !0,
    icon: n.join(process.env.VITE_PUBLIC, "opal-logo.svg"),
    webPreferences: {
      nodeIntegration: !1,
      contextIsolation: !0,
      devTools: !0,
      preload: n.join(p, "preload.mjs")
    }
  }), e = new d({
    width: 400,
    minHeight: 70,
    minWidth: 300,
    maxWidth: 400,
    frame: !1,
    transparent: !0,
    alwaysOnTop: !0,
    focusable: !1,
    icon: n.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      nodeIntegration: !1,
      contextIsolation: !0,
      devTools: !0,
      preload: n.join(p, "preload.mjs")
    }
  }), i = new d({
    width: 200,
    height: 200,
    minHeight: 200,
    maxHeight: 200,
    minWidth: 200,
    maxWidth: 200,
    frame: !1,
    transparent: !0,
    alwaysOnTop: !0,
    hasShadow: !0,
    focusable: !0,
    icon: n.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      nodeIntegration: !1,
      contextIsolation: !0,
      devTools: !0,
      preload: n.join(p, "preload.mjs")
    }
  }), o.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 }), o.setAlwaysOnTop(!0, "screen-saver", 1), e.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 }), e.setAlwaysOnTop(!0, "screen-saver", 1), i.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 }), i.setAlwaysOnTop(!0, "screen-saver", 1), o.webContents.on("did-finish-load", () => {
    o == null || o.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send(
      "main-process-message",
      (/* @__PURE__ */ new Date()).toLocaleString()
    );
  }), h ? (o.loadURL(h), e.loadURL("http://localhost:5173/studio.html"), i.loadURL("http://localhost:5173/webcam.html")) : (o.loadURL(`file://${n.join(m, "index.html")}`), e.loadURL(`file://${n.join(m, "studio.html")}`), i.loadURL(`file://${n.join(m, "webcam.html")}`));
}
l.on("window-all-closed", () => {
  process.platform !== "darwin" && (l.quit(), o = null, e = null, i = null);
});
l.on("activate", () => {
  d.getAllWindows().length === 0 && u();
});
l.whenReady().then(() => {
  a.handle("getSources", async () => {
    try {
      if (console.log("getSources called from renderer"), process.platform === "darwin") {
        const t = w.getMediaAccessStatus("screen");
      }
      const s = await f.getSources({
        thumbnailSize: { height: 100, width: 150 },
        fetchWindowIcons: !0,
        types: ["screen", "window"]
      });
      return console.log("Found sources:", s.length), s.forEach((t, c) => {
        console.log(`Source ${c}:`, {
          id: t.id,
          name: t.name,
          type: t.id.startsWith("screen:") ? "screen" : "window"
        });
      }), s.map((t, c) => ({
        id: t.id,
        name: t.id.startsWith("screen:") ? `Screen ${c + 1}${t.name && t.name !== "" ? ` (${t.name})` : ""}` : t.name || `Window ${c + 1}`,
        type: t.id.startsWith("screen:") ? "screen" : "window"
      }));
    } catch (s) {
      return console.error("Error in getSources:", s), [];
    }
  }), a.on("closeApp", () => {
    process.platform !== "darwin" && l.quit();
  }), a.on("media-sources", (s, r) => {
    e == null || e.webContents.send("profile-received", r);
  }), a.on("resize-studio", (s, r) => {
    r.shrink ? e == null || e.setSize(400, 100) : e == null || e.setSize(400, 250);
  }), a.on("hide-plugin", (s, r) => {
    o == null || o.webContents.send("hide-plugin", r);
  }), u();
});
export {
  R as MAIN_DIST,
  m as RENDERER_DIST,
  h as VITE_DEV_SERVER_URL
};
