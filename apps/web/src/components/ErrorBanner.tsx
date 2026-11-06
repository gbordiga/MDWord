"use client";

import { X } from "lucide-react";
import { useApp } from "@/lib/store";

/** Non-blocking notice for failed file and export operations. */
export function ErrorBanner() {
  const message = useApp((s) => s.errorMessage);
  const setErrorMessage = useApp((s) => s.setErrorMessage);
  if (!message) return null;

  return (
    <div
      role="alert"
      data-testid="app-error"
      className="flex shrink-0 items-center gap-2 border-b border-[#fecaca] bg-[#fef3f2] px-3 py-1.5 text-[13px] leading-5 text-[#b42318]"
    >
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        onClick={() => setErrorMessage(null)}
        aria-label="Dismiss"
        title="Dismiss"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-[#fee4e2]"
      >
        <X size={16} />
      </button>
    </div>
  );
}
