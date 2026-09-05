# Architecture

MDWord is a TypeScript pnpm monorepo. The Markdown file on disk is the source of truth. Every other representation is derived.

## Runtime topology

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web (Next.js, static export)                             │
│  Shared React application: ribbon, editor, source, panels  │
└──────────────────────────┬──────────────────────────────────┘
                           │ used as renderer
┌──────────────────────────┴──────────────────────────────────┐
│  apps/desktop (Electron)                                      │
│  Main: filesystem, dialogs, PDF, recovery, window           │
│  Preload: typed, minimal IPC                                 │
│  Renderer: sandboxed, no Node integration                    │
└──────────────────────────────────────────────────────────────┘
```

Web and desktop share packages. Desktop never exposes Node to document HTML.

## Package map

| Package | Responsibility |
| --- | --- |
| `@mdword/shared` | Units, paths, host types, constants |
| `@mdword/document-model` | Document session, diagnostics, model types |
| `@mdword/myst-parser` | Markdown → AST (MyST PRE + wikilinks + mdoc) |
| `@mdword/markdown-serializer` | AST → Markdown, YAML CST preservation |
| `@mdword/layout-engine` | mdoc schema, cascade, templates, page metrics |
| `@mdword/editor` | TipTap/ProseMirror schema and AST converters |
| `@mdword/source-editor` | CodeMirror 6 Markdown/MyST/YAML |
| `@mdword/renderer` | HTML + print/PDF document |
| `@mdword/workspace` | Folder, files, host adapters (Electron / browser) |
| `@mdword/indexer` | Derived FTS index (sql.js), backlinks |
| `@mdword/plugin-sdk` | Manifest + extension points (no 3p code in MVP) |
| `@mdword/ui` | Design tokens and primitives |

## Pipeline

```
Markdown source
    → extract YAML CST + body
    → mystParse(body) + wikilink rewrite
    → DocumentModel { frontmatter, mdoc, ast, source, diagnostics }
    → TipTap document  |  CodeMirror  |  HTML/PDF renderer
    → serialize(ast) + YAML CST dump
    → Markdown source
```

There is **one** document model. Document, Source, and Split are views of it.

## Pagination

The visual editor is a **single continuous ProseMirror document**. Page size, margins, headers, and footers are layout. Automatic page boundaries are decorations/overlays. They are never written to Markdown.

Explicit `:::{page-break}` is the only pagination that belongs in the file.

Print/PDF uses a separate paginated HTML pipeline (Chromium `printToPDF` on desktop; browser print on web).

## Security boundary

Renderer: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
IPC is typed and validated. Paths are resolved against an allowed root. Markdown HTML is sanitized. External links open in the system browser.

## Local-first

No backend. The Vercel deployment is a static client. Index, recovery, and preferences live in:

- Desktop: Electron `userData`
- Web: IndexedDB / Origin Private File System

## ADRs

See `docs/adr/`.
