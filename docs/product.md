# MDWord — Product specification

## Vision

MDWord is a **structured document editor**: semantic-first, with a Word-like writing experience and **MyST Markdown** as the native, durable file format.

It is not a clone of Microsoft Word, Obsidian, Notion, or LaTeX. It is a local, offline-first word processor built around a plain-text document that remains readable, diffable, and recoverable decades from now.

The user who comes from Word should be able to write, style headings, insert a table and a figure, set margins and headers, save, and print — without ever seeing Markdown.

The power user should open Source mode and find a clean, standard `.md` file.

Both work on the same document.

## Personas

### Marta — quality / operations author

Writes procedures, audit reports, and meeting minutes. Comes from Word. Cares about page size, headers, page numbers, and a professional PDF. Does not want to learn markup.

### Luca — technical writer

Maintains a folder of related Markdown files in Git. Wants wikilinks, backlinks, a table of contents, and a source view that stays pretty. Rejects proprietary binaries.

### Giulia — reviewer / auditor

Opens files in any text editor or on GitHub. Needs the document to remain intelligible without MDWord installed.

## Core use cases

1. Create a new A4 document and write as in a word processor.
2. Apply Heading 1–6, bold, italic, lists, links.
3. Insert a table, an image/figure, a callout, a code block, a page break.
4. Set page size, orientation, margins, typography, header, and footer.
5. Save as `report.md`; reopen in a text editor; the Markdown is clean.
6. Reopen in MDWord; the visual document matches.
7. Edit in Source or Split mode; return to Document mode; changes appear.
8. Open a folder as a workspace; create wikilinks; search; see backlinks.
9. Export PDF and HTML with pages, margins, headers/footers, and numbering.
10. Survive a crash via local recovery; never silently overwrite an external edit.

## Non-goals

MDWord will not implement:

- floating text boxes, absolute positioning, z-index, WordArt, decorative shapes
- character-by-character unconstrained formatting
- real-time collaboration (post-MVP)
- comments, track-changes, or a Git GUI in MVP
- DOCX as storage (export is interoperability only, post-MVP)
- a plugin marketplace in MVP
- telemetry of document content
- a new markup language

## MVP

See the Definition of Done in the master prompt. In short:

- File: New, Open, Save, Save As, recent files, open folder
- Editing: paragraphs, headings, emphasis, lists, links, tables, images, figures, blockquote, callouts, code, wikilinks, page breaks
- MyST + YAML frontmatter + `mdoc` namespace
- Document / Source / Split
- Page layout: size, margins, orientation, font, header/footer, page numbers
- Workspace: folder, wikilink, search, backlinks
- Export: PDF, HTML
- Reliability: atomic save, recovery, external-change prompt

## Future scope

Citations, equations UI, advanced cross-references, template gallery, DOCX export/import, plugin SDK, revision history, comments, collaboration, optional Git UI.

## Platforms

- **Desktop:** Electron installers for Windows (NSIS `.exe`), macOS (`.dmg`), Linux (`.AppImage` and `.deb`).
- **Web:** local-first Next.js app on Vercel. Documents never leave the device unless the user exports or saves them. The web app uses the File System Access API where available, with download/upload fallback.

## Privacy

Fully offline. No document is sent to a server. Telemetry is off. See `docs/security.md`.
