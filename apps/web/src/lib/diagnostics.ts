import type { DiagnosticsBundle } from "@mdword/shared";
import { getHost } from "./host";
import { capturedErrors, type CapturedError } from "./errorReporting";

export type DiagnosticsReport = DiagnosticsBundle & {
  capturedAt: string;
  /** Bounded list of unexpected failures; never contains document bodies. */
  recentErrors: CapturedError[];
};

export function buildDiagnostics(
  bundle: DiagnosticsBundle,
  errors: CapturedError[],
  capturedAt = new Date()
): DiagnosticsReport {
  return {
    ...bundle,
    capturedAt: capturedAt.toISOString(),
    recentErrors: errors.map((entry) => ({
      at: entry.at,
      source: entry.source,
      kind: entry.kind,
      message: entry.message
    }))
  };
}

/** Copy a support bundle (version, platform, recent errors) to the clipboard. */
export async function copyDiagnostics(): Promise<boolean> {
  try {
    const bundle = await getHost().app.exportDiagnostics();
    const report = buildDiagnostics(bundle, capturedErrors());
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    return true;
  } catch (error) {
    console.error("Could not copy diagnostics", error);
    return false;
  }
}
