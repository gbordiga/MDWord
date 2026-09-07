import { isMap, isScalar } from "yaml";
import type { DocumentModel } from "./index";

export const LAYOUT_FRONTMATTER_KEY = "mdoc";

export type FrontmatterValueKind = "string" | "number" | "boolean" | "list" | "object" | "empty";

export const FRONTMATTER_LABELS: Record<string, string> = {
  title: "Title",
  titolo: "Titolo",
  subtitle: "Subtitle",
  sottotitolo: "Sottotitolo",
  date: "Date",
  data: "Data",
  language: "Language",
  lingua: "Lingua",
  author: "Author",
  authors: "Authors",
  codice: "Codice",
  tipo: "Tipo",
  aziende: "Aziende",
  stato: "Stato",
  modifica: "Ultima modifica",
  storico: "Storico",
  redatto_da: "Redatto da",
  approvato_da: "Approvato da",
  iso9001: "ISO 9001",
  iatf: "IATF",
  processo: "Processo"
};

export const DOCUMENT_PROPERTY_KEYS = ["title", "titolo", "date", "data", "language", "lingua"] as const;

export const SUGGESTED_FRONTMATTER_KEYS = [
  "subtitle",
  "author",
  "codice",
  "tipo",
  "stato",
  "aziende"
] as const;

export function isDocumentPropertyKey(key: string): boolean {
  return (DOCUMENT_PROPERTY_KEYS as readonly string[]).includes(key);
}

export function isFrontmatterKey(key: string): boolean {
  const trimmed = key.trim();
  return trimmed.length > 0 && trimmed !== LAYOUT_FRONTMATTER_KEY && !/[\n\r:]/.test(trimmed);
}

export function frontmatterLabel(key: string): string {
  return FRONTMATTER_LABELS[key] ?? key.replace(/_/g, " ");
}

export function listFrontmatterKeys(model: DocumentModel): string[] {
  const keys: string[] = [];
  const seen = new Set<string>([LAYOUT_FRONTMATTER_KEY]);
  const contents = model.yamlCst?.contents;
  if (contents && isMap(contents)) {
    for (const item of contents.items) {
      const key = isScalar(item.key) ? String(item.key.value ?? "") : String(item.key);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }
  for (const key of Object.keys(model.frontmatter)) {
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export function listCustomFrontmatterKeys(model: DocumentModel): string[] {
  return listFrontmatterKeys(model).filter((key) => !isDocumentPropertyKey(key));
}

export function frontmatterValueKind(value: unknown): FrontmatterValueKind {
  if (value == null || value === "") return "empty";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number" && Number.isFinite(value)) return "number";
  if (Array.isArray(value)) return "list";
  if (value instanceof Date) return "string";
  if (typeof value === "object") return "object";
  return "string";
}

export function formatFrontmatterScalar(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const day = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
    return day?.[1] ?? value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value);
}

export function formatFrontmatterList(value: unknown): string {
  if (!Array.isArray(value)) return formatFrontmatterScalar(value);
  return value.map((item) => formatFrontmatterScalar(item)).join("\n");
}

export function parseFrontmatterList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function parseFrontmatterObject(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: {} };
  try {
    const value = JSON.parse(trimmed) as unknown;
    if (value === null || typeof value !== "object") {
      return { ok: false, error: "Must be a JSON object or array" };
    }
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON" };
  }
}

export function initialFrontmatterValue(kind: FrontmatterValueKind): unknown {
  if (kind === "list") return [];
  if (kind === "boolean") return false;
  if (kind === "number") return 0;
  if (kind === "object") return {};
  return "";
}
