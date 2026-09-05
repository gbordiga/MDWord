# ADR-007 Workspace indexing

## Status

Accepted

## Context

Workspaces may contain thousands of Markdown files. The index must be disposable. Native `better-sqlite3` complicates Electron packaging.

## Decision

Use **sql.js** (SQLite compiled to WASM) with FTS5 in the host (Electron main or web worker). The index is derived from `.md` files and can be deleted. Wikilink resolution uses the index plus filesystem probes.

## Consequences

Slightly slower than native SQLite; portable across web and desktop; no native module rebuilds.
