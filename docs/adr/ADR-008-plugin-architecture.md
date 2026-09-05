# ADR-008 Plugin architecture

## Status

Accepted

## Context

Extensibility is required, but arbitrary third-party code in the renderer is unsafe for v1.

## Decision

Define `@mdword/plugin-sdk` (manifest, directives, commands, renderers). MVP registers only bundled plugins. Third-party loaders are not implemented. The API is versioned for a future sandbox.

## Consequences

Users cannot install community plugins yet. Built-ins (page-break, callouts, figure) use the same interface.
