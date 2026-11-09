import {
  applyEdits,
  pickInstructionFiles,
  type AssistantEnv,
  type InstructionFile,
  type EditDecision,
  type EditProposal,
  type FileEntry
} from "@mdword/agent";
import { openDocument } from "@mdword/document-model";
import { parseMdoc } from "@mdword/layout-engine";
import { searchHits } from "@mdword/indexer";
import {
  isOpenableWorkspaceFile,
  joinWorkspacePath,
  relativeWorkspacePath
} from "@mdword/workspace";
import type { Diagnostic } from "@mdword/shared";
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

/** Workspace-relative paths of the instruction files that apply to the open file, nearest first. */
export function instructionPaths(): string[] {
  const state = useApp.getState();
  const root = state.workspace?.root;
  if (!root) return [];
  const rels = fileTable().filter((e) => !e.isDirectory).map((e) => e.rel);
  const open = state.path ? relativeWorkspacePath(state.path, root) : null;
  return pickInstructionFiles(rels, open);
}

/** Read AGENTS.md-style files fresh for each turn: the user may have edited them, even unsaved. */
export async function loadInstructionFiles(): Promise<InstructionFile[]> {
  const out: InstructionFile[] = [];
  for (const rel of instructionPaths()) {
    const entry = resolve(rel);
    const content = entry ? await readEntry(entry) : null;
    if (content) out.push({ path: rel, content });
  }
  return out;
}

/**
 * Errors in the layout block and in the standard metadata keys, so an edit that
 * writes `margins: 20` (no unit) or `tags: draft` (not a list) is refused with a
 * message the model can act on. Same-message errors that were already in the
 * file do not block an edit.
 */
export function metadataDiagnostics(frontmatter: Record<string, unknown>): Diagnostic[] {
  const out: Diagnostic[] = [];
  const error = (message: string, code: string) => out.push({ severity: "error", message, code });
  if (frontmatter.mdoc !== undefined) {
    if (frontmatter.mdoc === null || typeof frontmatter.mdoc !== "object" || Array.isArray(frontmatter.mdoc)) {
      error("mdoc must be a mapping with keys such as page, margins, header.", "mdoc-invalid");
    } else {
      for (const issue of parseMdoc(frontmatter.mdoc).issues) error(`mdoc.${issue}`, "mdoc-invalid");
    }
  }
  for (const key of ["title", "subtitle", "date", "language", "lingua"]) {
    const value = frontmatter[key];
    if (value !== undefined && value !== null && typeof value !== "string" && !(value instanceof Date)) {
      error(`${key} must be text.`, "frontmatter-type");
    }
  }
  const list = (value: unknown) => Array.isArray(value) && value.every((v) => typeof v === "string" || (v && typeof v === "object"));
  if (frontmatter.tags !== undefined && !list(frontmatter.tags)) error("tags must be a list.", "frontmatter-type");
  if (frontmatter.authors !== undefined && typeof frontmatter.authors !== "string" && !list(frontmatter.authors)) {
    error("authors must be a name or a list.", "frontmatter-type");
  }
  return out;
}

export interface EnvOptions {
  propose: (proposal: EditProposal, signal: AbortSignal | undefined) => Promise<EditDecision>;
  /** Files the user named with @ in this message. */
  mentioned?: readonly string[];
  /** Present only when commands are on for this workspace (desktop, folder open). */
  runCommand?: AssistantEnv["runCommand"];
}

/** Files the user opened in a tab or named in the message. Anything else the model reads taints the turn. */
function trustedPaths(mentioned: readonly string[]): Set<string> {
  const state = useApp.getState();
  const root = state.workspace?.root;
  const out = new Set(mentioned.map((p) => p.toLowerCase()));
  if (!root) return out;
  for (const tab of state.tabs) {
    const rel = tab.path ? relativeWorkspacePath(tab.path, root) : null;
    if (rel) out.add(rel.toLowerCase());
  }
  return out;
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
      const model = openDocument(source, { workspaceMdoc: useApp.getState().workspace?.workspaceMdoc });
      return [...model.diagnostics, ...metadataDiagnostics(
          model.frontmatter.mdoc === undefined && Object.keys(model.mdoc ?? {}).length > 0
            ? { ...model.frontmatter, mdoc: model.mdoc }
            : model.frontmatter
        )
      ];
    },
    canCreateFiles: () => Boolean(useApp.getState().workspace?.root),
    proposeEdit: options.propose,
    isTrustedPath: (path) => trustedPaths(options.mentioned ?? []).has(path.toLowerCase()),
    ...(options.runCommand ? { runCommand: options.runCommand } : {})
  };
}

/**
 * Apply a proposal the user accepted. The edit is checked again against the
 * current buffer, because the user may have typed since the model read the
 * file. Nothing is written when it no longer applies cleanly.
 */
export async function applyProposal(proposal: EditProposal): Promise<EditDecision> {
  if (proposal.create) return applyCreate(proposal);
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

async function applyCreate(proposal: EditProposal): Promise<EditDecision> {
  const root = useApp.getState().workspace?.root;
  if (!root) return { status: "stale", reason: "Open a folder before creating a file." };
  const entry = resolve(proposal.path);
  if (!entry?.abs) return { status: "stale", reason: "That path is not a markdown file in this folder." };
  if ((await readEntry(entry)) != null) return { status: "stale", reason: "The file already exists." };
  const host = getHost();
  try {
    if (typeof host.files.prepareWrite === "function") await host.files.prepareWrite(entry.abs);
    await host.files.write(entry.abs, proposal.after);
  } catch {
    return { status: "stale", reason: "The file could not be written. Check that the folder exists." };
  }
  await useApp.getState().refreshWorkspace();
  await useApp.getState().openWorkspaceFile(entry.abs);
  const open = useApp.getState().readOpenBuffer(entry.abs);
  if (!open) return { status: "stale", reason: "The file was written but could not be opened." };
  if (open.source !== proposal.after) {
    const done = useApp.getState().applyAssistantEdit(open.tabId, proposal.after, proposal.id);
    if (!done) return { status: "stale", reason: "The tab was closed." };
  }
  return { status: "applied" };
}
