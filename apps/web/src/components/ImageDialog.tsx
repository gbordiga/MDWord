"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Dialog, DialogButton, DialogField, dialogInputClass } from "./Dialog";
import { insertImage } from "@/lib/editorCommands";

export function ImageDialog({
  open,
  editor,
  onClose
}: {
  open: boolean;
  editor: Editor | null;
  onClose: () => void;
}) {
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");

  useEffect(() => {
    if (!open) return;
    setSrc("");
    setAlt("");
  }, [open]);

  const canInsert = Boolean(src.trim());

  const insert = () => {
    if (!editor || !canInsert) return;
    if (insertImage(editor, src, alt)) onClose();
  };

  return (
    <Dialog
      open={open}
      title="Insert image"
      onClose={onClose}
      testId="image-dialog"
      footer={
        <>
          <DialogButton onClick={onClose}>Cancel</DialogButton>
          <DialogButton variant="primary" testId="image-insert" disabled={!canInsert} onClick={insert}>
            Insert
          </DialogButton>
        </>
      }
    >
      <DialogField label="Image path or URL">
        <input
          data-testid="image-src"
          className={dialogInputClass}
          placeholder="https:// or ./images/photo.png"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              insert();
            }
          }}
        />
      </DialogField>
      <DialogField label="Alternative text">
        <input
          data-testid="image-alt"
          className={dialogInputClass}
          placeholder="Describe the image"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
        />
      </DialogField>
    </Dialog>
  );
}
