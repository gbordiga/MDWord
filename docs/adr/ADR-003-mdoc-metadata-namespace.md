# ADR-003 mdoc metadata namespace

## Status

Accepted

## Context

MyST frontmatter describes bibliographic metadata, not page size. Mixing layout into ad-hoc keys would clash with the ecosystem. Two YAML frontmatters would break other tools.

## Decision

One YAML frontmatter. Layout lives under `mdoc:` with a versioned JSON Schema. Standard MyST keys stay at the root.

## Consequences

Processors that ignore `mdoc` still see a normal MyST document. Cascade resolves missing fields from app/workspace/template.
