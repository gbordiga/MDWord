# ADR-006 Electron security model

## Status

Accepted

## Context

Markdown can contain HTML, images, and links. A renderer with Node access would turn a document into an RCE vector.

## Decision

Sandboxed renderer, context isolation, no Node integration, minimal preload, zod-validated IPC, path allowlists, sanitizer, CSP, external URLs via `shell.openExternal` after scheme checks.

## Consequences

All filesystem access goes through main. The web host implements the same `HostApi` without Node.
