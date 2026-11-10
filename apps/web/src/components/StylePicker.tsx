"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { applyBlockStyle, currentBlockStyle } from "@/lib/editorCommands";
import { shortcutKeys, type ShortcutId } from "@/lib/shortcuts";
import { Tooltip } from "./Tooltip";

const STYLES: { value: string; label: string; shortcut: ShortcutId; preview: string }[] = [
  { value: "p", label: "Body", shortcut: "paragraph", preview: "text-[13px]" },
  { value: "1", label: "Heading 1", shortcut: "heading1", preview: "text-[20px] font-bold leading-tight" },
  { value: "2", label: "Heading 2", shortcut: "heading2", preview: "text-[17px] font-bold leading-tight" },
  { value: "3", label: "Heading 3", shortcut: "heading3", preview: "text-[15px] font-semibold leading-tight" },
  { value: "4", label: "Heading 4", shortcut: "heading4", preview: "text-[13px] font-semibold" }
];

/** Paragraph style picker: each style is previewed at its own size and shows its shortcut. */
export function StylePicker({ editor }: { editor: Editor | null }) {
  const current = currentBlockStyle(editor);
  const active = STYLES.find((s) => s.value === current) ?? STYLES[0]!;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);

  const show = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) setBox({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 272) });
    setIndex(Math.max(0, STYLES.findIndex((s) => s.value === current)));
    setOpen(true);
  };
  const choose = (value: string) => {
    setOpen(false);
    if (editor) applyBlockStyle(editor, value);
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.focus();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open]);

  return (
    <>
      <Tooltip label="Paragraph style">
        <button
          ref={trigger}
          type="button"
          data-testid="ribbon-style"
          aria-label="Style"
          aria-haspopup="listbox"
          aria-expanded={open}
          data-value={active.value}
          className="inline-flex h-8 min-w-[7.5rem] items-center justify-between gap-2 rounded-md border border-[#e4e7ec] bg-white px-2.5 text-[13px] text-[#1c1f24] hover:bg-[#f9fafb]"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (open ? setOpen(false) : show())}
        >
          {active.label}
          <ChevronDown size={14} aria-hidden className="text-[#98a2b3]" />
        </button>
      </Tooltip>
      {open
        ? createPortal(
            <div
              ref={menu}
              role="listbox"
              tabIndex={-1}
              aria-label="Paragraph style"
              data-testid="style-menu"
              style={{ top: box.top, left: box.left }}
              className="fixed z-[90] w-64 rounded-xl border border-[#e4e7ec] bg-white p-1 shadow-xl outline-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  editor?.commands.focus();
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndex((i) => (i + 1) % STYLES.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndex((i) => (i + STYLES.length - 1) % STYLES.length);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  choose(STYLES[index]!.value);
                }
              }}
            >
              {STYLES.map((style, i) => (
                <button
                  key={style.value}
                  type="button"
                  role="option"
                  aria-selected={style.value === current}
                  data-testid={`style-option-${style.value}`}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#1c1f24] ${
                    i === index ? "bg-[#f2f4f7]" : ""
                  }`}
                  onMouseEnter={() => setIndex(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(style.value)}
                >
                  <Check size={14} aria-hidden className={style.value === current ? "text-accent" : "invisible"} />
                  <span className={`min-w-0 flex-1 truncate ${style.preview}`}>{style.label}</span>
                  <span className="flex shrink-0 gap-0.5">
                    {shortcutKeys(style.shortcut).map((k, n) => (
                      <kbd key={n} className="rounded bg-[#f2f4f7] px-1.5 py-px font-sans text-[11px] font-medium text-[#667085]">
                        {k}
                      </kbd>
                    ))}
                  </span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
