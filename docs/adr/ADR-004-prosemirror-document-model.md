# ADR-004 ProseMirror document model

## Status

Accepted

## Context

The visual editor must support tables, figures, and custom blocks with reliable selection, IME, and undo. ContentEditable wrappers are insufficient.

## Decision

TipTap 3 (ProseMirror) with a schema that maps to MyST nodes. Convert AST ↔ TipTap JSON in `@mdword/editor`. Do not use HTML as the interchange format. Do not use `tiptap-markdown` as the source of truth.

The TipTap document is a view. Visual edits patch `DocumentModel.source` (see ADR-001). They do not replace the markdown file with a full AST serialize unless the patch cannot be mapped.

## Consequences

Every new visual node needs a serializer mapping for **dirty regions**. Unsupported syntax uses a raw block node that stores original Markdown. Untouched source regions are not rewritten.
