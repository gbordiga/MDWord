"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { embedImageFile, isAllowedImageFile } from "@mdword/editor";
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewFile = useRef<File | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const clearPreview = () => {
    previewFile.current = null;
    setShowPreview(false);
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    if (!open) return;
    setSrc("");
    setAlt("");
    setError("");
    setBusy(false);
    clearPreview();
    if (fileRef.current) fileRef.current.value = "";
  }, [open]);

  useEffect(() => {
    const file = previewFile.current;
    const canvas = canvasRef.current;
    if (!showPreview || !file || !canvas) return;
    let cancelled = false;
    void createImageBitmap(file)
      .then((bitmap) => {
        if (cancelled) {
          bitmap.close();
          return;
        }
        const maxH = 128;
        const scale = bitmap.height > maxH ? maxH / bitmap.height : 1;
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
      })
      .catch(() => {
        /* invalid or unsupported image — keep the empty canvas */
      });
    return () => {
      cancelled = true;
    };
  }, [showPreview, previewEpoch]);

  const canInsert = Boolean(src.trim()) && !busy;

  const insert = async () => {
    if (!editor || !canInsert) return;
    setBusy(true);
    try {
      if (await insertImage(editor, src, alt)) onClose();
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    if (!isAllowedImageFile(file)) {
      setError("Choose an image file (PNG, JPEG, GIF, or WebP) smaller than 24 MB.");
      return;
    }
    setError("");
    setBusy(true);
    previewFile.current = file;
    setShowPreview(true);
    setPreviewEpoch((n) => n + 1);
    void embedImageFile(file)
      .then((embedded) => {
        setSrc(embedded);
      })
      .catch(() => {
        setError("Could not read that image.");
        clearPreview();
      })
      .finally(() => setBusy(false));
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
          <DialogButton variant="primary" testId="image-insert" disabled={!canInsert} onClick={() => void insert()}>
            {busy ? "Preparing…" : "Insert"}
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
      {showPreview ? (
        <canvas
          ref={canvasRef}
          className="mb-3 max-h-32 rounded-md border border-[#e4e7ec]"
          aria-hidden
        />
      ) : null}
      <DialogField label="Image path or URL">
        <input
          data-testid="image-src"
          className={dialogInputClass}
          placeholder="https://, ./images/photo.png, or choose a file above"
          value={src.startsWith("data:") ? "" : src}
          onChange={(e) => {
            setSrc(e.target.value);
            clearPreview();
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void insert();
            }
          }}
        />
      </DialogField>
      <DialogField label="Caption">
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
        <p className="text-[12px] text-[#667085]">
          Local files are embedded in the document. Large photos are resized so the file stays light.
        </p>
      )}
    </Dialog>
  );
}
