export type ImageAttrList = {
  width?: string;
  align?: string;
  className?: string;
};

const ATTR_TOKEN = /\b(width|align|class)=(\S+)/gi;

export function parseImageAttrList(raw: string): ImageAttrList | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const inner = text.startsWith("{") && text.endsWith("}") ? text.slice(1, -1) : text;
  const out: ImageAttrList = {};
  for (const match of inner.matchAll(ATTR_TOKEN)) {
    const key = match[1]?.toLowerCase();
    const value = match[2];
    if (!key || !value) continue;
    if (key === "width") out.width = value;
    else if (key === "align") out.align = value;
    else if (key === "class") out.className = value;
  }
  return out.width || out.align || out.className ? out : null;
}

export function formatImageAttrList(attrs: ImageAttrList): string {
  const parts: string[] = [];
  const width = String(attrs.width ?? "").trim();
  if (width && width !== "100" && width !== "100%") {
    parts.push(`width=${width.endsWith("%") ? width : `${width}%`}`);
  }
  const align = String(attrs.align ?? "").trim().toLowerCase();
  if (align && align !== "center") parts.push(`align=${align}`);
  const className = String(attrs.className ?? "").trim();
  if (className) parts.push(`class=${className}`);
  return parts.length ? `{${parts.join(" ")}}` : "";
}

export function isImageAttrTitle(title: string): boolean {
  return parseImageAttrList(title) != null;
}
