"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  effectiveReasoning,
  formatPerMillion,
  imagePriceLabel,
  parseReasoningEffort,
  reasoningChoices,
  SUGGESTED_MODELS,
  t,
  type ModelInfo
} from "@mdword/agent";
import { cn } from "@mdword/ui";
import { Check, ChevronDown, Search } from "lucide-react";
import { useAssistant } from "@/lib/assistant/store";
import { useModelLists } from "./useModelLists";

type Kind = "text" | "image";

const REASONING_ORDER = ["default", "none", "low", "medium", "high"] as const;

/** Name without the "Vendor: " prefix OpenRouter puts in front. */
function plainName(info: ModelInfo | undefined, id: string): string {
  return info?.name?.replace(/^[^:]+:\s*/, "") ?? id;
}

function textPrice(info: ModelInfo | undefined): string {
  if (!info) return "";
  if (info.promptPrice === 0 && info.completionPrice === 0) return "free";
  return `${formatPerMillion(info.promptPrice)} / ${formatPerMillion(info.completionPrice)}`;
}

/**
 * Model chip for the input area: opens a small panel to switch the writing model,
 * the picture model, and how much the writing model reasons.
 */
export function ModelMenu({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("text");
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement | null>(null);

  const lists = useModelLists(open);
  const updateSettings = useAssistant((s) => s.updateSettings);
  const effort = useAssistant((s) => s.settings.reasoningEffort);
  const textById = useMemo(() => new Map((lists.models ?? []).map((m) => [m.id, m])), [lists.models]);
  const imageById = useMemo(() => new Map(lists.imageList.map((m) => [m.id, m])), [lists.imageList]);
  const suggestedCurrent = SUGGESTED_MODELS.find((m) => m.id === lists.current);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const needle = query.trim().toLowerCase();
  const hit = (id: string, name?: string) =>
    !needle || id.toLowerCase().includes(needle) || (name ?? "").toLowerCase().includes(needle);

  const row = (id: string, name: string, hint: string, selected: boolean, pick: () => void) => (
    <button
      key={id}
      type="button"
      role="option"
      aria-selected={selected}
      title={id}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]",
        selected ? "bg-[#f2f4f7] text-[#1c1f24]" : "text-[#344054] hover:bg-[#f9fafb]"
      )}
      onClick={() => {
        pick();
        close();
      }}
    >
      <Check size={12} className={selected ? "shrink-0 text-accent" : "invisible shrink-0"} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {hint ? <span className="shrink-0 text-[10px] text-[#98a2b3]">{hint}</span> : null}
    </button>
  );

  const heading = (label: string) => (
    <div className="px-2 pb-0.5 pt-2 text-[10px] font-medium uppercase tracking-wide text-[#98a2b3]">{label}</div>
  );

  const textRows = (() => {
    const suggested = lists.suggested.filter((m) => hit(m.id, textById.get(m.id)?.name));
    const others = lists.others.filter((m) => hit(m.id, m.name));
    return { suggested, others };
  })();
  const imageRows = lists.imageList.filter((m) => hit(m.id, m.name));
  const empty = kind === "text" ? textRows.suggested.length + textRows.others.length === 0 : imageRows.length === 0;

  const label = plainName(textById.get(lists.current), lists.current);

  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        data-testid="assistant-model-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        title={t("panel.model.title")}
        className={cn(
          "flex h-7 max-w-[10rem] items-center gap-1 rounded-full px-2 text-[11px] text-[#475467] hover:bg-[#f2f4f7] disabled:opacity-40",
          open && "bg-[#f2f4f7]"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className={cn("shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t("panel.model.title")}
          data-testid="assistant-model-menu"
          className="absolute bottom-9 left-0 z-20 w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-[#e4e7ec] bg-white p-1.5 shadow-lg"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
        >
          <div role="tablist" className="flex gap-0.5 rounded-lg bg-[#f2f4f7] p-0.5">
            {(["text", "image"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                data-testid={`assistant-model-tab-${k}`}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-[11px] font-medium",
                  kind === k ? "bg-white text-[#1c1f24] shadow-sm" : "text-[#667085] hover:text-[#344054]"
                )}
                onClick={() => {
                  setKind(k);
                  setQuery("");
                }}
              >
                {t(k === "text" ? "panel.model.text" : "panel.model.image")}
              </button>
            ))}
          </div>
          <div className="relative mt-1.5">
            <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#98a2b3]" aria-hidden />
            <input
              autoFocus
              type="search"
              aria-label={t("settings.model.search")}
              placeholder={t("settings.model.search")}
              className="w-full rounded-md bg-[#f9fafb] py-1.5 pl-6 pr-2 text-[12px] text-[#1c1f24] placeholder:text-[#98a2b3] focus:outline-none focus:ring-1 focus:ring-accent"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div role="listbox" aria-label={t(kind === "text" ? "settings.model" : "settings.imageModel")} className="mt-1 max-h-56 overflow-auto">
            {kind === "text" ? (
              <>
                {textRows.suggested.length ? (
                  <div>
                    {heading(t("panel.model.suggested"))}
                    {textRows.suggested.map((m) =>
                      row(
                        m.id,
                        plainName(textById.get(m.id), m.id),
                        textPrice(textById.get(m.id)),
                        m.id === lists.current,
                        () => updateSettings({ modelId: m.id })
                      )
                    )}
                  </div>
                ) : null}
                {textRows.others.length ? (
                  <div>
                    {heading(t("settings.model.all"))}
                    {textRows.others.map((m) =>
                      row(m.id, plainName(m, m.id), textPrice(m), m.id === lists.current, () => updateSettings({ modelId: m.id }))
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <div>
                {imageRows.map((m) =>
                  row(m.id, plainName(m, m.id), imagePriceLabel(imageById.get(m.id) ?? m), m.id === lists.currentImage, () =>
                    updateSettings({ imageModelId: m.id })
                  )
                )}
              </div>
            )}
            {empty ? <p className="px-2 py-3 text-[11px] text-[#667085]">{t("settings.model.empty")}</p> : null}
          </div>
          {kind === "text" ? (
            <div className="mt-1.5 border-t border-[#f2f4f7] pt-1.5">
              <div className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-[#98a2b3]">
                {t("settings.reasoning")}
              </div>
              <div role="radiogroup" aria-label={t("settings.reasoning")} className="flex gap-0.5 rounded-lg bg-[#f2f4f7] p-0.5">
                {REASONING_ORDER.filter((choice) => reasoningChoices(suggestedCurrent).includes(choice)).map((choice) => {
                  const selected = effectiveReasoning(effort, suggestedCurrent) === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-testid={`assistant-reasoning-${choice}`}
                      className={cn(
                        "flex-1 truncate rounded-md px-1 py-1 text-[11px]",
                        selected ? "bg-white font-medium text-[#1c1f24] shadow-sm" : "text-[#667085] hover:text-[#344054]"
                      )}
                      onClick={() => updateSettings({ reasoningEffort: parseReasoningEffort(choice) })}
                    >
                      {t(`settings.reasoning.${choice}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
