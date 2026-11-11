import type { ShellHostApi } from "./shell";
import type { UpdateStatus } from "./updates";

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
  /** Project folders the app itself opened. Desktop reopens only paths from this list. */
  recentProjects?: string[];
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

export interface AssistantKeyStatus {
  hasKey: boolean;
  /** Masked form for display, never the key itself. */
  masked: string | null;
}

/**
 * Credentials and history for the AI assistant. The key is only ever used
 * inside `fetch`, so a host can keep it out of the renderer entirely
 * (desktop does). Absent on hosts where the assistant is not available.
 */
export interface AssistantHostApi {
  /** "browser" = page storage; "system" = OS-encrypted store in the main process. */
  keyStorage: "browser" | "system";
  keyStatus(): Promise<AssistantKeyStatus>;
  saveKey(key: string): Promise<void>;
  clearKey(): Promise<void>;
  /** Request to openrouter.ai with the saved key attached. Other origins are refused. */
  fetch(url: string, init?: RequestInit): Promise<Response>;
  /** Desktop: run the whole OpenRouter sign-in outside the renderer. */
  signIn?(): Promise<{ ok: boolean; cancelled?: boolean }>;
  cancelSignIn?(): Promise<void>;
  /** Chat history per workspace, stored outside the project. */
  history: {
    load(workspaceKey: string): Promise<string | null>;
    save(workspaceKey: string, json: string): Promise<void>;
    clear(workspaceKey: string): Promise<void>;
  };
  /** Desktop only. Absent elsewhere, so the model is never offered `runCommand` (ADR-011). */
  shell?: ShellHostApi;
}

export interface HostApi {
  platform: "electron" | "web" | "capacitor";
  files: {
    open(): Promise<OpenDocumentResult | null>;
    openPath(path: string): Promise<OpenDocumentResult>;
    save(input: SaveDocumentInput): Promise<void>;
    saveAs(content: string, suggestedName?: string): Promise<string | null>;
    /** Reopen a path the app itself listed in the recent files. Desktop only. */
    openRecent?(path: string): Promise<OpenDocumentResult>;
    openFolder(): Promise<string | null>;
    /** Reopen a project path the app itself stored. Desktop only. */
    openRecentFolder?(path: string): Promise<string>;
    list(folder: string): Promise<HostFileStat[]>;
    read(path: string): Promise<string>;
    /** Raw bytes of a file inside an allowed root. Used to extract office, PDF, and HTML text. */
    readBytes(path: string): Promise<Uint8Array>;
    /** Read a workspace file as a data URL (images). Missing files should reject. */
    readDataUrl?(path: string): Promise<string>;
    /** Batch read for workspace indexing. Missing/unreadable paths are omitted. */
    readMany?(paths: string[]): Promise<{ path: string; content: string }[]>;
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
    onPrintDocument?(handler: () => void): () => void;
    /** Desktop: the main process is asking whether this window may close. */
    onRequestClose?(handler: () => void): () => void;
    /** Desktop: the close guard is listening, so a blocked close can be delivered. */
    notifyCloseGuardReady?(): void;
    /** Desktop: the user saved or discarded, so the window may close. */
    allowClose?(): void;
    /** Desktop: the user cancelled, so a quit in progress must not continue. */
    cancelClose?(): void;
    /**
     * Desktop auto-update through GitHub Releases. Missing on web and mobile.
     * `check` is silent on startup and reports `none`/`error` only when asked.
     */
    updates?: {
      status(): Promise<UpdateStatus>;
      check(): Promise<UpdateStatus>;
      install(): Promise<void>;
      onStatus(handler: (status: UpdateStatus) => void): () => void;
    };
    /** Desktop: whether MDWord is the default Markdown handler. */
    getMarkdownAssociation?(): Promise<{
      supported: boolean;
      isDefault: boolean;
      missing?: string[];
      platform?: "win32" | "darwin" | "linux" | "other";
    }>;
    /** Register MDWord for Markdown files and open the OS default-app settings. */
    setMarkdownAssociation?(): Promise<{
      supported: boolean;
      isDefault: boolean;
      missing?: string[];
      platform?: "win32" | "darwin" | "linux" | "other";
    }>;
  };
  export: {
    pdf(
      html: string,
      options: { suggestedName?: string; sourcePath?: string | null }
    ): Promise<Uint8Array>;
    print(
      html: string,
      options?: {
        suggestedName?: string;
        pageWidthMicrons?: number;
        pageHeightMicrons?: number;
      }
    ): Promise<void>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
  };
  assistant?: AssistantHostApi;
}
