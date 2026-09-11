const cache = new Map<string, string>();
const dataUrlByBlob = new Map<string, string>();

/** Stable key so we do not store multi-megabyte data URLs as Map keys. */
export function srcFingerprint(src: string): string {
  if (src.length < 160) return src;
  return `${src.length}:${src.slice(0, 64)}:${src.slice(-48)}`;
}

export function objectUrlFromDataUrl(src: string): string {
  const comma = src.indexOf(",");
  if (comma < 0) throw new Error("bad-data-url");
  const header = src.slice(0, comma);
  let body = src.slice(comma + 1);
  if (body.includes("\n") || body.includes(" ") || body.includes("\r") || body.includes("\t")) {
    body = body.replace(/\s+/g, "");
  }
  const mime = header.match(/data:([^;,]+)/i)?.[1] ?? "application/octet-stream";
  const binary = header.toLowerCase().includes(";base64") ? atob(body) : decodeURIComponent(body);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

/** Display src that avoids re-decoding a data URL every time the node view remounts. */
export function displayImageSrc(src: string): string {
  if (!src.startsWith("data:image/")) return src;
  const key = srcFingerprint(src);
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const url = objectUrlFromDataUrl(src);
    cache.set(key, url);
    dataUrlByBlob.set(url, src);
    return url;
  } catch {
    return src;
  }
}

/** Blob URLs are display-only. Persist the original data URL when we still have it. */
export function canonicalImageSrc(src: string): string {
  const value = src.trim();
  if (!value.startsWith("blob:")) return value;
  return dataUrlByBlob.get(value) ?? value;
}

export function isDisplayBlobSrc(src: string): boolean {
  return src.trim().startsWith("blob:");
}

function rewriteBlobsInText(text: string): string {
  if (!text.includes("blob:")) return text;
  return text.replace(/blob:[^\s)"'\]]+/g, (blob) => canonicalImageSrc(blob));
}

export function rewriteDisplayBlobsInTree(node: { [key: string]: unknown }): boolean {
  let changed = false;
  for (const key of Object.keys(node)) {
    if (key === "children") continue;
    const value = node[key];
    if (typeof value === "string" && value.includes("blob:")) {
      const next = rewriteBlobsInText(value);
      if (next !== value) {
        node[key] = next;
        changed = true;
      }
    }
  }
  const children = node.children;
  if (!Array.isArray(children)) return changed;
  for (const child of children) {
    if (child && typeof child === "object") {
      if (rewriteDisplayBlobsInTree(child as { [key: string]: unknown })) changed = true;
    }
  }
  return changed;
}
