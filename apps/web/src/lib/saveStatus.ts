export function saveStatusText(input: {
  busyKind?: string | null;
  dirty: boolean;
  lastSavedAt: number | null;
}): { text: string; state: "saving" | "unsaved" | "saved" | "clean" } {
  if (input.busyKind === "save") return { text: "Saving…", state: "saving" };
  if (input.dirty) return { text: "Unsaved", state: "unsaved" };
  if (input.lastSavedAt) return { text: "Saved", state: "saved" };
  return { text: "", state: "clean" };
}
