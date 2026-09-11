export type ViewMode = "document" | "source" | "split";

function errorName(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  return String((error as { name?: unknown }).name ?? "");
}

/** File/directory picker cancel (and the browser blocking a second dialog). */
export function isUserAbort(error: unknown): boolean {
  const name = errorName(error);
  return name === "AbortError" || name === "NotAllowedError";
}

/** Write/permission denial — not the same as the user closing a picker. */
export function isNotAllowedError(error: unknown): boolean {
  return errorName(error) === "NotAllowedError";
}

export interface HostFileStat {
  path: string;
  name: string;
  isDirectory: boolean;
  modifiedMs?: number;
}

export interface OpenDocumentResult {
  path: string;
  content: string;
}

export interface SaveDocumentInput {
  path: string;
  content: string;
}

export interface UserPreferences {
  defaultPageSize: "A4" | "A3" | "A5" | "Letter" | "Legal";
  defaultMargins: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  defaultFont: string;
  defaultFontSize: string;
  theme: "system" | "light" | "dark";
  zoom: number;
  lastFolder?: string;
  recentFiles: string[];
}

export const defaultPreferences: UserPreferences = {
  defaultPageSize: "A4",
  defaultMargins: {
    top: "20mm",
    right: "20mm",
    bottom: "20mm",
    left: "25mm"
  },
  defaultFont: "Aptos",
  defaultFontSize: "11pt",
  theme: "system",
  zoom: 1,
  recentFiles: []
};

export interface DiagnosticsBundle {
  appVersion: string;
  electronVersion?: string;
  platform: string;
  logs: string[];
}

export interface HostApi {
  platform: "electron" | "web" | "capacitor";
  files: {
    open(): Promise<OpenDocumentResult | null>;
    openPath(path: string): Promise<OpenDocumentResult>;
    save(input: SaveDocumentInput): Promise<void>;
    saveAs(content: string, suggestedName?: string): Promise<string | null>;
    openFolder(): Promise<string | null>;
    list(folder: string): Promise<HostFileStat[]>;
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    rename(from: string, to: string): Promise<void>;
    mkdir(path: string): Promise<void>;
    copy(from: string, to: string): Promise<void>;
    remove(path: string): Promise<void>;
    copyIntoAssets(sourcePath: string, workspaceRoot: string): Promise<string>;
    /** True when save() can write without prompting or downloading. */
    canWrite(path: string): Promise<boolean>;
    /** Ask for write permission while a click/keypress is still valid (web FS Access). */
    prepareWrite?(path?: string): Promise<void>;
    watch?(
      path: string,
      onChange: (info: { path: string; kind: "change" | "delete" }) => void
    ): () => void;
  };
  app: {
    getPreferences(): Promise<UserPreferences>;
    setPreferences(prefs: UserPreferences): Promise<void>;
    listRecovery(): Promise<{ id: string; title: string; updatedMs: number }[]>;
    writeRecovery(id: string, content: string, meta: Record<string, unknown>): Promise<void>;
    readRecovery(id: string): Promise<string | null>;
    clearRecovery(id: string): Promise<void>;
    exportDiagnostics(): Promise<DiagnosticsBundle>;
    /** Path passed by the OS ("Open with" / file association). Electron only. */
    takeLaunchFile(): Promise<string | null>;
    onOpenDocument(handler: (path: string) => void): () => void;
  };
  export: {
    pdf(html: string, options: Record<string, unknown>): Promise<Uint8Array>;
    print(html: string): Promise<void>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
  };
}
