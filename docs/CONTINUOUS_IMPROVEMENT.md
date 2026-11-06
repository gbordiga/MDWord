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

## Baseline (2026-11-06)

| Check | Result |
| --- | --- |
| `pnpm test` | 66 files, 363 tests passing |
| `pnpm typecheck` | passing (all workspace projects) |
| `pnpm build:web` | passing |
| Playwright (chromium + mobile) | 75 tests passing |

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

## Backlog (highest first)

| Task | Why | Effort |
| --- | --- | --- |
| Crash drafts cover only the active tab | background dirty tabs are lost if the app crashes. Needs per-tab recovery ids, `listRecovery()` implemented in the Electron main process and the web IDB adapter (both return `[]` today), plus a restore-all dialog. Blocked until the Electron path can be exercised here. | L |
| `store.ts` owns tabs, files, export and undo in one 1100-line module | split workspace mutations into their own module once the next feature lands there | L |
| Sequential saves in `saveAllDirty` | correct but slow with many dirty tabs on close; measure before parallelising | M |
| `useEditorTick` still bumps on selection-only transactions | `useEditorDocVersion` exists now; move panels that do not depend on the caret over to it | S |

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

The next safe task is to move caret-independent panels (`Ribbon`, `MobileChrome`)
from `useEditorTick` to `useEditorDocVersion` where they only mirror content, and
to split short labels/messages out of `store.ts` as the first step of its split.
