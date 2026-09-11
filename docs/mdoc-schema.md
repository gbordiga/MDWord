# mdoc schema

Machine-readable copy: [`schemas/mdoc.schema.json`](../schemas/mdoc.schema.json).

`mdoc` lives inside the document YAML frontmatter. It describes **layout and typography of this document**, not application chrome.

## Version

```yaml
mdoc:
  version: 1
```

Unknown future fields are preserved. Missing fields fall through the cascade (application → workspace → template → document).

## Page

```yaml
page:
  size: A4          # A4 | A3 | A5 | Letter | Legal | custom
  orientation: portrait  # portrait | landscape
```

Custom size:

```yaml
page:
  size:
    width: 210mm
    height: 297mm
  orientation: portrait
```

## Margins

```yaml
margins:
  top: 20mm
  right: 20mm
  bottom: 20mm
  left: 25mm
```

Units: `mm`, `cm`, `in`, `pt`. All lengths in mdoc must include a unit.

## Font size

Named type scale. New documents write this explicitly.

```yaml
fontScale: medium   # extra-small | small | medium | large | extra-large
```

`medium` is 11pt body. The scale sets title, subtitle, headings, caption and quote together. A processor that ignores `fontScale` still uses `typography` if present.

## Typography

Semantic styles only. No raw CSS.

```yaml
typography:
  body:
    font-family: Aptos
    font-size: 11pt
    line-height: 1.15
  heading-1:
    font-size: 20pt
    weight: 600
  heading-2:
    font-size: 16pt
    weight: 600
```

Allowed style keys: `body`, `title`, `subtitle`, `heading-1` … `heading-6`, `caption`, `quote`, `code`, `callout`.

Allowed properties per style: `font-family`, `font-size`, `weight`, `line-height`, `color` (named semantic tokens only: `default`, `muted`, `accent` — not arbitrary palettes in v1 beyond hex `#RRGGBB` for body/headings).

## Header and footer

```yaml
header:
  left: "{{title}}"
  center: ""
  right: "{{page}} / {{pages}}"
footer:
  left: ""
  center: ""
  right: "{{date}}"
```

Variables: `{{title}}`, `{{subtitle}}`, `{{author}}`, `{{date}}`, `{{page}}`, `{{pages}}`, `{{filename}}`, `{{section}}`. Unknown variables render as empty and are not stripped from the template string until resolution.

## Numbering

```yaml
numbering:
  headings: true
  figures: true
  tables: true
```

## TOC

```yaml
toc:
  enabled: true
  depth: 3
```

The TOC is generated at render time. It is not duplicated into the Markdown body unless the user inserts an explicit MyST `contents` directive.

## Template

```yaml
template: report
```

Names match files in the workspace `.mdoc/templates/` or built-in templates. **Embed template into document** copies resolved layout fields into `mdoc` so the file is portable.

## What must not appear

Zoom, caret, window bounds, dark mode, sidebar width, recent files, toolbar state. Those belong in application preferences.
