"use client";

import { useEffect, useRef, useState } from "react";
import { formatUsd, t } from "@mdword/agent";
import { cn } from "@mdword/ui";
import { AlertCircle, Check, Loader2, Plus, Send, Settings, Sparkles, Square, X } from "lucide-react";
import { relativeWorkspacePath } from "@mdword/workspace";
import { useApp } from "@/lib/store";
import { useAssistant } from "@/lib/assistant/store";
import type { ThreadItem } from "@/lib/assistant/thread";
import { AssistantSettings } from "./AssistantSettings";
import { EditCard } from "./EditCard";

const iconButton =
  "rounded-md p-1 text-[#667085] hover:bg-[#f2f4f7] hover:text-[#1c1f24] disabled:opacity-40";

function ToolLine({ item }: { item: Extract<ThreadItem, { kind: "tool" }> }) {
  return (
    <div
      data-testid="assistant-tool"
      data-status={item.status}
      title={item.status === "error" ? item.detail : undefined}
      className="flex items-center gap-1.5 text-[11px] text-[#667085]"
    >
      {item.status === "running" ? (
        <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden />
      ) : item.status === "ok" ? (
        <Check size={12} className="shrink-0" aria-hidden />
      ) : (
        <AlertCircle size={12} className="shrink-0 text-[#b42318]" aria-hidden />
      )}
      <span className="min-w-0 truncate">{item.label}</span>
    </div>
  );
}

function ThreadView({ thread }: { thread: ThreadItem[] }) {
  return (
    <>
      {thread.map((item) => {
        switch (item.kind) {
          case "user":
            return (
              <div key={item.id} data-testid="assistant-user" className="flex justify-end">
                <p className="max-w-[90%] whitespace-pre-wrap break-words rounded-lg bg-[#e8eefc] px-2.5 py-1.5 text-[13px] text-[#1c1f24]">
                  {item.text}
                </p>
              </div>
            );
          case "assistant":
            return (
              <p
                key={item.id}
                data-testid="assistant-message"
                className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#1c1f24]"
              >
                {item.text}
              </p>
            );
          case "tool":
            return <ToolLine key={item.id} item={item} />;
          case "edit":
            return <EditCard key={item.id} item={item} />;
          case "notice":
            return (
              <p key={item.id} role="status" data-testid="assistant-notice-line" className="text-[12px] text-[#b54708]">
                {item.text}
              </p>
            );
        }
      })}
    </>
  );
}

function Composer({ disabled, reason }: { disabled: boolean; reason?: string }) {
  const [text, setText] = useState("");
  const running = useAssistant((s) => s.running);
  const send = useAssistant((s) => s.send);
  const stop = useAssistant((s) => s.stop);
  const path = useApp((s) => s.path);
  const root = useApp((s) => s.workspace?.root ?? null);
  const fileName = path ? ((root ? relativeWorkspacePath(path, root) : null) ?? path.split(/[/\\]/).pop()) : null;

  const submit = () => {
    if (disabled || running || !text.trim()) return;
    const value = text;
    setText("");
    void send(value);
  };

  return (
    <div className="shrink-0 space-y-1.5 border-t border-[#e4e7ec] p-2">
      {fileName ? (
        <div className="truncate text-[11px] text-[#667085]" data-testid="assistant-context">
          {t("panel.context.file", { name: fileName })}
        </div>
      ) : null}
      <div className="flex items-end gap-1.5">
        <textarea
          data-testid="assistant-input"
          aria-label={t("panel.input.placeholder")}
          rows={2}
          disabled={disabled}
          placeholder={disabled && reason ? reason : t("panel.input.placeholder")}
          className="min-h-[3.25rem] flex-1 resize-none rounded-md border border-[#d0d5dd] bg-white px-2 py-1.5 text-[13px] text-[#1c1f24] focus:border-accent focus:outline-none disabled:bg-[#f9fafb]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {running ? (
          <button
            type="button"
            data-testid="assistant-stop"
            aria-label={t("panel.stop")}
            title={t("panel.stop")}
            className="rounded-md border border-[#d0d5dd] p-2 text-[#344054] hover:bg-[#f2f4f7]"
            onClick={() => stop()}
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            type="button"
            data-testid="assistant-send"
            aria-label={t("panel.send")}
            title={t("panel.send")}
            disabled={disabled || !text.trim()}
            className="rounded-md bg-accent p-2 text-white hover:opacity-90 disabled:opacity-40"
            onClick={submit}
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function AssistantPanel({ className }: { className?: string }) {
  const s = useAssistant();
  const scroller = useRef<HTMLDivElement | null>(null);
  const hasKey = s.key?.hasKey ?? false;
  const ready = hasKey && s.settings.noticeAccepted;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.thread]);

  const close = () => useApp.setState({ rightOpen: false });

  return (
    <aside
      data-testid="assistant-panel"
      aria-label={t("panel.title")}
      className={cn("flex h-full w-full min-w-0 flex-col border-l border-[#e4e7ec] bg-white text-[13px]", className)}
    >
      {s.view === "settings" ? (
        <AssistantSettings />
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-1 border-b border-[#e4e7ec] px-3 py-2">
            <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">{t("panel.title")}</h2>
            {hasKey ? (
              <span className="text-[11px] text-[#667085]" data-testid="assistant-cost">
                {s.costUnknown && s.sessionCostUsd === 0 ? t("panel.cost.unknown") : t("panel.cost.session", { cost: formatUsd(s.sessionCostUsd) })}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={t("panel.newChat")}
              title={t("panel.newChat")}
              data-testid="assistant-new-chat"
              className={iconButton}
              disabled={s.thread.length === 0}
              onClick={() => s.newChat()}
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              aria-label={t("panel.settings")}
              title={t("panel.settings")}
              data-testid="assistant-open-settings"
              className={iconButton}
              onClick={() => s.setView("settings")}
            >
              <Settings size={16} />
            </button>
            <button
              type="button"
              aria-label={t("panel.close")}
              title={t("panel.close")}
              data-testid="assistant-close"
              className={iconButton}
              onClick={close}
            >
              <X size={16} />
            </button>
          </div>

          <div
            ref={scroller}
            role="log"
            aria-live="polite"
            aria-label={t("panel.title")}
            className="min-h-0 flex-1 space-y-2.5 overflow-auto p-3"
          >
            {!hasKey ? (
              <div className="space-y-2 rounded-lg border border-[#e4e7ec] bg-[#f9fafb] p-3" data-testid="assistant-nokey">
                <h3 className="text-[13px] font-semibold text-[#1c1f24]">{t("panel.nokey.title")}</h3>
                <p className="text-[12px] leading-snug text-[#667085]">{t("panel.nokey.body")}</p>
                <button
                  type="button"
                  className="rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white"
                  data-testid="assistant-nokey-open"
                  onClick={() => s.setView("settings")}
                >
                  {t("panel.nokey.open")}
                </button>
              </div>
            ) : !s.settings.noticeAccepted ? (
              <div className="space-y-2 rounded-lg border border-[#fedf89] bg-[#fffaeb] p-3">
                <p className="text-[12px] leading-snug text-[#7a2e0e]">{t("settings.notice.body")}</p>
                <button
                  type="button"
                  data-testid="assistant-notice-accept-chat"
                  className="rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white"
                  onClick={() => s.updateSettings({ noticeAccepted: true })}
                >
                  {t("settings.notice.accept")}
                </button>
              </div>
            ) : s.thread.length === 0 ? (
              <div className="space-y-1 pt-6 text-center">
                <Sparkles size={20} className="mx-auto text-[#98a2b3]" aria-hidden />
                <h3 className="text-[13px] font-semibold text-[#344054]">{t("panel.empty.title")}</h3>
                <p className="text-[12px] leading-snug text-[#667085]">{t("panel.empty.body")}</p>
              </div>
            ) : null}
            <ThreadView thread={s.thread} />
            {s.running && s.thread.at(-1)?.kind === "user" ? (
              <div className="flex items-center gap-1.5 text-[11px] text-[#667085]" role="status">
                <Loader2 size={12} className="animate-spin" aria-hidden />
                {t("panel.thinking")}
              </div>
            ) : null}
          </div>

          <Composer disabled={!ready} reason={!hasKey ? t("panel.input.disabled") : undefined} />
        </>
      )}
    </aside>
  );
}
