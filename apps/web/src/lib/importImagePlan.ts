import { resolveExternalImagePath } from "@mdword/shared";

export type ImportImagesResult = {
  imported: { src: string; path: string }[];
  skipped: { src: string; reason: string }[];
};

export async function resolveAndEmbedImages(
  sources: string[],
  options: {
    documentPath: string | null;
    workspaceRoot?: string | null;
    readEmbedded: (path: string) => Promise<string>;
  }
): Promise<{
  imported: ImportImagesResult["imported"];
  skipped: ImportImagesResult["skipped"];
  replacements: Map<string, string>;
}> {
  const imported: ImportImagesResult["imported"] = [];
  const skipped: ImportImagesResult["skipped"] = [];
  const replacements = new Map<string, string>();

  for (const src of sources) {
    const resolved = resolveExternalImagePath(src, options.documentPath, options.workspaceRoot);
    if (!resolved) {
      skipped.push({ src, reason: "Could not resolve path" });
      continue;
    }
    try {
      const embedded = await options.readEmbedded(resolved);
      if (!embedded.startsWith("data:image/")) throw new Error("not-image");
      replacements.set(src, embedded);
      imported.push({ src, path: resolved });
    } catch {
      skipped.push({ src, reason: "File is missing or unreadable" });
    }
  }

  return { imported, skipped, replacements };
}
