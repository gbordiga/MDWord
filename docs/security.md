# Security

## Electron

| Setting | Value |
| --- | --- |
| `contextIsolation` | `true` |
| `nodeIntegration` | `false` |
| `sandbox` | `true` |
| Navigation | only `mdword:`; the dev server origin only when `isDev` |
| `openExternal` | `http:` / `https:` / `mailto:` only |
| Window open | denied; `http(s)` / `mailto` handed to the OS browser |
| Permissions | only `fileSystem` (web FS Access) is granted |

Preload exposes a frozen, typed `window.mdword` API. Every IPC handler validates:

- method name
- payload schema (zod)
- file paths (no traversal outside workspace / explicitly opened files)

## Content

- Raw HTML in Markdown is sanitized before visual render (`sanitize-html`, explicit
  tag/attribute/scheme allowlists in `@mdword/renderer`)
- No `eval`, no document-supplied scripts
- Images load from allowed file URLs or `mdword-file:` / blob URLs created by the host
- `file://` is not granted to arbitrary Markdown paths
- Content Security Policy on the static app and on the Electron print window:
  same-origin scripts and inline styles (required by Next.js and Paged.js), images
  from `self`/`data:`/`blob:`/`http(s)`, `connect-src 'self' https://openrouter.ai` (or `'none'` in print;
  openrouter.ai is the only widening, for the optional AI assistant),
  `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`. Development builds
  skip the policy because the dev server needs eval and a websocket.
- Mermaid renders with `securityLevel: "strict"`

## Privacy

Offline by default. No analytics. Diagnostics export excludes document bodies. Recovery files stay in the application data directory.

## AI assistant

Optional; inert until the user connects an OpenRouter key and accepts the privacy notice. Full design in `docs/ai-assistant.md`. Security properties:

- **What leaves the device:** the user's messages and the text that a tool reads (file content, titles, search snippets), sent only to `https://openrouter.ai`. The default routing preference asks OpenRouter to use only providers that do not keep prompts.
- **Writes need Apply by default.** `writeFile`, `editFile`, and a `readDocument` conversion only propose; Apply (revalidated against the current buffer) writes as one undo step, and the user still saves. If the user sets edit approval to automatic, a change is written immediately, except three cases that always wait: files that steer later turns (`.agents`, `.claude`, `.opencode`, `AGENTS.md`), a change longer than the 4,000 characters the card shows, and a change that embeds an image. Deleting a file always waits. There is no rename tool.
- **Prompt injection:** file text is labelled as data in the prompt. With manual approval a hostile file can at worst produce a proposal the user sees before Apply. With automatic approval it can change a short markdown file without a prompt, which is why a project from someone else should stay on manual. Paths are confined to the workspace root (no absolute paths, drive letters, `..`).
- **Key storage:** desktop keeps the key in the main process, encrypted with Electron `safeStorage`, and refuses to store it when the system has no real keyring (Linux `basic_text`). The renderer never receives the key: it sends requests through a main-process proxy that only talks to `https://openrouter.ai`, attaches the stored key, forwards a short header allowlist, and refuses redirects. Web keeps the key in `localStorage`; the CSP limits where a script could send it, and settings suggest a dedicated key with a limit. The key is never logged, never in chat history, diagnostics, or the workspace; error text is redacted.
- **Web search (on by default):** requests carry OpenRouter's `openrouter:web_search` server tool, at most 3 searches and 15 results per request, until the user turns it off. The search query leaves OpenRouter for a search provider (Exa unless the model searches natively), which the privacy routing preference does not cover. Results are untrusted data: the system prompt tells the model never to follow instructions found in them.
- **Project instructions, skills, and rules:** `AGENTS.md` (including `.agents/AGENTS.md`), `agent.md` or `CLAUDE.md`, plus skills (`.agents/skills`, `.claude/skills`) and rules (`.agents/rules`) are workspace content that may come from a third party. The prompt ranks them below the Safety and Edit rules, the panel shows which instruction files apply, and a `/` command loads one skill or rule into that turn. They cannot add tools or skip Apply, and editing them always needs Apply.
- **Documents:** `readDocument` turns docx, pptx, xlsx, and pdf into Markdown in the browser. The bytes must match the type (a zip package, or `%PDF`) before a parser runs. Pictures become image references; the model sees the reference, not the bytes. HTML files are not read.
- **Commands (desktop only, off by default, ADR-011):** one optional tool, `runCommand`, enabled per project in settings and absent on web and mobile. There is **no sandbox**: a command runs with the user's permissions, and a hostile file, web page or instruction file can try to steer the model, so this feature must not be described as safe. Controls: (1) the renderer never spawns a process; the main process runs it after a zod-checked IPC call and re-checks that the folder is a project the user opened, not a link out of it; (2) a scrubbed environment (no OpenRouter key, no secret-like variable); (3) up to four commands at once, 60 s default and 10 min cap, no standard input, the whole process tree killed on Stop or timeout, output kept in memory and capped; (4) manual approval by default, with the exact command shown; (5) "Run without asking" only skips the prompt for plain read-only commands that pass a fixed, fail-closed filter (`packages/agent/src/shellPolicy.ts`); (6) "AI check" does not use that filter or the rest of the turn: a separate call to the Jev decision model sees only the command, shell and folder, and anything but a confident `allow` falls back to manual; (7) history stores the command and exit code, never the output. The setting lives in user settings, never in the project. The filter cannot see a link or junction that a command follows, and `git` reads repository configuration, so a project from an untrusted source should stay on manual approval.
- **Sign in:** OpenRouter PKCE. Desktop runs a one-shot loopback callback server on `127.0.0.1` in the main process; web redirects back to the app URL. No client secret exists.
- **History:** stored outside the project (desktop app data keyed by a hash of the workspace path; web IndexedDB). It holds messages and edit cards, never file text read by tools.
- **Not yet available on mobile**, where a secure key store has not been built.

## Desktop checkpoints

- **Recent files** are written only by the main process when the user opens or saves
  a file. `files.openRecent` reopens a path only if it is already in that list, so
  `allowedRoots` is never widened by the renderer. `app.setPreferences` strips
  `recentFiles` from renderer payloads for the same reason.
- **Auto-update** uses GitHub Releases over HTTPS; `electron-updater` verifies the
  `sha512` recorded in `latest*.yml`. macOS refuses unsigned updates (Squirrel.Mac),
  so a signed, notarized build is required there.
- **Images** referenced from a workspace document may live up to four folders above
  an allowed root (`assertImageRead`). This is deliberate: imported documents point
  at sibling `images/` folders. Anything further away, or any non-image extension,
  is rejected. Accepted risk: a malicious document can make the app read an image
  file near the workspace. It cannot upload it (`connect-src`).

## Audit (0.1.8)

- `pnpm audit --audit-level=high`: no known vulnerabilities.
- CodeQL polynomial-regex alerts #52–#54 fixed in `@mdword/shared` (see the
  improvement log).
- Navigation, CSP, recent files and print-window findings above were fixed in
  this release.

## Web

Same sanitizer. File System Access API is user-gated. Vercel hosts only static assets.
