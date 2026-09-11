import { NEW_DOCUMENT_MDOC } from "@mdword/layout-engine";

export function untitledDocument(now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  const page = NEW_DOCUMENT_MDOC.page ?? { size: "A4", orientation: "portrait" };
  const margins = NEW_DOCUMENT_MDOC.margins ?? {
    top: "20mm",
    right: "20mm",
    bottom: "20mm",
    left: "25mm"
  };
  const header = NEW_DOCUMENT_MDOC.header ?? { left: "", center: "", right: "" };
  const footer = NEW_DOCUMENT_MDOC.footer ?? { left: "", center: "", right: "" };
  const numbering = NEW_DOCUMENT_MDOC.numbering ?? { headings: false, figures: true, tables: true };
  const toc = NEW_DOCUMENT_MDOC.toc ?? { enabled: false, depth: 3 };
  return `---
title: "Untitled"
date: ${date}
language: it
mdoc:
  version: ${NEW_DOCUMENT_MDOC.version ?? 1}
  page:
    size: ${typeof page.size === "string" ? page.size : "A4"}
    orientation: ${page.orientation ?? "portrait"}
  margins:
    top: ${margins.top}
    right: ${margins.right}
    bottom: ${margins.bottom}
    left: ${margins.left}
  fontScale: ${NEW_DOCUMENT_MDOC.fontScale ?? "medium"}
  header:
    left: "${header.left ?? ""}"
    center: "${header.center ?? ""}"
    right: "${header.right ?? ""}"
  footer:
    left: "${footer.left ?? ""}"
    center: "${footer.center ?? ""}"
    right: "${footer.right ?? ""}"
  numbering:
    headings: ${numbering.headings ?? false}
    figures: ${numbering.figures ?? true}
    tables: ${numbering.tables ?? true}
  toc:
    enabled: ${toc.enabled ?? false}
    depth: ${toc.depth ?? 3}
---

# 

`;
}
