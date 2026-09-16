# Testing

## Pyramid

1. **Unit** — parser, serializer, schema, cascade, units, wikilinks, slugs, variables, paths
2. **Round-trip** — fixtures under `fixtures/round-trip/`
3. **Golden** — serializer snapshots under `fixtures/golden/`
4. **Property-based** — `fast-check` on units, wikilinks, parse/serialize
5. **Editor** — TipTap commands (jsdom)
6. **E2E** — Playwright against the web app; Electron when packaged
7. **Security** — script injection, path traversal, IPC validation

## Source-of-truth invariant

```
open(source) → save(model) === source
```

unless the user edited that region. YAML-only edits keep the body bytes. A visual edit of one block must leave later blocks byte-identical.

## Serializer invariant

```
parse(source) → serialize(ast) → parse(serialized)
```

The second AST is semantically equal to the first. Unknown syntax must still be present. This tests `serializeMarkdown`, not save.

Semantic equality ignores:

- insignificant whitespace in HTML/Markdown serialization
- YAML key quoting style when values are equal
- position offsets

It does **not** ignore unknown directives, comments in YAML (when CST is used), or wikilink targets.

## Commands

```sh
pnpm test
pnpm typecheck
pnpm build:web
```
