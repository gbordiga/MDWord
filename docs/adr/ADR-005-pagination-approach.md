# ADR-005 Pagination approach

## Status

Accepted

## Context

Splitting one ProseMirror document per page breaks selection, undo, IME, and accessibility. Writing automatic page breaks into Markdown pollutes the source of truth.

## Decision

- **Editor:** one continuous document. Page geometry from the layout engine. Visual boundaries, headers, and footers are overlays/decorations.
- **Print/PDF:** separate HTML with Chromium pagination.
- **Explicit breaks only:** `:::{page-break}` in the file.

MVP uses overlay page frames (boundary + header/footer) rather than widget spacers between pages, to keep typing and selection correct.

## Consequences

On-screen page gaps are approximated. Printed page count may differ slightly from the overlay until the print pipeline is used as the authority.
