# Feasibility spikes

Spikes are implemented as automated tests and small modules in the production packages, not throwaway apps.

| Spike | Result | ADR |
| --- | --- | --- |
| 1 MyST parse/serialize | `myst-parser` + `myst-to-md` round-trip; unknown directives kept | ADR-002 |
| 2 ProseMirror/TipTap | Custom nodes for callout, figure, wikilink, page-break | ADR-004 |
| 3 Round-trip | Fixture suite `fixtures/round-trip` | ADR-001 |
| 4 Pagination | Continuous editor + overlay; print pipeline separate | ADR-005 |
| 5 PDF | Electron `printToPDF` + header/footer templates | ADR-009 |
| 6 Workspace | sql.js FTS + wikilink resolver; scales to thousands of files | ADR-007 |

See tests under `packages/*/src/*.test.ts`.
