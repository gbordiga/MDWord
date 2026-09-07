"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  formatFrontmatterScalar,
  frontmatterLabel,
  frontmatterValueKind,
  listFrontmatterKeys
} from "@mdword/document-model";
import { useApp } from "@/lib/store";
import { DocumentProperties } from "./DocumentProperties";

const STORAGE_KEY = "mdword.frontmatterOpen";

function previewChips(frontmatter: Record<string, unknown>, keys: string[]): string[] {
  const chips: string[] = [];
  for (const key of keys) {
    const value = frontmatter[key];
    const kind = frontmatterValueKind(value);
    if (kind === "empty" || kind === "object") continue;
    if (kind === "list") {
      const list = Array.isArray(value) ? value : [];
      if (!list.length) continue;
      chips.push(`${frontmatterLabel(key)} ${list.length}`);
      continue;
    }
    const text = formatFrontmatterScalar(value).trim();
    if (!text) continue;
    chips.push(text.length > 36 ? `${text.slice(0, 34)}…` : text);
    if (chips.length >= 4) break;
  }
  return chips;
}

export function FrontmatterInline({ width }: { width?: number }) {
  const model = useApp((s) => s.model);
  const keys = listFrontmatterKeys(model);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setOpen(false);
    }
  }, []);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const chips = useMemo(() => previewChips(model.frontmatter, keys), [model.frontmatter, keys]);

  return (
    <div
      className="mx-auto mb-3 overflow-hidden rounded-lg border border-[#cdd5df] bg-white shadow-[0_1px_2px_rgb(16_24_40_/_6%)]"
      style={width ? { width } : undefined}
      data-testid="frontmatter-inline"
    >
      <button
        type="button"
        data-testid="frontmatter-toggle"
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#f8fafc]"
        onClick={toggle}
      >
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-[#667085] transition-transform ${open ? "rotate-180" : ""}`}
        />
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[#667085]">Properties</span>
        <span className="text-[12px] text-[#98a2b3]">
          {keys.length} {keys.length === 1 ? "field" : "fields"}
        </span>
        {!open && chips.length ? (
          <span className="min-w-0 flex-1 truncate text-[12px] text-[#344054]">{chips.join(" · ")}</span>
        ) : (
          <span className="flex-1" />
        )}
      </button>
      {open ? (
        <div className="border-t border-[#e4e7ec] px-3 py-3">
          <DocumentProperties variant="inline" />
        </div>
      ) : null}
    </div>
  );
}
