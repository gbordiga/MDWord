# ADR-001 Markdown source of truth

## Status

Accepted

## Context

Editors that store JSON, HTML, or SQLite as the canonical document trap users in a proprietary format and fail the longevity test.

## Decision

The file on disk is UTF-8 Markdown (`.md`). The AST, TipTap document, and index are runtime representations. Save always serializes to Markdown.

## Consequences

Round-trip testing is mandatory. Features that cannot be expressed as structured text are rejected.
