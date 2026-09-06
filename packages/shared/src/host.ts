export type ViewMode = "document" | "source" | "split";

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
  platform: "electron" | "web";
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
    copyIntoAssets(sourcePath: string, workspaceRoot: string): Promise<string>;
    /** True when save() can write without prompting or downloading. */
    canWrite(path: string): Promise<boolean>;
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
  };
  export: {
    pdf(html: string, options: Record<string, unknown>): Promise<Uint8Array>;
    print(html: string): Promise<void>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
  };
}
