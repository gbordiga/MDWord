# ADR-010 DOCX interoperability

## Status

Accepted

## Context

DOCX is important for colleagues still on Word. It is a bad canonical format (XML, wrapping, lossy round-trip).

## Decision

Markdown remains storage. DOCX export is post-MVP, best-effort (Pandoc or equivalent). Import is out of MVP. Never promise DOCX ↔ Markdown round-trip.

## Consequences

Document limitations of export when implemented (complex tables, themes, fields).
