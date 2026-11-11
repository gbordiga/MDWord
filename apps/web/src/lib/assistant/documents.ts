import { imageReference } from "@mdword/shared";
import JSZip from "jszip";

/** Office, PDF, and HTML files the assistant can read and turn into Markdown. */
export const DOCUMENT_EXTENSIONS = ["docx", "pptx", "xlsx", "pdf", "html", "htm"] as const;

export function documentExtension(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return (DOCUMENT_EXTENSIONS as readonly string[]).includes(ext) ? ext : null;
}

/**
 * Turn extracted HTML into Markdown. Embedded pictures become the same
 * `![alt][img-…]` references the editor already uses, with definitions at the end.
 */
export function htmlToMarkdown(html: string): string {
  const definitions = new Map<string, string>();
  const pictures = (fragment: string) =>
    fragment.replace(/<img\b([^>]*)>/gi, (_, attrs: string) => {
      const src = attr(attrs, "src");
      const alt = attr(attrs, "alt") || "image";
      if (!src.startsWith("data:image/") || src.startsWith("data:image/svg")) return "";
      const ref = imageReference(alt.replace(/[\[\]]/g, "") || "image", src);
      definitions.set(ref.id, ref.definition);
      return ref.image;
    });
  const withoutCode = dropElements(html, ["script", "style"]);
  const withBlocks = pictures(withoutCode)
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level: string, body: string) => {
      return `\n${"#".repeat(Number(level))} ${inline(body)}\n`;
    })
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, body: string) => `\n- ${inline(body)}`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, body: string) => {
      if (/^\s*(javascript|data):/i.test(href)) return inline(body);
      return `[${inline(body)}](${href})`;
    });
  const body = tidy(decode(stripTags(withBlocks)));
  const defs = [...definitions.values()].join("\n");
  return tidy(defs ? `${body}\n\n${defs}` : body);
}

function attr(attrs: string, name: string): string {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return decode(match?.[2] ?? match?.[3] ?? "");
}

function inline(html: string): string {
  const marked = html
    .replace(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, body: string) => `[${strip(body)}](${href})`)
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag: string, body: string) => `**${strip(body)}**`)
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag: string, body: string) => `*${strip(body)}*`);
  return tidy(decode(stripTags(marked)));
}

/** Drop every tag, including an unclosed `<script` with no `>`. */
function stripTags(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const start = html.indexOf("<", i);
    if (start < 0) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, start);
    const end = html.indexOf(">", start + 1);
    i = end < 0 ? html.length : end + 1;
  }
  return out;
}

function strip(html: string): string {
  return decode(stripTags(html));
}

/** Remove whole elements, including end tags with space before `>`. */
function dropElements(html: string, names: readonly string[]): string {
  const lower = html.toLowerCase();
  let out = "";
  let i = 0;
  while (i < html.length) {
    const start = lower.indexOf("<", i);
    if (start < 0) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, start);
    const name = names.find((n) => {
      if (!lower.startsWith("<" + n, start)) return false;
      const next = lower[start + n.length + 1];
      return next === undefined || next === ">" || next === "/" || /\s/.test(next);
    });
    if (!name) {
      out += html[start]!;
      i = start + 1;
      continue;
    }
    const close = lower.indexOf("</" + name, start + name.length + 1);
    const end = close < 0 ? html.length : html.indexOf(">", close);
    i = end < 0 ? html.length : end + 1;
  }
  return out;
}

function decode(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function tidy(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cell(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function table(rows: unknown[][]): string {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (width === 0) return "";
  const line = (row: unknown[]) => `| ${Array.from({ length: width }, (_, i) => cell(row[i])).join(" | ")} |`;
  const head = rows[0] ?? [];
  const body = rows.slice(1);
  return [line(head), `| ${Array.from({ length: width }, () => "---").join(" | ")} |`, ...body.map(line)].join("\n");
}

const MAX_EXTRACT_CHARS = 1_500_000;

/** A slide relationship may only point at ppt/media, never outside the package. */
function slideMedia(target: string): string | null {
  let path = target.replace(/\\/g, "/");
  if (path.startsWith("/") || /^[a-z]:/i.test(path)) return null;
  while (path.startsWith("../")) path = path.slice(3);
  if (path.includes("..") || !path.startsWith("media/")) return null;
  return `ppt/${path}`;
}

function dataUrl(bytes: Uint8Array, mime: string): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

async function pptxToMarkdown(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files)
    .filter((name) => /ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)?.[1]) - Number(b.match(/(\d+)/)?.[1]));
  const definitions = new Map<string, string>();
  const slides: string[] = [];
  for (const [index, name] of names.entries()) {
    const xml = await zip.files[name]!.async("string");
    const bits = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => decode(m[1] ?? ""));
    const rels = await zip.files[`ppt/slides/_rels/${name.split("/").pop()}.rels`]?.async("string");
    const targets = new Map<string, string>();
    if (rels) {
      for (const tag of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        const id = /Id="([^"]+)"/.exec(tag[1] ?? "")?.[1];
        const target = /Target="([^"]+)"/.exec(tag[1] ?? "")?.[1];
        if (id && target) targets.set(id, target);
      }
    }
    const images: string[] = [];
    for (const blip of xml.matchAll(/r:embed="([^"]+)"/g)) {
      if (definitions.size >= 40) break;
      const media = slideMedia(targets.get(blip[1] ?? "") ?? "");
      const file = media ? zip.files[media] : undefined;
      const ext = media?.split(".").pop()?.toLowerCase() ?? "";
      const mime = IMAGE_MIME[ext];
      if (!file || !mime) continue;
      const ref = imageReference("image", dataUrl(await file.async("uint8array"), mime));
      definitions.set(ref.id, ref.definition);
      images.push(ref.image);
    }
    slides.push(["## Slide " + (index + 1), bits.join("\n"), ...images].filter(Boolean).join("\n\n"));
  }
  const defs = [...definitions.values()].join("\n");
  return tidy(`${slides.join("\n\n")}${defs ? `\n\n${defs}` : ""}`);
}

async function xlsxToMarkdown(bytes: Uint8Array): Promise<string> {
  const { default: readXlsxFile } = await import("read-excel-file/universal");
  const sheets = await readXlsxFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return tidy(
    sheets
      .map((sheet) => {
        const rows = sheet.data.slice(0, 200);
        const note = sheet.data.length > rows.length ? `\n\n[${sheet.data.length - rows.length} more rows omitted]` : "";
        return `## ${sheet.sheet}\n\n${table(rows)}${note}`;
      })
      .join("\n\n")
  );
}

async function pdfToMarkdown(bytes: Uint8Array): Promise<string> {
  const { extractText } = await import("unpdf");
  const extracted = await extractText(bytes, { mergePages: false });
  const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
  return tidy(pages.map((page, index) => `## Page ${index + 1}\n\n${page.trim()}`).join("\n\n"));
}

/** Extract one supported file as Markdown. Images, layout, and scripts are dropped. */
export async function documentToMarkdown(path: string, bytes: Uint8Array): Promise<string> {
  const ext = documentExtension(path);
  if (!ext) throw new Error("This file type cannot be read as a document.");
  let markdown = "";
  if (ext === "html" || ext === "htm") markdown = htmlToMarkdown(new TextDecoder().decode(bytes));
  else if (ext === "docx") {
    const mammoth = (await import("mammoth")).default;
    const html = await mammoth.convertToHtml({
      arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.read("base64")}`
      }))
    });
    markdown = htmlToMarkdown(html.value);
  } else if (ext === "pptx") markdown = await pptxToMarkdown(bytes);
  else if (ext === "xlsx") markdown = await xlsxToMarkdown(bytes);
  else markdown = await pdfToMarkdown(bytes);
  if (!markdown) throw new Error("No text could be extracted from this file.");
  if (markdown.length > MAX_EXTRACT_CHARS) {
    throw new Error("This file is too large to convert. Try a smaller document.");
  }
  return markdown;
}
