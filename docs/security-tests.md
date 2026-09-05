# Security tests

See `packages/shared/src/paths.test.ts` and `packages/renderer/src/index.test.ts`.

IPC handlers in `apps/desktop/src/main/index.ts` reject paths outside allowed roots and only open `http(s)` / `mailto:` externally.
