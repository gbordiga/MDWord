"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@mdword/ui";

export function Sheet({
  open,
  onClose,
  side = "bottom",
  title,
  testId,
  children
}: {
  open: boolean;
  onClose: () => void;
  side?: "bottom" | "left";
  title: string;
  testId?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        data-testid={testId}
        className={cn(
          "absolute flex flex-col bg-white shadow-[0_-8px_40px_rgb(16_24_40_/_18%)]",
          side === "left"
            ? "inset-y-0 left-0 w-[min(100%,22rem)] pt-[env(safe-area-inset-top)]"
            : "inset-x-0 bottom-0 max-h-[min(85dvh,var(--app-height))] rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        )}
      >
        {side === "bottom" && (
          <div className="flex justify-center pt-2" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-[#d0d5dd]" />
          </div>
        )}
        <header className="flex items-center justify-between gap-2 border-b border-[#e4e7ec] px-3 py-1">
          <h2 className="px-1 text-[15px] font-semibold text-[#1c1f24]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#344054] hover:bg-[#f2f4f7]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
