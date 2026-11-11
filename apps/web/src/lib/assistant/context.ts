import { buildContext, type OutlineEntry } from "@mdword/agent";
import { relativeWorkspacePath } from "@mdword/workspace";
import { documentExtension } from "./documents";
import { getHost } from "../host";
import { useApp } from "../store";
import { getSelectionText } from "./selection";
import { folderListing, isFolderMention, type MentionFile } from "./mentions";

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
  // The active document's model is current: send() flushes pending edits first.
  const frontmatter = useApp.getState().model.head || null;
  return buildContext({ openFile, selectionText: getSelectionText(), outline, frontmatter });
}

export function mentionFiles(): MentionFile[] {
  const workspace = useApp.getState().workspace;
  const root = workspace?.root;
  if (!root || !workspace) return [];
  const files = workspace.index.documents.map((doc) => ({
    rel: relativeWorkspacePath(doc.path, root) ?? doc.path,
    title: doc.title || doc.path.split(/[/\\]/).pop() || doc.path
  }));
  const folders: MentionFile[] = [];
  for (const entry of workspace.files) {
    if (!entry.isDirectory) continue;
    const rel = relativeWorkspacePath(entry.path, root);
    if (!rel || rel.split("/").some((part) => part.startsWith("."))) continue;
    folders.push({ rel: `${rel}/`, title: `${entry.name}/` });
  }
  const known = new Set(files.map((f) => f.rel));
  const documents: MentionFile[] = [];
  for (const entry of workspace.files) {
    if (entry.isDirectory || !documentExtension(entry.name)) continue;
    const rel = relativeWorkspacePath(entry.path, root);
    if (!rel || known.has(rel) || rel.split("/").some((part) => part.startsWith("."))) continue;
    documents.push({ rel, title: entry.name });
  }
  return [...folders, ...files, ...documents];
}

const ATTACHED_MAX = 8000;

/** Text of files the user named with @, capped so one message cannot swallow the turn. */
export async function attachedFilesContext(rels: string[]): Promise<string> {
  if (rels.length === 0) return "";
  const workspace = useApp.getState().workspace;
  const root = workspace?.root;
  if (!root) return "";
  const blocks: string[] = ["Files the user attached as context:"];
  for (const rel of rels) {
    if (isFolderMention(rel)) {
      const all = workspace.files
        .filter((f) => !f.isDirectory)
        .map((f) => relativeWorkspacePath(f.path, root) ?? "");
      blocks.push(`Folder: ${rel}`, "<<<", folderListing(rel, all), ">>>");
      continue;
    }
    if (documentExtension(rel)) {
      blocks.push(`Document: ${rel} (not Markdown; open it with readDocument)`);
      continue;
    }
    const doc = workspace.index.documents.find(
      (entry) => (relativeWorkspacePath(entry.path, root) ?? entry.path) === rel
    );
    if (!doc) continue;
    let text = "";
    try {
      const open = useApp.getState().readOpenBuffer(doc.path);
      text = open?.source ?? (await getHost().files.read(doc.path));
    } catch {
      continue;
    }
    const shown = text.length > ATTACHED_MAX ? `${text.slice(0, ATTACHED_MAX)}\n...` : text;
    blocks.push(`File: ${rel}`, "<<<", shown, ">>>");
  }
  return blocks.length > 1 ? blocks.join("\n") : "";
}
