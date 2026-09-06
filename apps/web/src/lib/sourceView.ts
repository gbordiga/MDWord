import type { EditorView } from "@codemirror/view";

let sourceView: EditorView | null = null;

export function registerSourceView(view: EditorView | null): void {
  sourceView = view;
}

export function getSourceView(): EditorView | null {
  return sourceView;
}
