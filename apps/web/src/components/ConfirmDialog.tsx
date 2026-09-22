"use client";

import { useState } from "react";
import { Dialog, DialogButton } from "./Dialog";
import { Spinner } from "./Spinner";
import { useApp } from "@/lib/store";
import type { ConfirmState } from "@/lib/editorUi";

export function ConfirmDialog({
  confirm,
  onClose,
  onDismiss
}: {
  confirm: ConfirmState;
  onClose: () => void;
  /** Clears the dialog without running the cancel callback. Used by Save and Discard. */
  onDismiss?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  if (!confirm) return null;

  const dismiss = onDismiss ?? onClose;

  const discard = () => {
    const action = confirm.action;
    dismiss();
    action();
  };

  const saveThen = async () => {
    setSaving(true);
    try {
      const saved = confirm.save
        ? await confirm.save()
        : await (async () => {
            await useApp.getState().saveFile();
            return !useApp.getState().dirty;
          })();
      if (!saved) return;
      dismiss();
      confirm.action();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      title={confirm.title}
      onClose={saving ? () => undefined : onClose}
      testId="confirm-dialog"
      footer={
        <>
          <DialogButton onClick={onClose} disabled={saving}>
            Cancel
          </DialogButton>
          <DialogButton variant="danger" testId="confirm-discard" onClick={discard} disabled={saving}>
            Discard
          </DialogButton>
          <DialogButton variant="primary" testId="confirm-save" onClick={() => void saveThen()} disabled={saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={14} />
                Saving…
              </span>
            ) : (
              "Save"
            )}
          </DialogButton>
        </>
      }
    >
      <p className="text-[14px] leading-6 text-[#344054]">{confirm.message}</p>
    </Dialog>
  );
}
