# Rendering

Two pipelines share tokens from the layout engine.

## Visual (editor)

- Continuous TipTap/ProseMirror document
- Page width from `mdoc.page`
- Margins as padding
- Overlay: page boundary, header, footer, page number
- Automatic page breaks are **not** in the AST
- Zoom is a view transform (preferences), not a document property

## Print / PDF

- HTML generated from the same AST and the same cascade
- Chromium page size and margins
- `displayHeaderFooter` templates on desktop `printToPDF`
- Web: print stylesheet + browser print dialog
- Explicit `page-break` becomes `break-after: page`

## Mermaid

` ```mermaid ` fences become a TipTap `mermaid` node in the visual editor and a `<figure class="md-mermaid">` in print HTML. Export hydrates those figures to SVG with Mermaid `securityLevel: "strict"` so PDF/HTML stay offline and self-contained.

## HTML export

Semantic HTML5: headings, figures with captions, tables, admonitions as `<aside>`, wikilinks as `<a class="wikilink">`. Sanitize any raw HTML from the source. Mermaid diagrams are inlined as SVG.

## Consistency

Print CSS uses the same typography cascade as the editor. Fixtures live in `fixtures/print/`.
