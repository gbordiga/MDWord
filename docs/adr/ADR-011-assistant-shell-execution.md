# ADR-011 Assistant shell execution (desktop)

## Status

Accepted. This ADR changes a guarantee stated in `docs/security.md` and `docs/ai-assistant.md` ("the model has no network, shell, delete, rename, or create tool"), and ships together with this decision.

## Context

The assistant reads files and proposes edits. Every write needs the user's Apply, so a hostile file can at worst produce a misleading proposal that the user sees in full.

Some useful work needs a real command: count or transform text with a script, run a linter, run `git status`, convert a file. The first release excluded shell execution on purpose (`docs/ai-assistant.md`, non-goals).

A shell removes the main protection. Facts to keep in mind:

- A command runs with the permissions of the user. There is no sandbox in this design.
- The renderer CSP limits where a script in the page can send data. It does not limit a child process: `curl` or `Invoke-WebRequest` can send a file anywhere.
- Prompt injection reaches the model through file text, project instruction files, and web search results. With a shell, an injected instruction can become a command.
- "Ask the user first" is a weak control on its own. People approve repeated prompts by habit.
- Comparable agents run commands with the permissions of their own process and rely on approval rules, not on isolation. They are a reference for the tool surface, not a safety model to copy. What each one does, and what we take from it:

| Agent | Shell handling | What we take |
| --- | --- | --- |
| mini-swe-agent | One tool, `bash`. Every action is a fresh `subprocess.run`: no persistent shell, so `cd` and `export` do not carry over. stdout and stderr are merged. On timeout the whole process group is killed. Isolation is optional (Docker, bubblewrap). | Stateless calls, a `cwd` parameter instead of `cd`, merged output, kill the process tree. |
| opencode | `shell` tool with `workdir`, `timeout` (default two minutes), optional background mode. Ordered allow/ask/deny rules, last match wins, default `ask`. A built-in scanner parses Bash, Zsh, `sh` and PowerShell, and checks every subcommand and `cd` target. It prefers `pwsh` on Windows. Known gap: PowerShell bare expressions such as `[IO.File]::Delete(...)` produced no command, so policy checks were skipped until fixed. | Default `ask`; check every subcommand; **fail closed when the scanner finds nothing or cannot parse**; treat .NET type and member calls as commands. |
| Pi | `bash` tool (`bash -c`), optional `powershell` tool. Optional timeout, no default. Output is truncated to the last lines or bytes and the full output is written to a temp file. Windows Bash lookup: configured path, Git Bash in Program Files, then `bash.exe` on `PATH`. `shellCommandPrefix` is prepended to each command. | Tail truncation with a marker; explicit Windows lookup order. We reject the temp file for output and the prefix. A reported Pi bug shows why: the first `bash.exe` on `PATH` can be the WSL launcher in `System32`, which hangs. We skip it. |

Sources: mini-swe-agent FAQ and `environments/local.py`; opencode docs (Permissions, Tools) and its Windows and scanner issues; Pi docs (Windows, shell configuration) and `core/tools/bash.ts`.

## Decision

Add one optional tool, `runCommand`, to the assistant. It is **desktop only**, **off by default**, and enabled per workspace by the user.

### Scope

- Desktop (Electron) only. The web and mobile hosts have no `runCommand`. The tool is not offered to the model there.
- Shells: `bash` and, on Windows, PowerShell. The model names the shell in the call. Resolution:
  - Bash on Windows: Git Bash at `%ProgramFiles%\Git\bin\bash.exe`, then `%ProgramFiles(x86)%`, then `%LocalAppData%\Programs\Git`, then `bash.exe` on `PATH` **excluding** `%SystemRoot%\System32` (the WSL launcher hangs). Elsewhere: `/bin/bash`, then `bash` on `PATH`.
  - PowerShell: `pwsh.exe`, then `powershell.exe`, started with `-NoProfile -NonInteractive -NoLogo -Command`.
  - A missing shell is reported to the model as an error. There is no fallback to another shell.
- Each call is a **fresh process** (as in mini-swe-agent): no state carries over between calls. The folder is a parameter, not a `cd` in the command. It must be the workspace root or a folder inside it; anything else is refused.
- No command prefix or profile setup (no `shellCommandPrefix`). Aliases and startup files are not loaded.

### Where it runs

- Commands run only in the **main process**, started from a validated IPC call. The renderer never spawns a process (ADR-006 stays true).
- The IPC payload is checked with zod: shell name, command string (length cap), optional subfolder, timeout.
- The child process gets a **scrubbed environment**: an allowlist of variables (`PATH`, `HOME`/`USERPROFILE`, `SystemRoot`, locale, temp). The OpenRouter key, any variable that looks like a secret, and the app's own environment are not passed.
- Limits: default timeout 60 seconds (hard cap 10 minutes), at most one command at a time, no standard input (interactive programs fail instead of waiting), and Stop or timeout kills the whole process tree (`taskkill /T /F` on Windows, process group on POSIX).
- Output: stdout and stderr merged, kept **in memory only**, capped, and truncated from the start so the tail is kept, with a marker. No output is written to a temp file.

### Approval

Three modes, chosen per workspace in settings and stored in user settings, never in the workspace. The active mode is always shown in the assistant header.

1. **Manual** (default; the only mode until the user opts in). Every command shows a card with the exact command, shell, folder and timeout. The user presses Run or Deny. The command is never rewritten between the card and the run.
2. **Automatic with AI.** Commands that pass the deterministic filter go to a separate classifier call, using the same model as the chat. Anything else is manual.
3. **Always run.** Commands that pass the deterministic filter run with no question and no model call. Anything else is manual.

Enabling mode 2 or 3 needs an explicit confirmation that states: no sandbox, commands run with the user's permissions, prompt injection can lead to a command. Switching back to manual is one click.

Rules shared by all modes:

- **The deterministic filter always runs and cannot be overridden by a model or a setting.** It is modelled on opencode's per-subcommand scanner and **fails closed**: if the command cannot be fully parsed, if no command is found, or if anything unknown appears, the result is manual approval. It splits on `;`, `&&`, `||`, pipes and newlines and checks every part. It forces manual approval for anything that:
  - uses the network (`curl`, `wget`, `Invoke-WebRequest`, `Invoke-RestMethod`, `ssh`, `scp`, `nc`, package managers, `git push`, `fetch`, `pull`, `clone`), or .NET network types;
  - deletes, moves or overwrites (`rm`, `del`, `Remove-Item`, `mv`, `Move-Item`, `Set-Content`, `Out-File`, `>` and `>>` redirection, `sed -i`, `tee`), or calls .NET or member methods (`[IO.File]::...`, `$x.Delete()`), which are treated as commands, not ignored;
  - touches a path outside the workspace (absolute paths, `..`, `~`, drive letters, `$env:` and `%VAR%` paths, UNC paths);
  - reads credential locations (`.ssh`, `.aws`, `.git-credentials`, `.env`, browser profiles, the app data folder);
  - starts another shell or interpreter with `-c`/`-e`/`-Command`, uses `eval`/`Invoke-Expression`/`iex`, `source`, command substitution, here-strings with code, or encoded payloads (`-EncodedCommand`, `base64 -d`).
  - Only a short allowlist of read-only programs is accepted without manual approval (`ls`, `dir`, `cat`, `head`, `tail`, `wc`, `grep`, `rg`, `sort` without `-o`, `uniq`, `find` without `-delete`, `-exec*`, `-ok*`, `-fprint*` or `-fls`, `git status|diff|log|show|branch`, `Get-ChildItem`, `Get-Content`, `Select-String`, `Measure-Object`, `Get-Location`, `echo`, `pwd`, `node --version`). Programs that run workspace-defined code, such as package scripts (`pnpm test|typecheck|lint`), are not read-only and are never on the list. Everything else is manual in every mode.
- **Tainted turns.** Once a turn has used web search, read a file the user did not open or mention, or returned workspace `search` snippets from such a file, modes 2 and 3 are off for the rest of that turn and every command is manual. They are also off for every turn while the system prompt includes project instruction files (`AGENTS.md`, `agent.md`, `CLAUDE.md`) from the workspace, unless the user has reviewed and trusted them.
- Every automatic decision (AI or always-run) appears in the thread with the command and which mode approved it.
- Stop is always available.
- The classifier (mode 2) sees **only** the command text, the shell and the folder: never file contents, tool output, web results or the conversation. Its answer must match a strict schema (`allow` or `deny`, short reason). Anything else, a timeout or an error is `deny` and falls back to manual approval. The classifier is a convenience that lowers prompts, not a security boundary. The filter and the scrubbed environment are what limit damage.
- No "remember this command" and no allowlist file in the first version.

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

## Resolved questions

1. Per-command allow rules: not in v1. If added later, user-level only, never read from the workspace.
2. Classifier model: the chat model.
3. Sandbox before automatic modes: not required, but modes 2 and 3 need the explicit opt-in above. A sandbox stays a follow-up ADR.
4. Isolated scripts first: no. The real shell ships now, manual by default.
5. Shell prefix and profiles: not supported.
