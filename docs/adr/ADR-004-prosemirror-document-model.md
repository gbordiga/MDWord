# ADR-004 ProseMirror document model

## Status

Accepted

## Context

The visual editor must support tables, figures, and custom blocks with reliable selection, IME, and undo. ContentEditable wrappers are insufficient.

## Decision

TipTap 3 (ProseMirror) with a schema that maps to MyST nodes. Convert AST ↔ TipTap JSON in `@mdword/editor`. Do not use HTML as the interchange format. Do not use `tiptap-markdown` as the source of truth.

## Consequences

Every new visual node needs a serializer mapping. Unsupported syntax uses a raw block node that stores original Markdown.
