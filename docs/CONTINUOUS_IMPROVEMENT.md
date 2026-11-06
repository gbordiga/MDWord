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

## Baseline (2026-11-06, version 0.1.8)

| Check | Result |
| --- | --- |
| `pnpm test` | 73 files, 417 tests passing |
| `pnpm typecheck` | passing (all workspace projects) |
| `pnpm build:web` | passing |
| Playwright (chromium + mobile) | 80 tests passing |

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

Version 0.1.8 is the state of this tree: the save path honours the “never silently
overwrite an external edit” promise, desktop builds update themselves from GitHub
Releases, recent files reopen from the File tab, image cleanup and file/export
failures report honestly, and the outline reads the live document.

Remaining work, in order:
1. **Publish one tag and verify the updater end-to-end.** With the release
   workflow in place: tag `v0.1.8`, install that build, bump to `0.1.9`, tag
   again, and confirm the installed app downloads and restarts into it. This also
   verifies recent files (`File → Recent` after a restart) on a packaged build.
2. Crash recovery for every dirty tab (blocked on `listRecovery()` across runtimes).
3. `store.ts` split once a feature touches the workspace actions.

## Releasing 0.1.8

The version is bumped in `package.json`, `apps/{web,desktop,mobile}/package.json`,
`packages/shared/src/constants.ts`, the `next.config.ts` fallback and
`docs/releasing.md`. Tagging, installers and store uploads stay with the release
checklist (`docs/COSA-DEVI-FARE.md`); nothing was deployed from here.

Recent files and auto-update are desktop-only and their IPC has not been exercised
outside a local Windows packaging run: check both on the first tagged build.
Publishing a tag uploads installers to GitHub Releases, so the first release must
be reviewed for `latest.yml`, `latest-linux.yml` and the `.blockmap` files.
