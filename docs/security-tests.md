# Security tests

See `packages/shared/src/paths.test.ts` and `packages/renderer/src/index.test.ts`.

IPC handlers in `apps/desktop/src/main/index.ts` reject paths outside allowed roots and only open `http(s)` / `mailto:` externally.

The renderer tests cover sanitizing hostile HTML (`sanitize-html` allowlist) and
refusing unsafe link schemes. The CSP is not unit-tested: it only ships in
production builds, so verify it after `pnpm build:web` by serving `apps/web/out`
and loading the editor — a violation appears in the console as
`Refused to …` / `Content Security Policy`.
