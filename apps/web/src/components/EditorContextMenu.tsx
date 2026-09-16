"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  ClipboardPaste,
  Columns3,
  Copy,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  PanelLeft,
  PanelRight,
  Rows3,
  Scissors,
  Table as TableIcon,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  type LucideIcon
} from "lucide-react";
import {
  editorContextKind,
  figureNodeFromState,
  widthForLayoutChange,
  type ImageLayout
} from "@mdword/editor";
import { cn } from "@mdword/ui";
import { useEditorUi } from "@/lib/editorUi";
import {
  applyBlockStyle,
  copyEditorSelection,
  cutEditorSelection,
  insertTable,
  pasteIntoEditor
} from "@/lib/editorCommands";

const MOD =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl+";

function MenuItem({
  label,
  icon: Icon,
  shortcut,
  testId,
  danger,
  checked,
  disabled,
  onClick
}: {
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  testId: string;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      disabled={disabled}
      aria-checked={checked}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] disabled:cursor-not-allowed disabled:text-[#98a2b3] disabled:hover:bg-transparent",
        danger ? "text-[#b42318] hover:bg-[#fef3f2]" : "text-[#1c1f24] hover:bg-[#f2f4f7]"
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon
        size={15}
        aria-hidden
        className={cn(
          "shrink-0",
          disabled ? "text-[#98a2b3]" : danger ? "text-[#b42318]" : checked ? "text-accent" : "text-[#667085]"
        )}
      />
      <span className="min-w-0 flex-1">{label}</span>
      {checked ? (
        <span aria-hidden className="text-[11px] text-[#667085]">
          ✓
        </span>
      ) : null}
      {shortcut ? (
        <kbd className="shrink-0 text-[11px] font-normal text-[#667085]">{shortcut}</kbd>
      ) : null}
    </button>
  );
}

function Sep() {
  return <div className="my-1 border-t border-[#e4e7ec]" />;
}

export function EditorContextMenu() {
  const { editor, contextMenu, closeContextMenu, openLink, openImage } = useEditorUi();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !contextMenu) return;
    const box = el.getBoundingClientRect();
    let left = contextMenu.x;
    let top = contextMenu.y;
    if (left + box.width > window.innerWidth - 8) left = window.innerWidth - box.width - 8;
    if (top + box.height > window.innerHeight - 8) top = window.innerHeight - box.height - 8;
    el.style.left = `${Math.max(8, left)}px`;
    el.style.top = `${Math.max(8, top)}px`;
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeContextMenu();
      }
    };
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) closeContextMenu();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu || !editor) return null;

  const kind = editorContextKind(editor.state);
  const run = (action: () => void) => {
    action();
    closeContextMenu();
  };
  const inTable = editor.isActive("table");
  const layout = String(figureNodeFromState(editor.state)?.attrs?.layout ?? "block-center");
  const width = Number(figureNodeFromState(editor.state)?.attrs?.width ?? 100);

  const setLayout = (next: ImageLayout) => {
    editor.commands.updateFigure({ layout: next, width: widthForLayoutChange(width, next) });
  };

  const textItems = (
    <>
      <MenuItem icon={Scissors} label="Cut" shortcut={`${MOD}X`} testId="editor-menu-cut" onClick={() => void run(() => cutEditorSelection(editor))} />
      <MenuItem icon={Copy} label="Copy" shortcut={`${MOD}C`} testId="editor-menu-copy" onClick={() => void run(() => copyEditorSelection(editor))} />
      <MenuItem icon={ClipboardPaste} label="Paste" shortcut={`${MOD}V`} testId="editor-menu-paste" onClick={() => void run(() => pasteIntoEditor(editor))} />
      <Sep />
      <MenuItem
        icon={Bold}
        label="Bold"
        shortcut={`${MOD}B`}
        testId="editor-menu-bold"
        checked={editor.isActive("bold")}
        onClick={() => run(() => editor.chain().focus().toggleBold().run())}
      />
      <MenuItem
        icon={Italic}
        label="Italic"
        shortcut={`${MOD}I`}
        testId="editor-menu-italic"
        checked={editor.isActive("italic")}
        onClick={() => run(() => editor.chain().focus().toggleItalic().run())}
      />
      <MenuItem
        icon={UnderlineIcon}
        label="Underline"
        shortcut={`${MOD}U`}
        testId="editor-menu-underline"
        checked={editor.isActive("underline")}
        onClick={() => run(() => editor.chain().focus().toggleUnderline().run())}
      />
      <Sep />
      <MenuItem
        icon={Heading1}
        label="Heading 1"
        shortcut={`${MOD}1`}
        testId="editor-menu-h1"
        checked={editor.isActive("heading", { level: 1 })}
        onClick={() => run(() => applyBlockStyle(editor, "1"))}
      />
      <MenuItem
        icon={Heading2}
        label="Heading 2"
        shortcut={`${MOD}2`}
        testId="editor-menu-h2"
        checked={editor.isActive("heading", { level: 2 })}
        onClick={() => run(() => applyBlockStyle(editor, "2"))}
      />
      <MenuItem icon={Type} label="Body" testId="editor-menu-body" onClick={() => run(() => applyBlockStyle(editor, "p"))} />
      <Sep />
      <MenuItem icon={LinkIcon} label="Insert link" shortcut={`${MOD}K`} testId="editor-menu-link" onClick={openLink} />
      {kind === "table" ? (
        <MenuItem icon={ImageIcon} label="Insert image in cell" testId="editor-menu-cell-image" onClick={openImage} />
      ) : (
        <>
          <MenuItem icon={TableIcon} label="Insert table" testId="editor-menu-table" onClick={() => run(() => insertTable(editor))} />
          <MenuItem icon={ImageIcon} label="Insert image" testId="editor-menu-image" onClick={openImage} />
        </>
      )}
    </>
  );

  const tableItems = (
    <>
      <MenuItem icon={Rows3} label="Add row" testId="editor-menu-add-row" onClick={() => run(() => editor.chain().focus().addRowAfter().run())} />
      <MenuItem icon={Columns3} label="Add column" testId="editor-menu-add-col" onClick={() => run(() => editor.chain().focus().addColumnAfter().run())} />
      <MenuItem icon={Rows3} label="Delete row" testId="editor-menu-del-row" onClick={() => run(() => editor.chain().focus().deleteRow().run())} />
      <MenuItem icon={Columns3} label="Delete column" testId="editor-menu-del-col" onClick={() => run(() => editor.chain().focus().deleteColumn().run())} />
      <Sep />
      <MenuItem
        icon={Trash2}
        label="Delete table"
        testId="editor-menu-del-table"
        danger
        onClick={() => run(() => editor.chain().focus().deleteTable().run())}
      />
    </>
  );

  let items: ReactNode = null;
  if (kind === "text") {
    items = textItems;
  } else if (kind === "table") {
    items = (
      <>
        {textItems}
        <Sep />
        {tableItems}
      </>
    );
  } else {
    items = (
      <>
        <MenuItem
          icon={AlignLeft}
          label="Align left"
          testId="editor-menu-align-left"
          checked={layout === "block-left"}
          onClick={() => run(() => setLayout("block-left"))}
        />
        <MenuItem
          icon={AlignCenter}
          label="Align center"
          testId="editor-menu-align-center"
          checked={layout === "block-center"}
          onClick={() => run(() => setLayout("block-center"))}
        />
        <MenuItem
          icon={AlignRight}
          label="Align right"
          testId="editor-menu-align-right"
          checked={layout === "block-right"}
          onClick={() => run(() => setLayout("block-right"))}
        />
        <MenuItem
          icon={PanelLeft}
          label="Float left"
          testId="editor-menu-float-left"
          checked={layout === "float-left"}
          disabled={inTable}
          onClick={() => run(() => setLayout("float-left"))}
        />
        <MenuItem
          icon={PanelRight}
          label="Float right"
          testId="editor-menu-float-right"
          checked={layout === "float-right"}
          disabled={inTable}
          onClick={() => run(() => setLayout("float-right"))}
        />
        <Sep />
        <MenuItem
          icon={ArrowUp}
          label="Move up"
          shortcut="Alt+↑"
          testId="editor-menu-move-up"
          onClick={() => run(() => editor.commands.moveFigureUp())}
        />
        <MenuItem
          icon={ArrowDown}
          label="Move down"
          shortcut="Alt+↓"
          testId="editor-menu-move-down"
          onClick={() => run(() => editor.commands.moveFigureDown())}
        />
        <Sep />
        <MenuItem icon={ImageIcon} label="Replace image" testId="editor-menu-replace" onClick={openImage} />
        <MenuItem
          icon={Trash2}
          label="Delete image"
          shortcut="Del"
          testId="editor-menu-del-image"
          danger
          onClick={() => run(() => editor.chain().focus().deleteSelection().run())}
        />
      </>
    );
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      data-testid="editor-context-menu"
      data-kind={kind}
      className="fixed z-[70] min-w-56 rounded-lg border border-[#e4e7ec] bg-white py-1 shadow-[0_8px_24px_rgb(16_24_40_/_18%)]"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {items}
    </div>,
    document.body
  );
}
