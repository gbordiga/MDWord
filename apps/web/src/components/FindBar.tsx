"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { findInDocument } from "@/lib/editorCommands";
import { useEditorUi } from "@/lib/editorUi";
import { useApp } from "@/lib/store";

export function FindBar() {
  const open = useApp((s) => s.findOpen);
  const query = useApp((s) => s.findQuery);
  const setFind = useApp((s) => s.setFind);
  const { editor } = useEditorUi();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setFind(false);
        editor?.commands.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editor, setFind]);

  if (!open) return null;

  const run = (direction: 1 | -1) => {
    if (!editor) return;
    const result = findInDocument(editor, query, direction);
    if (!query.trim()) {
      setStatus("");
      return;
    }
    setStatus(result.count ? `${result.index + 1} of ${result.count}` : "No matches");
  };

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
          setStatus("");
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
