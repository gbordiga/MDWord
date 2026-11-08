"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatUsd, t } from "@mdword/agent";
import { cn } from "@mdword/ui";
import { AlertCircle, Check, ChevronRight, ArrowDown, FileText, Globe, History, Loader2, Plus, Send, Settings, Sparkles, Square, X } from "lucide-react";
import { relativeWorkspacePath } from "@mdword/workspace";
import { useApp } from "@/lib/store";
import { groupThread, type ToolItem } from "@/lib/assistant/thread";
import { safeHref } from "@/lib/assistant/links";
import { useAssistant } from "@/lib/assistant/store";
import { instructionPaths } from "@/lib/assistant/env";
import type { ThreadItem } from "@/lib/assistant/thread";
import { AssistantHistory } from "./AssistantHistory";
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

const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    const safe = safeHref(href);
    return safe ? (
      <a href={safe} target="_blank" rel="noopener noreferrer" className="text-accent underline">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    );
  },
  img: ({ alt }: { alt?: string }) => <span>{alt}</span>,
  p: ({ children }: { children?: React.ReactNode }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
  h1: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 mt-2 text-[14px] font-semibold">{children}</h3>,
  h2: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 mt-2 text-[14px] font-semibold">{children}</h3>,
  h3: ({ children }: { children?: React.ReactNode }) => <h4 className="mb-1 mt-2 text-[13px] font-semibold">{children}</h4>,
  h4: ({ children }: { children?: React.ReactNode }) => <h4 className="mb-1 mt-2 text-[13px] font-semibold">{children}</h4>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-1.5 border-l-2 border-[#d0d5dd] pl-2 text-[#475467]">{children}</blockquote>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-1.5 overflow-auto rounded-md bg-[#f2f4f7] p-2 text-[12px]">{children}</pre>
  ),
  // Block code lives inside <pre>, which styles it; only inline code gets its own chip.
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => (
    <code className={cn(className ? "" : "[:not(pre)>&]:rounded [:not(pre)>&]:bg-[#f2f4f7] [:not(pre)>&]:px-1 [:not(pre)>&]:py-0.5", "font-mono text-[12px]")}>{children}</code>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-1.5 overflow-auto">
      <table className="border-collapse text-[12px]">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-[#e4e7ec] bg-[#f9fafb] px-1.5 py-0.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => <td className="border border-[#e4e7ec] px-1.5 py-0.5">{children}</td>
};

const remarkPlugins = [remarkGfm];

// Memoized: while one answer streams, older messages must not be parsed again.
const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  );
});

const WorkGroup = memo(function WorkGroup({ tools }: { tools: ToolItem[] }) {
  const [open, setOpen] = useState(false);
  const running = tools.some((x) => x.status === "running");
  const failed = tools.some((x) => x.status === "error");
  const last = tools.at(-1)!;
  return (
    <div data-testid="assistant-work" data-status={running ? "running" : "done"} className="rounded-md border border-[#e4e7ec] bg-[#f9fafb]">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] text-[#667085]"
        onClick={() => setOpen((v) => !v)}
      >
        {running ? (
          <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden />
        ) : failed ? (
          <AlertCircle size={12} className="shrink-0 text-[#b42318]" aria-hidden />
        ) : (
          <Check size={12} className="shrink-0" aria-hidden />
        )}
        <span className="min-w-0 truncate">{last.label}</span>
        <span className="ml-auto shrink-0 text-[#667085]">{t("panel.work.steps", { count: tools.length })}</span>
        <ChevronRight size={12} className={cn("shrink-0 transition-transform", open && "rotate-90")} aria-hidden />
      </button>
      {open ? (
        <div className="space-y-1 border-t border-[#e4e7ec] px-2 py-1.5">
          {tools.map((x) => (
            <ToolLine key={x.id} item={x} />
          ))}
        </div>
      ) : null}
    </div>
  );
});

function ThreadView({ thread }: { thread: ThreadItem[] }) {
  return (
    <>
      {groupThread(thread).map((block) => {
        if (block.kind === "work") return <WorkGroup key={block.id} tools={block.tools} />;
        const item = block.item;
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
              <div
                key={item.id}
                data-testid="assistant-message"
                className="break-words text-[13px] leading-relaxed text-[#1c1f24]"
              >
                <Markdown text={item.text} />
              </div>
            );
          case "tool":
            return null;
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

const SUGGESTIONS = [
  { label: "panel.suggest.summarize", prompt: "panel.suggest.summarize.prompt" },
  { label: "panel.suggest.proofread", prompt: "panel.suggest.proofread.prompt" },
  { label: "panel.suggest.structure", prompt: "panel.suggest.structure.prompt" }
] as const;

function Composer({ disabled, reason }: { disabled: boolean; reason?: string }) {
  const text = useAssistant((s) => s.composerText);
  const setText = useAssistant((s) => s.setComposerText);
  const running = useAssistant((s) => s.running);
  const send = useAssistant((s) => s.send);
  const stop = useAssistant((s) => s.stop);
  const webSearch = useAssistant((s) => s.settings.webSearch);
  const updateSettings = useAssistant((s) => s.updateSettings);
  const path = useApp((s) => s.path);
  const root = useApp((s) => s.workspace?.root ?? null);
  const workspace = useApp((s) => s.workspace);
  // Instruction files that apply to the open file (AGENTS.md and the like).
  const instructions = useMemo(() => (workspace?.root ? instructionPaths() : []), [workspace, path]);
  const fileName = path ? ((root ? relativeWorkspacePath(path, root) : null) ?? path.split(/[/\\]/).pop()) : null;

  // Suggestions fill the box and move focus here.
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (text && document.activeElement !== inputRef.current && !running) inputRef.current?.focus();
  }, [text, running]);

  const submit = () => {
    if (disabled || running || !text.trim()) return;
    const value = text;
    setText("");
    void send(value);
  };

  return (
    <div className="shrink-0 space-y-1.5 border-t border-[#e4e7ec] p-2">
      <div className="flex items-center gap-1.5">
        {fileName ? (
          <div className="min-w-0 flex-1 truncate text-[11px] text-[#667085]" data-testid="assistant-context">
            {t("panel.context.file", { name: fileName })}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {instructions.length > 0 ? (
          <span
            data-testid="assistant-instructions"
            className="flex max-w-[45%] shrink-0 items-center gap-1 truncate rounded-md bg-[#f2f4f7] px-1.5 py-0.5 text-[11px] text-[#475467]"
            title={t("panel.instructions.title", { paths: instructions.join(", ") })}
          >
            <FileText size={12} className="shrink-0" aria-hidden />
            <span className="truncate">
              {t("panel.instructions", { names: instructions.map((p) => p.split("/").pop()).join(", ") })}
            </span>
          </span>
        ) : null}
        <button
          type="button"
          data-testid="assistant-web-toggle"
          aria-pressed={webSearch}
          aria-label={t(webSearch ? "panel.web.on" : "panel.web.off")}
          title={t(webSearch ? "panel.web.on" : "panel.web.off")}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]",
            webSearch ? "bg-[#eef2ff] text-[#3538cd]" : "text-[#667085] hover:bg-[#f2f4f7]"
          )}
          onClick={() => updateSettings({ webSearch: !webSearch })}
        >
          <Globe size={12} aria-hidden />
          {webSearch ? <span>{t("panel.web.badge")}</span> : null}
        </button>
      </div>
      <div className="flex items-end gap-1.5">
        <textarea
          ref={inputRef}
          data-testid="assistant-input"
          aria-label={t("panel.input.placeholder")}
          rows={2}
          disabled={disabled}
          placeholder={disabled && reason ? reason : t("panel.input.placeholder")}
          className="min-h-[3.25rem] flex-1 resize-none rounded-md border border-[#d0d5dd] bg-white px-2 py-1.5 text-[13px] max-lg:text-[16px] text-[#1c1f24] focus:border-accent focus:outline-none disabled:bg-[#f9fafb]"
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
      <p className="text-[11px] text-[#667085]">{t("panel.input.hint")}</p>
    </div>
  );
}

export function AssistantPanel({ className, onClose }: { className?: string; onClose?: () => void }) {
  const s = useAssistant();
  const scroller = useRef<HTMLDivElement | null>(null);
  const hasKey = s.key?.hasKey ?? false;
  const ready = hasKey && s.settings.noticeAccepted;

  // After a dev hot reload the store is recreated empty: reload what is saved.
  useEffect(() => {
    if (s.key === null) void useAssistant.getState().init();
  }, [s.key]);

  // Follow the end while the answer streams, unless the user scrolled away.
  const [attached, setAttached] = useState(true);
  const attachedRef = useRef(true);
  const toBottom = useCallback(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    attachedRef.current = atEnd;
    setAttached(atEnd);
  };
  const waitingForUser = s.thread.some((i) => i.kind === "edit" && i.status === "pending");
  const lastUser = s.thread.findLast((i) => i.kind === "user")?.id;
  useEffect(() => {
    attachedRef.current = true;
    setAttached(true);
    toBottom();
  }, [lastUser, toBottom]);
  useEffect(() => {
    if (attachedRef.current) toBottom();
  }, [s.thread, s.running, toBottom]);

  const close = () => (onClose ? onClose() : useApp.setState({ rightOpen: false }));

  return (
    <aside
      data-testid="assistant-panel"
      aria-label={t("panel.title")}
      className={cn("flex h-full w-full min-w-0 flex-col border-l border-[#e4e7ec] bg-white text-[13px]", className)}
    >
      {s.view === "settings" ? (
        <AssistantSettings />
      ) : s.view === "history" ? (
        <AssistantHistory />
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
              aria-label={t("panel.history")}
              title={t("panel.history")}
              data-testid="assistant-open-history"
              className={iconButton}
              onClick={() => s.setView("history")}
            >
              <History size={16} />
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
            onScroll={onScroll}
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
                <div className="flex flex-col items-stretch gap-1.5 pt-3" data-testid="assistant-suggestions">
                  {SUGGESTIONS.map((x) => (
                    <button
                      key={x.label}
                      type="button"
                      className="rounded-md border border-[#e4e7ec] px-2.5 py-1.5 text-left text-[12px] text-[#344054] hover:bg-[#f2f4f7]"
                      onClick={() => s.setComposerText(t(x.prompt))}
                    >
                      {t(x.label)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <ThreadView thread={s.thread} />
            {s.running && !waitingForUser ? (
              <div data-testid="assistant-thinking" className="flex items-center gap-1.5 text-[11px] text-[#667085]" role="status">
                <Loader2 size={12} className="animate-spin" aria-hidden />
                {t("panel.thinking")}…
              </div>
            ) : null}
          </div>

          {!attached ? (
            <div className="relative h-0">
              <button
                type="button"
                data-testid="assistant-jump-latest"
                aria-label={t("panel.jumpLatest")}
                title={t("panel.jumpLatest")}
                className="absolute -top-9 right-3 rounded-full border border-[#d0d5dd] bg-white p-1.5 text-[#344054] shadow hover:bg-[#f2f4f7]"
                onClick={() => {
                  attachedRef.current = true;
                  setAttached(true);
                  toBottom();
                }}
              >
                <ArrowDown size={14} />
              </button>
            </div>
          ) : null}
          <Composer disabled={!ready} reason={!hasKey ? t("panel.input.disabled") : undefined} />
        </>
      )}
    </aside>
  );
}
