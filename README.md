# MDWord

A local-first, semantic-first document editor. Microsoft Word–like to write in, **MyST Markdown** on disk.

The file you save is UTF-8 Markdown. It stays readable in any text editor, diffable in Git, and recoverable if this application disappears.

## Run

```sh
pnpm install
pnpm dev:web
```

Desktop (Electron):

```sh
pnpm dev:desktop
```

## Test

```sh
pnpm test
pnpm typecheck
```

## Package

```sh
pnpm build:web
pnpm dist
```

Linux CI produces `.AppImage` and `.deb`. Windows `.exe` and macOS `.dmg` should be built on those OS runners for signed releases. See `docs/releasing.md`.

## Layout

```
apps/web          Next.js UI (Vercel + Electron renderer)
apps/desktop     Electron main / preload / installers
packages/*       document model, parser, serializer, editor, layout, indexer
docs/            product, architecture, ADRs, format
```

## Principles

If a feature cannot live in a structured text file, it does not belong here.
