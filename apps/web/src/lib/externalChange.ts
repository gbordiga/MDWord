export type DiskSnapshot = string | null;

export type DiskChange = "none" | "external";

/**
 * Decide whether a save would silently overwrite someone else's edit.
 *
 * - `null` means the disk could not be read (missing handle, permission, web
 *   sessions after reload): the check cannot prove a conflict, so saving keeps
 *   working as before.
 * - Writing exactly what is already on disk, or a file that still matches the
 *   content we last read or saved, is not a conflict.
 */
export function diskChange(input: {
  diskContent: DiskSnapshot;
  lastSavedContent: string;
  pendingContent: string;
}): DiskChange {
  const { diskContent, lastSavedContent, pendingContent } = input;
  if (diskContent == null) return "none";
  if (diskContent === pendingContent) return "none";
  if (diskContent === lastSavedContent) return "none";
  return "external";
}
