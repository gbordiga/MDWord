# ADR-011 Assistant shell execution (desktop)

## Status

Proposed. No code yet. This ADR changes a guarantee stated in `docs/security.md` and `docs/ai-assistant.md` ("the model has no network, shell, delete, rename, or create tool"), so it must be accepted before any implementation starts.

## Context

The assistant reads files and proposes edits. Every write needs the user's Apply, so a hostile file can at worst produce a misleading proposal that the user sees in full.

Some useful work needs a real command: count or transform text with a script, run a linter, run `git status`, convert a file. The first release excluded shell execution on purpose (`docs/ai-assistant.md`, non-goals).

A shell removes the main protection. Facts to keep in mind:

- A command runs with the permissions of the user. There is no sandbox in this design.
- The renderer CSP limits where a script in the page can send data. It does not limit a child process: `curl` or `Invoke-WebRequest` can send a file anywhere.
- Prompt injection reaches the model through file text, project instruction files, and web search results. With a shell, an injected instruction can become a command.
- "Ask the user first" is a weak control on its own. People approve repeated prompts by habit.
- Pi, a comparable agent, runs commands with the permissions of its own process and relies on trust decisions and extension hooks, not on isolation. That is a useful reference for the tool surface, not a safety model to copy.

## Decision

Add one optional tool, `runCommand`, to the assistant. It is **desktop only**, **off by default**, and enabled per workspace by the user.

### Scope

- Desktop (Electron) only. The web and mobile hosts have no `runCommand`. The tool is not offered to the model there.
- Shells: `bash` (Git Bash on Windows, `/bin/bash` elsewhere) and, on Windows, PowerShell (`pwsh.exe`, then `powershell.exe`, with `-NoProfile -NonInteractive`). The model names the shell in the call; the user can restrict the choice in settings.
- The working directory is always the workspace root or a folder inside it. A call with another directory is refused.

### Where it runs

- Commands run only in the **main process**, started from a validated IPC call. The renderer never spawns a process (ADR-006 stays true).
- The IPC payload is checked with zod: shell name, command string (length cap), optional subfolder, timeout.
- The child process gets a **scrubbed environment**: an allowlist of variables (`PATH`, `HOME`/`USERPROFILE`, locale, temp). The OpenRouter key, any variable that looks like a secret, and the app's own environment are not passed.
- Limits: default timeout 60 seconds (hard cap 10 minutes), output cap per call (truncated with a marker), at most one command at a time, and Stop kills the whole process tree.
- Commands read no standard input. Interactive programs fail instead of waiting.

### Approval

Two modes, chosen per workspace in settings. **Manual is the default and the only mode until the user opts in.**

1. **Manual.** Every command shows a card with the exact command, shell, folder, and timeout. The user presses Run or Deny. The command is never rewritten between the card and the run.
2. **Automatic.** A second, separate model call decides on commands that already pass a deterministic filter. Rules:
   - The deterministic filter runs first and cannot be overridden by the model. It **denies** (forces manual approval) anything that: uses the network (`curl`, `wget`, `Invoke-WebRequest`, `ssh`, `scp`, package managers, `git push`, `git fetch`/`pull`/`clone`); deletes or overwrites outside a temp folder (`rm`, `del`, `Remove-Item`, `mv` over an existing file, `>` redirection to an existing file); touches a path outside the workspace (absolute paths, `..`, `~`, drive letters, environment-variable paths); reads credential locations (`.ssh`, `.aws`, `.git-credentials`, browser profiles, the app data folder); starts another shell, interpreter with `-c`/`-e`, or `eval`/`Invoke-Expression`; or uses command substitution, pipes into an interpreter, or encoded payloads.
   - The classifier sees **only** the command text, the shell, and the folder. It never sees file contents, tool output, web search results, or the conversation. This keeps injected text out of the approver.
   - Its answer must match a strict schema (`allow` or `deny`, short reason). Anything else, a timeout, or an error counts as `deny`, which falls back to manual approval.
   - Automatic approval is switched off for a turn once that turn used web search, or read a file the user did not open or mention. Those turns go back to manual approval.
   - The classifier is a convenience, not a security boundary. It lowers the number of prompts. The deterministic filter and the scrubbed environment are what limit damage.
   - Every automatic decision is shown in the thread with the command, so the user can audit it afterwards.

A "remember this command" choice is **not** offered in the first version. Repeated approvals are an open question below.

### Interaction with the document flow

A command can change files without Apply and without an undo step. To keep the Markdown source of truth (ADR-001) safe:

- Edits to documents still go through `editFile` and Apply. The prompt says so, and the tool description tells the model to use `runCommand` for reading, checking, and generating, not for editing documents.
- Before and after a command the host records the modification time and size of the workspace files it indexes. Changed files are listed in the thread ("Files changed by the command").
- A changed file that is open in a tab goes through the existing external-change prompt (overwrite or reload), never a silent replacement.
- A save never re-serializes a document because of a command.

### Logging and history

- Do not log document bodies, command output, or the key. The diagnostics export contains no command text or output.
- Conversation history stores the command, shell, exit code, duration, and whether it was approved manually or automatically. It does **not** store standard output or standard error, in line with the rule that history never holds file text.

### Presentation

- Interface copy is English, in the message catalog.
- The command card, the running state with Stop, and the result summary are reachable by keyboard and labelled for screen readers.
- Output is shown as plain text in a collapsed block, never rendered as Markdown or HTML.

## Alternatives considered

1. **No execution.** Safest and current. Rejected as the long-term answer because it leaves common tasks unsolved, but it stays the behavior until this ADR is accepted.
2. **Isolated scripts in a worker** (JavaScript or Python via WebAssembly, no network, no disk). Much safer and works on web, but it cannot run the user's tools (`git`, linters, converters). Not rejected: it is a compatible, lower-risk step and may ship first as a separate ADR.
3. **Adopt an external harness such as Pi.** Already rejected in `docs/ai-assistant.md`: it does not know the open buffer, the selection, `mdoc` blocks, or the Apply flow. Its tool design is used as input only.
4. **Real sandbox** (Windows job objects and restricted tokens, `bubblewrap` on Linux, `sandbox-exec` on macOS). The right long-term control, but a large cross-platform effort. Listed as an open question, not part of this decision.

## Consequences

- A new class of risk exists: a prompt injection can lead to a command running with the user's permissions. Manual approval, the filter, and the scrubbed environment reduce it; they do not remove it. The documentation must say this plainly and not call the feature "safe".
- `docs/security.md` and `docs/ai-assistant.md` must be updated when the feature ships: the sentence "no shell tool" becomes "desktop only, off by default, approval required".
- New IPC handlers in main with schemas and tests. The CSP does not change. The renderer gains no new capability.
- New security tests in `docs/security-tests.md`: the key never appears in the child environment; a command outside the workspace folder is refused; a denied filter case never reaches automatic approval; a turn that used web search never auto-approves; Stop kills child processes; output is capped.
- The assistant tool count changes from four to five, and the evaluation set must cover prompt-injection cases that try to trigger `runCommand`.
- Mobile and web keep the previous guarantee.

## Open questions

1. Should a user be able to allow a specific command pattern for a workspace, and where is that list stored so a cloned repository cannot ship one? (Proposal: user-level only, never read from the workspace.)
2. Which model performs automatic approval: the chat model or a separate, cheaper one? Cost and the OpenRouter privacy routing apply to both.
3. Is a real sandbox required before automatic approval is allowed at all?
4. Should the first release offer only the isolated-script option (alternative 2) and defer the real shell?
5. How are `shellCommandPrefix`-style user setups handled, if at all?
