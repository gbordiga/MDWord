# ADR-002 MyST as base syntax

## Status

Accepted

## Context

CommonMark is too weak (no admonitions, figures, roles). Inventing a dialect would isolate users. MyST is an existing, specified superset used in scientific/technical publishing.

## Decision

Use the official JavaScript `myst-parser` to produce MyST PRE mdast, and `myst-to-md` to serialize. Disable MyST's own frontmatter rewrite; MDWord owns YAML via CST. Enable GFM tables, task lists, and strikethrough.

Do not fork the grammar. Wikilinks and `page-break` are documented extensions.

## Consequences

Unknown MyST directives remain `mystDirective` nodes. We depend on MIT-licensed mystmd packages.
