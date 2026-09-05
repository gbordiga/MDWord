# Development

## Requirements

- Node.js 20+
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

## Packages

Packages export TypeScript source (`src/index.ts`) and are transpiled by Next.js / electron-vite. Keep them UI-agnostic except `@mdword/ui` and `@mdword/editor`.

## Conventions

- TypeScript strict
- No document content in logs
- Prefer MyST syntax over new markup
- New format concerns need an ADR
