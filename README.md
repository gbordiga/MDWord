# MDWord

**Write like Word. Save as text — because that is what AI can actually read.**

MDWord is a word processor for **AI-era documents**. The page looks like Word: A4, margins, header, page numbers. The file is plain Markdown. Models, agents, and search index **text**. They do not read `.docx` well — zipped XML, styles, and binary blobs. A `.md` they can open, quote, edit, and cite.

That is why the project exists. Not to invent another markup. To give people a real page whose source is already the format AI prefers.

It is not Word, Obsidian, Notion, or LaTeX. The source of truth is [MyST Markdown](https://mystmd.org/spec) plus a small layout block called **`mdoc`**.

```
You  →  page on screen  →  report.md  →  an LLM, Git, VS Code, twenty years from now
```

No proprietary binary. No cloud required. If MDWord disappears, the file is still a document — and still readable by a model.

---

## Why

Intelligence reads text. It does not read Word files.

A `.docx` is a zip of Office XML. Humans see a page; a model sees markup, revision junk, and lost structure. Markdown is headings, lists, tables, and meaning — the same document, already tokenized for a machine.

MDWord keeps the **author** in a Word-like UI and the **file** in that text. You write procedures and reports on a page. An assistant can summarize, rewrite, or check the same `.md` without a converter that mangles it.

People who want a real page and people who keep a folder in Git (or in an agent workspace) share **one file**.

| You write | AI and Git see |
| --- | --- |
| Heading 1, a table, margins, a PDF | Clean MyST — not a dump of `word/document.xml` |
| You never have to look at markup | Layout lives in `mdoc` YAML; the body stays prose |

---

## Features

**Writing**
Headings 1–6, bold / italic / underline, lists (including tasks), links, block quotes, callouts, code blocks, page breaks. Ribbon and contextual tabs for tables and images.

**The page**
Paper size and orientation, rulers, margins, type scale, running header and footer (`{{title}}`, `{{page}}` / `{{pages}}`), live table of contents, heading numbering. Layout is stored **in the file**, not in app settings.

**Tables and figures**
GFM pipe tables with column resize and caption. When you need widths or a label, MDWord writes a MyST `{table}` (and keeps `{list-table}` / `{csv-table}`). Images can live on disk or be embedded in the same `.md`. Mermaid diagrams and KaTeX equation blocks render in the page.

**Workspace**
Open a folder. Tabs, `[[wikilinks]]`, search, backlinks. Multiple documents without leaving the editor.

**Views**
Document · Source · Split. Same AST. Unknown MyST directives show as a Raw card and are never stripped on save.

**Export**
Print, PDF, and HTML use the same page model as the canvas.

**Offline**
Desktop (Windows / macOS / Linux), local-first web, mobile shells. Files stay on the device unless you export or save them yourself.

---

## Markdown dialects

MDWord does not invent a dialect. It stacks existing ones:

```
CommonMark     body everyone can read
    └── GFM    tables, task lists, strikethrough
         └── MyST    figures, callouts, rich tables, math, mermaid, page-break
              └── mdoc    page size, margins, typography, header/footer  (YAML only)
```

- **`.md` / `.markdown`** — the document. This is the file you share.
- **`mdoc:` in frontmatter** — layout of *this* document. Not a new markup. A processor that ignores it still reads the Markdown.
- **`.mdoc/` in a workspace** — optional templates and workspace config. Not the article itself.

```markdown
---
title: Audit report
mdoc:
  version: 1
  page: { size: A4, orientation: portrait }
  margins: { top: 20mm, right: 20mm, bottom: 20mm, left: 25mm }
  fontScale: medium
  header: { left: "{{title}}", right: "{{page}} / {{pages}}" }
---

# Findings

:::{note}
This file is still Markdown if you open it in GitHub.
:::
```

Details: [file format](docs/file-format.md) · [mdoc schema](docs/mdoc-schema.md)

---

## Run it

```sh
pnpm install
pnpm dev           # web  →  http://localhost:3000
pnpm dev:desktop   # Electron
```

```sh
pnpm test
pnpm build:web
pnpm dist          # desktop installers
```

Node 20+, pnpm. License [MIT](LICENSE).

---

## Repo

| | |
| --- | --- |
| `apps/web` | Next.js — web, Electron renderer, Capacitor |
| `apps/desktop` | Electron main process and installers |
| `apps/mobile` | Android / iOS shells |
| `packages/*` | parser, serializer, editor, layout, indexer |
| `docs/` | product, ADRs, format |

If a feature cannot live in a structured text file, it does not belong in MDWord.
