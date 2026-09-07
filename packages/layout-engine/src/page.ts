import type { Mdoc } from "./schema";
import { toMm, toPx } from "@mdword/shared";

export const PAGE_SIZES_MM: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 }
};

export interface PageMetrics {
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  margins: { top: number; right: number; bottom: number; left: number };
  orientation: "portrait" | "landscape";
}

/** Gray gap between stacked sheets in page view (CSS px at 96dpi). */
export const PAGE_STACK_GAP_PX = 24;

export function countFlowPages(contentHeightPx: number, usableHeightPx: number): number {
  if (usableHeightPx <= 1) return 1;
  return Math.max(1, Math.ceil(contentHeightPx / usableHeightPx));
}

export function pageStackHeightPx(pageCount: number, pageHeightPx: number, gapPx = PAGE_STACK_GAP_PX): number {
  const n = Math.max(1, pageCount);
  return n * pageHeightPx + (n - 1) * gapPx;
}

export function pageMetrics(mdoc: Mdoc, dpi = 96): PageMetrics {
  const orientation = mdoc.page?.orientation ?? "portrait";
  let widthMm = PAGE_SIZES_MM.A4!.width;
  let heightMm = PAGE_SIZES_MM.A4!.height;
  const size = mdoc.page?.size;
  if (typeof size === "string") {
    const named = PAGE_SIZES_MM[size] ?? PAGE_SIZES_MM.A4!;
    widthMm = named.width;
    heightMm = named.height;
  } else if (size && typeof size === "object") {
    widthMm = toMm(size.width);
    heightMm = toMm(size.height);
  }
  if (orientation === "landscape") {
    const tmp = widthMm;
    widthMm = heightMm;
    heightMm = tmp;
  }
  const mmToPx = (mm: number) => (mm / 25.4) * dpi;
  return {
    widthMm,
    heightMm,
    widthPx: mmToPx(widthMm),
    heightPx: mmToPx(heightMm),
    orientation,
    margins: {
      top: toPx(mdoc.margins?.top ?? "20mm", dpi),
      right: toPx(mdoc.margins?.right ?? "20mm", dpi),
      bottom: toPx(mdoc.margins?.bottom ?? "20mm", dpi),
      left: toPx(mdoc.margins?.left ?? "25mm", dpi)
    }
  };
}
