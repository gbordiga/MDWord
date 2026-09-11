import { Annotation, StateEffect, StateField, type EditorState } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, WidgetType, type ViewUpdate } from "@codemirror/view";
import { displayImageStub, findDataUrlRanges, findDisplayImageStubs, foldPreview } from "@mdword/shared";

export {
  findDataUrlRanges,
  foldEmbeddedDataUrls,
  stubEmbeddedImages,
  stubEmbeddedImagesForDisplay,
  stubToken
} from "@mdword/shared";
export type { DataUrlRange } from "@mdword/shared";

export const setSourceAnnotation = Annotation.define<boolean>();
export const setImagePayloads = StateEffect.define<string[]>();
const toggleFold = StateEffect.define<{ from: number; to: number }>();

const payloadsField = StateField.define<string[]>({
  create() {
    return [];
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setImagePayloads)) return effect.value;
    }
    return value;
  }
});

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
    if (tr.docChanged && !tr.effects.some((effect) => effect.is(toggleFold))) next.clear();
    return next;
  }
});

class FoldWidget extends WidgetType {
  constructor(
    readonly preview: string,
    readonly from: number,
    readonly to: number,
    readonly expandTo?: string,
    readonly collapseTo?: string,
    readonly mode: "expand" | "collapse" = "expand"
  ) {
    super();
  }

  override eq(other: FoldWidget): boolean {
    return (
      this.preview === other.preview &&
      this.from === other.from &&
      this.to === other.to &&
      this.expandTo === other.expandTo &&
      this.collapseTo === other.collapseTo &&
      this.mode === other.mode
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-data-url-fold";
    span.textContent = this.preview;
    span.title = this.preview;
    span.dataset.testid = this.mode === "collapse" ? "data-url-unfold" : "data-url-fold";
    span.addEventListener("mousedown", (event) => {
      event.preventDefault();
      if (this.expandTo) {
        view.dispatch({
          changes: { from: this.from, to: this.to, insert: this.expandTo },
          effects: toggleFold.of({ from: this.from, to: this.from + this.expandTo.length }),
          annotations: setSourceAnnotation.of(true)
        });
        return;
      }
      if (this.collapseTo != null && this.collapseTo !== "") {
        view.dispatch({
          changes: { from: this.from, to: this.to, insert: this.collapseTo },
          annotations: setSourceAnnotation.of(true)
        });
        return;
      }
      view.dispatch({ effects: toggleFold.of({ from: this.from, to: this.to }) });
    });
    return span;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

function stubForUrl(payloads: string[], url: string): string | undefined {
  const index = payloads.findIndex((item) => item === url);
  if (index < 0) return undefined;
  return displayImageStub(index, url);
}

function decorationsForState(state: EditorState): DecorationSet {
  const expanded = state.field(expandedField);
  const payloads = state.field(payloadsField);
  const deco = [];
  for (let lineNo = 1; lineNo <= state.doc.lines; lineNo++) {
    const line = state.doc.line(lineNo);
    for (const stub of findDisplayImageStubs(line.text)) {
      const from = line.from + stub.from;
      const to = line.from + stub.to;
      const url = payloads[stub.index];
      deco.push(
        Decoration.replace({
          widget: new FoldWidget(url ? foldPreview(url, "expand") : stub.label, from, to, url, undefined, "expand"),
          inclusive: false
        }).range(from, to)
      );
    }
    for (const range of findDataUrlRanges(line.text, 1)) {
      const from = line.from + range.from;
      const to = line.from + range.to;
      const url = line.text.slice(range.from, range.to);
      const key = `${from}:${to}`;
      if (expanded.has(key)) {
        deco.push(
          Decoration.widget({
            widget: new FoldWidget(
              foldPreview(url, "collapse"),
              from,
              to,
              undefined,
              stubForUrl(payloads, url),
              "collapse"
            ),
            side: -1
          }).range(from)
        );
        continue;
      }
      deco.push(
        Decoration.replace({
          widget: new FoldWidget(foldPreview(url, "expand"), from, to, undefined, undefined, "expand"),
          inclusive: false
        }).range(from, to)
      );
    }
  }
  return Decoration.set(deco, true);
}

export function dataUrlFold() {
  return [
    payloadsField,
    expandedField,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = decorationsForState(view.state);
        }
        update(update: ViewUpdate) {
          if (update.docChanged || update.transactions.some((tr) => tr.effects.length)) {
            this.decorations = decorationsForState(update.state);
          }
        }
      },
      { decorations: (value) => value.decorations }
    )
  ];
}
