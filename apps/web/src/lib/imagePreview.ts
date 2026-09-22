import { setImagePreviewLoader } from "@mdword/editor";
import { resolveExternalImagePath } from "@mdword/shared";
import { getHost } from "@/lib/host";
import { useApp } from "@/lib/store";

setImagePreviewLoader(async (src) => {
  const state = useApp.getState();
  const resolved = resolveExternalImagePath(src, state.path, state.workspace?.root ?? null);
  if (!resolved) return null;
  const readDataUrl = getHost().files.readDataUrl;
  if (!readDataUrl) return null;
  try {
    const data = await readDataUrl(resolved);
    return data.startsWith("data:image/") ? data : null;
  } catch {
    return null;
  }
});
