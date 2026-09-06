"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Dialog, DialogButton, DialogField, dialogInputClass } from "./Dialog";
import { applyLink, removeLink, selectionText } from "@/lib/editorCommands";

export function LinkDialog({
  open,
  editor,
  onClose
}: {
  open: boolean;
  editor: Editor | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [inLink, setInLink] = useState(false);
  const [needsText, setNeedsText] = useState(false);

  useEffect(() => {
    if (!open || !editor) return;
    const selected = selectionText(editor);
    const existing = String(editor.getAttributes("link").href ?? "");
    const empty = editor.state.selection.empty;
    const active = editor.isActive("link");
    setUrl(existing);
    setText(selected);
    setInLink(active);
    setNeedsText(empty && !active);
  }, [open, editor]);

  const canApply = Boolean(url.trim()) && (!needsText || Boolean(text.trim()));

  const apply = () => {
    if (!editor || !canApply) return;
    if (applyLink(editor, url, text)) onClose();
  };

  return (
    <Dialog
      open={open}
      title={inLink ? "Edit link" : "Insert link"}
      onClose={onClose}
      testId="link-dialog"
      footer={
        <>
          {inLink ? (
            <DialogButton
              variant="danger"
              testId="link-remove"
              onClick={() => {
                if (!editor) return;
                removeLink(editor);
                onClose();
              }}
            >
              Remove
            </DialogButton>
          ) : null}
          <DialogButton onClick={onClose}>Cancel</DialogButton>
          <DialogButton variant="primary" testId="link-apply" disabled={!canApply} onClick={apply}>
            {inLink ? "Update" : "Apply"}
          </DialogButton>
        </>
      }
    >
      {needsText ? (
        <DialogField label="Text">
          <input
            data-testid="link-text"
            className={dialogInputClass}
            placeholder="Visible text"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </DialogField>
      ) : null}
      <DialogField label="URL">
        <input
          data-testid="link-url"
          className={dialogInputClass}
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
        />
      </DialogField>
      {needsText ? (
        <p className="text-[12px] text-[#667085]">
          Select text in the document, or type the label here. A link cannot be applied to an empty selection.
        </p>
      ) : (
        <p className="text-[12px] text-[#667085]">The selected text will keep its wording and become a link.</p>
      )}
    </Dialog>
  );
}
