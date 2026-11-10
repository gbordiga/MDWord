"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Centre under the trigger, then pull the box back inside the window on either side.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el || !pos) return;
    const width = el.offsetWidth;
    el.style.left = `${Math.min(Math.max(pos.x - width / 2, 8), window.innerWidth - width - 8)}px`;
  }, [pos]);

  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
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
              ref={tipRef}
              role="tooltip"
              data-testid="tooltip"
              style={{ left: pos.x, top: pos.y }}
              className={`pointer-events-none fixed z-[100] flex items-center gap-2 rounded-lg bg-[#1c1f24] px-2.5 py-1.5 text-[12px] font-medium text-white shadow-lg ${label.length > 40 ? "w-max max-w-[16rem] whitespace-normal leading-snug" : "whitespace-nowrap"}`}
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
