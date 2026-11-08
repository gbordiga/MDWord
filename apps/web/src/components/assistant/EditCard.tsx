"use client";

import { t } from "@mdword/agent";
import { Check, FilePenLine, X } from "lucide-react";
import type { ThreadItem } from "@/lib/assistant/thread";
import { useAssistant } from "@/lib/assistant/store";

type EditItem = Extract<ThreadItem, { kind: "edit" }>;

function Block({ kind, text }: { kind: "remove" | "add"; text: string }) {
  const remove = kind === "remove";
  return (
    <div
      className={`flex gap-1.5 rounded px-1.5 py-1 ${remove ? "bg-[#fef3f2] text-[#912018]" : "bg-[#ecfdf3] text-[#05603a]"}`}
    >
      <span aria-label={remove ? t("edit.removed") : t("edit.added")} className="select-none font-mono">
        {remove ? "\u2212" : "+"}
      </span>
      <pre className="m-0 max-h-40 min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words font-sans text-[12px] leading-snug">
        {text || "\u00a0"}
      </pre>
    </div>
  );
}

export function EditCard({ item }: { item: EditItem }) {
  const resolve = useAssistant((s) => s.resolveEdit);
  const pending = item.status === "pending";
  return (
    <section
      data-testid="assistant-edit-card"
      data-status={item.status}
      aria-label={t("edit.card.title", { path: item.path })}
      className="rounded-lg border border-[#d0d5dd] bg-white"
    >
      <header className="flex items-center gap-1.5 border-b border-[#e4e7ec] px-2.5 py-1.5">
        <FilePenLine size={14} className="shrink-0 text-[#667085]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#1c1f24]" title={item.path}>
          {item.path}
        </span>
        <span className="shrink-0 text-[11px] text-[#667085]">
          {t("edit.card.summary", { count: item.edits.length })}
        </span>
      </header>
      <div className="space-y-2 px-2.5 py-2">
        {item.edits.map((edit, index) => (
          <div key={index} className="space-y-1">
            <Block kind="remove" text={edit.oldText} />
            <Block kind="add" text={edit.newText} />
          </div>
        ))}
      </div>
      <footer className="flex items-center gap-2 border-t border-[#e4e7ec] px-2.5 py-1.5">
        {pending ? (
          <>
            <button
              type="button"
              data-testid="assistant-apply"
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:opacity-90"
              onClick={() => void resolve(item.id, "apply")}
            >
              <Check size={13} aria-hidden />
              {t("edit.apply")}
            </button>
            <button
              type="button"
              data-testid="assistant-discard"
              className="inline-flex items-center gap-1 rounded-md border border-[#d0d5dd] px-2.5 py-1 text-[12px] font-medium text-[#344054] hover:bg-[#f2f4f7]"
              onClick={() => void resolve(item.id, "discard")}
            >
              <X size={13} aria-hidden />
              {t("edit.discard")}
            </button>
          </>
        ) : (
          <span className="text-[12px] text-[#667085]" role="status">
            {item.status === "applied"
              ? t("edit.applied")
              : item.status === "stale"
                ? t("edit.stale")
                : t("edit.discarded")}
          </span>
        )}
      </footer>
    </section>
  );
}
