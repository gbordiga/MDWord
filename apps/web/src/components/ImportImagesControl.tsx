"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { ImageDown } from "lucide-react";
import { Dialog, DialogButton } from "./Dialog";
import { Spinner } from "./Spinner";
import {
  deleteImportedImageFiles,
  importDocumentImages,
  type ImportImagesResult
} from "@/lib/importDocumentImages";

function summary(result: ImportImagesResult): string {
  if (!result.imported.length && !result.skipped.length) {
    return "No file-backed images were found in this document. Embedded images are already inlined.";
  }
  const parts: string[] = [];
  if (result.imported.length) {
    parts.push(
      result.imported.length === 1
        ? "Imported 1 image into the Markdown file."
        : `Imported ${result.imported.length} images into the Markdown file.`
    );
  }
  if (result.skipped.length) {
    parts.push(
      `Skipped ${result.skipped.length}: ${result.skipped.map((item) => item.src).join(", ")}.`
    );
  }
  return parts.join(" ");
}

export function ImportImagesControl({
  editor,
  variant = "ribbon",
  onStart
}: {
  editor: Editor | null;
  variant?: "ribbon" | "menu";
  onStart?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportImagesResult | null>(null);
  const [deleting, setDeleting] = useState(false);

  const run = async () => {
    onStart?.();
    setBusy(true);
    try {
      setResult(await importDocumentImages(editor));
    } finally {
      setBusy(false);
    }
  };

  const close = () => setResult(null);

  const deleteFiles = async () => {
    if (!result?.imported.length) return;
    setDeleting(true);
    try {
      await deleteImportedImageFiles(result.imported.map((item) => item.path));
      close();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {variant === "menu" ? (
        <button
          type="button"
          data-testid="import-images"
          className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-[#1c1f24] hover:bg-[#f2f4f7]"
          onClick={() => void run()}
          disabled={busy}
        >
          {busy ? <Spinner size={18} /> : <ImageDown size={18} />}
          Import images
        </button>
      ) : (
        <button
          type="button"
          title="Embed linked image files in the Markdown document"
          aria-label="Import images"
          data-testid="import-images"
          disabled={busy}
          onClick={() => void run()}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-[#1c1f24] hover:bg-[#eef2f6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Spinner size={14} /> : <ImageDown size={16} />}
          Import images
        </button>
      )}
      {result ? (
        <Dialog
          open
          title="Import images"
          onClose={deleting ? () => undefined : close}
          testId="import-images-dialog"
          footer={
            result.imported.length ? (
              <>
                <DialogButton onClick={close} disabled={deleting} testId="import-images-keep">
                  Keep files
                </DialogButton>
                <DialogButton
                  variant="danger"
                  onClick={() => void deleteFiles()}
                  disabled={deleting}
                  testId="import-images-delete"
                >
                  {deleting ? "Deleting…" : "Delete files"}
                </DialogButton>
              </>
            ) : (
              <DialogButton variant="primary" onClick={close} testId="import-images-ok">
                OK
              </DialogButton>
            )
          }
        >
          <p className="text-[14px] leading-6 text-[#344054]">{summary(result)}</p>
          {result.imported.length ? (
            <p className="mt-3 text-[14px] leading-6 text-[#344054]">
              Delete the original image files from the workspace now that they are embedded?
            </p>
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}
