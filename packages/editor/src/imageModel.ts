export const IMAGE_LAYOUTS = [
  "block-left",
  "block-center",
  "block-right",
  "float-left",
  "float-right"
] as const;

export type ImageLayout = (typeof IMAGE_LAYOUTS)[number];

export const DEFAULT_IMAGE_WIDTH = 100;
export const DEFAULT_IMAGE_LAYOUT: ImageLayout = "block-center";
export const FLOAT_IMAGE_WIDTH = 40;
export const MIN_IMAGE_WIDTH = 10;
export const MAX_IMAGE_WIDTH = 100;
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export type FigureAttrs = {
  src: string;
  alt: string;
  width: number;
  layout: ImageLayout;
  label: string | null;
};

export function clampImageWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_IMAGE_WIDTH;
  return Math.min(MAX_IMAGE_WIDTH, Math.max(MIN_IMAGE_WIDTH, Math.round(value)));
}

export function parseWidthPercent(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 && value <= 1 ? clampImageWidth(value * 100) : clampImageWidth(value);
  }
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_IMAGE_WIDTH;
  const match = raw.match(/([\d.]+)\s*%?/);
  if (!match) return DEFAULT_IMAGE_WIDTH;
  return clampImageWidth(Number(match[1]));
}

export function isImageLayout(value: unknown): value is ImageLayout {
  return IMAGE_LAYOUTS.includes(value as ImageLayout);
}

export function layoutFromMyst(align?: unknown, className?: unknown): ImageLayout {
  const classes = String(className ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const floated = classes.includes("float") || classes.includes("float-left") || classes.includes("float-right");
  const side = String(align ?? "").toLowerCase();
  if (floated || classes.includes("float-left") || classes.includes("float-right")) {
    if (side === "right" || classes.includes("float-right")) return "float-right";
    return "float-left";
  }
  if (side === "left") return "block-left";
  if (side === "right") return "block-right";
  return "block-center";
}

export function mystFromLayout(layout: ImageLayout): { align: "left" | "center" | "right"; className?: string } {
  if (layout === "float-left") return { align: "left", className: "float" };
  if (layout === "float-right") return { align: "right", className: "float" };
  if (layout === "block-left") return { align: "left" };
  if (layout === "block-right") return { align: "right" };
  return { align: "center" };
}

export function isDefaultFigureLayout(width: number, layout: ImageLayout): boolean {
  return clampImageWidth(width) === DEFAULT_IMAGE_WIDTH && layout === DEFAULT_IMAGE_LAYOUT;
}

export function widthForLayoutChange(currentWidth: number, next: ImageLayout): number {
  const floated = next.startsWith("float");
  if (floated && clampImageWidth(currentWidth) === DEFAULT_IMAGE_WIDTH) return FLOAT_IMAGE_WIDTH;
  if (!floated && clampImageWidth(currentWidth) === FLOAT_IMAGE_WIDTH) return DEFAULT_IMAGE_WIDTH;
  return clampImageWidth(currentWidth);
}

export function isAllowedImageFile(file: { type: string; size: number }): boolean {
  if (file.size > IMAGE_MAX_BYTES) return false;
  if (IMAGE_MIME.has(file.type)) return true;
  return file.type.startsWith("image/");
}

export function parseHtmlImg(html: string): { src: string; alt: string; width: number; layout: ImageLayout } | null {
  const match = html.match(/<img\b[^>]*>/i);
  if (!match) return null;
  const tag = match[0];
  const src = attr(tag, "src");
  if (!src) return null;
  const alt = attr(tag, "alt");
  const widthAttr = attr(tag, "width");
  const style = attr(tag, "style");
  const styleWidth = style.match(/width\s*:\s*([\d.]+)\s*%/i)?.[1];
  const className = attr(tag, "class");
  const align = attr(tag, "align") || className.match(/md-layout-([a-z-]+)/)?.[1];
  return {
    src,
    alt,
    width: parseWidthPercent(styleWidth ?? widthAttr),
    layout: isImageLayout(align) ? align : layoutFromMyst(align, className)
  };
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decode(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
