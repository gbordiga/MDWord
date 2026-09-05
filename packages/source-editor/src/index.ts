import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
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
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
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
