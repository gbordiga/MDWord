import type { Editor } from "@tiptap/react";
import {
  applyFigureSources,
  collectEditorExternalFigures,
  embedImageSrc
} from "@mdword/editor";
import { serializeDocument } from "@mdword/document-model";
import { collectExternalImageUrls, rewriteExternalImageUrls } from "@mdword/shared";
import { getHost } from "./host";
import { getSourceView } from "./sourceView";
import { setSource } from "@mdword/source-editor";
import { useApp } from "./store";
import { resolveAndEmbedImages, type ImportImagesResult } from "./importImagePlan";

export type { ImportImagesResult } from "./importImagePlan";
export { resolveAndEmbedImages } from "./importImagePlan";

async function readEmbedded(path: string): Promise<string> {
  const host = getHost();
  const raw = host.files.readDataUrl ? await host.files.readDataUrl(path) : await host.files.read(path);
  if (!raw.startsWith("data:image/")) throw new Error("not-image");
  return embedImageSrc(raw);
}

export async function importDocumentImages(editor: Editor | null): Promise<ImportImagesResult> {
  const state = useApp.getState();
  const fromEditor = editor ? collectEditorExternalFigures(editor) : [];
  const fromAst = collectExternalImageUrls(state.model.ast);
  const sources = [...new Set([...fromEditor.map((item) => item.src), ...fromAst])];
  const { imported, skipped, replacements } = await resolveAndEmbedImages(sources, {
    documentPath: state.path,
    workspaceRoot: state.workspace?.root ?? null,
    readEmbedded
  });

  if (!replacements.size) return { imported, skipped };

  if (editor && fromEditor.length) {
    applyFigureSources(
      editor,
      fromEditor
        .map((item) => {
          const next = replacements.get(item.src);
          return next ? { pos: item.pos, src: next } : null;
        })
        .filter((item): item is { pos: number; src: string } => item != null)
    );
    state.flushPendingEdits();
    return { imported, skipped };
  }

  const nextAst = rewriteExternalImageUrls(state.model.ast, replacements);
  const source = serializeDocument({ ...state.model, ast: nextAst });
  const view = getSourceView();
  if (view) setSource(view, source, { undoable: true });
  else state.applySource(source);
  state.flushPendingEdits();
  return { imported, skipped };
}

export async function deleteImportedImageFiles(paths: string[]): Promise<void> {
  const host = getHost();
  const unique = [...new Set(paths)];
  for (const filePath of unique) {
    try {
      if (typeof host.files.prepareWrite === "function") await host.files.prepareWrite(filePath);
      await host.files.remove(filePath);
    } catch {
      /* a missing file is already gone */
    }
  }
  await useApp.getState().refreshWorkspace();
}
