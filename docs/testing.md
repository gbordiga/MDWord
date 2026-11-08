# Testing

## Pyramid

1. **Unit** — parser, serializer, schema, cascade, units, wikilinks, slugs, variables, paths
2. **Round-trip** — every `.md` file under `fixtures/round-trip/` (`packages/document-model` reads the directory)
3. **Real document** — `fixtures/real-world/ipr001.md` in editor and Playwright tests
4. **Property-based** — `fast-check` on units and wikilinks (`packages/shared`)
5. **Editor** — TipTap commands (jsdom)
6. **E2E** — Playwright against the web app (Chromium and a phone-sized project)
7. **Security** — script injection, path traversal, IPC validation

Serializer golden files and PDF screenshot comparison are not in this tree. They are listed under Next in `docs/roadmap.md`. Print inputs are the round-trip fixtures; see `fixtures/print/README.md`.

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
