"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  activeSlash,
  EMPTY_CAPABILITIES,
  formatUsd,
  slashBadgeLength,
  slashChoices,
  t,
  type Capabilities,
  type SlashChoice
} from "@mdword/agent";
import { cn } from "@mdword/ui";
import { AlertCircle, Check, ChevronRight, ArrowDown, ArrowUp, CornerDownRight, FilePenLine, FileText, Folder, Globe, History, Loader2, Plus, ScrollText, Settings, Sparkles, Square, Terminal, X } from "lucide-react";
import type { ShellMode } from "@mdword/shared";
import { getHost } from "@/lib/host";
import { relativeWorkspacePath } from "@mdword/workspace";
import { useApp } from "@/lib/store";
import { groupThread, type ToolItem, type WorkEntry } from "@/lib/assistant/thread";
import { linkifyWikilinks, safeHref, wikiTargetFromHref } from "@/lib/assistant/links";
import { openWikiTarget } from "@/lib/openEditorLink";
import { shellModeOf, useAssistant } from "@/lib/assistant/store";
import { mentionFiles } from "@/lib/assistant/context";
import { instructionPaths, loadCapabilities } from "@/lib/assistant/env";
import { activeMention, filterMentionFiles, isFolderMention, splitMentions, type MentionSegment } from "@/lib/assistant/mentions";
import type { ThreadItem } from "@/lib/assistant/thread";
import { AssistantHistory } from "./AssistantHistory";
import { AssistantSettings } from "./AssistantSettings";
import { CommandCard, CommandStep } from "./CommandCard";
import { DeleteCard, DeleteStep } from "./DeleteCard";
import { ImageCard } from "./ImageCard";
import { EditCard, EditStep } from "./EditCard";

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
    const wiki = wikiTargetFromHref(href);
    if (wiki) {
      return (
        <a
          href={href}
          data-testid="assistant-wikilink"
          className="rounded bg-[#e8eefc] px-1 text-[#1d4ed8] underline"
          onClick={(event) => {
            event.preventDefault();
            openWikiTarget(wiki);
          }}
        >
          {children}
        </a>
      );
    }
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
      {linkifyWikilinks(text)}
    </ReactMarkdown>
  );
});

function renderEntry(entry: WorkEntry) {
  if (entry.kind === "tool") return <ToolLine key={entry.id} item={entry} />;
  if (entry.kind === "edit") return <EditStep key={entry.id} item={entry} />;
  if (entry.kind === "delete") return <DeleteStep key={entry.id} item={entry} />;
  if (entry.kind === "thought") return <ThoughtBlock key={entry.id} item={entry} />;
  return <CommandStep key={entry.id} item={entry} />;
}

function workLabel(entry: WorkEntry): string {
  if (entry.kind === "thought") {
    if (entry.streaming) return t("panel.thought.live");
    const preview = entry.text.replace(/\s+/g, " ").trim();
    return preview ? `${t("panel.thought")}: ${preview}` : t("panel.thought");
  }
  if (entry.kind === "tool") return entry.label;
  if (entry.kind === "edit") return t(entry.create ? "edit.step.created" : "edit.step.applied", { path: entry.path });
  if (entry.kind === "delete") {
    return t(entry.status === "deleted" ? "delete.deleted" : entry.status === "failed" ? "delete.failed" : "delete.kept", {
      path: entry.path,
      reason: entry.error ?? ""
    });
  }
  return entry.command;
}

function workFailed(entry: WorkEntry): boolean {
  if (entry.kind === "thought") return false;
  if (entry.kind === "tool") return entry.status === "error";
  if (entry.kind === "edit") return false;
  if (entry.kind === "delete") return entry.status === "failed";
  return entry.status === "failed" || (entry.status === "done" && (entry.exitCode !== 0 || entry.timedOut === true));
}

const WorkGroup = memo(function WorkGroup({ entries }: { entries: WorkEntry[] }) {
  const running = entries.some((x) => x.kind === "thought" ? x.streaming : x.status === "running");
  // Open only while the model is thinking, so the text can be followed. Tool steps do not move the layout.
  const thinking = entries.some((x) => x.kind === "thought" && x.streaming);
  const [open, setOpen] = useState(thinking);
  const pinned = useRef(false);
  useEffect(() => {
    if (!pinned.current) setOpen(thinking);
  }, [thinking]);
  const last = entries.at(-1)!;
  const failed = !running && workFailed(last);
  return (
    <div data-testid="assistant-work" data-status={running ? "running" : "done"} className="rounded-md border border-[#e4e7ec] bg-[#f9fafb]">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] text-[#667085]"
        onClick={() => {
          pinned.current = true;
          setOpen((v) => !v);
        }}
      >
        {running ? (
          <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden />
        ) : failed ? (
          <AlertCircle size={12} className="shrink-0 text-[#b42318]" aria-hidden />
        ) : (
          <Check size={12} className="shrink-0" aria-hidden />
        )}
        <span className="min-w-0 truncate">{workLabel(last)}</span>
        <span className="ml-auto shrink-0 text-[#667085]">{t("panel.work.steps", { count: entries.length })}</span>
        <ChevronRight size={12} className={cn("shrink-0 transition-transform", open && "rotate-90")} aria-hidden />
      </button>
      {open ? (
        <div className="space-y-1 border-t border-[#e4e7ec] px-2 py-1.5">
          {entries.map(renderEntry)}
        </div>
      ) : null}
    </div>
  );
});

function ThoughtBlock({ item }: { item: Extract<ThreadItem, { kind: "thought" }> }) {
  return (
    <div data-testid="assistant-thought" className="text-[12px] text-[#667085]">
      <p className="font-medium text-[#475467]">{t(item.streaming ? "panel.thought.live" : "panel.thought")}</p>
      <div className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words border-l border-[#e4e7ec] pl-2.5 leading-relaxed">
        {item.text}
      </div>
    </div>
  );
}

function ThreadView({ thread }: { thread: ThreadItem[] }) {
  return (
    <>
      {groupThread(thread).map((block) => {
        if (block.kind === "work") return <WorkGroup key={block.id} entries={block.entries} />;
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
          case "delete":
            return <DeleteCard key={item.id} item={item} />;
          case "image":
            return <ImageCard key={item.id} item={item} />;
          case "command":
            return <CommandCard key={item.id} item={item} />;
          case "thought":
            return null;
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

const BADGE_CLASS = "rounded-md bg-[#e8eefc] shadow-[0_0_0_2px_#e8eefc] [box-decoration-break:clone]";

function renderSegment(segment: MentionSegment, index: number) {
  return (
    <span key={index} className={segment.mention ? BADGE_CLASS : undefined}>
      {segment.text}
    </span>
  );
}

function MentionMark({ text, query }: { text: string; query: string }) {
  if (!query) return text;
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-[#1d4ed8]">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

function MentionMenu({
  query,
  choices,
  active,
  onHover,
  onPick
}: {
  query: string;
  choices: { rel: string; title: string }[];
  active: number;
  onHover: (index: number) => void;
  onPick: (rel: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, choices]);

  return (
    <div
      id="assistant-mentions"
      data-testid="assistant-mentions"
      className="absolute bottom-full left-2 right-2 z-20 mb-2 overflow-hidden rounded-xl border border-[#e4e7ec] bg-white shadow-[0_12px_32px_rgba(16,24,40,0.12)]"
    >
      <div className="flex items-center gap-2 border-b border-[#e4e7ec] px-3 py-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#e8eefc] text-[12px] font-semibold text-[#1d4ed8]">@</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#344054]">{t("panel.mention.list")}</span>
        {query ? (
          <span className="max-w-[40%] truncate rounded-md bg-[#f2f4f7] px-1.5 py-0.5 font-mono text-[11px] text-[#475467]">
            {query}
          </span>
        ) : null}
      </div>
      {choices.length === 0 ? (
        <p className="px-3 py-3 text-[12px] leading-5 text-[#667085]">
          {query ? t("panel.mention.empty", { query }) : t("panel.mention.empty.all")}
        </p>
      ) : (
        <ul role="listbox" aria-label={t("panel.mention.list")} className="max-h-64 overflow-auto p-1">
          {choices.map((file, index) => {
            const selected = index === active;
            return (
              <li key={file.rel}>
                <button
                  ref={selected ? activeRef : undefined}
                  id={`assistant-mention-${index}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-testid="assistant-mention"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
                    selected ? "bg-[#e8eefc]" : "hover:bg-[#f8fafc]"
                  )}
                  onMouseEnter={() => onHover(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onPick(file.rel);
                  }}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      selected ? "bg-white text-[#1d4ed8]" : "bg-[#f2f4f7] text-[#667085]"
                    )}
                  >
                    {isFolderMention(file.rel) ? <Folder size={14} aria-hidden /> : <FileText size={14} aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-[#1c1f24]">
                      <MentionMark text={file.title} query={query} />
                    </span>
                    <span className="block truncate text-[11px] text-[#667085]">
                      <MentionMark text={file.rel} query={query} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t border-[#e4e7ec] px-3 py-1.5 text-[11px] text-[#98a2b3]">{t("panel.mention.hint")}</div>
    </div>
  );
}

function SlashMenu({
  query,
  choices,
  active,
  onHover,
  onPick
}: {
  query: string;
  choices: SlashChoice[];
  active: number;
  onHover: (index: number) => void;
  onPick: (choice: SlashChoice) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, choices]);

  return (
    <div
      id="assistant-slash"
      data-testid="assistant-slash"
      className="absolute bottom-full left-2 right-2 z-20 mb-2 overflow-hidden rounded-xl border border-[#e4e7ec] bg-white shadow-[0_12px_32px_rgba(16,24,40,0.12)]"
    >
      <div className="flex items-center gap-2 border-b border-[#e4e7ec] px-3 py-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#e8eefc] text-[12px] font-semibold text-[#1d4ed8]">/</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#344054]">{t("panel.slash.list")}</span>
      </div>
      {choices.length === 0 ? (
        <p className="px-3 py-3 text-[12px] leading-5 text-[#667085]">{t("panel.slash.empty", { query })}</p>
      ) : (
      <ul role="listbox" aria-label={t("panel.slash.list")} className="max-h-64 overflow-auto p-1">
        {choices.map((choice, index) => {
          const selected = index === active;
          return (
            <li key={choice.id}>
              <button
                ref={selected ? activeRef : undefined}
                id={`assistant-slash-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                data-testid="assistant-slash-item"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
                  selected ? "bg-[#e8eefc]" : "hover:bg-[#f8fafc]"
                )}
                onMouseEnter={() => onHover(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onPick(choice);
                }}
              >
                <span className="min-w-0 flex-1">
                  {choice.kind === "new-skill" || choice.kind === "new-rule" ? (
                    <>
                      <span className="flex items-center gap-1 truncate text-[13px] text-[#1d4ed8]">
                        <Plus size={13} aria-hidden />
                        {choice.kind === "new-skill" ? t("panel.slash.new.skill") : t("panel.slash.new.rule")}
                      </span>
                      <span className="block truncate text-[11px] text-[#667085]">
                        {choice.kind === "new-skill" ? t("panel.slash.new.skill.hint") : t("panel.slash.new.rule.hint")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block truncate text-[13px] text-[#1c1f24]">
                        {choice.name}
                        <span className="ml-1.5 text-[11px] text-[#667085]">
                          {choice.kind === "skill" ? t("panel.slash.skill") : t("panel.slash.rule")}
                        </span>
                      </span>
                      <span className="block truncate text-[11px] text-[#667085]">{choice.description}</span>
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      )}
      <div className="border-t border-[#e4e7ec] px-3 py-1.5 text-[11px] text-[#98a2b3]">{t("panel.slash.hint")}</div>
    </div>
  );
}

const SHELL_CHOICES: ShellMode[] = ["off", "manual", "ai", "always"];

function ShellModeControl() {
  const mode = useAssistant((s) => shellModeOf(s));
  const setShellMode = useAssistant((s) => s.setShellMode);
  const refreshShell = useAssistant((s) => s.refreshShell);
  const noShell = useAssistant((s) => s.shellAvailability != null && !s.shellAvailability.bash && !s.shellAvailability.powershell);
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<ShellMode | null>(null);
  if (!getHost().assistant?.shell) return null;
  const choose = (next: ShellMode) => {
    if (next === "ai" || next === "always") setAsking(next);
    else {
      setAsking(null);
      setShellMode(next);
      setOpen(false);
    }
  };
  return (
    <div className="relative">
      <button
        type="button"
        data-testid="assistant-shell-badge"
        data-mode={mode}
        aria-expanded={open}
        aria-label={t(mode === "off" ? "panel.shell.badge.title" : `panel.shell.badge.${mode}`)}
        title={t(mode === "off" ? "panel.shell.badge.title" : `panel.shell.badge.${mode}`)}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          mode === "off" ? "text-[#667085] hover:bg-[#f2f4f7]" : mode === "manual" ? "bg-[#f2f4f7] text-[#344054]" : "bg-[#fffaeb] text-[#b54708]"
        )}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void refreshShell();
        }}
      >
        <Terminal size={13} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          data-testid="assistant-shell-menu"
          className="absolute bottom-9 left-0 z-20 w-56 space-y-1 rounded-lg border border-[#e4e7ec] bg-white p-1.5 shadow-lg"
        >
          {SHELL_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              role="menuitemradio"
              aria-checked={mode === choice}
              data-testid={`assistant-shell-pick-${choice}`}
              disabled={choice !== "off" && noShell}
              className={cn(
                "block w-full rounded-md px-2 py-1 text-left text-[12px] text-[#344054] hover:bg-[#f2f4f7] disabled:opacity-40",
                mode === choice && "bg-[#f2f4f7] font-medium"
              )}
              onClick={() => choose(choice)}
            >
              {t(`settings.shell.${choice}`)}
            </button>
          ))}
          {asking ? (
            <div className="space-y-1.5 rounded-md border border-[#fedf89] bg-[#fffaeb] p-2" data-testid="assistant-shell-warning">
              <p className="text-[11px] leading-snug text-[#93370d]">{t("settings.shell.warn.body")}</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="rounded-md bg-[#1c1f24] px-2 py-1 text-[11px] font-medium text-white"
                  data-testid="assistant-shell-confirm"
                  onClick={() => {
                    setShellMode(asking);
                    setAsking(null);
                    setOpen(false);
                  }}
                >
                  {t("settings.shell.warn.confirm")}
                </button>
                <button type="button" className="rounded-md px-2 py-1 text-[11px] text-[#344054]" onClick={() => setAsking(null)}>
                  {t("settings.shell.warn.cancel")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EditApprovalControl() {
  const mode = useAssistant((s) => s.settings.editApproval);
  const updateSettings = useAssistant((s) => s.updateSettings);
  const auto = mode === "auto";
  return (
    <button
      type="button"
      data-testid="assistant-edits-badge"
      data-mode={mode}
      aria-pressed={auto}
      aria-label={t(auto ? "panel.edits.auto" : "panel.edits.manual")}
      title={t(auto ? "panel.edits.auto" : "panel.edits.manual")}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        auto ? "bg-[#ecfdf3] text-[#027a48]" : "text-[#667085] hover:bg-[#f2f4f7]"
      )}
      onClick={() => updateSettings({ editApproval: auto ? "manual" : "auto" })}
    >
      <FilePenLine size={13} aria-hidden />
    </button>
  );
}

function Composer({ disabled, reason }: { disabled: boolean; reason?: string }) {
  const text = useAssistant((s) => s.composerText);
  const setText = useAssistant((s) => s.setComposerText);
  const running = useAssistant((s) => s.running);
  const send = useAssistant((s) => s.send);
  const stop = useAssistant((s) => s.stop);
  const queue = useAssistant((s) => s.queue);
  const enqueue = useAssistant((s) => s.enqueue);
  const unqueue = useAssistant((s) => s.unqueue);
  const steer = useAssistant((s) => s.steer);
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
  const [cursor, setCursor] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionClosed, setMentionClosed] = useState(false);
  useEffect(() => {
    if (text && document.activeElement !== inputRef.current && !running) inputRef.current?.focus();
  }, [text, running]);

  const backdropRef = useRef<HTMLDivElement | null>(null);
  const knownFiles = useMemo(() => (workspace ? mentionFiles().map((f) => f.rel) : []), [workspace]);

  const mention = activeMention(text, cursor);
  const mentionOpen = Boolean(mention) && !mentionClosed;
  const mentionChoices = useMemo(
    () => (mentionOpen && mention && workspace ? filterMentionFiles(mentionFiles(), mention.query) : []),
    [mentionOpen, mention, workspace]
  );
  useEffect(() => {
    setMentionIndex(0);
    setMentionClosed(false);
  }, [mention?.start, mention?.query]);

  // `/` at the start of the message picks a skill or rule from .agents.
  const [caps, setCaps] = useState<Capabilities>(EMPTY_CAPABILITIES);
  const [capsReady, setCapsReady] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashClosed, setSlashClosed] = useState(false);
  const slash = activeSlash(text, cursor);
  const slashWanted = Boolean(slash) && !slashClosed;
  const startsWithSlash = text.startsWith("/");
  useEffect(() => {
    if (!startsWithSlash || !workspace) return;
    setCapsReady(false);
    let live = true;
    void loadCapabilities().then((next) => {
      if (!live) return;
      setCaps(next);
      setCapsReady(true);
    });
    return () => {
      live = false;
    };
  }, [startsWithSlash, workspace]);
  const slashList = useMemo(
    () => (slashWanted && slash ? slashChoices(caps, slash.query) : []),
    [slashWanted, slash?.query, caps]
  );
  const slashBadge = useMemo(() => slashBadgeLength(text, caps), [text, caps]);
  const segments = useMemo(
    () =>
      slashBadge > 0
        ? [{ text: text.slice(0, slashBadge), mention: true }, ...splitMentions(text.slice(slashBadge), knownFiles)]
        : splitMentions(text, knownFiles),
    [text, knownFiles, slashBadge]
  );
  const hasBadges = segments.some((s) => s.mention);
  const slashOpen =
    !mentionOpen && slashWanted && Boolean(workspace) && (slashList.length > 0 || (capsReady && (slash?.query.length ?? 0) > 0));
  useEffect(() => {
    setSlashIndex(0);
    setSlashClosed(false);
  }, [slash?.query, slash === null]);

  const applySlash = (choice: SlashChoice) => {
    if (!slash) return;
    const after = text.slice(slash.end).replace(/^ /, "");
    // A new skill or rule is written by the assistant: the box gets the start of the request to finish.
    const start =
      choice.kind === "new-skill"
        ? t("panel.slash.new.skill.prompt")
        : choice.kind === "new-rule"
          ? t("panel.slash.new.rule.prompt")
          : choice.kind === "rule" && caps.skills.some((skill) => skill.name === choice.name)
            ? `/${choice.id} `
            : `/${choice.name} `;
    const next = `${start}${after}`;
    const caret = start.length;
    setText(next);
    setCursor(caret);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  };

  const applyMention = (rel: string) => {
    if (!mention) return;
    // Replace the whole token, also the part after the caret, so no leftover text stays behind.
    const after = text.slice(mention.end).replace(/^ /, "");
    const next = `${text.slice(0, mention.start)}@${rel} ${after}`;
    const caret = mention.start + rel.length + 2;
    setText(next);
    setCursor(caret);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  };

  const submit = () => {
    if (disabled || !text.trim()) return;
    const value = text;
    setText("");
    setCursor(0);
    if (running) enqueue(value);
    else void send(value);
  };

  // The box grows with the text up to about eight lines, then scrolls. It is measured again
  // when its width changes: while the panel opens or closes the box is briefly narrow, and
  // text (or the placeholder) wraps into many lines that would otherwise stay as its height.
  const fitHeight = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  };
  useLayoutEffect(fitHeight, [text, disabled]);
  useEffect(() => {
    const el = inputRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fitHeight();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSend = !disabled && text.trim().length > 0;

  return (
    <div className="shrink-0 border-t border-[#e4e7ec] bg-[#f8fafc] p-2">
      <div
        className={cn(
          "rounded-xl border bg-white shadow-sm transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20",
          disabled ? "border-[#e4e7ec] bg-[#f9fafb]" : "border-[#d0d5dd]"
        )}
      >
        {queue.length > 0 ? (
          <ul aria-label={t("panel.queue.list")} data-testid="assistant-queue" className="space-y-1 border-b border-[#eaecf0] p-1.5">
            {queue.map((q) => (
              <li key={q.id} data-testid="assistant-queued" className="flex items-center gap-1.5 rounded-md bg-[#f2f4f7] py-1 pl-2 pr-1 text-[12px] text-[#344054]">
                <span className="min-w-0 flex-1 truncate">{q.text}</span>
                <button
                  type="button"
                  data-testid="assistant-steer"
                  aria-label={t("panel.queue.steer")}
                  title={t("panel.queue.steer")}
                  className="rounded p-1 text-[#667085] hover:bg-white hover:text-accent"
                  onClick={() => steer(q.id)}
                >
                  <CornerDownRight size={13} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t("panel.queue.remove")}
                  title={t("panel.queue.remove")}
                  className="rounded p-1 text-[#667085] hover:bg-white hover:text-[#1c1f24]"
                  onClick={() => unqueue(q.id)}
                >
                  <X size={13} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {fileName || instructions.length > 0 ? (
          <div className="flex items-center gap-1.5 px-2.5 pt-2">
            {fileName ? (
              <span
                className="flex min-w-0 items-center gap-1 rounded-md bg-[#f2f4f7] px-1.5 py-0.5 text-[11px] text-[#475467]"
                data-testid="assistant-context"
              >
                <FileText size={12} className="shrink-0" aria-hidden />
                <span className="truncate">{t("panel.context.file", { name: fileName })}</span>
              </span>
            ) : null}
            {instructions.length > 0 ? (
              <span
                data-testid="assistant-instructions"
                className="flex min-w-0 shrink-0 items-center gap-1 truncate rounded-md bg-[#f2f4f7] px-1.5 py-0.5 text-[11px] text-[#475467]"
                title={t("panel.instructions.title", { paths: instructions.join(", ") })}
              >
                <ScrollText size={12} className="shrink-0" aria-hidden />
                <span className="truncate">
                  {t("panel.instructions", { names: instructions.map((p) => p.split("/").pop()).join(", ") })}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="relative">
          {slashOpen ? (
            <SlashMenu query={slash?.query ?? ""} choices={slashList} active={slashIndex} onHover={setSlashIndex} onPick={applySlash} />
          ) : null}
          {mentionOpen && mention ? (
            <MentionMenu
              query={mention.query}
              choices={mentionChoices}
              active={mentionIndex}
              onHover={setMentionIndex}
              onPick={applyMention}
            />
          ) : null}
          {hasBadges ? (
            <div
              ref={backdropRef}
              aria-hidden
              data-testid="assistant-input-badges"
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-2.5 text-[13px] leading-5 text-transparent max-lg:text-[16px]"
            >
              {segments.map(renderSegment)}
              {/* A trailing newline would otherwise collapse and shift the badges. */}
              {"\u200b"}
            </div>
          ) : null}
          <textarea
            ref={inputRef}
            data-testid="assistant-input"
            data-focus-ring="none"
            aria-label={t("panel.input.placeholder")}
            aria-expanded={mentionOpen || slashOpen}
            aria-controls={slashOpen ? "assistant-slash" : mentionOpen ? "assistant-mentions" : undefined}
            aria-activedescendant={
              slashOpen && slashList[slashIndex]
                ? `assistant-slash-${slashIndex}`
                : mentionOpen && mentionChoices[mentionIndex]
                  ? `assistant-mention-${mentionIndex}`
                  : undefined
            }
            title={t("panel.input.hint")}
            rows={1}
            disabled={disabled}
            placeholder={disabled && reason ? reason : t("panel.input.placeholder")}
            className="relative block max-h-[168px] min-h-[2.75rem] w-full resize-none bg-transparent outline-none focus:outline-none focus-visible:outline-none px-3 py-2.5 text-[13px] leading-5 text-[#1c1f24] placeholder:text-[#98a2b3] focus:outline-none disabled:cursor-not-allowed max-lg:text-[16px]"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCursor(e.target.selectionStart ?? e.target.value.length);
            }}
            onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
            onScroll={(e) => {
              if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop;
            }}
            onKeyDown={(e) => {
              // While an input method composes text, Enter and Tab belong to it.
              if (e.nativeEvent.isComposing) return;
              if (slashOpen) {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setSlashClosed(true);
                  return;
                }
                if (slashList.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                  e.preventDefault();
                  setSlashIndex((index) =>
                    e.key === "ArrowDown"
                      ? (index + 1) % slashList.length
                      : (index - 1 + slashList.length) % slashList.length
                  );
                  return;
                }
                if (slashList.length > 0 && (e.key === "Enter" || e.key === "Tab") && !e.shiftKey) {
                  e.preventDefault();
                  const choice = slashList[slashIndex] ?? slashList[0];
                  if (choice) applySlash(choice);
                  return;
                }
              }
              if (e.key === "Escape" && mentionOpen) {
                e.preventDefault();
                setMentionClosed(true);
                return;
              }
              if (mentionOpen && mentionChoices.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                setMentionIndex((index) =>
                  e.key === "ArrowDown"
                    ? (index + 1) % mentionChoices.length
                    : (index - 1 + mentionChoices.length) % mentionChoices.length
                );
                return;
              }
              if (mentionOpen && mentionChoices.length > 0 && (e.key === "Enter" || e.key === "Tab") && !e.shiftKey) {
                e.preventDefault();
                const choice = mentionChoices[mentionIndex] ?? mentionChoices[0];
                if (choice) applyMention(choice.rel);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>
        <div className="flex items-center gap-1.5 px-2 pb-2">
          <button
            type="button"
            data-testid="assistant-mention-trigger"
            aria-label={t("panel.mention.add")}
            title={t("panel.mention.add")}
            disabled={disabled || !workspace}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
              mentionOpen ? "bg-[#e8eefc] text-[#1d4ed8]" : "text-[#667085] hover:bg-[#f2f4f7]"
            )}
            onClick={() => {
              const el = inputRef.current;
              const at = el?.selectionStart ?? text.length;
              const prefix = at > 0 && !/\s/.test(text[at - 1] ?? "") ? " @" : "@";
              const next = `${text.slice(0, at)}${prefix}${text.slice(at)}`;
              const caret = at + prefix.length;
              setText(next);
              setCursor(caret);
              requestAnimationFrame(() => {
                el?.focus();
                el?.setSelectionRange(caret, caret);
              });
            }}
          >
            @
          </button>
          <button
            type="button"
            data-testid="assistant-web-toggle"
            aria-pressed={webSearch}
            aria-label={t(webSearch ? "panel.web.on" : "panel.web.off")}
            title={t(webSearch ? "panel.web.badge" : "panel.web.off")}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
              webSearch ? "bg-[#eef2ff] text-[#3538cd]" : "text-[#667085] hover:bg-[#f2f4f7]"
            )}
            onClick={() => updateSettings({ webSearch: !webSearch })}
          >
            <Globe size={13} aria-hidden />
          </button>
          <EditApprovalControl />
          {root ? <ShellModeControl /> : null}
          <span className="flex-1" />
          {running && canSend ? (
            <button
              type="button"
              data-testid="assistant-enqueue"
              aria-label={t("panel.queue")}
              title={t("panel.queue")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:opacity-90"
              onClick={submit}
            >
              <ArrowUp size={16} />
            </button>
          ) : null}
          {running ? (
            <button
              type="button"
              data-testid="assistant-stop"
              aria-label={t("panel.stop")}
              title={t("panel.stop")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1c1f24] text-white hover:opacity-85"
              onClick={() => stop()}
            >
              <Square size={11} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              data-testid="assistant-send"
              aria-label={t("panel.send")}
              title={t("panel.send")}
              disabled={!canSend}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity hover:opacity-90 disabled:bg-[#d0d5dd]"
              onClick={submit}
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
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
  const webSearchOn = s.settings.webSearch;
  const waitingForUser = s.thread.some(
    (i) => (i.kind === "edit" || i.kind === "command" || i.kind === "delete" || i.kind === "image") && i.status === "pending"
  );
  const lastUser = [...s.thread].reverse().find((i) => i.kind === "user")?.id;
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
                {t(webSearchOn ? "panel.thinking.web" : "panel.thinking")}…
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
