import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_IMAGE_WIDTH,
  isAllowedImageFile,
  type FigureAttrs
} from "./imageModel";

const key = new PluginKey("mdword-media");

function collectImageFiles(list: FileList | DataTransferItemList | undefined | null): File[] {
  if (!list) return [];
  const files: File[] = [];
  if (list instanceof FileList) {
    for (const file of Array.from(list)) files.push(file);
  } else {
    for (const item of Array.from(list)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }
  return files.filter((file) => isAllowedImageFile(file));
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result.startsWith("data:image/")) reject(new Error("not-image"));
      else resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

function insertFigure(view: EditorView, pos: number, attrs: FigureAttrs): void {
  const type = view.state.schema.nodes.figure;
  if (!type) return;
  const node = type.createAndFill({
    src: attrs.src,
    alt: attrs.alt,
    width: attrs.width,
    layout: attrs.layout,
    label: attrs.label
  });
  if (!node) return;
  const $pos = view.state.doc.resolve(Math.min(Math.max(1, pos), view.state.doc.content.size));
  let from = $pos.pos;
  let to = $pos.pos;
  if ($pos.parent.inlineContent) {
    const start = $pos.before($pos.depth);
    const end = $pos.after($pos.depth);
    if ($pos.parent.content.size === 0) {
      from = start;
      to = end;
    } else {
      from = end;
      to = end;
    }
  }
  const tr = view.state.tr.replaceWith(from, to, node);
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

async function insertFiles(view: EditorView, event: DragEvent | ClipboardEvent, pos: number): Promise<boolean> {
  const dt =
    "dataTransfer" in event && event.dataTransfer
      ? event.dataTransfer
      : "clipboardData" in event
        ? event.clipboardData
        : null;
  const unique = collectImageFiles(dt?.files).length
    ? collectImageFiles(dt?.files)
    : collectImageFiles(dt?.items);
  if (!unique.length) return false;
  event.preventDefault();
  for (const file of unique) {
    try {
      const src = await readDataUrl(file);
      const alt = file.name.replace(/\.[^.]+$/, "");
      insertFigure(view, pos, {
        src,
        alt,
        width: DEFAULT_IMAGE_WIDTH,
        layout: DEFAULT_IMAGE_LAYOUT,
        label: null
      });
    } catch {
      /* skip unreadable files */
    }
  }
  return true;
}

export function mediaDropPlugin(): Plugin {
  return new Plugin({
    key,
    props: {
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const files = collectImageFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void insertFiles(view, event, coords?.pos ?? view.state.selection.from);
        return true;
      },
      handlePaste(view, event) {
        const files = collectImageFiles(event.clipboardData?.files).length
          ? collectImageFiles(event.clipboardData?.files)
          : collectImageFiles(event.clipboardData?.items);
        if (!files.length) return false;
        void insertFiles(view, event, view.state.selection.from);
        return true;
      }
    }
  });
}
