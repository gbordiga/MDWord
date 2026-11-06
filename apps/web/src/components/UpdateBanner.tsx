"use client";

import { useEffect, useState } from "react";
import { Download, RotateCcw, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { updateNotice } from "@/lib/updateNotice";
import { Spinner } from "./Spinner";

const TONE_CLASS: Record<string, string> = {
  progress: "border-[#e4e7ec] bg-[#f8fafc] text-[#344054]",
  ready: "border-[#bfd3fe] bg-[#eef4ff] text-[#1c1f24]",
  error: "border-[#fecaca] bg-[#fef3f2] text-[#b42318]"
};

/**
 * Desktop update banner: download progress, then a restart action. Dismissing it
 * is safe — `autoInstallOnAppQuit` installs the update on the next quit anyway.
 */
export function UpdateBanner() {
  const status = useApp((s) => s.updateStatus);
  const installUpdate = useApp((s) => s.installUpdate);
  const checkForUpdates = useApp((s) => s.checkForUpdates);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const notice = updateNotice(status);

  // A new version brings the banner back.
  useEffect(() => {
    if (status?.state === "downloaded") setDismissed(null);
  }, [status]);

  if (!notice) return null;
  const key = status?.state === "error" ? "error" : status?.state ?? "";
  if (dismissed === key) return null;

  const action = notice.action;
  return (
    <div
      role="status"
      data-testid="update-banner"
      data-update-state={status?.state}
      className={`flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-[13px] leading-5 ${TONE_CLASS[notice.tone]}`}
    >
      {notice.tone === "progress" && status?.state !== "none" ? (
        <Spinner size={14} />
      ) : (
        <Download size={14} />
      )}
      <span className="min-w-0 flex-1">{notice.text}</span>
      {action === "restart" ? (
        <button
          type="button"
          data-testid="update-restart"
          disabled={installing}
          onClick={() => {
            setInstalling(true);
            void installUpdate().finally(() => setInstalling(false));
          }}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {installing ? <Spinner size={12} /> : <RotateCcw size={12} />}
          Restart to update
        </button>
      ) : null}
      {action === "retry" ? (
        <button
          type="button"
          data-testid="update-retry"
          onClick={() => void checkForUpdates()}
          className="inline-flex h-7 items-center rounded-md border border-[#fecaca] px-2 text-[12px] font-medium hover:bg-[#fee4e2]"
        >
          Try again
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setDismissed(key)}
        aria-label="Dismiss update notice"
        title="Dismiss"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
      >
        <X size={14} />
      </button>
    </div>
  );
}
