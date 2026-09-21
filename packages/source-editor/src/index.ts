import { EditorSelection, EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, keymap, lineNumbers, highlightActiveLine, type DecorationSet } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { highlightSelectionMatches } from "@codemirror/search";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { dataUrlFold, setImagePayloads, setSourceAnnotation, stubEmbeddedImagesForDisplay } from "./dataUrlFold";

const restoreByView = new WeakMap<EditorView, (display: string) => string>();

const setFindMarks = StateEffect.define<{ matches: { from: number; to: number }[]; current: number }>();

const findMarks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decos, tr) {
    for (const effect of tr.effects) {
      if (!effect.is(setFindMarks)) continue;
      return Decoration.set(
        effect.value.matches.map((match, i) =>
          Decoration.mark({
            class: i === effect.value.current ? "cm-find-match cm-find-match-current" : "cm-find-match"
          }).range(match.from, match.to)
        ),
        true
      );
    }
    return decos.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field)
});

function bindStub(view: EditorView, source: string): { display: string; urls: string[] } {
  const stub = stubEmbeddedImagesForDisplay(source);
  restoreByView.set(view, stub.restore);
  return { display: stub.display, urls: stub.urls };
}

function restoreSource(view: EditorView, display: string): string {
  return (restoreByView.get(view) ?? ((value) => value))(display);
}

export function createSourceEditor(options: {
  parent: HTMLElement;
  doc: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}): EditorView {
  const stub = stubEmbeddedImagesForDisplay(options.doc);
  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: stub.display,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        markdown(),
        yaml(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        highlightSelectionMatches(),
        findMarks,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (update.transactions.some((tr) => tr.annotation(setSourceAnnotation))) return;
          options.onChange(restoreSource(update.view, update.state.doc.toString()));
        }),
        EditorView.lineWrapping,
        EditorView.editable.of(!options.readOnly),
        ...dataUrlFold(),
        EditorView.theme({
          "&": { height: "100%", fontSize: "13.5px" },
          ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }
        })
      ]
    })
  });
  restoreByView.set(view, stub.restore);
  if (stub.urls.length) {
    view.dispatch({ effects: setImagePayloads.of(stub.urls), annotations: setSourceAnnotation.of(true) });
  }
  return view;
}

export function setSource(view: EditorView, doc: string, options?: { undoable?: boolean }): void {
  const { display, urls } = bindStub(view, doc);
  if (view.state.doc.toString() === display) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: display },
    effects: setImagePayloads.of(urls),
    ...(options?.undoable ? {} : { annotations: setSourceAnnotation.of(true) })
  });
}

export function findInSource(
  view: EditorView,
  query: string,
  direction: 1 | -1
): { count: number; index: number } {
  const needle = query.trim().toLowerCase();
  if (!needle) return { count: 0, index: -1 };
  const text = view.state.doc.toString();
  const lower = text.toLowerCase();
  const matches: number[] = [];
  let start = 0;
  while (start < lower.length) {
    const idx = lower.indexOf(needle, start);
    if (idx < 0) break;
    matches.push(idx);
    start = idx + 1;
  }
  if (!matches.length) {
    view.dispatch({ effects: setFindMarks.of({ matches: [], current: -1 }) });
    return { count: 0, index: -1 };
  }
  const caret = direction === 1 ? view.state.selection.main.to : view.state.selection.main.from;
  let index = -1;
  if (direction === 1) {
    index = matches.findIndex((from) => from >= caret);
    if (index < 0) index = 0;
  } else {
    for (let i = matches.length - 1; i >= 0; i--) {
      if ((matches[i] ?? 0) < caret) {
        index = i;
        break;
      }
    }
    if (index < 0) index = matches.length - 1;
  }
  const from = matches[index] ?? 0;
  const ranges = matches.map((start) => ({ from: start, to: start + needle.length }));
  view.dispatch({
    selection: EditorSelection.range(from, from + needle.length),
    effects: setFindMarks.of({ matches: ranges, current: index }),
    scrollIntoView: true
  });
  return { count: matches.length, index };
}

export function clearFindInSource(view: EditorView): void {
  view.dispatch({ effects: setFindMarks.of({ matches: [], current: -1 }) });
}

export {
  findDataUrlRanges,
  foldEmbeddedDataUrls,
  stubEmbeddedImages,
  stubEmbeddedImagesForDisplay
} from "./dataUrlFold";
