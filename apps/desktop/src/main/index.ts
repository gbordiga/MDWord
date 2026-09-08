import { app, BrowserWindow, ipcMain, dialog, shell, protocol, Menu, session } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { z } from "zod";
import {
  MAX_WORKSPACE_LIST_DEPTH,
  MAX_WORKSPACE_LIST_ENTRIES,
  shouldSkipWorkspaceDir,
  shouldSkipWorkspaceFile
} from "@mdword/shared";

const isDev = !app.isPackaged;
let pendingPrintHtml: string | null = null;

function staticRoots(): string[] {
  if (isDev) {
    return [
      path.resolve(__dirname, "../../../web/out"),
      path.resolve(__dirname, "../../../web/public"),
      path.join(__dirname, "../../resources/web")
    ];
  }
  return [
    path.join(process.resourcesPath, "web"),
    path.join(app.getAppPath(), "resources", "web"),
    path.join(__dirname, "../../resources/web")
  ];
}

const STATIC_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

function windowIconPath(): string | undefined {
  const ico = path.join(__dirname, "../../resources/icon.ico");
  const png = path.join(__dirname, "../../resources/icon.png");
  if (process.platform === "win32" && existsSync(ico)) return ico;
  if (existsSync(png)) return png;
  return undefined;
}

protocol.registerSchemesAsPrivileged([
  { scheme: "mdword", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

function userData(...parts: string[]): string {
  return path.join(app.getPath("userData"), ...parts);
}

function assertSafePath(input: string, roots: string[]): string {
  const resolved = path.resolve(input);
  const ok = roots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
  if (!ok) throw new Error("Path is outside the allowed roots");
  return resolved;
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  const fh = await fs.open(tmp, "w");
  try {
    await fh.writeFile(content, "utf8");
    await fh.sync();
  } finally {
    await fh.close();
  }
  await fs.rename(tmp, filePath);
}

let mainWindow: BrowserWindow | null = null;
let pendingOpen: string | null = null;
const allowedRoots = new Set<string>([app.getPath("userData")]);
const MARKDOWN_EXT = /\.(md|markdown|mdown|mkd)$/i;

function isMarkdownPath(filePath: string): boolean {
  return MARKDOWN_EXT.test(filePath);
}

function markdownPathsFromArgv(argv: string[]): string[] {
  return argv.filter((arg, index) => {
    if (index === 0) return false;
    if (!arg || arg.startsWith("-")) return false;
    if (arg === ".") return false;
    return isMarkdownPath(arg);
  });
}

function queueOpenDocument(filePath: string): void {
  const resolved = path.resolve(filePath);
  if (!isMarkdownPath(resolved)) return;
  allowedRoots.add(path.dirname(resolved));
  pendingOpen = resolved;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.getURL()) {
    mainWindow.webContents.send("app.openDocument", resolved);
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  queueOpenDocument(filePath);
});

if (process.platform === "win32") {
  app.setAppUserModelId("app.mdword.desktop");
}

const gotInstanceLock = app.requestSingleInstanceLock();
if (!gotInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    for (const filePath of markdownPathsFromArgv(argv)) queueOpenDocument(filePath);
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow(): void {
  const icon = windowIconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "MDWord",
    ...(icon ? { icon } : {}),
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    ...(process.platform === "darwin"
      ? {}
      : {
          titleBarOverlay: {
            color: "#ffffff",
            symbolColor: "#1c1f24",
            height: 40
          }
        }),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url) || url.startsWith("mailto:")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = url.startsWith("mdword:") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
    if (!allowed) event.preventDefault();
  });

  if (isDev) {
    void mainWindow.loadURL("http://127.0.0.1:3000");
  } else {
    void mainWindow.loadURL("mdword://app/index.html");
  }
  mainWindow.once("ready-to-show", () => mainWindow?.show());
}

app.whenReady().then(() => {
  protocol.handle("mdword", async (request) => {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (rel === "" || rel === ".") rel = "index.html";
    if (rel === "__print.html") {
      if (!pendingPrintHtml) return new Response("No print document", { status: 404 });
      return new Response(pendingPrintHtml, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    const serve = async (target: string) => {
      const data = await fs.readFile(target);
      const type = STATIC_TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream";
      return new Response(data, { headers: { "content-type": type } });
    };
    for (const webRoot of staticRoots()) {
      const filePath = path.normalize(path.join(webRoot, rel));
      if (filePath !== webRoot && !filePath.startsWith(webRoot + path.sep)) continue;
      if (!existsSync(filePath)) continue;
      try {
        return await serve(filePath);
      } catch {
        /* try next root */
      }
    }
    if (rel === "index.html" || rel.endsWith(".html")) {
      for (const webRoot of staticRoots()) {
        const fallback = path.join(webRoot, "index.html");
        if (existsSync(fallback)) return serve(fallback);
      }
    }
    return new Response(`Missing ${rel}`, { status: 404 });
  });

  const sess = session.defaultSession;
  sess.setPermissionCheckHandler((_contents, permission) => permission === "fileSystem");
  sess.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === "fileSystem");
  });

  Menu.setApplicationMenu(null);
  mkdirSync(userData("recovery"), { recursive: true });
  mkdirSync(userData("logs"), { recursive: true });
  registerIpc();
  for (const filePath of markdownPathsFromArgv(process.argv)) queueOpenDocument(filePath);
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function registerIpc(): void {
  const filesOpen = z.object({});
  ipcMain.handle("files.open", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    allowedRoots.add(path.dirname(filePath));
    const content = await fs.readFile(filePath, "utf8");
    return { path: filePath, content };
  });

  ipcMain.handle("files.save", async (_e, payload: unknown) => {
    const parsed = z.object({ path: z.string(), content: z.string() }).parse(payload);
    const filePath = assertSafePath(parsed.path, [...allowedRoots]);
    await atomicWrite(filePath, parsed.content);
  });

  ipcMain.handle("files.saveAs", async (_e, payload: unknown) => {
    const parsed = z.object({ content: z.string(), suggestedName: z.string().optional() }).parse(payload);
    const result = await dialog.showSaveDialog({
      defaultPath: parsed.suggestedName,
      filters: [{ name: "Markdown", extensions: ["md"] }]
    });
    if (result.canceled || !result.filePath) return null;
    allowedRoots.add(path.dirname(result.filePath));
    await atomicWrite(result.filePath, parsed.content);
    return result.filePath;
  });

  ipcMain.handle("files.openFolder", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths[0]) return null;
    const root = result.filePaths[0];
    allowedRoots.add(root);
    return root;
  });

  ipcMain.handle("files.list", async (_e, folder: unknown) => {
    const root = assertSafePath(z.string().parse(folder), [...allowedRoots]);
    const out: { path: string; name: string; isDirectory: boolean; modifiedMs?: number }[] = [];

    async function walk(dir: string, depth: number): Promise<void> {
      if (depth > MAX_WORKSPACE_LIST_DEPTH || out.length >= MAX_WORKSPACE_LIST_ENTRIES) return;
      let entries: import("node:fs").Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (out.length >= MAX_WORKSPACE_LIST_ENTRIES) return;
        if (shouldSkipWorkspaceFile(entry.name)) continue;
        if (entry.isSymbolicLink()) continue;
        const isDirectory = entry.isDirectory();
        if (isDirectory && shouldSkipWorkspaceDir(entry.name)) continue;
        const full = path.join(dir, entry.name);
        let modifiedMs: number | undefined;
        try {
          modifiedMs = (await fs.stat(full)).mtimeMs;
        } catch {
          continue;
        }
        out.push({ path: full, name: entry.name, isDirectory, modifiedMs });
        if (isDirectory) await walk(full, depth + 1);
      }
    }

    await walk(root, 0);
    return out;
  });

  ipcMain.handle("files.read", async (_e, filePath: unknown) => {
    const resolved = assertSafePath(z.string().parse(filePath), [...allowedRoots]);
    return fs.readFile(resolved, "utf8");
  });

  ipcMain.handle("files.write", async (_e, payload: unknown) => {
    const parsed = z.object({ path: z.string(), content: z.string() }).parse(payload);
    await atomicWrite(assertSafePath(parsed.path, [...allowedRoots]), parsed.content);
  });

  ipcMain.handle("files.exists", async (_e, filePath: unknown) => {
    try {
      await fs.access(assertSafePath(z.string().parse(filePath), [...allowedRoots]));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("files.rename", async (_e, payload: unknown) => {
    const parsed = z.object({ from: z.string(), to: z.string() }).parse(payload);
    const from = assertSafePath(parsed.from, [...allowedRoots]);
    const to = assertSafePath(parsed.to, [...allowedRoots]);
    await fs.rename(from, to);
  });

  ipcMain.handle("files.copyIntoAssets", async (_e, payload: unknown) => {
    const parsed = z.object({ sourcePath: z.string(), workspaceRoot: z.string() }).parse(payload);
    const root = assertSafePath(parsed.workspaceRoot, [...allowedRoots]);
    const source = path.resolve(parsed.sourcePath);
    const assets = path.join(root, "images");
    await fs.mkdir(assets, { recursive: true });
    const dest = path.join(assets, path.basename(source));
    await fs.copyFile(source, dest);
    return path.relative(root, dest).replace(/\\/g, "/");
  });

  ipcMain.handle("app.getPreferences", async () => {
    try {
      return JSON.parse(await fs.readFile(userData("preferences.json"), "utf8"));
    } catch {
      return null;
    }
  });

  ipcMain.handle("app.setPreferences", async (_e, prefs: unknown) => {
    await atomicWrite(userData("preferences.json"), JSON.stringify(prefs, null, 2));
  });

  ipcMain.handle("app.writeRecovery", async (_e, payload: unknown) => {
    const parsed = z.object({ id: z.string(), content: z.string(), meta: z.record(z.unknown()) }).parse(payload);
    const safeId = parsed.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    await atomicWrite(userData("recovery", `${safeId}.md`), parsed.content);
    await atomicWrite(userData("recovery", `${safeId}.json`), JSON.stringify(parsed.meta));
  });

  ipcMain.handle("app.readRecovery", async (_e, id: unknown) => {
    const safeId = z.string().parse(id).replace(/[^a-zA-Z0-9_-]/g, "_");
    try {
      return await fs.readFile(userData("recovery", `${safeId}.md`), "utf8");
    } catch {
      return null;
    }
  });

  ipcMain.handle("app.clearRecovery", async (_e, id: unknown) => {
    const safeId = z.string().parse(id).replace(/[^a-zA-Z0-9_-]/g, "_");
    await fs.rm(userData("recovery", `${safeId}.md`), { force: true });
    await fs.rm(userData("recovery", `${safeId}.json`), { force: true });
  });

  ipcMain.handle("app.takeLaunchFile", async () => {
    const next = pendingOpen;
    pendingOpen = null;
    return next;
  });

  ipcMain.handle("app.exportDiagnostics", async () => {
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      platform: process.platform,
      logs: [`recoveryDir=${userData("recovery")}`]
    };
  });

  ipcMain.handle("export.pdf", async (_e, payload: unknown) => {
    const parsed = z.object({ html: z.string() }).parse(payload);
    pendingPrintHtml = parsed.html;
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, offscreen: true }
    });
    try {
      await win.loadURL("mdword://app/__print.html");
      await win.webContents.executeJavaScript(`new Promise((resolve) => {
        const start = Date.now();
        const tick = () => {
          if (document.documentElement.dataset.pagedReady === "1" || Date.now() - start > 10000) {
            resolve(true);
            return;
          }
          setTimeout(tick, 40);
        };
        if (!document.querySelector("script[src*=\\"paged\\"]")) resolve(true);
        else tick();
      })`);
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false
      });
      const save = await dialog.showSaveDialog({
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        defaultPath: "document.pdf"
      });
      if (!save.canceled && save.filePath) await fs.writeFile(save.filePath, pdf);
      return pdf;
    } finally {
      pendingPrintHtml = null;
      if (!win.isDestroyed()) win.close();
    }
  });

  ipcMain.handle("shell.openExternal", async (_e, url: unknown) => {
    const parsed = z.string().url().parse(url);
    if (!/^https?:/i.test(parsed) && !parsed.startsWith("mailto:")) return;
    await shell.openExternal(parsed);
  });

  void filesOpen;
  void existsSync;
  void createWriteStream;
}
