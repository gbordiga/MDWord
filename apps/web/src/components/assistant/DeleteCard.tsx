"use client";

import { t } from "@mdword/agent";
import { Trash2 } from "lucide-react";
import type { ThreadItem } from "@/lib/assistant/thread";
import { useAssistant } from "@/lib/assistant/store";

type DeleteItem = Extract<ThreadItem, { kind: "delete" }>;

function label(item: DeleteItem): string {
  if (item.status === "deleted") return t("delete.deleted", { path: item.path });
  if (item.status === "failed") return t("delete.failed", { reason: item.error ?? "" });
  if (item.status === "kept") return t("delete.kept", { path: item.path });
  return item.path;
}

/** A finished delete, shown as one row inside the steps accordion. */
export function DeleteStep({ item }: { item: DeleteItem }) {
  return (
    <div data-testid="assistant-delete-step" data-status={item.status} className="flex items-center gap-1.5 text-[11px] text-[#667085]">
      <Trash2 size={12} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={item.path}>
        {label(item)}
      </span>
    </div>
  );
}

export function DeleteCard({ item }: { item: DeleteItem }) {
  const resolve = useAssistant((s) => s.resolveDelete);
  const pending = item.status === "pending";
  return (
    <section
      data-testid="assistant-delete-card"
      data-status={item.status}
      aria-label={t("delete.card.title", { path: item.path })}
      className="rounded-lg border border-[#fecdca] bg-[#fffbfa]"
    >
      <header className="flex items-center gap-1.5 px-2.5 py-1.5">
        <Trash2 size={14} className="shrink-0 text-[#b42318]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#1c1f24]" title={item.path}>
          {t("delete.card.title", { path: item.path })}
        </span>
      </header>
      <p className="px-2.5 pb-2 text-[12px] leading-snug text-[#912018]">{t("delete.card.warning")}</p>
      {pending ? (
        <footer className="flex items-center gap-2 border-t border-[#fecdca] px-2.5 py-1.5">
          <button
            type="button"
            data-testid="assistant-delete-confirm"
            className="rounded-md bg-[#b42318] px-2.5 py-1 text-[12px] font-medium text-white hover:opacity-90"
            onClick={() => void resolve(item.id, "delete")}
          >
            {t("delete.confirm")}
          </button>
          <button
            type="button"
            data-testid="assistant-delete-keep"
            className="rounded-md border border-[#d0d5dd] bg-white px-2.5 py-1 text-[12px] font-medium text-[#344054] hover:bg-[#f2f4f7]"
            onClick={() => void resolve(item.id, "keep")}
          >
            {t("delete.keep")}
          </button>
        </footer>
      ) : null}
    </section>
  );
}
