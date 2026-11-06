export type CapturedError = {
  /** Epoch milliseconds. */
  at: number;
  /** Where it came from: "window", "unhandledrejection" or a feature name. */
  source: string;
  /** Error constructor name, when available. */
  kind: string;
  /** Short, single-line description. Never a stack trace or a document body. */
  message: string;
};

const MAX_CAPTURED = 20;
const MAX_MESSAGE = 240;
const captured: CapturedError[] = [];

/**
 * Failures that happen during normal use: the user cancelled a picker, a capture
 * was aborted, the browser emitted a ResizeObserver loop warning. They must not
 * interrupt the editor with a banner.
 */
export function isBenignError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || name === "NotAllowedError") return true;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /ResizeObserver loop/i.test(message) || /aborted a request/i.test(message);
}

export function describeError(error: unknown): { kind: string; message: string } {
  if (error instanceof Error) {
    return {
      kind: error.name || "Error",
      message: oneLine(error.message || error.name || "Unknown error")
    };
  }
  if (typeof error === "string") return { kind: "Error", message: oneLine(error) };
  if (error && typeof error === "object") {
    const record = error as { name?: unknown; message?: unknown };
    const message = typeof record.message === "string" ? record.message : "";
    const kind = typeof record.name === "string" ? record.name : "Error";
    return { kind, message: oneLine(message || kind) };
  }
  return { kind: "Error", message: oneLine(String(error ?? "Unknown error")) };
}

function oneLine(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  if (!flat) return "Unknown error";
  return flat.length > MAX_MESSAGE ? `${flat.slice(0, MAX_MESSAGE)}…` : flat;
}

/** Keep the newest errors only: enough to diagnose the last session, bounded memory. */
export function recordCapturedError(
  source: string,
  error: unknown,
  now = Date.now()
): CapturedError | null {
  if (isBenignError(error)) return null;
  const { kind, message } = describeError(error);
  const entry: CapturedError = { at: now, source, kind, message };
  captured.push(entry);
  if (captured.length > MAX_CAPTURED) captured.splice(0, captured.length - MAX_CAPTURED);
  return entry;
}

export function capturedErrors(): CapturedError[] {
  return captured.map((entry) => ({ ...entry }));
}

export function resetCapturedErrors(): void {
  captured.length = 0;
}

type ErrorTarget = {
  addEventListener(type: string, listener: (event: never) => void): void;
  removeEventListener(type: string, listener: (event: never) => void): void;
};

function defaultErrorTarget(): ErrorTarget | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as ErrorTarget);
}

/**
 * Report unexpected failures instead of leaving them in the devtools console.
 * Benign failures are ignored; everything else is logged and handed to the
 * caller (the app turns it into a banner and keeps it for diagnostics).
 */
export function installErrorCapture(
  onUnexpected: (entry: CapturedError) => void,
  target: ErrorTarget | undefined = defaultErrorTarget()
): () => void {
  if (!target) return () => undefined;

  const handle = (source: string, error: unknown) => {
    if (isBenignError(error)) return;
    const entry = recordCapturedError(source, error);
    if (!entry) return;
    console.error(`Unexpected error (${source})`, error);
    onUnexpected(entry);
  };

  const onError = (event: ErrorEvent) => handle("window", event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => handle("unhandledrejection", event.reason);

  target.addEventListener("error", onError as (event: never) => void);
  target.addEventListener("unhandledrejection", onRejection as (event: never) => void);
  return () => {
    target.removeEventListener("error", onError as (event: never) => void);
    target.removeEventListener("unhandledrejection", onRejection as (event: never) => void);
  };
}
