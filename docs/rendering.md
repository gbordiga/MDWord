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

## HTML export

Semantic HTML5: headings, figures with captions, tables, admonitions as `<aside>`, wikilinks as `<a class="wikilink">`. Sanitize any raw HTML from the source.

## Consistency

Print CSS uses the same typography cascade as the editor. Fixtures live in `fixtures/print/`.
