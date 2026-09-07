const DB = "mdword-doc-history";
const STORE = "snapshots";
const MAX_SNAPSHOTS = 50;

export interface HistorySnapshot {
  id: string;
  docKey: string;
  savedAt: number;
  title: string;
  content: string;
}

export type HistoryListItem = Omit<HistorySnapshot, "content">;

export function historyKeyFromPath(path: string | null, untitledId: string): string {
  if (!path) return untitledId;
  let hash = 0;
  for (let i = 0; i < path.length; i += 1) {
    hash = (Math.imul(31, hash) + path.charCodeAt(i)) | 0;
  }
  const tail = path.replace(/[^a-zA-Z0-9]+/g, "_").slice(-32);
  return `p_${Math.abs(hash).toString(36)}_${tail}`;
}

export function newUntitledHistoryKey(): string {
  return `untitled-${Date.now().toString(36)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("docKey", "docKey", { unique: false });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listHistory(docKey: string): Promise<HistoryListItem[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).index("docKey").getAll(docKey);
    req.onsuccess = () => {
      const rows = (req.result as HistorySnapshot[])
        .map(({ content: _content, ...item }) => item)
        .sort((a, b) => b.savedAt - a.savedAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function readHistory(id: string): Promise<string | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as HistorySnapshot | undefined)?.content ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function addHistorySnapshot(snapshot: HistorySnapshot): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const items = await listHistory(snapshot.docKey);
  const extra = items.slice(MAX_SNAPSHOTS);
  if (extra.length === 0) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    for (const item of extra) tx.objectStore(STORE).delete(item.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
