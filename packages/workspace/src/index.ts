import { isMarkdownFileName, type HostApi, type HostFileStat } from "@mdword/shared";
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
  files: { path: string; name: string; isDirectory: boolean; modifiedMs?: number }[];
  index: WorkspaceIndex;
  workspaceMdoc: Mdoc | undefined;
}

const INDEX_READ_CONCURRENCY = 16;
const MAX_INDEX_CHARS = 512_000;

const indexCache = new Map<string, IndexedDocument>();

function cacheKey(path: string, modifiedMs: number): string {
  return `${path}\0${modifiedMs}`;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return out;
}

function pruneIndexCache(keepPaths: Set<string>): void {
  for (const key of indexCache.keys()) {
    const path = key.slice(0, key.indexOf("\0"));
    if (!keepPaths.has(path)) indexCache.delete(key);
  }
}

async function readWorkspaceMdoc(
  host: HostApi,
  listing: HostFileStat[]
): Promise<Mdoc | undefined> {
  const config = listing.find((f) => {
    const p = f.path.replace(/\\/g, "/");
    return p.endsWith(".mdoc/config.yaml") || p.endsWith(".mdoc/config.yml");
  });
  if (!config) return undefined;
  try {
    const raw = await host.files.read(config.path);
    const { parseDocument } = await import("yaml");
    const js = parseDocument(raw).toJS();
    return parseMdoc(js?.mdoc ?? js).value;
  } catch {
    return undefined;
  }
}

async function readMarkdownContents(
  host: HostApi,
  files: HostFileStat[]
): Promise<Map<string, string>> {
  const contents = new Map<string, string>();
  if (files.length === 0) return contents;
  if (host.files.readMany) {
    const batch = await host.files.readMany(files.map((file) => file.path));
    for (const item of batch) contents.set(item.path, item.content);
    return contents;
  }
  await mapPool(files, INDEX_READ_CONCURRENCY, async (file) => {
    try {
      contents.set(file.path, await host.files.read(file.path));
    } catch {
      /* unreadable files are skipped */
    }
  });
  return contents;
}

function clipForIndex(content: string): string {
  return content.length > MAX_INDEX_CHARS ? content.slice(0, MAX_INDEX_CHARS) : content;
}

export async function listWorkspace(host: HostApi, root: string): Promise<WorkspaceState> {
  const listing = await host.files.list(root);
  return {
    root,
    files: listing,
    index: { documents: [] },
    workspaceMdoc: await readWorkspaceMdoc(host, listing)
  };
}

export async function indexWorkspace(
  host: HostApi,
  listed: WorkspaceState
): Promise<WorkspaceState> {
  const mdFiles = listed.files.filter((f) => !f.isDirectory && isMarkdownFileName(f.name));
  const keep = new Set(mdFiles.map((file) => file.path));
  pruneIndexCache(keep);

  const documents: Array<IndexedDocument | undefined> = new Array(mdFiles.length);
  const stale: { file: HostFileStat; index: number }[] = [];
  mdFiles.forEach((file, index) => {
    const cached = file.modifiedMs != null ? indexCache.get(cacheKey(file.path, file.modifiedMs)) : undefined;
    if (cached) documents[index] = cached;
    else stale.push({ file, index });
  });

  const contents = await readMarkdownContents(
    host,
    stale.map((item) => item.file)
  );
  for (const { file, index } of stale) {
    const content = contents.get(file.path);
    if (content == null) continue;
    const modifiedMs = file.modifiedMs ?? Date.now();
    const indexed = indexMarkdown(file.path, clipForIndex(content), modifiedMs);
    if (file.modifiedMs != null) indexCache.set(cacheKey(file.path, file.modifiedMs), indexed);
    documents[index] = indexed;
  }

  return { ...listed, index: { documents: documents.filter((doc): doc is IndexedDocument => Boolean(doc)) } };
}

export async function loadWorkspace(
  host: HostApi,
  root: string
): Promise<WorkspaceState> {
  return indexWorkspace(host, await listWorkspace(host, root));
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
export {
  childNamesInFolder,
  isPathOrDescendant,
  isValidWorkspaceEntryName,
  joinWorkspacePath,
  normalizeNewFileName,
  rewriteWorkspacePath,
  targetFolderPath,
  uniqueChildName,
  workspaceEntryName,
  workspaceParentPath
} from "./mutations";
export type { IndexedDocument, WorkspaceIndex };
