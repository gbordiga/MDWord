let provider: (() => string) | null = null;

/** The editor registers how to read its current selection; the assistant calls it on send. */
export function setSelectionProvider(next: (() => string) | null): void {
  provider = next;
}

export function getSelectionText(): string {
  try {
    return provider?.() ?? "";
  } catch {
    return "";
  }
}
