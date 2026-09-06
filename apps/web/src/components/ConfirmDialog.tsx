"use client";

import { Dialog, DialogButton } from "./Dialog";
import { useApp } from "@/lib/store";
import type { ConfirmState } from "@/lib/editorUi";

export function ConfirmDialog({
  confirm,
  onClose
}: {
  confirm: ConfirmState;
  onClose: () => void;
}) {
  if (!confirm) return null;

  const discard = () => {
    const action = confirm.action;
    onClose();
    action();
  };

  const saveThen = async () => {
    await useApp.getState().saveFile();
    if (useApp.getState().dirty) return;
    onClose();
    confirm.action();
  };

  return (
    <Dialog
      open
      title={confirm.title}
      onClose={onClose}
      testId="confirm-dialog"
      footer={
        <>
          <DialogButton onClick={onClose}>Cancel</DialogButton>
          <DialogButton variant="danger" testId="confirm-discard" onClick={discard}>
            Discard
          </DialogButton>
          <DialogButton variant="primary" testId="confirm-save" onClick={() => void saveThen()}>
            Save
          </DialogButton>
        </>
      }
    >
      <p className="text-[14px] leading-6 text-[#344054]">{confirm.message}</p>
    </Dialog>
  );
}
