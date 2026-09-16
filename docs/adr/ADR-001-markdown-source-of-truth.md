# ADR-001 Markdown source of truth

## Status

Accepted

## Context

Editors that store JSON, HTML, or SQLite as the canonical document trap users in a proprietary format and fail the longevity test.

The first implementation treated `.md` as the *file format* but used the MyST AST as the live document. Save always ran `serializeMarkdown(ast)`, so opening and saving could rewrite whitespace, fences, images, and YAML quoting even when the user had not edited those regions.

## Decision

The UTF-8 Markdown string is the live document. `DocumentModel.source` is the only thing that is saved.

- AST, TipTap JSON, layout, PDF, and the index are derived.
- Source view reads and writes `model.source` directly.
- Document view is a WYSIWYG that **patches** `model.source`. Unedited regions stay byte-identical.
- YAML-only edits dump the CST and keep the original body bytes.
- `serializeMarkdown` is for new or dirty regions, fallback when a patch cannot be mapped, and serializer tests.

## Consequences

- Open + save without edits is byte-identical.
- Semantic `parse → serialize → parse` remains the serializer contract, not the save path.
- Features that cannot be expressed as structured text are still rejected.
- Visual edits that cannot be mapped to source spans fall back to a full serialize so content is never dropped.
