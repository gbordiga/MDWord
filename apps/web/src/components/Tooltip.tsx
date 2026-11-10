"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { shortcutKeys, type ShortcutId } from "@/lib/shortcuts";

/**
 * Modern tooltip: dark pill with the label and key chips. It is positioned with fixed
 * coordinates in a portal, so a scrolling ribbon never clips it. It shows after a short
 * delay on hover and at once on keyboard focus.
 */
export function Tooltip({ label, shortcut, keys, children }: { label: string; shortcut?: ShortcutId; keys?: string[]; children: ReactNode }) {
  const chips = keys ?? (shortcut ? shortcutKeys(shortcut) : []);
  const ref = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      // Long descriptions wrap in a 16rem box: keep its edges inside the window.
      const half = label.length > 40 ? 136 : 0;
      const x = Math.min(Math.max(rect.left + rect.width / 2, half + 8), window.innerWidth - half - 8);
      setPos({ x, y: rect.bottom + 8 });
    }, delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };

  return (
    <span
      ref={ref}
      className="inline-flex"
      onMouseEnter={() => show(450)}
      onMouseLeave={hide}
      onFocus={(e) => {
        if (e.target.matches(":focus-visible")) show(0);
      }}
      onBlur={hide}
      onMouseDown={hide}
    >
      {children}
      {pos
        ? createPortal(
            <span
              role="tooltip"
              data-testid="tooltip"
              style={{ left: pos.x, top: pos.y }}
              className={`pointer-events-none fixed z-[100] flex -translate-x-1/2 items-center gap-2 rounded-lg bg-[#1c1f24] px-2.5 py-1.5 text-[12px] font-medium text-white shadow-lg ${label.length > 40 ? "w-max max-w-[16rem] whitespace-normal leading-snug" : "whitespace-nowrap"}`}
            >
              {label}
              {chips.length ? (
                <span className="flex items-center gap-0.5">
                  {chips.map((k, i) => (
                    <kbd key={i} className="rounded bg-white/15 px-1.5 py-px font-sans text-[11px] font-medium text-white/90">
                      {k}
                    </kbd>
                  ))}
                </span>
              ) : null}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
