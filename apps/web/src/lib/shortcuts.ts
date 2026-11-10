/** Keyboard shortcuts of the app. One table drives the key handler and the toolbar tooltips. */
export type ShortcutId =
  | "bold" | "italic" | "underline" | "strike" | "code" | "subscript" | "superscript"
  | "bulletList" | "orderedList" | "quote" | "codeBlock" | "link"
  | "heading1" | "heading2" | "heading3"
  | "undo" | "redo" | "save" | "saveAs" | "new" | "open" | "print" | "find" | "palette" | "assistant";

interface Shortcut {
  /** KeyboardEvent.code, so Alt and non-US layouts do not change the match. */
  code: string;
  shift?: boolean;
  alt?: boolean;
  /** Text shown in the tooltip for the key. */
  key: string;
}

export const SHORTCUTS: Record<ShortcutId, Shortcut> = {
  bold: { code: "KeyB", key: "B" },
  italic: { code: "KeyI", key: "I" },
  underline: { code: "KeyU", key: "U" },
  strike: { code: "KeyX", shift: true, key: "X" },
  code: { code: "KeyE", key: "E" },
  subscript: { code: "Comma", key: "," },
  superscript: { code: "Period", key: "." },
  bulletList: { code: "Digit8", shift: true, key: "8" },
  orderedList: { code: "Digit7", shift: true, key: "7" },
  quote: { code: "KeyB", shift: true, key: "B" },
  codeBlock: { code: "KeyC", alt: true, key: "C" },
  link: { code: "KeyK", key: "K" },
  heading1: { code: "Digit1", alt: true, key: "1" },
  heading2: { code: "Digit2", alt: true, key: "2" },
  heading3: { code: "Digit3", alt: true, key: "3" },
  undo: { code: "KeyZ", key: "Z" },
  redo: { code: "KeyZ", shift: true, key: "Z" },
  save: { code: "KeyS", key: "S" },
  saveAs: { code: "KeyS", shift: true, key: "S" },
  new: { code: "KeyN", key: "N" },
  open: { code: "KeyO", key: "O" },
  print: { code: "KeyP", key: "P" },
  find: { code: "KeyF", key: "F" },
  palette: { code: "KeyP", shift: true, key: "P" },
  assistant: { code: "KeyJ", key: "J" }
};

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Key chips for a tooltip, for example ["Ctrl", "Shift", "X"] or ["⌘", "⇧", "X"]. */
export function shortcutKeys(id: ShortcutId): string[] {
  const s = SHORTCUTS[id];
  if (isMac()) return [...(s.alt ? ["⌥"] : []), ...(s.shift ? ["⇧"] : []), "⌘", s.key];
  return ["Ctrl", ...(s.alt ? ["Alt"] : []), ...(s.shift ? ["Shift"] : []), s.key];
}

export function matchShortcut(e: KeyboardEvent): ShortcutId | null {
  if (!(e.metaKey || e.ctrlKey)) return null;
  for (const id of Object.keys(SHORTCUTS) as ShortcutId[]) {
    const s = SHORTCUTS[id];
    if (e.code === s.code && e.shiftKey === Boolean(s.shift) && e.altKey === Boolean(s.alt)) return id;
  }
  return null;
}
