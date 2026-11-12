"use client";

import { useState } from "react";
import { t } from "@mdword/agent";
import { cn } from "@mdword/ui";
import { AlertCircle, Check, ChevronRight, Loader2, Square, TerminalSquare, X } from "lucide-react";
import type { ThreadItem } from "@/lib/assistant/thread";
import { useAssistant } from "@/lib/assistant/store";

type CommandItem = Extract<ThreadItem, { kind: "command" }>;

function whyText(item: CommandItem): string | null {
  const why = item.why;
  if (!why) return null;
  if (why.kind === "ai") return t("command.aiDenied", { reason: why.reason });
  return t("command.needsYou", { reason: why.reason });
}

function summary(item: CommandItem): string {
  switch (item.status) {
    case "denied":
      return t("command.denied");
    case "failed":
      return t("command.failed", { reason: item.error ?? "" });
    case "running":
      return t("command.running");
    case "done": {
      if (item.cancelled) return t("command.cancelled");
      if (item.timedOut) return t("command.timedOut", { seconds: Math.round((item.timeoutMs ?? 0) / 1000) });
      return t("command.exit", {
        code: item.exitCode ?? "?",
        seconds: ((item.durationMs ?? 0) / 1000).toFixed(1)
      });
    }
    default:
      return "";
  }
}

/** A command that already ran, shown as one row inside the steps accordion. */
export function CommandStep({ item }: { item: CommandItem }) {
  const stop = useAssistant((s) => s.stop);
  const [outputOpen, setOutputOpen] = useState(false);
  const failed = item.status === "failed" || (item.status === "done" && (item.exitCode !== 0 || item.timedOut));
  return (
    <div data-testid="assistant-command-step" data-status={item.status} className="text-[11px] text-[#667085]">
      <div className="flex items-center gap-1.5">
        {item.status === "running" ? (
          <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden />
        ) : failed ? (
          <AlertCircle size={12} className="shrink-0 text-[#b42318]" aria-hidden />
        ) : (
          <Check size={12} className="shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate font-mono" title={item.command}>
          {item.command}
        </span>
        {item.status === "running" ? (
          <button type="button" className="shrink-0 underline" onClick={() => stop()}>
            {t("command.stop")}
          </button>
        ) : (
          <span className="shrink-0">{summary(item)}</span>
        )}
        {item.output ? (
          <button
            type="button"
            aria-expanded={outputOpen}
            aria-label={t("command.output")}
            title={t("command.output")}
            data-testid="assistant-command-output-toggle"
            className="-mr-1 shrink-0 rounded p-1 hover:bg-[#e4e7ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb]"
            onClick={() => setOutputOpen((open) => !open)}
          >
            <ChevronRight size={12} className={cn("transition-transform", outputOpen && "rotate-90")} aria-hidden />
          </button>
        ) : null}
      </div>
      {item.changed && item.changed.length > 0 ? (
        <p className="mt-1 pl-5">{t("command.changed", { files: item.changed.join(", ") })}</p>
      ) : null}
      {item.output && outputOpen ? (
        <pre data-testid="assistant-command-output" className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all pl-5 font-mono">
          {item.output}
        </pre>
      ) : null}
    </div>
  );
}

export function CommandCard({ item }: { item: CommandItem }) {
  const resolve = useAssistant((s) => s.resolveCommand);
  const stop = useAssistant((s) => s.stop);
  const pending = item.status === "pending";
  const why = whyText(item);
  const failed = item.status === "failed" || (item.status === "done" && (item.exitCode !== 0 || item.timedOut));
  return (
    <section
      data-testid="assistant-command-card"
      data-status={item.status}
      data-approval={item.approval}
      aria-label={t("command.card.title", { shell: item.shell })}
      className="rounded-lg border border-[#d0d5dd] bg-white"
    >
      <header className="flex items-center gap-1.5 border-b border-[#e4e7ec] px-2.5 py-1.5">
        <TerminalSquare size={14} className="shrink-0 text-[#667085]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#1c1f24]">
          {t("command.card.title", { shell: item.shell })}
        </span>
        <span className="shrink-0 text-[11px] text-[#667085]">
          {t("command.folder", { folder: item.folder || t("command.root") })}
        </span>
      </header>
      <div className="space-y-2 px-2.5 py-2">
        <pre
          data-testid="assistant-command-text"
          className="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-[#f2f4f7] px-2 py-1.5 font-mono text-[12px] leading-snug text-[#1c1f24]"
        >
          {item.command}
        </pre>
        {pending && why ? (
          <p className="text-[11px] leading-snug text-[#b54708]" data-testid="assistant-command-why">
            {why}
          </p>
        ) : null}
        {item.changed && item.changed.length > 0 ? (
          <p className="text-[11px] leading-snug text-[#344054]" data-testid="assistant-command-changed">
            {t("command.changed", { files: item.changed.join(", ") })}
          </p>
        ) : null}
        {item.status === "done" || item.output ? (
          <details className="text-[12px]">
            <summary className="cursor-pointer text-[#667085]">{t("command.output")}</summary>
            <pre
              data-testid="assistant-command-output"
              className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-[#f9fafb] px-2 py-1.5 font-mono text-[11px] leading-snug text-[#344054]"
            >
              {item.output ? item.output : t("command.output.empty")}
            </pre>
            <p className="mt-1 text-[11px] text-[#98a2b3]">{t("command.history")}</p>
          </details>
        ) : null}
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t border-[#e4e7ec] px-2.5 py-1.5">
        {pending ? (
          <>
            <button
              type="button"
              data-testid="assistant-command-run"
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:opacity-90"
              onClick={() => resolve(item.id, "run")}
            >
              <Check size={13} aria-hidden />
              {t("command.run")}
            </button>
            <button
              type="button"
              data-testid="assistant-command-deny"
              className="inline-flex items-center gap-1 rounded-md border border-[#d0d5dd] px-2.5 py-1 text-[12px] font-medium text-[#344054] hover:bg-[#f2f4f7]"
              onClick={() => resolve(item.id, "deny")}
            >
              <X size={13} aria-hidden />
              {t("command.deny")}
            </button>
          </>
        ) : item.status === "running" ? (
          <>
            <button
              type="button"
              data-testid="assistant-command-stop"
              className="inline-flex items-center gap-1 rounded-md border border-[#d0d5dd] px-2.5 py-1 text-[12px] font-medium text-[#344054] hover:bg-[#f2f4f7]"
              onClick={() => stop()}
            >
              <Square size={12} aria-hidden />
              {t("command.stop")}
            </button>
            <span className="text-[12px] text-[#667085]" role="status">
              {summary(item)}
            </span>
          </>
        ) : (
          <span className={`text-[12px] ${failed ? "text-[#b54708]" : "text-[#667085]"}`} role="status">
            {summary(item)}
          </span>
        )}
        {item.status !== "pending" && item.status !== "denied" ? (
          <span className="ml-auto text-[11px] text-[#98a2b3]">{t(`command.approval.${item.approval}`)}</span>
        ) : null}
      </footer>
    </section>
  );
}
