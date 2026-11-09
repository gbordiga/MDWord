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
- **Writes need Apply.** The model has four tools: `listFiles`, `search`, `readFile`, `editFile`. Unless the user turns commands on (see below), there is no network, shell, delete, or rename tool. `writeFile` and `editFile` only propose; the user's Apply (revalidated against the current buffer) writes into the open document as one undo step. The user still saves as usual.
- **Prompt injection:** file text is labelled as data in the prompt; a hostile file can at worst produce a misleading proposal, which the user sees in full before Apply. Paths are confined to the workspace root (no absolute paths, drive letters, `..`).
- **Key storage:** desktop keeps the key in the main process, encrypted with Electron `safeStorage`, and refuses to store it when the system has no real keyring (Linux `basic_text`). The renderer never receives the key: it sends requests through a main-process proxy that only talks to `https://openrouter.ai`, attaches the stored key, forwards a short header allowlist, and refuses redirects. Web keeps the key in `localStorage`; the CSP limits where a script could send it, and settings suggest a dedicated key with a limit. The key is never logged, never in chat history, diagnostics, or the workspace; error text is redacted.
- **Web search (opt-in, off by default):** when the user turns it on (composer globe or settings), requests carry OpenRouter's `openrouter:web_search` server tool, at most 3 searches and 15 results per request. The search query leaves OpenRouter for a search provider (Exa unless the model searches natively), which the privacy routing preference does not cover. Results are untrusted data: the system prompt tells the model never to follow instructions found in them, and any edit still needs the user's Apply.
- **Project instructions:** `AGENTS.md`, `agent.md` or `CLAUDE.md` in the open workspace are sent to the model as part of the system prompt. They are workspace content that may come from a third party, so the prompt ranks them below the Safety and Edit rules, and the panel shows which files apply. They cannot add tools or skip Apply.
- **Commands (desktop only, off by default, ADR-011):** one optional tool, `runCommand`, enabled per project in settings and absent on web and mobile. There is **no sandbox**: a command runs with the user's permissions, and a hostile file, web page or instruction file can try to steer the model, so this feature must not be described as safe. Controls: (1) the renderer never spawns a process; the main process runs it after a zod-checked IPC call and re-checks that the folder is a project the user opened, not a link out of it; (2) a scrubbed environment (no OpenRouter key, no secret-like variable); (3) one command at a time, 60 s default and 10 min cap, no standard input, the whole process tree killed on Stop or timeout, output kept in memory and capped; (4) manual approval by default, with the exact command shown; (5) the optional modes "AI check" and "Run without asking" only apply to plain read-only commands that pass a fixed, fail-closed filter (`packages/agent/src/shellPolicy.ts`) that no model or setting can override, and never to a turn that used web search, read or searched files the user did not open or name, or carries project instruction files; (6) the AI check sees only the command, shell and folder, and anything but an exact `allow` answer falls back to manual; (7) history stores the command and exit code, never the output. The setting lives in user settings, never in the project. The filter cannot see a link or junction that a command follows, and `git` reads repository configuration, so a project from an untrusted source should stay on manual approval.
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
