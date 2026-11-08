"use client";

import { useMemo, useState } from "react";
import { t } from "@mdword/agent";
import { cn } from "@mdword/ui";
import { ArrowLeft, MessageSquare, Plus, Search, Trash2 } from "lucide-react";
import { useAssistant } from "@/lib/assistant/store";
import { dayGroup, filterConversations, type ConversationMeta, type DayGroup } from "@/lib/assistant/conversations";

const GROUPS: DayGroup[] = ["today", "yesterday", "week", "older"];
const GROUP_LABEL = {
  today: "history.group.today",
  yesterday: "history.group.yesterday",
  week: "history.group.week",
  older: "history.group.older"
} as const;

const iconButton =
  "rounded-md p-1 text-[#667085] hover:bg-[#f2f4f7] hover:text-[#1c1f24] disabled:opacity-40";

function formatWhen(ms: number): string {
  const d = new Date(ms);
  const sameDay = dayGroup(ms) === "today";
  return new Intl.DateTimeFormat("en", sameDay ? { timeStyle: "short" } : { month: "short", day: "numeric" }).format(d);
}

function Row({ item, active }: { item: ConversationMeta; active: boolean }) {
  const open = useAssistant((s) => s.openConversation);
  const remove = useAssistant((s) => s.deleteConversation);
  const [confirming, setConfirming] = useState(false);
  const title = item.title || t("history.untitled");

  return (
    <li
      data-testid="assistant-history-item"
      data-active={active}
      className={cn("group rounded-md", active ? "bg-[#eef2ff]" : "hover:bg-[#f2f4f7]")}
    >
      {confirming ? (
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-[12px] text-[#344054]">{title}</span>
          <button
            type="button"
            data-testid="assistant-history-delete-confirm"
            className="rounded-md bg-[#b42318] px-2 py-1 text-[11px] font-medium text-white"
            onClick={() => void remove(item.id)}
          >
            {t("history.delete.confirm")}
          </button>
          <button type="button" className="rounded-md border border-[#d0d5dd] px-2 py-1 text-[11px]" onClick={() => setConfirming(false)}>
            {t("history.cancel")}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 pr-1">
          <button
            type="button"
            aria-label={title}
            title={title}
            aria-current={active ? "true" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
            onClick={() => void open(item.id)}
          >
            <MessageSquare size={13} className="shrink-0 text-[#98a2b3]" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[12px] text-[#1c1f24]">{title}</span>
            <span className="shrink-0 text-[11px] text-[#667085]">{formatWhen(item.updatedAt)}</span>
          </button>
          <button
            type="button"
            aria-label={t("history.delete")}
            title={t("history.delete")}
            data-testid="assistant-history-delete"
            className={cn(iconButton, "opacity-0 focus:opacity-100 group-hover:opacity-100")}
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </li>
  );
}

export function AssistantHistory() {
  const conversations = useAssistant((s) => s.conversations);
  const activeId = useAssistant((s) => s.activeId);
  const setView = useAssistant((s) => s.setView);
  const newChat = useAssistant((s) => s.newChat);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const list = filterConversations(conversations, query);
    return GROUPS.map((g) => ({ group: g, items: list.filter((c) => dayGroup(c.updatedAt) === g) })).filter((g) => g.items.length > 0);
  }, [conversations, query]);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="assistant-history">
      <div className="flex shrink-0 items-center gap-1 border-b border-[#e4e7ec] px-3 py-2">
        <button type="button" aria-label={t("history.back")} title={t("history.back")} data-testid="assistant-history-back" className={iconButton} onClick={() => setView("chat")}>
          <ArrowLeft size={16} />
        </button>
        <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">{t("history.title")}</h2>
        <button type="button" aria-label={t("history.new")} title={t("history.new")} data-testid="assistant-history-new" className={iconButton} onClick={() => newChat()}>
          <Plus size={16} />
        </button>
      </div>
      {conversations.length > 0 ? (
        <div className="relative shrink-0 px-3 pt-2">
          <Search size={13} className="pointer-events-none absolute left-5 top-[1.15rem] text-[#98a2b3]" aria-hidden />
          <input
            type="search"
            data-testid="assistant-history-search"
            aria-label={t("history.search")}
            placeholder={t("history.search")}
            className="w-full rounded-md border border-[#d0d5dd] bg-white py-1.5 pl-7 pr-2 text-[12px] focus:border-accent focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {conversations.length === 0 ? (
          <p className="px-2 pt-6 text-center text-[12px] leading-snug text-[#667085]">{t("history.empty")}</p>
        ) : groups.length === 0 ? (
          <p className="px-2 pt-6 text-center text-[12px] text-[#667085]">{t("history.noMatch")}</p>
        ) : (
          groups.map(({ group, items }) => (
            <section key={group} className="mb-2">
              <h3 className="px-2 pb-1 pt-2 text-[11px] font-semibold text-[#667085]">{t(GROUP_LABEL[group])}</h3>
              <ul className="space-y-0.5">
                {items.map((c) => (
                  <Row key={c.id} item={c} active={c.id === activeId} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
