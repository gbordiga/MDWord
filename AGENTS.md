# AGENTS.md

Instructions for coding agents working in this repository. Humans use `CONTRIBUTING.md`.

## Read first

- `README.md` — what the product is
- `docs/architecture.md` — packages and the source-of-truth rule
- `docs/file-format.md` and `docs/mdoc-schema.md` — Markdown and `mdoc`
- `docs/testing.md` — which checks exist
- `docs/security.md` — Electron, sanitizer, CSP
- `docs/adr/` — accepted decisions. A new format concern needs a new ADR

`docs/CONTINUOUS_IMPROVEMENT.md` is a maintenance log. Its baseline table is historical. The current version and the Node requirement are in the root `package.json`.

## Rules

- The Markdown string is the source of truth. Save writes that string. Do not re-serialize the whole document to “clean it up”.
- Do not invent a markup dialect. Prefer MyST. Unknown directives must survive a save.
- Interface copy is English. The app shell is `<html lang="en">`. A document’s language comes from frontmatter (`language` or `lingua`) and is used for print HTML.
- Do not log document bodies.
- Do not push to `main`. Open a pull request from a branch.
- Do not add analytics, a backend, or a required cloud account.

## Verify

Run the commands that cover your change, and only claim the ones you ran:

```sh
pnpm test
pnpm typecheck
pnpm build:web
pnpm --filter @mdword/web test:e2e
```

Requires Node 26+ and pnpm 10. The license is MIT (`LICENSE`). Vendored third-party code is listed in `THIRD_PARTY_NOTICES.md`.
