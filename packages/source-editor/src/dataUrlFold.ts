import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, WidgetType, type ViewUpdate } from "@codemirror/view";

const DATA_URL = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/g;
const MIN_FOLD = 48;

export type DataUrlRange = { from: number; to: number; preview: string };

export function findDataUrlRanges(text: string): DataUrlRange[] {
  const ranges: DataUrlRange[] = [];
  const re = new RegExp(DATA_URL.source, "g");
  for (const match of text.matchAll(re)) {
    const raw = match[0] ?? "";
    const comma = raw.indexOf(",");
    const payload = comma >= 0 ? raw.slice(comma + 1).replace(/\s+/g, "") : "";
    if (payload.length < MIN_FOLD) continue;
    const from = match.index ?? 0;
    const preview = `${raw.slice(0, Math.max(comma + 1, 12))}…`;
    ranges.push({ from, to: from + raw.length, preview });
  }
  return ranges;
}

const toggleFold = StateEffect.define<{ from: number; to: number }>();

const expandedField = StateField.define<Set<string>>({
  create() {
    return new Set();
  },
  update(value, tr) {
    const next = new Set(value);
    for (const effect of tr.effects) {
      if (effect.is(toggleFold)) {
        const key = `${effect.value.from}:${effect.value.to}`;
        if (next.has(key)) next.delete(key);
        else next.add(key);
      }
    }
    if (tr.docChanged) next.clear();
    return next;
  }
});

class FoldWidget extends WidgetType {
  constructor(
    readonly preview: string,
    readonly from: number,
    readonly to: number
  ) {
    super();
  }

  override eq(other: FoldWidget): boolean {
    return this.preview === other.preview && this.from === other.from && this.to === other.to;
  }

  override toDOM(view: EditorView): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-data-url-fold";
    span.textContent = this.preview;
    span.title = "Show embedded image data";
    span.dataset.testid = "data-url-fold";
    span.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({ effects: toggleFold.of({ from: this.from, to: this.to }) });
    });
    return span;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

function decorations(doc: string, expanded: Set<string>): DecorationSet {
  const ranges = findDataUrlRanges(doc);
  const deco = ranges
    .filter((range) => !expanded.has(`${range.from}:${range.to}`))
    .map((range) =>
      Decoration.replace({
        widget: new FoldWidget(range.preview, range.from, range.to),
        inclusive: false
      }).range(range.from, range.to)
    );
  return Decoration.set(deco, true);
}

export function dataUrlFold() {
  return [
    expandedField,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = decorations(view.state.doc.toString(), view.state.field(expandedField));
        }
        update(update: ViewUpdate) {
          if (update.docChanged || update.transactions.some((tr) => tr.effects.length)) {
            this.decorations = decorations(update.state.doc.toString(), update.state.field(expandedField));
          }
        }
      },
      { decorations: (value) => value.decorations }
    )
  ];
}
