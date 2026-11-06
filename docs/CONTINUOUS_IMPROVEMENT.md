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
| `pnpm test` | 66 files, 360 tests passing |
| `pnpm typecheck` | passing (all workspace projects) |
| `pnpm build:web` | passing |
| Playwright (chromium + mobile) | 73 tests passing |

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

## Backlog (highest first)

| Task | Why | Effort |
| --- | --- | --- |
| Crash drafts cover only the active tab | background dirty tabs are lost if the app crashes; needs per-tab recovery ids and a restore-all dialog | M |
| `LeftSidebar` outline is built from the debounced AST while `focusHeading` walks the live editor doc | a heading added and clicked within the debounce window can jump to the neighbour | S |
| `store.ts` owns tabs, files, export and undo in one 1100-line module | split workspace mutations into their own module once the next feature lands there | L |
| Sequential saves in `saveAllDirty` | correct but slow with many dirty tabs on close; measure before parallelising | M |
| `focusHeading` and `jumpToHeading` duplicate the heading walk | two traversals with slightly different filters; unify only if a third caller appears | S |

## Known limitations

- Playwright suites exercise the web build only; Electron-specific paths
  (`NotAllowedError` fallback, close guard IPC) are covered by unit tests only.
- Crash drafts are best-effort and single-document: only the active tab is written,
  and a tab closed within the debounce window keeps its content in memory only.
- `reloadWorkspace` swallows re-list failures on purpose (keeps the optimistic list).

## Next task

Make crash recovery cover every dirty tab (per-tab recovery ids, one restore
dialog), then make the outline read from the live editor document instead of the
debounced AST.
