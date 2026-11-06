# Continuous improvement log

Operational notes for maintenance sessions. Read this before starting work, update it
after each meaningful change. Project facts live in `docs/architecture.md`,
`docs/file-format.md` and `docs/testing.md`; do not duplicate them here.

## How to verify

```sh
pnpm test          # vitest, packages/** + apps/**
pnpm typecheck     # tsc --noEmit across the workspace
pnpm build:web     # Next.js production build
pnpm --filter @mdword/web exec playwright test   # chromium + mobile
```

Record the result of each command you actually run. Do not claim a check that did
not run.

## Baseline (2026-11-06, version 0.1.13)

| Check | Result |
| --- | --- |
| `pnpm test` | 76 files, 431 tests passing |
| `pnpm typecheck` | passing (all workspace projects) |
| `pnpm build:web` | passing |
| Playwright (chromium + mobile) | 82 tests passing |

Environment note: the repo declares Node 26 (`engines`), the current machine runs
Node 24, so pnpm prints an engine warning. Everything above still passes.

## Invariants to preserve

- `DocumentModel.source` is the source of truth. Save writes that string; it never
  re-serializes the AST (`saveDocument` returns `model.source`).
- `open(source) → save(model) === source` unless the user edited that region.
- Unknown MyST syntax must survive a save (Raw card, never stripped).
- No document content in logs or error messages.
- Errors shown to users are short, friendly strings; details stay in `console.error`.
- Saves must target the tab that started the write, and must never mark a tab clean
  when the model changed while the write was in flight.

## Completed

### 2026-11-06 — Save race could lose edits

- **Problem:** `markSaved` applied the pre-write model and forced `dirty: false`
  after the await. Edits typed during the disk write were dropped from the store
  model, and the tab looked saved. It also patched whichever tab was active when
  the write finished, not the one being saved.
- **Solution:** `markSaved(tabId, path, content)` matches by tab id and recomputes
  `dirty` from the current model source. Extracted `writeTabContent(tabId)` shared
  by `saveFile` and `saveTab`; `saveTab` no longer activates the tab it saves, so
  closing a dirty background tab (or cancelling its file picker) leaves the visible
  document alone.
- **Files:** `apps/web/src/lib/store.ts`
- **Tests:** `apps/web/src/lib/store.saveFile.test.ts`
- **Verified:** unit tests, typecheck, build, Playwright `find-save`,
  `open-file-tabs`, `tab-bar`, `complete-ux`.

### 2026-11-06 — Outline jump landed on the wrong heading

- **Problem:** `collectEditorHeadings` skipped empty headings, `jumpToHeading`
  counted them. A document with an empty heading (the default new document starts
  with `# `) jumped to the wrong place.
- **Solution:** one shared traversal (`headingEntries`) feeds both the list and the
  jump. Numbering is unchanged: empty headings still consume a number, matching
  `collectTocItems` in the renderer.
- **Files:** `apps/web/src/lib/toc.ts`
- **Tests:** `apps/web/src/lib/toc.test.ts`

### 2026-11-06 — Silent file and export failures

- **Problem:** failed save/open/folder/PDF/print/HTML operations only reached
  `console.error`; `exportPdf` and `printDocument` also had no `catch`, so a
  rejection was unhandled. Users could believe the document was saved.
- **Solution:** `errorMessage` in the app store, set on failure and cleared on the
  next success, rendered by a dismissible `role="alert"` banner under the toolbars.
  Export paths now catch and report.
- **Files:** `apps/web/src/lib/store.ts`,
  `apps/web/src/components/ErrorBanner.tsx`,
  `apps/web/src/components/AppShell.tsx`
- **Tests:** `apps/web/src/lib/store.saveFile.test.ts` (failure + retry clears),
  `apps/web/e2e/error-banner.spec.ts` (announced, dismissible)

### 2026-11-06 — Outline work on every cursor move

- **Problem:** `collectEditorHeadings` walked the whole document on every render of
  the editor body, including selection updates, even when the TOC was disabled.
- **Solution:** `useMemo` keyed on the immutable ProseMirror document identity and
  on `toc.enabled`; the walk now runs only when content changes and the TOC is on.
- **Files:** `apps/web/src/components/VisualEditor.tsx`

### 2026-11-06 — Replaced documents were invisible to React panels

- **Problem:** `replaceEditorDocument` called `view.updateState`, which bypasses
  Tiptap's dispatcher. No transaction was emitted, so panels that read the live
  document (page TOC, sidebar outline) kept showing the previous document after an
  open until something else forced a re-render.
- **Solution:** after recreating the state, a no-op replace of the same content is
  dispatched with `addToHistory: false`. It emits a normal `docChanged`
  transaction, so `shouldRerenderOnTransaction`, `useEditorTick` and outline
  readers update, without touching undo history. The document checks and the undo
  reset are unchanged.
- **Files:** `packages/editor/src/replaceEditorDocument.ts`
- **Tests:** `packages/editor/src/replaceEditorDocument.test.ts` (now tests the
  function itself, not a copy of its logic),
  `apps/web/e2e/outline-headings.spec.ts`

### 2026-11-06 — Sidebar outline read a debounced copy

- **Problem:** the sidebar outline came from `model.ast` (up to ~200 ms behind the
  editor) while the jump used the live document, so the two could disagree; the
  heading walk also existed twice (`focusHeading`, `jumpToHeading`).
- **Solution:** the outline now reads the live editor document through
  `collectEditorOutline`, refreshed by `useEditorDocVersion` (doc changes only, not
  cursor moves), and jumps by the heading's ProseMirror position
  (`jumpToHeadingPos`). The AST remains the source only while the visual editor is
  not mounted. `focusHeading` was removed: one traversal, one jump path.
- **Files:** `apps/web/src/lib/toc.ts`, `apps/web/src/components/LeftSidebar.tsx`,
  `apps/web/src/hooks/useEditorDocVersion.ts`,
  `apps/web/src/lib/editorCommands.ts`
- **Tests:** `apps/web/src/lib/toc.test.ts`,
  `apps/web/e2e/outline-headings.spec.ts` (both cases fail without the editor fix
  above)

### 2026-11-06 — Image cleanup reported success it did not have

- **Problem:** `deleteImportedImageFiles` swallowed every per-file error, so the
  import dialog closed as if the originals were gone when they were still on disk.
  `importDocumentImages` could also reject with no user feedback at all.
- **Solution:** the delete helper now returns `{ deleted, failed }` (a file that is
  already missing counts as deleted, checked with `files.exists`). The dialog stays
  open and shows which files are still in the workspace; a failing import reports
  through the app error banner. The inline name error in the file tree is announced
  with `role="alert"`.
- **Files:** `apps/web/src/lib/importDocumentImages.ts`,
  `apps/web/src/components/ImportImagesControl.tsx`,
  `apps/web/src/components/FileTree.tsx`
- **Tests:** `apps/web/src/lib/deleteImportedImages.test.ts` (dedupe, already gone,
  still on disk), e2e `import-images`

### 2026-11-06 — Workspace mutations had no regression tests

- **Problem:** create/rename/copy/delete were only covered through the file-tree
  e2e flows. The validation rules and the tab bookkeeping lived in `store.ts` with
  no test that pinned them.
- **Solution:** added store-level tests with a mocked host: refusal without a folder,
  name validation before any disk call, unique naming (create and copy), rename
  no-op / duplicate rejection / tab path rewrite, delete refusing the root and
  closing the tabs inside the deleted path.
- **Files:** `apps/web/src/lib/store.workspace.test.ts` (tests only, no behaviour
  change)

### 2026-11-06 — Saving could silently overwrite an external edit

- **Problem:** the product promises “never silently overwrite an external edit”, but
  nothing checked the file before writing. If another editor (or an agent) changed
  the file while it was open, the next save replaced that work without a word.
  `externalDialog` existed in the store but was never set and had no UI.
- **Solution:** before writing a file that has a path, the store reads the current
  disk text and compares it with the tab's saved baseline and the pending text.
  A conflict opens a prompt: **Overwrite** keeps the local text, **Reload from
  disk** adopts the disk version (and resets that tab's undo), **Cancel** leaves
  the edit unsaved. When the disk cannot be read (missing handle, web session after
  reload), saving behaves as before. `saveAllDirty` inherits the check.
- **Files:** `apps/web/src/lib/externalChange.ts`,
  `apps/web/src/components/ExternalChangeDialog.tsx`, `apps/web/src/lib/store.ts`,
  `apps/web/src/components/AppShell.tsx`
- **Tests:** `apps/web/src/lib/externalChange.test.ts` (decision table),
  `apps/web/src/lib/store.saveFile.test.ts` (blocked save, overwrite, reload,
  cancel, unchanged disk, unreadable disk), `apps/web/e2e/external-change.spec.ts`
  (prompt appears, reload adopts the disk text, cancel keeps the edit unsaved)
- **Limits:** the web host keeps its own text cache, so detection is exact on
  desktop and best-effort in the browser; changes made while the app is closed are
  reported on the next save, not while typing.

### 2026-11-06 — Recent files (MVP checklist item)

- **Problem:** `UserPreferences.recentFiles` existed but nothing read preferences,
  so the File tab had no way to reopen a document. A desktop restart also left
  recent paths outside the Electron allowlist.
- **Solution:** the **main process** now owns the list. It records a path when the
  user opens a file from the dialog, saves with Save As, or the OS opens a document,
  through `rememberRecentFile` (dedupe, cap 10, Windows case folding). The new
  `files.openRecent(path)` rejects anything that is not already in that list before
  adding its folder to `allowedRoots`, so the allowlist is not widened.
  `app.setPreferences` now strips `recentFiles` from renderer payloads: the
  renderer must not be able to turn preferences into a path allowlist.
  The renderer loads the list, shows up to five entries in the File tab, and opens
  them from the preloaded content (no second read). Hosts without `openRecent`
  (web, mobile) keep the section hidden.
- **Files:** `packages/shared/src/recentFiles.ts`,
  `apps/desktop/src/main/index.ts`, `apps/desktop/src/preload/index.ts`,
  `packages/shared/src/host.ts`, `apps/web/src/lib/store.ts`,
  `apps/web/src/components/Ribbon.tsx`, `apps/web/src/components/AppShell.tsx`
- **Tests:** `packages/shared/src/recentFiles.test.ts` (ordering, dedupe, case
  folding, cap, sanitising), `apps/web/src/lib/store.recentFiles.test.ts` (hidden
  without host support, sanitized load, opens preloaded content, reports a failure)
- **Partially verified:** the Electron IPC cannot be executed here. Main/preload are
  typechecked and the pure list logic is tested, but a desktop build must confirm
  `files.openRecent` before release.

### 2026-11-06 — Automatic updates through GitHub Releases

- **Problem:** `electron-updater` was a dependency but nothing used it and
  `electron-builder.yml` had `publish: null`, so desktop users had to notice and
  install every new build by hand.
- **Solution:** the publish provider is now GitHub (`gbordiga/MDWord`), which
  embeds `app-update.yml` and emits `latest*.yml` + `.blockmap` on build.
  `apps/desktop/src/main/updater.ts` checks once after launch (silent), downloads
  in the background, auto-installs on quit and exposes status to the renderer
  through `app.updates` IPC. The renderer shows a dismissible banner (progress,
  then *Restart to update*), keeps a *File → Updates* button for a manual check
  with *Try again* on failure, and saves every dirty tab before restarting so the
  close guard cannot discard work. The web and mobile hosts have no bridge, so the
  banner and the button never appear there.
  `.github/workflows/release.yml` validates the tag against `package.json`, then
  publishes Linux (AppImage/deb) and Windows (NSIS) artifacts with `GH_TOKEN`.
- **Files:** `packages/shared/src/updates.ts`, `packages/shared/src/host.ts`,
  `apps/desktop/src/main/updater.ts`, `apps/desktop/src/main/index.ts`,
  `apps/desktop/src/preload/index.ts`, `apps/desktop/electron-builder.yml`,
  `apps/desktop/package.json`, `apps/web/src/lib/store.ts`,
  `apps/web/src/components/UpdateBanner.tsx`,
  `apps/web/src/components/Ribbon.tsx`, `apps/web/src/components/AppShell.tsx`,
  `.github/workflows/release.yml`
- **Tests:** `apps/web/src/lib/updateNotice.test.ts` (silent states, progress,
  restart, up-to-date, retry), `apps/web/src/lib/store.updates.test.ts`
  (subscription, unsupported host, failed check, saves before install, refuses to
  restart when a save is cancelled), `apps/web/e2e/update-banner.spec.ts`
  (downloaded banner, progress banner, no controls on web)
- **Verified:** a real Windows packaging run (`electron-builder`, unsigned)
  produced `latest.yml` with sha512, `MDWord-Setup-0.1.8.exe.blockmap` and a
  packaged `app-update.yml` pointing at `gbordiga/MDWord`. The workflow YAML parses
  and the desktop main/preload build.
- **Partially verified:** no tagged release was published from here, so the
  end-to-end download/install and macOS signing were not executed. First release
  after this change must confirm `latest*.yml` is attached to the GitHub Release.
- **Limits:** Linux updates only work for the AppImage (deb is upgraded by the
  package manager); macOS requires a signed + notarized build.

### 2026-11-06 — CodeQL High: polynomial regexes on document input (#52, #53, #54)

- **Problem:** three CodeQL `High` alerts for “polynomial regular expression used on
  uncontrolled data”: `sanitizeExportFileName` (`/[. ]+$/g`),
  `headingSlug` (`/^-+|-+$/g`) and the GFM cell text (`/\s*
\s*/g`). These run
  on document titles, heading text and table cells, i.e. on file content. Measured
  in V8 on 200k characters: 38 s, 28 s and 33 s respectively.
- **Solution:** the trailing/leading runs are now stripped by linear scans in
  `@mdword/shared/strings` (`stripEdgeChars`, `stripEdgeDashes`, existing
  `stripTrailingChars`), and the newline collapse in GFM cells is an explicit
  scan over the same whitespace set as `\s`. Semantics are unchanged: dots and
  spaces are still kept mid-name, whitespace runs without a newline are still left
  alone, and CRLF collapses like LF.
- **Files:** `packages/shared/src/strings.ts`, `packages/shared/src/title.ts`,
  `packages/shared/src/paths.ts`, `packages/shared/src/mystTables.ts`
- **Tests:** `title.test.ts` (trailing runs, 100k-char tails under a 500 ms
  budget), `paths.test.ts` (slug edges, 20k-dash runs), `mystTables.test.ts`
  (LF/CRLF/multiple newlines, untouched plain whitespace, 100k-space cell under
  500 ms). The two timing tests **fail on the previous implementation**
  (6.6 s and 7.9 s against the 500 ms budget) and pass now.
- **Note:** the `headingSlug` pattern was flagged structurally; its input cannot
  actually reach a long dash run because `[^a-z0-9]+` collapses separators first.
  The replacement is still exact and removes the pattern CodeQL objects to.

### 2026-11-06 — Security audit for 0.1.8

- **Scope:** dependencies (`pnpm audit`), Electron window/IPC configuration,
  navigation allowlist, protocol handler, HTML sanitizing and CSP, external links,
  recent-files and auto-update additions, GitHub Actions permissions.
- **Findings fixed:**
  1. `will-navigate` accepted `http://localhost` in packaged builds. The preload
     bridge is attached to every navigation in that window, so any page served on
     localhost would have received `window.mdword`. The dev-server origin is now
     allowed only when `isDev`.
  2. No Content Security Policy. The static app now ships one in production
     (same-origin scripts because Next.js needs inline bootstrap, inline styles for
     Tiptap/Paged.js, `data:`/`blob:`/`http(s)` images, `connect-src 'self'`,
     `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`), and the
     Electron print window gets the same policy injected by the `mdword://`
     handler with `connect-src 'none'`.
- **Checked, no change needed:** `contextIsolation`/`sandbox`/no `nodeIntegration`,
  window-open handler, `openExternal` validation, `mdword://` path traversal check,
  permission handlers (only `fileSystem`), zod schemas on IPC payloads, images in
  `sanitize-html` restricted to `http/https/data`, Mermaid `securityLevel: strict`,
  recent-files list owned by the main process, updater checksums via `latest*.yml`,
  no secrets or document content in logs, workflow permissions minimal.
- **Accepted risk, documented:** `assertImageRead` lets a workspace document read
  an image up to four folders above an allowed root (needed for imported
  documents); exfiltration is blocked by `connect-src`.
- **Files:** `apps/desktop/src/main/index.ts`, `apps/web/src/app/layout.tsx`,
  `docs/security.md`, `docs/security-tests.md`
- **Verified:** `pnpm audit --audit-level=high` clean; the **production** build was
  served from `apps/web/out` and driven with Chromium: editor loads, typing works,
  KaTeX renders, an `srcdoc` frame with an inline script, inline style and data
  image runs (the print-document shape), and the console reports **no CSP
  violations**. The Electron navigation/print changes are typechecked and their
  directives match the ones exercised in Chromium, but they were not executed in a
  packaged Electron window.

### 2026-11-06 — Performance audit for 0.1.9

- **Method:** a throwaway benchmark on a generated 27 KB / 720-block report measured
  the document pipeline; each number below is the best of three runs on this
  machine.
- **Findings and fixes:**
  1. **`applyVisualDocument` took 3.6 s per visual edit.** `lcsMatches` built an
     `n×m` table of `semanticAstEqual` calls (each a `JSON.stringify` of a whole
     block) on every debounced keystroke. It now matches the unchanged prefix and
     suffix directly and runs LCS only on the differing middle, capped at 20k
     cells. Membership checks that were `Array.some` over the match list are sets,
     and the "previous match" lookups are a single forward scan.
     **3.6 s → ~100 ms** (and the new guard test on a smaller document: old
     1.8 s, new ~50 ms).
  2. **Opening a document took 134 ms.** `mapDisplayLineToBody` fell back to a
     full line LCS whenever the rewritten display text had a different line count
     (any document with GFM tables). Replaced with unique-line anchoring plus a
     longest-increasing-subsequence pass (O(n log n)); the per-block
     `lineStartOffsets` scan is now computed once.
     **134 ms → 43 ms** (`mystParse` itself is 35 ms of that).
  3. **The numbering plugin walked the whole document on every transaction**,
     including cursor moves (`toJSON` + AST conversion + index build). The
     decoration set is now cached on the immutable ProseMirror document identity.
  4. `rebuildBody`'s `[...matches].reverse()` copies inside loops are linear scans.
- **Unchanged and fine:** `saveDocument` is O(1), `renderPrintDocument` ~15 ms,
  `buildNumberingIndex` ~1 ms, `visualProjection` ~7 ms, KaTeX ~0.3 ms after
  warm-up, workspace indexing is concurrency-limited with a cache.
- **Measured baseline for the bundle (backlog, not changed here):** initial JS is
  ~3.17 MB uncompressed across 11 chunks, dominated by the MyST parser stack
  (~1.6 MB, needed at startup) and KaTeX (~258 KB, only needed when a document
  contains math). Mermaid/d3/cytoscape (~2 MB) are correctly lazy-loaded.
- **Files:** `packages/document-model/src/applyVisual.ts`,
  `packages/myst-parser/src/blockSpans.ts`,
  `packages/editor/src/mystNumberingPlugin.ts`
- **Tests:** `packages/document-model/src/applyVisual.perf.test.ts` (long document
  under an 800 ms budget — the old code needs 1.8 s — plus a byte-preservation
  check around an insertion). All 419 unit tests and 80 e2e tests pass.

### 2026-11-06 — Debugging audit for 0.1.10

- **Method:** inventoried logging, swallowed catches, promise handling, error
  boundaries, dev-only hooks, diagnostics and the crash-draft paths across
  `packages/**` and `apps/**`.
- **Clean already:** no `console.log`/`debug`/`trace` in shipped code; every
  `console.error` names the operation; dev hooks (`__MDWORD_APP__`,
  `__MDWORD_PRIME_FILE__`) are compiled out of production builds; the visual
  editor has an error boundary with a "open source" escape; the IPC handlers and
  the print window are already covered by the security audit.
- **Findings fixed:**
  1. **Unexpected failures were silent.** `window.error` and
     `unhandledrejection` had no listeners, so a broken render path or a rejected
     `void` promise left a trace only in devtools. `lib/errorReporting.ts` now
     captures them (ignoring cancelled pickers, aborted captures and
     ResizeObserver noise), logs them with context, shows a generic banner (details
     never reach the user) and keeps the newest 20 in memory.
  2. **No way to hand over a report.** `exportDiagnostics` existed but nothing
     called it. The command palette has **Copy diagnostics**, which copies version,
     platform, logs and the recent errors as JSON — never document bodies. A
     transient **notice** channel was added to the store so confirmations do not
     reuse the red error banner.
  3. **Crash-draft cleanup could reject unhandled.** `clearCrashDraft` is called as
     `void` from saves and tab closes; it now logs instead of rejecting, and the
     startup `readCrashDraft` has an explicit `catch`.
  4. **AST conversion fallbacks were invisible.** `astToTiptap` and
     `visualProjection` returned an empty document on error without a trace; both
     now log, so a conversion bug cannot masquerade as an empty page.
- **Files:** `apps/web/src/lib/errorReporting.ts`, `apps/web/src/lib/diagnostics.ts`,
  `apps/web/src/lib/recovery.ts`, `apps/web/src/lib/store.ts`,
  `apps/web/src/components/ErrorBanner.tsx`, `apps/web/src/components/AppShell.tsx`,
  `apps/web/src/components/CommandPalette.tsx`,
  `packages/editor/src/astToTiptap.ts`, `docs/development.md`
- **Tests:** `apps/web/src/lib/errorReporting.test.ts` (benign filter, message
  flattening, ring buffer cap, installer wiring, diagnostics merge without
  content), `apps/web/e2e/diagnostics.spec.ts` (unexpected rejection → banner →
  Copy diagnostics contains the error and not the document text; `AbortError` is
  ignored). All 426 unit tests and 82 e2e tests pass.

### 2026-11-06 — CI guarantees the Windows release (0.1.11)

- **Problem:** the `windows` job already built and published the NSIS installer, but
  nothing verified it: a release could be green (or half-published) with the Windows
  installer, its `.blockmap` or `latest.yml` missing, which silently breaks updates
  for installed apps.
- **Solution:** the Windows job now runs `pnpm test`, retries the publish three
  times like Linux, and a new `verify-release` job (needs `linux` + `windows`) runs
  `scripts/verify-release.mjs <tag>`. The script checks the GitHub Release for
  `MDWord-Setup-X.Y.Z.exe`, its `.blockmap`, `MDWord-X.Y.Z.AppImage`,
  `MDWord-X.Y.Z.deb`, `latest.yml` and `latest-linux.yml`, and downloads both
  metadata files to confirm `version:` matches the tag.
- **Files:** `.github/workflows/release.yml`, `scripts/verify-release.mjs`,
  `docs/releasing.md`
- **Verified:** the script passes on the published `v0.1.10` release (all six
  artifacts, both metadata files at `0.1.10`) and exits non-zero on `v0.1.0`, which
  only has the `.exe`. The workflow YAML parses with the four expected jobs.

### 2026-11-06 — "Could not check for updates": chain verified, failure now explains itself

- **Report:** an installed desktop build showed *Could not check for updates* with
  no detail.
- **Verified the release side is correct** (live calls): `releases/latest` returns
  `v0.1.11` with `latest.yml`; `latest.yml` and `MDWord-Setup-0.1.11.exe` download
  from `releases/download/v0.1.11/` (302 to release-assets, 200); the atom feed
  lists 0.1.11; the packaged `resources/app-update.yml` is `owner: gbordiga,
  repo: MDWord, provider: github, releaseType: release`; and a real
  `electron-updater` run from a scratch Electron app printed
  `Found version 0.1.11 (url: MDWord-Setup-0.1.11.exe)` with the sha512 from the
  release. CI publishes the Windows release and the client reaches it.
- **Why it was opaque:** the reason only reached the main-process console, which a
  packaged Windows app does not show, and the banner always said the same sentence.
- **Fixed:**
  1. `updateErrorReason` (`@mdword/shared`) maps electron-updater codes and
     messages to `HTTP 404`, `DNS lookup failed`, `network unavailable`,
     `certificate rejected`, `release metadata missing`, ... including the real
     `HTTP_ERROR_404` shape captured from a failing run.
  2. The banner shows `Could not check for updates (HTTP 404).`; manual failures
     stay visible, background ones stay silent but logged.
  3. The main process writes `logs/updater.log` (capped at 64 KB) with
     electron-updater's own lines, and Copy diagnostics includes its tail.
  4. A failed check retries once after 2.5 s before reporting.
- **Files:** `packages/shared/src/updates.ts`, `apps/desktop/src/main/updater.ts`,
  `apps/desktop/src/main/index.ts`, `docs/releasing.md`
- **Tests:** `packages/shared/src/updates.test.ts`.
- **Verified in a packaged window:** the locally built 0.1.11 `win-unpacked` app
  wrote `updater.log` and logged
  `Found version 0.1.12 (url: MDWord-Setup-0.1.12.exe)` right after 0.1.12 was
  published, then started the differential download and fell back to the full one
  (the cached installer came from a local build, so its blocks did not match the
  released blockmap — the fallback is the expected behaviour). A 0.1.13 polish
  sets `disableWebInstaller` and keeps electron-updater's blockmap dumps out of the
  log.

## Backlog (highest first)

| Task | Why | Effort |
| --- | --- | --- |
| Crash drafts cover only the active tab | background dirty tabs are lost if the app crashes. Needs per-tab recovery ids, `listRecovery()` implemented in the Electron main process and the web IDB adapter (both return `[]` today), plus a restore-all dialog. Blocked until the Electron path can be exercised here. | L |

## Decisions

- **`saveAllDirty` stays sequential.** The web host funnels every write through one
  queue (`enqueueWrite`), so parallel saves would serialize anyway; on desktop the
  win is milliseconds while the busy-state races are real. Revisit only with a
  profile that shows the close guard waiting.
- **The `store.ts` split waits.** Moving workspace mutations into
  `apps/web/src/lib/workspaceActions.ts` needs a context object; the actions are
  covered now, so the split is low risk whenever a feature touches them.
- **`Ribbon`, `MobileChrome` and `LinkBubble` keep `useEditorTick`.** Their state
  depends on the caret, not only on the content.

## Known limitations

- Playwright suites exercise the web build only; Electron-specific paths
  (`NotAllowedError` fallback, close guard IPC) are covered by unit tests only.
- Crash drafts are best-effort and single-document: only the active tab is written,
  and a tab closed within the debounce window keeps its content in memory only.
- `reloadWorkspace` swallows re-list failures on purpose (keeps the optimistic list).

## Next task

Crash recovery for every dirty tab is the highest-value remaining item, but it is
blocked: `listRecovery()` has no implementation in the Electron main process or the
web IDB adapter, and the multi-tab restore flow cannot be exercised without an
Electron runtime. Landing it needs a desktop build to verify, otherwise recovery
could silently stop working.

Version 0.1.13 is the state of this tree: the save path honours the “never silently
overwrite an external edit” promise, desktop builds update themselves from GitHub
Releases, recent files reopen from the File tab, failures are reported and can be
copied as a diagnostics report, the outline reads the live document, and visual
edits on long documents are ~35× cheaper.

Remaining work, in order:
1. **Publish one tag and verify the updater end-to-end.** With the release
   workflow in place: tag `v0.1.8`, install that build, bump to `0.1.9`, tag
   again, and confirm the installed app downloads and restarts into it. This also
   verifies recent files (`File → Recent` after a restart) on a packaged build.
2. Crash recovery for every dirty tab (blocked on `listRecovery()` across runtimes).
3. `store.ts` split once a feature touches the workspace actions.

## Releasing 0.1.13

The version is bumped in `package.json`, `apps/{web,desktop,mobile}/package.json`,
`packages/shared/src/constants.ts`, the `next.config.ts` fallback and
`docs/releasing.md`. Tagging, installers and store uploads stay with the release
checklist (`docs/COSA-DEVI-FARE.md`); nothing was deployed from here.

Recent files and auto-update are desktop-only and their IPC has not been exercised
outside a local Windows packaging run: check both on the first tagged build.
Publishing a tag uploads installers to GitHub Releases, so the first release must
be reviewed for `latest.yml`, `latest-linux.yml` and the `.blockmap` files.
