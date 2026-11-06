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
  from `self`/`data:`/`blob:`/`http(s)`, `connect-src 'self'` (or `'none'` in print),
  `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`. Development builds
  skip the policy because the dev server needs eval and a websocket.
- Mermaid renders with `securityLevel: "strict"`

## Privacy

Offline by default. No analytics. Diagnostics export excludes document bodies. Recovery files stay in the application data directory.

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
