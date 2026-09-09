import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { embedImageFile, embedImageSrc } from "./imageEmbed";
import {
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_IMAGE_WIDTH,
  isAllowedImageFile,
  parseHtmlImg,
  type FigureAttrs
} from "./imageModel";
import { insertFigureTransaction } from "./figureInsert";

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

function insertFigure(view: EditorView, pos: number, attrs: FigureAttrs): void {
  const tr = insertFigureTransaction(view.state, pos, attrs);
  if (!tr) return;
  view.dispatch(tr);
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
      const src = await embedImageFile(file);
      const alt = file.name.replace(/\.[^.]+$/, "");
      insertFigure(view, pos, {
        src,
        alt,
        caption: "",
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
        if (files.length) {
          void insertFiles(view, event, view.state.selection.from);
          return true;
        }
        const html = event.clipboardData?.getData("text/html") ?? "";
        const parsed = html ? parseHtmlImg(html) : null;
        if (!parsed?.src) return false;
        event.preventDefault();
        void embedImageSrc(parsed.src).then((src) => {
          insertFigure(view, view.state.selection.from, {
            src,
            alt: parsed.alt,
            caption: "",
            width: parsed.width,
            layout: parsed.layout,
            label: null
          });
        });
        return true;
      }
    }
  });
}
