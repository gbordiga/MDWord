# Security

## Electron

| Setting | Value |
| --- | --- |
| `contextIsolation` | `true` |
| `nodeIntegration` | `false` |
| `sandbox` | `true` |
| Navigation | blocked except `mdword:` / `http://localhost` in dev |
| `openExternal` | `http:` / `https:` / `mailto:` only |

Preload exposes a frozen, typed `window.mdword` API. Every IPC handler validates:

- method name
- payload schema (zod)
- file paths (no traversal outside workspace / explicitly opened files)

## Content

- Raw HTML in Markdown is sanitized before visual render
- No `eval`, no document-supplied scripts
- Images load from allowed file URLs or `mdword-file:` / blob URLs created by the host
- `file://` is not granted to arbitrary Markdown paths

## Privacy

Offline by default. No analytics. Diagnostics export excludes document bodies. Recovery files stay in the application data directory.

## Web

Same sanitizer. File System Access API is user-gated. Vercel hosts only static assets.
