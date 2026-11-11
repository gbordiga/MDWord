import { imageReference } from "@mdword/shared";
import JSZip from "jszip";
import { htmlToMarkdown } from "./htmlMarkdown";
import { pdfToMarkdown as layoutToMarkdown, type PdfItem } from "./pdfMarkdown";
import { slideToMarkdown } from "./pptxMarkdown";

export { htmlToMarkdown };

/** Office and PDF files the assistant can read and turn into Markdown. */
export const DOCUMENT_EXTENSIONS = ["docx", "pptx", "xlsx", "pdf"] as const;

export function documentExtension(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return (DOCUMENT_EXTENSIONS as readonly string[]).includes(ext) ? ext : null;
}

function tidy(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 16).replace("T", " ");
  }
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
    const rels = await zip.files[`ppt/slides/_rels/${name.split("/").pop()}.rels`]?.async("string");
    const targets = new Map<string, string>();
    if (rels) {
      for (const tag of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        const id = /Id="([^"]+)"/.exec(tag[1] ?? "")?.[1];
        const target = /Target="([^"]+)"/.exec(tag[1] ?? "")?.[1];
        if (id && target) targets.set(id, target);
      }
    }
    const notesTarget = [...targets.values()].find((target) => target.includes("notesSlide"));
    const notesName = notesTarget ? `ppt/notesSlides/${notesTarget.split("/").pop()}` : "";
    const notesXml = notesName && zip.files[notesName] ? await zip.files[notesName]!.async("string") : undefined;
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
    slides.push([slideToMarkdown(xml, index + 1, notesXml), ...images].filter(Boolean).join("\n\n"));
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
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const pages: PdfItem[][] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !Array.isArray(item.transform)) continue;
      const [a = 0, b = 0, , , x = 0, y = 0] = item.transform as number[];
      items.push({ text: item.str, x, y, size: Math.hypot(a, b) || item.height || 1, width: item.width });
    }
    pages.push(items);
  }
  return tidy(layoutToMarkdown(pages));
}

/** Extract one supported file as Markdown. Images, layout, and scripts are dropped. */
/** Office files are zip packages; a PDF starts with `%PDF`. Anything else is refused before a parser sees it. */
function hasSignature(bytes: Uint8Array, ext: string): boolean {
  if (ext === "pdf") {
    return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

export async function documentToMarkdown(path: string, bytes: Uint8Array): Promise<string> {
  const ext = documentExtension(path);
  if (!ext) throw new Error("This file type cannot be read as a document.");
  if (!hasSignature(bytes, ext)) throw new Error(`This file is not a ${ext} document.`);
  let markdown = "";
  if (ext === "docx") {
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
