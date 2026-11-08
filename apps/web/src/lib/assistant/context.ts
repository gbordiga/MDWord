import { buildContext, type OutlineEntry } from "@mdword/agent";
import { relativeWorkspacePath } from "@mdword/workspace";
import { useApp } from "../store";
import { getSelectionText } from "./selection";

function baseName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/** Context block for one turn: open file, selection, and a titles-and-headings outline. */
export function buildTurnContext(): string {
  const state = useApp.getState();
  const { workspace } = state;
  const root = workspace?.root ?? null;
  const openFile = state.path
    ? root
      ? (relativeWorkspacePath(state.path, root) ?? baseName(state.path))
      : baseName(state.path)
    : null;
  const outline: OutlineEntry[] = [];
  if (root && workspace) {
    for (const doc of workspace.index.documents) {
      outline.push({
        path: relativeWorkspacePath(doc.path, root) ?? doc.path,
        title: doc.title,
        headings: doc.headings.map((h) => `${"#".repeat(h.depth)} ${h.text}`)
      });
    }
  }
  return buildContext({ openFile, selectionText: getSelectionText(), outline });
}
