import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { headerFooterFromHtml } from "@mdword/renderer";

const isDev = !app.isPackaged;

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
const allowedRoots = new Set<string>([app.getPath("userData")]);

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "MDWord",
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
    const webRoot = isDev
      ? path.resolve(__dirname, "../../../web/out")
      : path.join(process.resourcesPath, "web");
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/" || rel === "") rel = "/index.html";
    const filePath = path.normalize(path.join(webRoot, rel));
    if (!filePath.startsWith(webRoot)) {
      return new Response("Forbidden", { status: 403 });
    }
    try {
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      const fallback = path.join(webRoot, "index.html");
      return net.fetch(pathToFileURL(fallback).toString());
    }
  });

  mkdirSync(userData("recovery"), { recursive: true });
  mkdirSync(userData("logs"), { recursive: true });
  registerIpc();
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
    const entries = await fs.readdir(root, { withFileTypes: true });
    return Promise.all(
      entries.map(async (entry) => ({
        path: path.join(root, entry.name),
        name: entry.name,
        isDirectory: entry.isDirectory(),
        modifiedMs: (await fs.stat(path.join(root, entry.name))).mtimeMs
      }))
    );
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
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, offscreen: true }
    });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(parsed.html)}`);
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      displayHeaderFooter: true,
      ...headerFooterFromHtml(parsed.html)
    });
    win.close();
    const save = await dialog.showSaveDialog({
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      defaultPath: "document.pdf"
    });
    if (!save.canceled && save.filePath) await fs.writeFile(save.filePath, pdf);
    return pdf;
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
