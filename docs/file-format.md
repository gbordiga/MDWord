# File format

This document is enough to implement a compatible parser without reading MDWord source.

## Encoding

UTF-8, LF preferred. `.md` is the canonical extension. The file is plain text.

## Layers

1. **CommonMark**
2. **GitHub Flavored Markdown** where compatible (tables, task lists, strikethrough)
3. **MyST Markdown** (colon-fence directives, roles, admonitions, figures, footnotes, math)
4. **mdoc** YAML namespace for pagination/typography (MDWord)
5. **Wikilinks** (MDWord extension, documented, disableable)

MyST version compatibility: the JavaScript `myst-parser` family (mdast PRE form). Unknown MyST constructs must round-trip.

## Frontmatter

A single YAML document between opening and closing `---` at the start of the file:

```markdown
---
title: "Rapporto audit"
mdoc:
  version: 1
---

# Body
```

Rules:

- Do not emit two consecutive YAML frontmatters.
- If a property exists in MyST/standard frontmatter, store it at the top level, never duplicated under `mdoc`.
- Unknown keys are preserved.
- Comments and key order are preserved when the editor mutates a subset of properties.
- Malformed YAML is kept as raw text, reported as a diagnostic, and must not be auto-repaired.

Standard keys MDWord reads: `title`, `subtitle`, `authors` (or `author`), `date`, `language`, `tags`, `exports`, plus any other MyST frontmatter.

## mdoc

See `docs/mdoc-schema.md` and `schemas/mdoc.schema.json`.

```yaml
mdoc:
  version: 1
  template: corporate-report
  page:
    size: A4
    orientation: portrait
  margins:
    top: 20mm
    right: 20mm
    bottom: 20mm
    left: 25mm
```

A processor that ignores `mdoc` still reads the Markdown body normally.

## Wikilinks

Extension, not core MyST. Disable with workspace `mdoc.wikilinks: false` (future) or by not using the syntax.

```
[[Document]]
[[Document|Visible label]]
[[Document#Section]]
[[folder/Document]]
```

Resolution (workspace mode):

1. Exact path relative to the current file, with or without `.md`
2. Unique basename match in the workspace
3. Otherwise: broken link

A parser that does not understand wikilinks should leave `[[...]]` as text.

## Explicit page break

```markdown
:::{page-break}
:::
```

This is a MyST directive in the `page-break` name. Automatic pagination must not insert this.

## Figures and images

Images use relative paths when a file is on disk, or a `data:` URL when the user embeds a local file. Prefer:

```markdown
![Alt text](./images/demo.png)

:::{figure} ./images/pump.png
:label: fig-pump
:align: left
:width: 40%
:class: float

Schema della pompa.
:::
```

`:align:` is block placement (`left` / `center` / `right`). Add `:class: float` for text wrap. `:width:` is a percent of the column. Simple `![alt](url)` images stay CommonMark. Do not embed base64 unless the user inserts a local file.

## Unknown nodes

Unsupported directives, roles, and HTML remain in the AST (typically `mystDirective` / raw nodes). Visual mode may show a “Raw / unsupported” block. Source mode always shows the original markup. Saving must not drop them.

## Versioning and migration

`mdoc.version` is an integer. v1 is the current schema. Future versions must:

- read older documents
- migrate on save only when the user-editable model requires it
- never rewrite a file solely to bump metadata

## Fallback behavior

| Consumer | Expected behavior |
| --- | --- |
| CommonMark-only | Body readable; YAML ignored or shown as text; directives appear as fenced blocks |
| MyST without mdoc | Body + MyST semantics; page layout uses defaults |
| MDWord | Full model |

## Longevity

Assume MDWord does not exist in 20 years. The file must still be a reasonable Markdown document.
