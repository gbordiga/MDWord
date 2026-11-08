# Security tests

See `packages/shared/src/paths.test.ts` and `packages/renderer/src/index.test.ts`.

IPC handlers in `apps/desktop/src/main/index.ts` reject paths outside allowed roots and only open `http(s)` / `mailto:` externally.

**AI assistant** (see `docs/ai-assistant.md`):

- `packages/agent/src/*.test.ts`: path confinement, edit rules (unique, non-overlapping, all-or-nothing, CRLF/BOM), refusal of edits that add error diagnostics, loop limits (steps, tool-output budget, spend cap, three consecutive failures), Stop, and that tool results are labelled data in the prompt.
- `apps/desktop/src/main/assistantCore.test.ts`: the key is stored encrypted and never in plain text; no storage without a real keyring; the proxy accepts only `https://openrouter.ai` and forwards only allowlisted headers; history file names cannot escape their folder.
- `apps/web/src/lib/store.assistant.test.ts`: an Apply is exactly one undo step and never coalesces with typing.
- `apps/web/src/lib/assistant/thread.test.ts`: saved history contains no tool results.
- `apps/web/e2e/assistant.spec.ts`: a proposed edit (including one written by an "obedient" model) changes nothing until Apply; a stale edit is refused; Stop discards the open card; the assistant only contacts `openrouter.ai`; the key is shown masked.
- Manual: build the web app and confirm in the console that a request to any origin other than `openrouter.ai` is blocked by the CSP.

The renderer tests cover sanitizing hostile HTML (`sanitize-html` allowlist) and
refusing unsafe link schemes. The CSP is not unit-tested: it only ships in
production builds, so verify it after `pnpm build:web` by serving `apps/web/out`
and loading the editor — a violation appears in the console as
`Refused to …` / `Content Security Policy`.
