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

/**
 * Short, human-readable reason for a failed update check. electron-updater wraps
 * network and HTTP failures in codes like `ERR_UPDATER_LATEST_VERSION_NOT_FOUND`
 * or `ERR_UPDATER_HTTP_ERROR`; the renderer shows this next to a generic message
 * so the failure is not just "could not check".
 */
export function updateErrorReason(error: unknown): string {
  const record = (error ?? {}) as { code?: unknown; message?: unknown };
  const message = typeof record.message === "string" ? record.message : String(record.message ?? "");
  const code = typeof record.code === "string" ? record.code : "";

  // electron-updater uses `HTTP_ERROR_<status>` (for example HTTP_ERROR_404) and
  // `ERR_UPDATER_HTTP_ERROR` for 4xx/5xx responses.
  const httpCode = /^HTTP_ERROR_(\d{3})$/.exec(code)?.[1];
  if (httpCode) return `HTTP ${httpCode}`;
  if (code === "ERR_UPDATER_HTTP_ERROR" || /HttpError/i.test(`${code} ${message}`)) {
    const status = /([45]\d{2})/.exec(message)?.[1] ?? /status(?:Code)?\s*[:=]?\s*(\d{3})/i.exec(message)?.[1];
    return status ? `HTTP ${status}` : "server error";
  }
  if (/ERR_UPDATER_LATEST_VERSION_NOT_FOUND|ERR_UPDATER_NO_PUBLISHED_VERSIONS|Cannot find latest\.yml|CHANNEL_FILE_NOT_FOUND/i.test(`${code} ${message}`)) {
    return "release metadata missing";
  }
  if (/ERR_UPDATER_INVALID_RELEASE_FEED|Cannot parse releases feed/i.test(`${code} ${message}`)) {
    return "release feed unreadable";
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) return "DNS lookup failed";
  if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|ERR_INTERNET_DISCONNECTED|ERR_NETWORK/i.test(message)) {
    return "network unavailable";
  }
  if (/CERT_|certificate/i.test(message)) return "certificate rejected";
  if (/ERR_UPDATER_NETWORK|net::/i.test(`${code} ${message}`)) return "network error";
  if (code.startsWith("ERR_UPDATER_")) {
    return code.replace(/^ERR_UPDATER_/, "").replace(/_/g, " ").toLowerCase();
  }
  return "";
}
