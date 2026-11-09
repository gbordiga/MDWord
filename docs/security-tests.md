# Security tests

See `packages/shared/src/paths.test.ts` and `packages/renderer/src/index.test.ts`.

IPC handlers in `apps/desktop/src/main/index.ts` reject paths outside allowed roots and only open `http(s)` / `mailto:` externally.

**AI assistant** (see `docs/ai-assistant.md`):

- `packages/agent/src/*.test.ts`: path confinement, edit rules (unique, non-overlapping, all-or-nothing, CRLF/BOM), refusal of edits that add error diagnostics, loop limits (steps, tool-output budget, spend cap, three consecutive failures), Stop, and that tool results are labelled data in the prompt.
- `apps/desktop/src/main/assistantCore.test.ts`: the key is stored encrypted and never in plain text; no storage without a real keyring; the proxy accepts only `https://openrouter.ai` and forwards only allowlisted headers; history file names cannot escape their folder.
- `apps/web/src/lib/store.assistant.test.ts`: an Apply is exactly one undo step and never coalesces with typing.
- `apps/web/src/lib/assistant/thread.test.ts`: saved history contains no tool results.
- `apps/web/e2e/assistant.spec.ts`: a proposed edit (including one written by an "obedient" model) changes nothing until Apply; a stale edit is refused; Stop discards the open card; the assistant only contacts `openrouter.ai`; the key is shown masked.
- `packages/agent/src/shellPolicy.test.ts`: the fixed filter sends the network, deletes and writes, paths outside the project, credential locations, substitution, variables, redirection, blocks, jobs, PowerShell expressions and .NET calls, shells and encoded payloads to manual approval; every part of a compound command is checked; unparseable or empty input fails closed.
- `packages/agent/src/tools.shell.test.ts` and `approval.test.ts`: `runCommand` is offered only when the host provides it; a folder outside the workspace never reaches the host; a denial tells the model not to retry; reading or searching a file does not by itself force manual approval; the AI check accepts only the exact JSON answer.
- `apps/desktop/src/main/shellCore.test.ts` and `shell.test.ts`: the OpenRouter key and app variables never reach the child; a folder outside the project, a root the user did not open, and a link to the outside are refused; timeout and Stop kill the whole tree; up to four commands at once, a fifth is refused; no standard input; output is capped and keeps the end; changed markdown files are listed; the WSL launcher in `System32` is never picked as bash.
- `apps/web/src/lib/assistant/thread.test.ts`: saved commands keep no output, and unfinished ones are closed.
- Manual: build the web app and confirm in the console that a request to any origin other than `openrouter.ai` is blocked by the CSP.

The renderer tests cover sanitizing hostile HTML (`sanitize-html` allowlist) and
refusing unsafe link schemes. The CSP is not unit-tested: it only ships in
production builds, so verify it after `pnpm build:web` by serving `apps/web/out`
and loading the editor — a violation appears in the console as
`Refused to …` / `Content Security Policy`.
