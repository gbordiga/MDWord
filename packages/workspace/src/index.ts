import { isMarkdownFileName, type HostApi } from "@mdword/shared";
import {
  indexMarkdown,
  searchIndex,
  backlinksTo,
  resolveWikiTarget,
  brokenLinks,
  type IndexedDocument,
  type WorkspaceIndex
} from "@mdword/indexer";
import { parseMdoc, type Mdoc } from "@mdword/layout-engine";

export interface WorkspaceState {
  root: string | null;
  files: { path: string; name: string; isDirectory: boolean }[];
  index: WorkspaceIndex;
  workspaceMdoc: Mdoc | undefined;
}

export async function loadWorkspace(
  host: HostApi,
  root: string
): Promise<WorkspaceState> {
  const listing = await host.files.list(root);
  const mdFiles = listing.filter((f) => !f.isDirectory && isMarkdownFileName(f.name));
  const documents: IndexedDocument[] = [];
  for (const file of mdFiles) {
    try {
      const content = await host.files.read(file.path);
      documents.push(indexMarkdown(file.path, content, file.modifiedMs ?? Date.now()));
    } catch {
      /* unreadable files are skipped */
    }
  }
  let workspaceMdoc: Mdoc | undefined;
  const config = listing.find((f) => {
    const p = f.path.replace(/\\/g, "/");
    return p.endsWith(".mdoc/config.yaml") || p.endsWith(".mdoc/config.yml");
  });
  if (config) {
    try {
      const raw = await host.files.read(config.path);
      const { parseDocument } = await import("yaml");
      const js = parseDocument(raw).toJS();
      workspaceMdoc = parseMdoc(js?.mdoc ?? js).value;
    } catch {
      workspaceMdoc = undefined;
    }
  }
  return { root, files: listing, index: { documents }, workspaceMdoc };
}

export { searchIndex, backlinksTo, resolveWikiTarget, brokenLinks };
export { applySavedDocument, isInsideWorkspace, upsertWorkspaceFile } from "./files";
export {
  buildFileTree,
  expandFolderPathsForSelection,
  isOpenableWorkspaceFile,
  isSameWorkspacePath,
  workspaceFolderName,
  type FileTreeNode
} from "./tree";
export type { IndexedDocument, WorkspaceIndex };
