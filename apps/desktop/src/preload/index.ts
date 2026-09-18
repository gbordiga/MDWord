import { contextBridge, ipcRenderer } from "electron";

const api = {
  platform: "electron" as const,
  files: {
    open: () => ipcRenderer.invoke("files.open"),
    openPath: (path: string) => ipcRenderer.invoke("files.read", path).then((content: string) => ({ path, content })),
    save: (input: { path: string; content: string }) => ipcRenderer.invoke("files.save", input),
    saveAs: (content: string, suggestedName?: string) =>
      ipcRenderer.invoke("files.saveAs", { content, suggestedName }),
    openFolder: () => ipcRenderer.invoke("files.openFolder"),
    list: (folder: string) => ipcRenderer.invoke("files.list", folder),
    read: (path: string) => ipcRenderer.invoke("files.read", path),
    readMany: (paths: string[]) => ipcRenderer.invoke("files.readMany", paths),
    write: (path: string, content: string) => ipcRenderer.invoke("files.write", { path, content }),
    exists: (path: string) => ipcRenderer.invoke("files.exists", path),
    rename: (from: string, to: string) => ipcRenderer.invoke("files.rename", { from, to }),
    mkdir: (path: string) => ipcRenderer.invoke("files.mkdir", path),
    copy: (from: string, to: string) => ipcRenderer.invoke("files.copy", { from, to }),
    remove: (path: string) => ipcRenderer.invoke("files.remove", path),
    copyIntoAssets: (sourcePath: string, workspaceRoot: string) =>
      ipcRenderer.invoke("files.copyIntoAssets", { sourcePath, workspaceRoot }),
    canWrite: async () => true
  },
  app: {
    getPreferences: () => ipcRenderer.invoke("app.getPreferences"),
    setPreferences: (prefs: unknown) => ipcRenderer.invoke("app.setPreferences", prefs),
    listRecovery: async () => [],
    writeRecovery: (id: string, content: string, meta: Record<string, unknown>) =>
      ipcRenderer.invoke("app.writeRecovery", { id, content, meta }),
    readRecovery: (id: string) => ipcRenderer.invoke("app.readRecovery", id),
    clearRecovery: (id: string) => ipcRenderer.invoke("app.clearRecovery", id),
    exportDiagnostics: () => ipcRenderer.invoke("app.exportDiagnostics"),
    takeLaunchFile: () => ipcRenderer.invoke("app.takeLaunchFile"),
    onOpenDocument: (handler: (path: string) => void) => {
      const listener = (_event: unknown, filePath: string) => handler(filePath);
      ipcRenderer.on("app.openDocument", listener);
      return () => ipcRenderer.removeListener("app.openDocument", listener);
    },
    onPrintDocument: (handler: () => void) => {
      const listener = () => handler();
      ipcRenderer.on("app.print", listener);
      return () => ipcRenderer.removeListener("app.print", listener);
    }
  },
  export: {
    pdf: (html: string, options: { suggestedName?: string; sourcePath?: string | null } = {}) =>
      ipcRenderer.invoke("export.pdf", {
        html,
        suggestedName: options.suggestedName,
        sourcePath: options.sourcePath
      }),
    print: (
      html: string,
      options: {
        suggestedName?: string;
        pageWidthMicrons?: number;
        pageHeightMicrons?: number;
      } = {}
    ) => ipcRenderer.invoke("export.print", { html, ...options })
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke("shell.openExternal", url)
  }
};

contextBridge.exposeInMainWorld("mdword", Object.freeze(api));
