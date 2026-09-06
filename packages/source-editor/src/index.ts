import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { highlightSelectionMatches } from "@codemirror/search";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

export function createSourceEditor(options: {
  parent: HTMLElement;
  doc: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}): EditorView {
  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        markdown(),
        yaml(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) options.onChange(update.state.doc.toString());
        }),
        EditorView.lineWrapping,
        EditorView.editable.of(!options.readOnly),
        EditorView.theme({
          "&": { height: "100%", fontSize: "13.5px" },
          ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }
        })
      ]
    })
  });
  return view;
}

export function setSource(view: EditorView, doc: string): void {
  if (view.state.doc.toString() === doc) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: doc }
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
  if (!matches.length) return { count: 0, index: -1 };
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
  view.dispatch({
    selection: EditorSelection.range(from, from + needle.length),
    scrollIntoView: true
  });
  return { count: matches.length, index };
}
