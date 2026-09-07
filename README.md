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

## Git remotes

Primary: Origin Cursor (`origin`). To also host on GitHub:

```sh
gh auth login
./scripts/push-github.sh
```

That creates `https://github.com/gbordiga/MDWord`, adds a `github` remote, and pushes `main` plus tags. Origin stays `origin`. Details: `docs/COSA-DEVI-FARE.md`.

## Layout

```
apps/web          Next.js UI (Vercel + Electron renderer + Capacitor WebView)
apps/desktop      Electron main / preload / installers
apps/mobile       Capacitor Android / iOS store shells
packages/*        document model, parser, serializer, editor, layout, indexer
docs/             product, architecture, ADRs, format, release notes
```

Store / installer steps that need your accounts: `docs/COSA-DEVI-FARE.md`.

## Principles

If a feature cannot live in a structured text file, it does not belong here.
