import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import type { UpdateStatus } from "@mdword/shared";

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
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error("Could not check for updates", error);
    if (manual) broadcast({ state: "error", message: "Could not check for updates." });
  }
  return status;
}

/** Quit, install the downloaded update and relaunch. */
export function installUpdate(): void {
  if (status.state !== "downloaded") return;
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
  autoUpdater.logger = null;

  autoUpdater.on("checking-for-update", () => broadcast({ state: "checking" }));
  autoUpdater.on("update-available", (info) => {
    availableVersion = info.version;
    broadcast({ state: "available", version: info.version });
  });
  autoUpdater.on("update-not-available", () => {
    availableVersion = "";
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
    broadcast({ state: "downloaded", version: info.version });
  });
  autoUpdater.on("error", (error) => {
    console.error("Update error", error);
    // A background failure (offline, no release yet) must not interrupt writing.
    broadcast(
      manualCheck ? { state: "error", message: "Could not check for updates." } : { state: "idle" }
    );
  });

  // Give the window time to paint before touching the network.
  setTimeout(() => {
    void checkForUpdates(false);
  }, 8000);
}
