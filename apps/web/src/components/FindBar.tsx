"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { findInDocument } from "@/lib/editorCommands";
import { findInSource } from "@mdword/source-editor";
import { useEditorUi } from "@/lib/editorUi";
import { useApp } from "@/lib/store";
import { getSourceView } from "@/lib/sourceView";

export function FindBar() {
  const open = useApp((s) => s.findOpen);
  const query = useApp((s) => s.findQuery);
  const setFind = useApp((s) => s.setFind);
  const view = useApp((s) => s.view);
  const { editor } = useEditorUi();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [open]);

  const run = (direction: 1 | -1, keepFocus = true, live = false) => {
    const needle = query.trim();
    if (!needle) {
      setStatus("");
      return;
    }
    const source = view !== "document" ? getSourceView() : null;
    const visual = view !== "source" ? editor : null;
    let result = { count: 0, index: -1 };
    if (visual) {
      result = findInDocument(visual, query, direction, {
        focus: !keepFocus,
        from: live ? "caret-start" : "caret-end"
      });
    } else if (source) {
      result = findInSource(source, query, direction);
    }
    setStatus(result.count ? `${result.index + 1} of ${result.count}` : "No matches");
    if (keepFocus) requestAnimationFrame(() => inputRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setFind(false);
        editor?.commands.focus();
      }
      if (e.key === "F3") {
        e.preventDefault();
        run(e.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, editor, query, view]);

  useEffect(() => {
    if (!open) {
      setStatus("");
      return;
    }
    run(1, true, true);
    // Search when the query or target editor changes, not on every key in the document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, editor, view]);

  if (!open) return null;

  return (
    <div
      data-testid="find-bar"
      className="flex shrink-0 items-center gap-2 border-b border-[#e4e7ec] bg-white px-2 py-1"
    >
      <input
        ref={inputRef}
        data-testid="find-input"
        className="min-h-11 min-w-0 flex-1 rounded-md border border-[#e4e7ec] px-3 text-[16px] outline-none lg:min-h-8 lg:text-[13px]"
        placeholder="Find in document"
        value={query}
        onChange={(e) => {
          setFind(true, e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            run(e.shiftKey ? -1 : 1);
          }
        }}
      />
      <span className="hidden min-w-[4.5rem] text-[12px] text-[#667085] sm:block" data-testid="find-status">
        {status}
      </span>
      <button
        type="button"
        data-testid="find-prev"
        title="Previous"
        aria-label="Previous match"
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[#f2f4f7] lg:h-8 lg:w-8"
        onClick={() => run(-1)}
      >
        <ChevronUp size={18} />
      </button>
      <button
        type="button"
        data-testid="find-next"
        title="Next"
        aria-label="Next match"
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[#f2f4f7] lg:h-8 lg:w-8"
        onClick={() => run(1)}
      >
        <ChevronDown size={18} />
      </button>
      <button
        type="button"
        title="Close"
        aria-label="Close find"
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[#f2f4f7] lg:h-8 lg:w-8"
        onClick={() => {
          setFind(false);
          editor?.commands.focus();
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
