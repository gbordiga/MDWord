"use client";

import { useState } from "react";
import { Dialog, DialogButton } from "./Dialog";
import { Spinner } from "./Spinner";
import { useApp } from "@/lib/store";

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/**
 * Shown when the file on disk changed since it was opened or last saved.
 * Saving anyway keeps the local text; reloading drops it for the disk version.
 */
export function ExternalChangeDialog() {
  const prompt = useApp((s) => s.externalDialog);
  const resolve = useApp((s) => s.resolveExternalConflict);
  const [busy, setBusy] = useState(false);
  if (!prompt) return null;

  const choose = async (choice: "overwrite" | "reload") => {
    setBusy(true);
    try {
      await resolve(choice);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      title="File changed on disk"
      onClose={busy ? () => undefined : () => void resolve("cancel")}
      testId="external-change-dialog"
      footer={
        <>
          <DialogButton onClick={() => void resolve("cancel")} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton onClick={() => void choose("reload")} disabled={busy} testId="external-reload">
            {busy ? <Spinner size={14} /> : "Reload from disk"}
          </DialogButton>
          <DialogButton
            variant="danger"
            onClick={() => void choose("overwrite")}
            disabled={busy}
            testId="external-overwrite"
          >
            Overwrite
          </DialogButton>
        </>
      }
    >
      <p className="text-[14px] leading-6 text-[#344054]">
        “{fileName(prompt.path)}” changed on disk after you opened it. Overwriting replaces that
        version with the one in MDWord; reloading replaces your unsaved edits with the version on
        disk.
      </p>
    </Dialog>
  );
}
