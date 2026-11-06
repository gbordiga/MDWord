"use client";

import { X } from "lucide-react";
import { useApp } from "@/lib/store";

/** Non-blocking notices: failures (alert) and confirmations (status). */
export function ErrorBanner() {
  const message = useApp((s) => s.errorMessage);
  const setErrorMessage = useApp((s) => s.setErrorMessage);
  const notice = useApp((s) => s.noticeMessage);
  const showNotice = useApp((s) => s.showNotice);
  if (!message && !notice) return null;

  return (
    <>
      {message ? (
        <Banner
          tone="error"
          testId="app-error"
          role="alert"
          text={message}
          onDismiss={() => setErrorMessage(null)}
        />
      ) : null}
      {notice ? (
        <Banner
          tone="notice"
          testId="app-notice"
          role="status"
          text={notice}
          onDismiss={() => showNotice(null)}
        />
      ) : null}
    </>
  );
}

function Banner({
  tone,
  testId,
  role,
  text,
  onDismiss
}: {
  tone: "error" | "notice";
  testId: string;
  role: "alert" | "status";
  text: string;
  onDismiss: () => void;
}) {
  const isError = tone === "error";
  return (
    <div
      role={role}
      data-testid={testId}
      className={`flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-[13px] leading-5 ${
        isError
          ? "border-[#fecaca] bg-[#fef3f2] text-[#b42318]"
          : "border-[#e4e7ec] bg-[#f8fafc] text-[#344054]"
      }`}
    >
      <span className="min-w-0 flex-1">{text}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Dismiss"
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isError ? "hover:bg-[#fee4e2]" : "hover:bg-[#eef2f6]"
        }`}
      >
        <X size={16} />
      </button>
    </div>
  );
}
