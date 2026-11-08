# Development

## Requirements

- Node.js 26+
- pnpm 10

## Install

```sh
pnpm install
```

## Web (also the Electron renderer UI)

```sh
pnpm dev:web
```

Open http://localhost:3000

## Desktop

```sh
pnpm dev:desktop
```

Starts Next.js and Electron. The renderer loads the Next dev server with a preload bridge.

## Tests

```sh
pnpm test
pnpm typecheck
```

## Debugging

- Unexpected failures (`window.error`, `unhandledrejection`) are logged with
  context, shown as a generic banner (never a stack trace) and kept in memory.
  Cancelled pickers and `ResizeObserver` noise are ignored.
- **Command palette → Copy diagnostics** puts version, platform, logs and the
  newest 20 unexpected errors on the clipboard as JSON. Document bodies are never
  included; logs name the operation, not the content.
- Development builds expose `window.__MDWORD_APP__` (store) and
  `window.__MDWORD_PRIME_FILE__` (prime a file for the web host). Both are compiled
  out of production builds.
- The visual editor has an error boundary that offers Source mode; a failed
  document conversion is logged instead of silently showing an empty page.

## Packages

Packages export TypeScript source (`src/index.ts`) and are transpiled by Next.js / electron-vite. Keep them UI-agnostic except `@mdword/ui` and `@mdword/editor`.

## Git

Work on a branch and open a pull request. Do not push directly to `main`. See `CONTRIBUTING.md` and, for agents, `AGENTS.md`.

## Conventions

- TypeScript strict
- No document content in logs
- Prefer MyST syntax over new markup
- New format concerns need an ADR
