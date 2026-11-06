/**
 * State of the desktop auto-updater, shared by the Electron main process, the
 * preload bridge and the renderer. The web and mobile builds never emit these.
 */
export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  /** An update is known and the download has started. */
  | { state: "available"; version: string }
  | { state: "downloading"; version: string; percent: number }
  /** Downloaded and waiting for a restart (or for the app to quit). */
  | { state: "downloaded"; version: string }
  /** Checked on request: this build is the latest. */
  | { state: "none" }
  /** Development build or a platform that cannot self-update. */
  | { state: "unsupported" }
  | { state: "error"; message: string };

/** True when restarting the app installs the downloaded update. */
export function updateReady(status: UpdateStatus | null | undefined): boolean {
  return status?.state === "downloaded";
}
