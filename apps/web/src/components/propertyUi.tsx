"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip } from "./Tooltip";

/**
 * Shared look of the properties panel, so every section uses the same type scale:
 * section titles 12px semibold, labels 12px medium, inputs 13px (16px on touch), hints 11px.
 */
export const fieldClass =
  "block w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-[16px] text-[#1c1f24] outline-none transition-colors placeholder:text-[#98a2b3] focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50 lg:px-2.5 lg:py-1.5 lg:text-[13px]";

export const labelClass = "block text-[12px] font-medium text-[#475467]";

/** Info icon with a modern tooltip: the place for descriptions that do not need screen space. */
export function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip label={text}>
      <span
        role="img"
        tabIndex={0}
        aria-label={text}
        className="inline-flex cursor-help rounded-full text-[#98a2b3] hover:text-[#475467] focus-visible:text-[#475467] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Info size={13} aria-hidden />
      </span>
    </Tooltip>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={`${labelClass} mb-1 flex items-center gap-1`}>
        {label}
        {hint ? <InfoHint text={hint} /> : null}
      </span>
      {children}
    </label>
  );
}

export function Check({
  label,
  hint,
  checked,
  onChange,
  testId
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId?: string;
}) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2 text-[12px] font-medium text-[#344054]">
      <input
        type="checkbox"
        data-testid={testId}
        className="h-4 w-4 shrink-0 accent-[var(--color-accent,#2f6fed)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
      {hint ? <InfoHint text={hint} /> : null}
    </label>
  );
}
