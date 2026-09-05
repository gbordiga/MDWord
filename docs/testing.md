# Testing

## Pyramid

1. **Unit** — parser, serializer, schema, cascade, units, wikilinks, slugs, variables, paths
2. **Round-trip** — fixtures under `fixtures/round-trip/`
3. **Golden** — serializer snapshots under `fixtures/golden/`
4. **Property-based** — `fast-check` on units, wikilinks, parse/serialize
5. **Editor** — TipTap commands (jsdom)
6. **E2E** — Playwright against the web app; Electron when packaged
7. **Security** — script injection, path traversal, IPC validation

## Round-trip invariant

```
parse(source) → serialize(ast) → parse(serialized)
```

The second AST is semantically equal to the first. Unknown syntax must still be present.

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
