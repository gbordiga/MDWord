"use client";

import { useEffect, useMemo, useState } from "react";
import { countLineChanges, diffLines, foldEmbeddedDataUrls } from "@mdword/shared";
import { saveDocument as serializeDocument } from "@mdword/document-model";
import { listHistory, readHistory, type HistoryListItem } from "@/lib/documentHistory";
import { useApp } from "@/lib/store";

const DIFF_LINE_MAX = 240;

function displayDiffLine(text: string): string {
  const folded = foldEmbeddedDataUrls(text);
  return folded.length > DIFF_LINE_MAX ? `${folded.slice(0, DIFF_LINE_MAX)}…` : folded;
}

type Selection = { kind: "unsaved" } | { kind: "snapshot"; id: string };

function formatWhen(ms: number): string {
  const date = new Date(ms);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  return `${date.toLocaleDateString()} ${time}`;
}

export function HistoryPane() {
  const dirty = useApp((s) => s.dirty);
  const historyKey = useApp((s) => s.historyKey);
  const lastSavedContent = useApp((s) => s.lastSavedContent);
  const source = useApp((s) => s.model.source);
  const ast = useApp((s) => s.model.ast);
  const lastSavedAt = useApp((s) => s.lastSavedAt);
  const [items, setItems] = useState<HistoryListItem[]>([]);
  const [selection, setSelection] = useState<Selection>(dirty ? { kind: "unsaved" } : { kind: "unsaved" });
  const [baseContent, setBaseContent] = useState(lastSavedContent);

  const current = useMemo(() => {
    const raw = dirty ? serializeDocument(useApp.getState().model) : source;
    return foldEmbeddedDataUrls(raw);
  }, [ast, dirty, lastSavedContent, source]);
  const foldedBase = useMemo(() => foldEmbeddedDataUrls(baseContent), [baseContent]);

  useEffect(() => {
    let cancelled = false;
    void listHistory(historyKey).then((next) => {
      if (!cancelled) setItems(next);
    });
    return () => {
      cancelled = true;
    };
  }, [historyKey, lastSavedAt]);

  useEffect(() => {
    if (selection.kind === "unsaved") {
      setBaseContent(lastSavedContent);
      return;
    }
    let cancelled = false;
    void readHistory(selection.id).then((content) => {
      if (!cancelled && content != null) setBaseContent(content);
    });
    return () => {
      cancelled = true;
    };
  }, [selection, lastSavedContent]);

  const changes = useMemo(() => diffLines(foldedBase, current), [foldedBase, current]);
  const counts = useMemo(() => countLineChanges(changes), [changes]);
  const hasUnsaved = dirty && current !== foldEmbeddedDataUrls(lastSavedContent);

  const restore = () => {
    if (selection.kind !== "snapshot") return;
    void useApp.getState().restoreHistory(baseContent);
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="history-pane">
      <ul className="shrink-0 space-y-1 border-b border-[#e4e7ec] pb-2">
        <li>
          <button
            type="button"
            data-testid="history-unsaved"
            disabled={!hasUnsaved}
            onClick={() => setSelection({ kind: "unsaved" })}
            className={`w-full rounded px-2 py-2 text-left ${
              selection.kind === "unsaved" ? "bg-[#e8eefc] font-medium text-accent" : "hover:bg-[#f2f4f7]"
            } ${hasUnsaved ? "" : "text-[#98a2b3]"}`}
          >
            <div>Unsaved changes</div>
            <div className="text-[11px] font-normal text-[#667085]">
              {hasUnsaved ? "Since last save" : "Nothing to compare"}
            </div>
          </button>
        </li>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              data-testid="history-snapshot"
              data-snapshot-id={item.id}
              onClick={() => setSelection({ kind: "snapshot", id: item.id })}
              className={`w-full rounded px-2 py-2 text-left hover:bg-[#f2f4f7] ${
                selection.kind === "snapshot" && selection.id === item.id
                  ? "bg-[#e8eefc] font-medium text-accent"
                  : ""
              }`}
            >
              <div className="truncate">{item.title || "Saved version"}</div>
              <div className="text-[11px] font-normal text-[#667085]">{formatWhen(item.savedAt)}</div>
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <p className="px-2 py-1 text-[12px] text-[#667085]">Save the document to start a local changelog.</p>
        )}
      </ul>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-[#667085]">
        <span data-testid="history-counts">
          {counts.added} added · {counts.removed} removed
        </span>
        {selection.kind === "snapshot" ? (
          <button
            type="button"
            data-testid="history-restore"
            className="rounded border border-[#cdd5df] px-2 py-0.5 font-medium text-[#344054] hover:bg-[#f8fafc]"
            onClick={restore}
          >
            Restore
          </button>
        ) : null}
      </div>
      <pre
        data-testid="history-diff"
        className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-2 font-mono text-[11px] leading-5"
      >
        {changes.every((c) => c.kind === "equal") ? (
          <span className="text-[#667085]">No differences.</span>
        ) : (
          changes
            .filter((c) => c.kind !== "equal")
            .map((change, i) => (
              <div
                key={`${change.kind}-${i}`}
                className={
                  change.kind === "add"
                    ? "bg-[#ecfdf3] text-[#067647]"
                    : "bg-[#fef3f2] text-[#b42318]"
                }
              >
                {change.kind === "add" ? "+" : "-"} {displayDiffLine(change.text || " ")}
              </div>
            ))
        )}
      </pre>
    </div>
  );
}
