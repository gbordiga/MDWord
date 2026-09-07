"use client";

import { Dialog, DialogButton } from "./Dialog";

export function RecoveryDialog({
  title,
  onRestore,
  onDiscard
}: {
  title?: string;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog
      open
      title="Unsaved draft found"
      onClose={onDiscard}
      testId="recovery-dialog"
      footer={
        <>
          <DialogButton testId="recovery-discard" onClick={onDiscard}>
            Discard
          </DialogButton>
          <DialogButton variant="primary" testId="recovery-restore" onClick={onRestore}>
            Restore
          </DialogButton>
        </>
      }
    >
      <p className="text-[14px] leading-6 text-[#344054]">
        MDWord found unsaved work from a previous session
        {title ? ` (“${title}”)` : ""}. Restore it into the editor, or discard it. The file on disk was
        not changed.
      </p>
    </Dialog>
  );
}
