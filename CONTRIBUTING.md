# Contributing

MDWord is MIT-licensed. By submitting a contribution you agree that it is licensed under the same terms as `LICENSE`.

## Setup

```sh
pnpm install
pnpm dev
```

Node.js 26 or newer, pnpm 10. See `docs/development.md`.

## Changes

- Use a branch. Open a pull request against `main`. Do not push to `main`.
- Keep the Markdown file as the source of truth (`docs/architecture.md`).
- Format changes need an ADR in `docs/adr/`.
- UI strings stay in English.
- Do not include document contents in logs.

## Checks

```sh
pnpm test
pnpm typecheck
pnpm build:web
```

Pull requests run these in CI, plus the Playwright suite (`pnpm --filter @mdword/web test:e2e`).

Agents should follow `AGENTS.md`.
