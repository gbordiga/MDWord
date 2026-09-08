"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Dialog, DialogButton, DialogField, dialogInputClass } from "./Dialog";
import { insertImage } from "@/lib/editorCommands";
import { isAllowedImageFile } from "@mdword/editor";

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
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSrc("");
    setAlt("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }, [open]);

  const canInsert = Boolean(src.trim());

  const insert = () => {
    if (!editor || !canInsert) return;
    if (insertImage(editor, src, alt)) onClose();
  };

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    if (!isAllowedImageFile(file)) {
      setError("Choose an image file (PNG, JPEG, GIF, or WebP) smaller than 8 MB.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result.startsWith("data:image/")) {
        setError("Could not read that image.");
        return;
      }
      setSrc(result);
      if (!alt.trim()) setAlt(file.name.replace(/\.[^.]+$/, ""));
    };
    reader.onerror = () => setError("Could not read that image.");
    reader.readAsDataURL(file);
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
      <DialogField label="Choose a local image">
        <input
          ref={fileRef}
          data-testid="image-file"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/*"
          className="w-full text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-[#eef2f6] file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-[#1c1f24]"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />
      </DialogField>
      {src.startsWith("data:image/") ? (
        <img src={src} alt="" className="mb-3 max-h-32 rounded-md border border-[#e4e7ec]" />
      ) : null}
      <DialogField label="Image path or URL">
        <input
          data-testid="image-src"
          className={dialogInputClass}
          placeholder="https://, ./images/photo.png, or choose a file above"
          value={src.startsWith("data:") ? "" : src}
          onChange={(e) => {
            setSrc(e.target.value);
            setError("");
          }}
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
      {error ? (
        <p className="mb-2 text-[12px] text-[#b42318]" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-[12px] text-[#667085]">Local files are embedded in the document so they travel with the Markdown.</p>
      )}
    </Dialog>
  );
}
