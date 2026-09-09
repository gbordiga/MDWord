const cache = new Map<string, string>();

/** Stable key so we do not store multi-megabyte data URLs as Map keys. */
export function srcFingerprint(src: string): string {
  if (src.length < 160) return src;
  return `${src.length}:${src.slice(0, 64)}:${src.slice(-48)}`;
}

export function objectUrlFromDataUrl(src: string): string {
  const comma = src.indexOf(",");
  if (comma < 0) throw new Error("bad-data-url");
  const header = src.slice(0, comma);
  const body = src.slice(comma + 1).replace(/\s+/g, "");
  const mime = header.match(/data:([^;,]+)/i)?.[1] ?? "application/octet-stream";
  const binary = header.toLowerCase().includes(";base64") ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
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
    return url;
  } catch {
    return src;
  }
}
