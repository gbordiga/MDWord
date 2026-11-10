"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronUp, CaseSensitive, Regex, WholeWord, X } from "lucide-react";
import { DEFAULT_FIND_OPTIONS, type FindOptions } from "@mdword/shared";
import { findInDocument, replaceAllInDocument, replaceInDocument, type FindResult } from "@/lib/editorCommands";
import { clearFindInSource, findInSource, replaceAllInSource, replaceInSource } from "@mdword/source-editor";
import { useEditorUi } from "@/lib/editorUi";
import { useApp } from "@/lib/store";
import { getSourceView } from "@/lib/sourceView";
import { Tooltip } from "./Tooltip";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const ALT = isMac ? "⌥" : "Alt";

function Toggle({
  label,
  keys,
  active,
  testId,
  onClick,
  children
}: {
  label: string;
  keys: string[];
  active: boolean;
  testId: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label} keys={keys}>
      <button
        type="button"
        data-testid={testId}
        aria-label={label}
        aria-pressed={active}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
          active ? "bg-accent text-white" : "text-[#667085] hover:bg-[#f2f4f7]"
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function IconBtn({
  label,
  keys,
  testId,
  disabled,
  onClick,
  children
}: {
  label: string;
  keys?: string[];
  testId?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label} keys={keys}>
      <button
        type="button"
        data-testid={testId}
        aria-label={label}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#344054] hover:bg-[#f2f4f7] disabled:opacity-40 max-lg:h-10 max-lg:w-10"
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function FindBar() {
  const open = useApp((s) => s.findOpen);
  const query = useApp((s) => s.findQuery);
  const setFind = useApp((s) => s.setFind);
  const replaceOpen = useApp((s) => s.findReplaceOpen);
  const setReplaceOpen = useApp((s) => s.setFindReplaceOpen);
  const view = useApp((s) => s.view);
  const { editor } = useEditorUi();
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<FindOptions>(DEFAULT_FIND_OPTIONS);
  const [replacement, setReplacement] = useState("");
  const [result, setResult] = useState<FindResult & { done?: string }>({ count: 0, index: -1 });

  const target = () => {
    const source = view !== "document" ? getSourceView() : null;
    const visual = view !== "source" ? editor : null;
    return { source, visual };
  };

  const clearMarks = () => {
    editor?.commands.clearSearchHighlight();
    const sourceView = getSourceView();
    if (sourceView) clearFindInSource(sourceView);
  };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [open]);

  const run = (direction: 1 | -1, keepFocus = true, live = false) => {
    if (!query.trim() && !options.regex) {
      setResult({ count: 0, index: -1 });
      clearMarks();
      return;
    }
    const { source, visual } = target();
    let next: FindResult = { count: 0, index: -1 };
    if (visual) {
      next = findInDocument(visual, query, direction, {
        focus: !keepFocus,
        from: live ? "caret-start" : "caret-end",
        find: options
      });
    } else if (source) {
      next = findInSource(source, query, direction, options);
    }
    setResult(next);
    if (keepFocus) requestAnimationFrame(() => document.activeElement === document.body && inputRef.current?.focus());
  };

  const replaceOne = () => {
    const { source, visual } = target();
    if (!query.trim() && !options.regex) return;
    const next = visual
      ? replaceInDocument(visual, query, replacement, options)
      : source
        ? replaceInSource(source, query, replacement, options)
        : null;
    if (next) setResult(next);
  };

  const replaceAll = () => {
    const { source, visual } = target();
    if (!query.trim() && !options.regex) return;
    const count = visual
      ? replaceAllInDocument(visual, query, replacement, options)
      : source
        ? replaceAllInSource(source, query, replacement, options)
        : 0;
    setResult({ count: 0, index: -1, done: count ? `Replaced ${count}` : "No matches" });
  };

  const toggle = (key: keyof FindOptions) => setOptions((o) => ({ ...o, [key]: !o[key] }));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setFind(false);
        editor?.commands.focus();
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        run(e.shiftKey ? -1 : 1);
        return;
      }
      // Alt+C, Alt+W and Alt+R flip the options, as in most editors.
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const key = e.code === "KeyC" ? "caseSensitive" : e.code === "KeyW" ? "wholeWord" : e.code === "KeyR" ? "regex" : null;
        if (key) {
          e.preventDefault();
          e.stopPropagation();
          toggle(key);
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, editor, query, view, options]);

  useEffect(() => {
    if (!open) {
      setResult({ count: 0, index: -1 });
      clearMarks();
      return;
    }
    run(1, true, true);
    // Search when the query, options or target editor change, not on every key in the document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, editor, view, options]);

  useEffect(() => {
    if (replaceOpen && open) replaceRef.current?.focus();
  }, [replaceOpen, open]);

  if (!open) return null;

  const status =
    result.error ??
    result.done ??
    (result.count ? `${result.index + 1} of ${result.count}` : query.trim() ? "No matches" : "");
  const invalid = Boolean(result.error);
  const canReplace = view !== "source" || Boolean(getSourceView());

  return (
    <div
      data-testid="find-bar"
      role="search"
      className="absolute inset-x-2 top-2 z-30 flex flex-col gap-1.5 rounded-xl border border-[#e4e7ec] bg-white/95 p-2 shadow-xl backdrop-blur lg:inset-x-auto lg:right-6 lg:w-[26rem]"
    >
      <div className="flex items-center gap-1">
        <IconBtn
          label={replaceOpen ? "Hide replace" : "Show replace"}
          keys={[isMac ? "⌘" : "Ctrl", "H"]}
          testId="find-toggle-replace"
          onClick={() => setReplaceOpen(!replaceOpen)}
        >
          {replaceOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </IconBtn>
        <div
          className={`flex min-w-0 flex-1 items-center gap-0.5 rounded-lg border bg-white pr-1 focus-within:ring-2 ${
            invalid
              ? "border-[#f04438] focus-within:ring-[#fee4e2]"
              : "border-[#d0d5dd] focus-within:border-accent focus-within:ring-accent/20"
          }`}
        >
          <input
            ref={inputRef}
            data-testid="find-input"
            aria-label="Find in document"
            aria-invalid={invalid}
            spellCheck={false}
            className="min-h-9 min-w-0 flex-1 bg-transparent px-2.5 text-[16px] outline-none lg:min-h-8 lg:text-[13px]"
            placeholder="Find"
            value={query}
            onChange={(e) => setFind(true, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                run(e.shiftKey ? -1 : 1);
              }
            }}
          />
          <Toggle label="Match case" keys={[ALT, "C"]} active={options.caseSensitive} testId="find-case" onClick={() => toggle("caseSensitive")}>
            <CaseSensitive size={16} />
          </Toggle>
          <Toggle label="Whole word" keys={[ALT, "W"]} active={options.wholeWord} testId="find-word" onClick={() => toggle("wholeWord")}>
            <WholeWord size={16} />
          </Toggle>
          <Toggle label="Regular expression" keys={[ALT, "R"]} active={options.regex} testId="find-regex" onClick={() => toggle("regex")}>
            <Regex size={16} />
          </Toggle>
        </div>
        <span
          data-testid="find-status"
          role="status"
          className={`min-w-[4.25rem] text-center text-[12px] tabular-nums ${invalid ? "text-[#d92d20]" : "text-[#667085]"}`}
        >
          {status}
        </span>
        <IconBtn label="Previous match" keys={["Shift", "Enter"]} testId="find-prev" onClick={() => run(-1)}>
          <ChevronUp size={16} />
        </IconBtn>
        <IconBtn label="Next match" keys={["Enter"]} testId="find-next" onClick={() => run(1)}>
          <ChevronDown size={16} />
        </IconBtn>
        <IconBtn
          label="Close"
          keys={["Esc"]}
          onClick={() => {
            setFind(false);
            editor?.commands.focus();
          }}
        >
          <X size={16} />
        </IconBtn>
      </div>
      {replaceOpen ? (
        <div className="flex items-center gap-1 pl-9">
          <input
            ref={replaceRef}
            data-testid="replace-input"
            aria-label="Replace with"
            spellCheck={false}
            disabled={!canReplace}
            className="min-h-9 min-w-0 flex-1 rounded-lg border border-[#d0d5dd] bg-white px-2.5 text-[16px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 lg:min-h-8 lg:text-[13px]"
            placeholder={options.regex ? "Replace (use $1 for groups)" : "Replace"}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (e.ctrlKey || e.metaKey) replaceAll();
              else replaceOne();
            }}
          />
          <button
            type="button"
            data-testid="replace-one"
            disabled={!result.count}
            onClick={replaceOne}
            className="h-8 rounded-lg px-2.5 text-[12px] font-medium text-[#344054] hover:bg-[#f2f4f7] disabled:opacity-40 max-lg:h-10"
          >
            Replace
          </button>
          <Tooltip label="Replace all" keys={[isMac ? "⌘" : "Ctrl", "Enter"]}>
            <button
              type="button"
              data-testid="replace-all"
              disabled={!result.count}
              onClick={replaceAll}
              className="h-8 rounded-lg bg-[#f2f4f7] px-2.5 text-[12px] font-medium text-[#1c1f24] hover:bg-[#e4e7ec] disabled:opacity-40 max-lg:h-10"
            >
              All
            </button>
          </Tooltip>
        </div>
      ) : null}
    </div>
  );
}
