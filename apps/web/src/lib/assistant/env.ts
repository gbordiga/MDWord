import {
  applyEdits,
  type AssistantEnv,
  type EditDecision,
  type EditProposal,
  type FileEntry
} from "@mdword/agent";
import { openDocument } from "@mdword/document-model";
import { searchHits } from "@mdword/indexer";
import {
  isOpenableWorkspaceFile,
  joinWorkspacePath,
  relativeWorkspacePath
} from "@mdword/workspace";
import { getHost } from "../host";
import { useApp } from "../store";

interface Entry {
  /** Workspace-relative POSIX path shown to the model. */
  rel: string;
  /** Host path, or null for an unsaved tab. */
  abs: string | null;
  tabId: string | null;
  isDirectory: boolean;
}

function baseName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/**
 * Files the model may see. With a folder open that is the folder (markdown
 * files only). Without one it is the open tabs, named by file name, so the
 * assistant still works on the document in front of the user.
 */
function fileTable(): Entry[] {
  const state = useApp.getState();
  const { workspace, tabs } = state;
  if (workspace?.root) {
    const out: Entry[] = [];
    for (const f of workspace.files) {
      const rel = relativeWorkspacePath(f.path, workspace.root);
      if (!rel) continue;
      if (!f.isDirectory && !isOpenableWorkspaceFile(f.name)) continue;
      out.push({ rel, abs: f.path, tabId: null, isDirectory: f.isDirectory });
    }
    return out;
  }
  const used = new Set<string>();
  let untitled = 0;
  return tabs.map((tab) => {
    let rel = tab.path ? baseName(tab.path) : `Untitled-${(untitled += 1)}.md`;
    while (used.has(rel)) rel = `${tab.id.slice(-4)}-${rel}`;
    used.add(rel);
    return { rel, abs: tab.path, tabId: tab.id, isDirectory: false };
  });
}

function resolve(rel: string): Entry | null {
  const table = fileTable();
  const lower = rel.toLowerCase();
  const hit =
    table.find((e) => !e.isDirectory && e.rel === rel) ??
    table.find((e) => !e.isDirectory && e.rel.toLowerCase() === lower);
  if (hit) return hit;
  const root = useApp.getState().workspace?.root;
  if (root && isOpenableWorkspaceFile(baseName(rel))) {
    return { rel, abs: joinWorkspacePath(root, rel), tabId: null, isDirectory: false };
  }
  return null;
}

async function readEntry(entry: Entry): Promise<string | null> {
  const store = useApp.getState();
  const open = entry.tabId
    ? store.readOpenBuffer({ tabId: entry.tabId })
    : entry.abs
      ? store.readOpenBuffer(entry.abs)
      : null;
  if (open) return open.source;
  if (!entry.abs) return null;
  try {
    return await getHost().files.read(entry.abs);
  } catch {
    return null;
  }
}

export interface EnvOptions {
  propose: (proposal: EditProposal, signal: AbortSignal | undefined) => Promise<EditDecision>;
}

export function createAssistantEnv(options: EnvOptions): AssistantEnv {
  return {
    async listFiles(folder) {
      const table = fileTable();
      const prefix = folder ? `${folder}/` : "";
      if (folder && !table.some((e) => e.rel === folder || e.rel.startsWith(prefix))) return null;
      const out: FileEntry[] = [];
      for (const e of table) {
        if (!e.rel.startsWith(prefix) || e.rel === folder) continue;
        const rest = e.rel.slice(prefix.length);
        if (rest.includes("/")) continue;
        out.push({ path: e.rel, name: rest, isDirectory: e.isDirectory });
      }
      return out;
    },
    async search(query, field, limit) {
      const state = useApp.getState();
      const { workspace } = state;
      if (workspace?.root) {
        const hits = searchHits(workspace.index, query)
          .filter((h) => !field || h.field === field)
          .slice(0, limit);
        return hits.map((h) => ({
          path: relativeWorkspacePath(h.document.path, workspace.root!) ?? h.document.path,
          title: h.document.title,
          snippet: h.excerpt
        }));
      }
      const needle = query.toLowerCase();
      const out = [];
      for (const e of fileTable()) {
        const text = await readEntry(e);
        if (text == null || !text.toLowerCase().includes(needle)) continue;
        const at = text.toLowerCase().indexOf(needle);
        out.push({
          path: e.rel,
          title: e.rel,
          snippet: text.slice(Math.max(0, at - 40), at + query.length + 40).replace(/\s+/g, " ")
        });
        if (out.length >= limit) break;
      }
      return out;
    },
    async readFile(path) {
      const entry = resolve(path);
      return entry ? readEntry(entry) : null;
    },
    diagnostics(source) {
      return openDocument(source, { workspaceMdoc: useApp.getState().workspace?.workspaceMdoc })
        .diagnostics;
    },
    proposeEdit: options.propose
  };
}

/**
 * Apply a proposal the user accepted. The edit is checked again against the
 * current buffer, because the user may have typed since the model read the
 * file. Nothing is written when it no longer applies cleanly.
 */
export async function applyProposal(proposal: EditProposal): Promise<EditDecision> {
  const entry = resolve(proposal.path);
  if (!entry) return { status: "stale", reason: "The file is no longer available." };
  const store = useApp.getState();
  let open = entry.tabId
    ? store.readOpenBuffer({ tabId: entry.tabId })
    : entry.abs
      ? store.readOpenBuffer(entry.abs)
      : null;
  if (!open && entry.abs) {
    await store.openWorkspaceFile(entry.abs);
    open = useApp.getState().readOpenBuffer(entry.abs);
  }
  if (!open) return { status: "stale", reason: "The file could not be opened." };
  const again = applyEdits(open.source, proposal.edits);
  if (!again.ok) {
    return { status: "stale", reason: "The document changed after the edit was proposed." };
  }
  const done = useApp.getState().applyAssistantEdit(open.tabId, again.result, proposal.id);
  return done ? { status: "applied" } : { status: "stale", reason: "The tab was closed." };
}
