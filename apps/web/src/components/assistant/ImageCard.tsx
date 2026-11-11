"use client";

import { t } from "@mdword/agent";
import { ImageIcon } from "lucide-react";
import type { ThreadItem } from "@/lib/assistant/thread";
import { useAssistant } from "@/lib/assistant/store";

type ImageItem = Extract<ThreadItem, { kind: "image" }>;

export function ImageCard({ item }: { item: ImageItem }) {
  const resolve = useAssistant((s) => s.resolveImage);
  const pending = item.status === "pending";
  return (
    <section
      data-testid="assistant-image-card"
      data-status={item.status}
      aria-label={t("image.card.title")}
      className="rounded-lg border border-[#d0d5dd] bg-white"
    >
      <header className="flex items-center gap-1.5 border-b border-[#e4e7ec] px-2.5 py-1.5">
        <ImageIcon size={14} className="shrink-0 text-[#667085]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#1c1f24]">{t("image.card.title")}</span>
      </header>
      {item.preview ? (
        <img src={item.preview} alt={item.alt} className="max-h-48 w-full bg-[#f9fafb] object-contain" />
      ) : null}
      <p className="line-clamp-3 px-2.5 pt-1.5 text-[12px] text-[#475467]" title={item.prompt}>
        {item.prompt}
      </p>
      <p className="px-2.5 py-1.5 text-[12px] text-[#667085]">{t("image.card.alt", { alt: item.alt })}</p>
      {item.status === "inserted" && item.path ? (
        <p className="px-2.5 pb-2 text-[12px] text-[#067647]">{t("image.inserted", { path: item.path })}</p>
      ) : null}
      {item.status === "failed" ? (
        <p className="px-2.5 pb-2 text-[12px] text-[#b42318]">{t("image.failed", { reason: item.error ?? "" })}</p>
      ) : null}
      {item.status === "discarded" ? <p className="px-2.5 pb-2 text-[12px] text-[#667085]">{t("image.discarded")}</p> : null}
      {pending ? (
        <footer className="flex items-center gap-2 border-t border-[#e4e7ec] px-2.5 py-1.5">
          <button
            type="button"
            data-testid="assistant-image-insert"
            className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:opacity-90"
            onClick={() => resolve(item.id, "insert")}
          >
            {t("image.insert")}
          </button>
          <button
            type="button"
            data-testid="assistant-image-discard"
            className="rounded-md border border-[#d0d5dd] px-2.5 py-1 text-[12px] font-medium text-[#344054] hover:bg-[#f2f4f7]"
            onClick={() => resolve(item.id, "discard")}
          >
            {t("image.discard")}
          </button>
        </footer>
      ) : null}
    </section>
  );
}
