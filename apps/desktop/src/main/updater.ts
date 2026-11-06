import { app, BrowserWindow } from "electron";
import { existsSync, mkdirSync, appendFileSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { autoUpdater } from "electron-updater";
import { updateErrorReason, type UpdateStatus } from "@mdword/shared";

export const UPDATE_CHANNEL = "app.updateStatus";

let status: UpdateStatus = { state: "idle" };
let availableVersion = "";
let manualCheck = false;
let started = false;

function broadcast(next: UpdateStatus): void {
  status = next;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(UPDATE_CHANNEL, next);
  }
}

export function currentUpdateStatus(): UpdateStatus {
  return status;
}

/** Desktop only: AppImage, NSIS and signed macOS builds can replace themselves. */
function supported(): boolean {
  return app.isPackaged;
}

const LOG_MAX_BYTES = 64 * 1024;

function updateLogPath(): string {
  return path.join(app.getPath("userData"), "logs", "updater.log");
}

/** Packaged apps have no console, so update problems are written next to the data. */
export function logUpdate(line: string): void {
  try {
    const file = updateLogPath();
    mkdirSync(path.dirname(file), { recursive: true });
    const entry = `${new Date().toISOString()} ${line}\n`;
    if (existsSync(file) && statSync(file).size > LOG_MAX_BYTES) writeFileSync(file, entry);
    else appendFileSync(file, entry);
  } catch {
    /* logging must never break the updater */
  }
}

/** Last lines of the update log, used by Copy diagnostics. */
export function readUpdateLog(lines = 40): string[] {
  try {
    const file = updateLogPath();
    if (!existsSync(file)) return [];
    return readFileSync(file, "utf8").trimEnd().split("\n").slice(-lines);
  } catch {
    return [];
  }
}

function fail(message: string, error: unknown): UpdateStatus {
  const reason = updateErrorReason(error);
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  logUpdate(`error ${reason || "unknown"} | ${detail}`);
  const next: UpdateStatus = {
    state: "error",
    message: reason ? `${message} (${reason}).` : message
  };
  if (manualCheck) broadcast(next);
  else status = next;
  return next;
}

/**
 * Check for a newer version on GitHub Releases. Called once after launch (silent)
 * and on demand from the File tab. Downloads happen in the background; the update
 * installs on restart or on the next quit.
 */
export async function checkForUpdates(manual = false): Promise<UpdateStatus> {
  manualCheck = manual;
  if (!supported()) {
    if (manual) broadcast({ state: "unsupported" });
    return status;
  }
  if (status.state === "downloading" || status.state === "downloaded") return status;

  // A flaky network or a transient GitHub error should not need a second click.
  for (let attempt = 1; attempt <= 2; attempt++) {
    logUpdate(`check start (attempt ${attempt}, ${manual ? "manual" : "startup"})`);
    try {
      await autoUpdater.checkForUpdates();
      logUpdate(`check finished: ${status.state}`);
      return status;
    } catch (error) {
      logUpdate(`check failed (attempt ${attempt})`);
      if (attempt === 2) {
        console.error("Could not check for updates", error);
        return fail("Could not check for updates", error);
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }
  return status;
}

/** Quit, install the downloaded update and relaunch. */
export function installUpdate(): void {
  if (status.state !== "downloaded") return;
  logUpdate(`installing ${availableVersion}`);
  autoUpdater.quitAndInstall(false, true);
}

export function registerAutoUpdater(): void {
  if (started) return;
  started = true;
  if (!supported()) {
    status = { state: "unsupported" };
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // NSIS/dmg/AppImage only: there is no web installer to fall back to.
  autoUpdater.disableWebInstaller = true;
  autoUpdater.logger = {
    info: (message) => logUpdate(`info ${String(message)}`),
    warn: (message) => logUpdate(`warn ${String(message)}`),
    error: (message) => logUpdate(`error ${String(message)}`),
    // electron-updater dumps blockmaps here; keep the log readable.
    debug: () => undefined
  };
  logUpdate(`updater ready: version ${app.getVersion()} on ${process.platform}`);

  autoUpdater.on("checking-for-update", () => broadcast({ state: "checking" }));
  autoUpdater.on("update-available", (info) => {
    availableVersion = info.version;
    logUpdate(`update available: ${info.version}`);
    broadcast({ state: "available", version: info.version });
  });
  autoUpdater.on("update-not-available", () => {
    availableVersion = "";
    logUpdate("no update available");
    broadcast(manualCheck ? { state: "none" } : { state: "idle" });
  });
  autoUpdater.on("download-progress", (progress) => {
    broadcast({
      state: "downloading",
      version: availableVersion,
      percent: Math.min(100, Math.max(0, Math.round(progress.percent)))
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    availableVersion = info.version;
    logUpdate(`update downloaded: ${info.version}`);
    broadcast({ state: "downloaded", version: info.version });
  });
  autoUpdater.on("error", (error) => {
    // A background failure (offline, no release yet) must not interrupt writing,
    // so the banner only appears for a check the user asked for.
    console.error("Update error", error);
    if (manualCheck) fail("Could not check for updates", error);
    else logUpdate("background error not shown in the UI");
  });

  // Give the window time to paint before touching the network.
  setTimeout(() => {
    void checkForUpdates(false);
  }, 8000);
}
