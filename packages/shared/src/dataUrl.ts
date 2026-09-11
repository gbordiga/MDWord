const MARKER = "data:image/";
const BASE64 = ";base64,";
const MIN_FOLD = 48;
const STUB_MARK = "MDWORDIMG";

export type DataUrlRange = { from: number; to: number; preview: string };

function isPayloadChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) return true;
  if (code >= 97 && code <= 122) return true;
  if (code >= 48 && code <= 57) return true;
  return ch === "+" || ch === "/" || ch === "=";
}

function isSpace(ch: string): boolean {
  return ch === " " || ch === "\n" || ch === "\r" || ch === "\t";
}

/** Scan without a global regex so megabyte payloads cannot backtrack or hang. */
export function findDataUrlRanges(text: string, minPayload = MIN_FOLD): DataUrlRange[] {
  const ranges: DataUrlRange[] = [];
  let search = 0;
  while (search < text.length) {
    const start = text.indexOf(MARKER, search);
    if (start < 0) break;
    const base64 = text.indexOf(BASE64, start);
    if (base64 < 0 || base64 - start > 48) {
      search = start + MARKER.length;
      continue;
    }
    const payloadStart = base64 + BASE64.length;
    let end = payloadStart;
    let payloadLen = 0;
    while (end < text.length) {
      const ch = text[end] ?? "";
      if (isPayloadChar(ch)) {
        payloadLen += 1;
        end += 1;
        continue;
      }
      if (isSpace(ch)) {
        end += 1;
        continue;
      }
      break;
    }
    while (end > payloadStart && isSpace(text[end - 1] ?? "")) end -= 1;
    if (payloadLen >= minPayload) {
      const headerEnd = Math.min(payloadStart, start + 24);
      ranges.push({
        from: start,
        to: end,
        preview: `${text.slice(start, headerEnd)}…`
      });
    }
    search = Math.max(end, start + 1);
  }
  return ranges;
}

export function foldEmbeddedDataUrls(text: string): string {
  const ranges = findDataUrlRanges(text);
  if (!ranges.length) return text;
  let out = "";
  let last = 0;
  for (const range of ranges) {
    out += text.slice(last, range.from) + range.preview;
    last = range.to;
  }
  return out + text.slice(last);
}

export function stubToken(index: number): string {
  return `data:image/png;base64,${STUB_MARK}${index}`;
}

export function imagePayloadLabel(url: string): { kind: string; kb: number } {
  const raw = (url.match(/data:image\/([\w+.-]+)/i)?.[1] ?? "image").toLowerCase();
  const kind = raw === "jpeg" || raw === "jpg" ? "JPEG" : raw.toUpperCase();
  const comma = url.indexOf(",");
  const payload = comma >= 0 ? url.slice(comma + 1) : url;
  const kb = Math.max(1, Math.round((payload.replace(/\s/g, "").length * 3) / 4 / 1024));
  return { kind, kb };
}

export function foldPreview(url: string, mode: "expand" | "collapse" = "expand"): string {
  const { kind, kb } = imagePayloadLabel(url);
  const hint = mode === "collapse" ? "click to collapse" : "click to expand";
  return `${url.slice(0, 22)}… · ${kind} ${kb} KB — ${hint}`;
}

export function displayImageStub(index: number, url: string): string {
  const { kind, kb } = imagePayloadLabel(url);
  return `\u27E6${STUB_MARK}:${index}:${kind}:${kb}KB\u27E7`;
}

export function findDisplayImageStubs(text: string): { index: number; from: number; to: number; label: string }[] {
  const out: { index: number; from: number; to: number; label: string }[] = [];
  const re = /\u27E6MDWORDIMG:(\d+):([^:]+):(\d+)KB\u27E7/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    out.push({
      index: Number(match[1]),
      from: match.index,
      to: match.index + match[0].length,
      label: `${match[2]} ${match[3]} KB — click to expand`
    });
  }
  return out;
}

export function stubEmbeddedImagesForDisplay(source: string): {
  display: string;
  urls: string[];
  restore: (display: string) => string;
} {
  const ranges = findDataUrlRanges(source, 1);
  if (!ranges.length) {
    return { display: source, urls: [], restore: (value) => value };
  }
  const urls: string[] = [];
  let display = "";
  let last = 0;
  ranges.forEach((range, index) => {
    const url = source.slice(range.from, range.to);
    urls.push(url);
    display += source.slice(last, range.from);
    display += displayImageStub(index, url);
    last = range.to;
  });
  display += source.slice(last);
  return {
    display,
    urls,
    restore: (value) => {
      let next = value;
      for (let i = 0; i < urls.length; i++) {
        next = next.split(displayImageStub(i, urls[i] ?? "")).join(urls[i] ?? "");
      }
      return next;
    }
  };
}

export function stubEmbeddedImages(source: string): {
  display: string;
  restore: (display: string) => string;
} {
  const ranges = findDataUrlRanges(source);
  if (!ranges.length) {
    return { display: source, restore: (value) => value };
  }
  const urls: string[] = [];
  let display = "";
  let last = 0;
  ranges.forEach((range, index) => {
    display += source.slice(last, range.from);
    urls.push(source.slice(range.from, range.to));
    display += stubToken(index);
    last = range.to;
  });
  display += source.slice(last);
  return {
    display,
    restore: (value) => {
      if (!value.includes(STUB_MARK)) return value;
      let next = value;
      for (let i = 0; i < urls.length; i++) {
        next = next.split(stubToken(i)).join(urls[i] ?? "");
      }
      return next;
    }
  };
}

export function restoreEmbeddedImagesInTree(node: { [key: string]: unknown }, restore: (value: string) => string): void {
  for (const key of Object.keys(node)) {
    if (key === "children") continue;
    const value = node[key];
    if (typeof value === "string" && value.includes(STUB_MARK)) {
      node[key] = restore(value);
    }
  }
  const children = node.children;
  if (!Array.isArray(children)) return;
  for (const child of children) {
    if (child && typeof child === "object") restoreEmbeddedImagesInTree(child as { [key: string]: unknown }, restore);
  }
}

function replaceDataUrls(text: string, replace: (url: string) => string): string {
  const ranges = findDataUrlRanges(text);
  if (!ranges.length) return text;
  let out = "";
  let last = 0;
  for (const range of ranges) {
    out += text.slice(last, range.from) + replace(text.slice(range.from, range.to));
    last = range.to;
  }
  return out + text.slice(last);
}

/** Short tokens so myst-to-md keeps `![]()` instead of a multiline `{image}` fence. */
export function createDataUrlStubber(): {
  stubTree: (node: { [key: string]: unknown }) => void;
  restore: (text: string) => string;
} {
  const urls: string[] = [];
  const restore = (text: string) => {
    if (!urls.length || !text.includes(STUB_MARK)) return text;
    let next = text;
    for (let i = 0; i < urls.length; i++) {
      next = next.split(stubToken(i)).join(urls[i] ?? "");
    }
    return next;
  };
  const stubTree = (node: { [key: string]: unknown }) => {
    for (const key of Object.keys(node)) {
      if (key === "children") continue;
      const value = node[key];
      if (typeof value === "string") {
        node[key] = replaceDataUrls(value, (url) => {
          const index = urls.length;
          urls.push(url);
          return stubToken(index);
        });
      }
    }
    const children = node.children;
    if (!Array.isArray(children)) return;
    for (const child of children) {
      if (child && typeof child === "object") stubTree(child as { [key: string]: unknown });
    }
  };
  return { stubTree, restore };
}

function optionValue(body: string, name: string): string {
  return body.match(new RegExp(`^\\s*:${name}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
}

function markdownImageFromFence(full: string, first: string, body: string): string {
  const optionLines: string[] = [];
  const captionLines: string[] = [];
  const urlParts = [String(first ?? "").trim()];
  for (const line of String(body).split(/\r?\n/)) {
    if (/^\s*:\w+:/.test(line)) optionLines.push(line.trim());
    else if (/^[A-Za-z0-9+/=]+$/.test(line.trim()) && line.trim()) urlParts.push(line.trim());
    else if (line.trim()) captionLines.push(line.trimEnd());
  }
  const url = urlParts.join("");
  if (!url.startsWith("data:image/") && !url.startsWith("blob:")) return full;
  const opts = optionLines.join("\n");
  const alt = optionValue(opts, "alt");
  const width = optionValue(opts, "width");
  const align = optionValue(opts, "align");
  const className = optionValue(opts, "class");
  const label = optionValue(opts, "label");
  const caption = captionLines.join("\n").trim();
  const image = `![${alt}](${url})`;
  const keepFigure = Boolean(
    width || caption || label || className || (align && align !== "center")
  );
  if (!keepFigure) return image;
  const head = [":::{figure}"];
  if (label) head.push(`:label: ${label}`);
  if (align && align !== "center") head.push(`:align: ${align}`);
  if (width) head.push(`:width: ${width}`);
  if (className) head.push(`:class: ${className}`);
  return `${head.join("\n")}\n\n${image}${caption ? `\n\n${caption}` : ""}\n:::`;
}

/**
 * Data-URL `{image}` / `:::figure` arguments become a CommonMark image,
 * wrapped in `:::figure` when width, caption, or layout must be kept.
 */
export function rewriteEmbeddedImageFences(md: string): string {
  return md
    .replace(/```\{(?:image|figure)\}[ \t]*([^\n]*)\n([\s\S]*?)```/gi, markdownImageFromFence)
    .replace(/:::{0,3}[ \t]*\{?(?:figure|image)\}?[ \t]*([^\n]*)\n([\s\S]*?):::/gi, markdownImageFromFence);
}
