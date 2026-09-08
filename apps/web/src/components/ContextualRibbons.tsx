"use client";

import type { Editor } from "@tiptap/react";
import type { ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns3,
  Image as ImageIcon,
  PanelLeft,
  PanelRight,
  Rows3,
  Trash2
} from "lucide-react";
import {
  IMAGE_LAYOUTS,
  widthForLayoutChange,
  type ImageLayout
} from "@mdword/editor";
import { useEditorUi } from "@/lib/editorUi";

function Tool({
  title,
  onClick,
  testId,
  pressed,
  disabled,
  children
}: {
  title: string;
  onClick: () => void;
  testId?: string;
  pressed?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      data-testid={testId}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-[#1c1f24] hover:bg-[#eef2f6] disabled:cursor-not-allowed disabled:opacity-40 ${
        pressed ? "bg-[#e8eefc] text-accent" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1.5 h-5 w-px shrink-0 self-center bg-[#98a2b3]" aria-hidden />;
}

const LAYOUT_BUTTONS: { id: ImageLayout; title: string; testId: string; icon: ReactNode }[] = [
  { id: "block-left", title: "Align left", testId: "image-align-left", icon: <AlignLeft size={16} /> },
  { id: "block-center", title: "Align center", testId: "image-align-center", icon: <AlignCenter size={16} /> },
  { id: "block-right", title: "Align right", testId: "image-align-right", icon: <AlignRight size={16} /> },
  { id: "float-left", title: "Float left, wrap text", testId: "image-float-left", icon: <PanelLeft size={16} /> },
  { id: "float-right", title: "Float right, wrap text", testId: "image-float-right", icon: <PanelRight size={16} /> }
];

function captionText(editor: Editor): string {
  const { $from, from } = editor.state.selection;
  let current = editor.state.doc.nodeAt(from);
  if (current?.type.name !== "figure") {
    current = null;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === "figure") {
        current = $from.node(depth);
        break;
      }
    }
  }
  if (!current) return "";
  const caption = current.firstChild?.type.name === "caption" ? current.firstChild : null;
  return caption?.textContent ?? "";
}

export function ImageRibbonTools({ editor, enabled }: { editor: Editor | null; enabled: boolean }) {
  const { openImage } = useEditorUi();
  const attrs = editor?.getAttributes("figure") ?? {};
  const layout = IMAGE_LAYOUTS.includes(attrs.layout as ImageLayout)
    ? (attrs.layout as ImageLayout)
    : "block-center";
  const width = Number(attrs.width ?? 100);
  const alt = String(attrs.alt ?? "");
  const inTable = Boolean(editor?.isActive("table"));
  const caption = editor && enabled ? captionText(editor) : "";

  return (
    <>
      <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Image</span>
      {LAYOUT_BUTTONS.map((item) => (
        <Tool
          key={item.id}
          title={item.title}
          testId={item.testId}
          pressed={layout === item.id}
          disabled={!enabled || (inTable && item.id.startsWith("float"))}
          onClick={() => {
            if (!editor) return;
            editor.commands.updateFigure({
              layout: item.id,
              width: widthForLayoutChange(width, item.id)
            });
          }}
        >
          {item.icon}
        </Tool>
      ))}
      <Divider />
      <label className="inline-flex items-center gap-1 text-[12px] text-[#667085]">
        Width
        <input
          data-testid="image-width"
          type="number"
          min={10}
          max={100}
          disabled={!enabled}
          className="h-8 w-16 rounded-md border border-[#e4e7ec] bg-white px-1 text-[13px] text-[#1c1f24] disabled:opacity-40"
          value={enabled ? width : ""}
          onChange={(e) => editor?.commands.updateFigure({ width: Number(e.target.value) })}
        />
        %
      </label>
      <input
        data-testid="image-alt"
        disabled={!enabled}
        className="h-8 w-40 rounded-md border border-[#e4e7ec] bg-white px-2 text-[13px] disabled:opacity-40"
        placeholder="Alternative text"
        value={enabled ? alt : ""}
        onChange={(e) => editor?.commands.updateFigure({ alt: e.target.value })}
      />
      <input
        data-testid="image-caption"
        disabled={!enabled}
        className="h-8 w-44 rounded-md border border-[#e4e7ec] bg-white px-2 text-[13px] disabled:opacity-40"
        placeholder="Caption"
        value={enabled ? caption : ""}
        onChange={(e) => editor?.commands.setFigureCaption(e.target.value)}
      />
      <Divider />
      <Tool title="Replace image" testId="image-replace" disabled={!enabled} onClick={openImage}>
        <ImageIcon size={16} /> Replace
      </Tool>
      <Tool
        title="Delete image"
        testId="image-delete"
        disabled={!enabled}
        onClick={() => editor?.chain().focus().deleteSelection().run()}
      >
        <Trash2 size={16} /> Delete
      </Tool>
    </>
  );
}

export function TableRibbonTools({ editor, enabled }: { editor: Editor | null; enabled: boolean }) {
  const { openImage } = useEditorUi();
  return (
    <>
      <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Table</span>
      <Tool
        title="Add row"
        testId="table-add-row"
        disabled={!enabled}
        onClick={() => editor?.chain().focus().addRowAfter().run()}
      >
        <Rows3 size={16} /> Row
      </Tool>
      <Tool
        title="Add column"
        testId="table-add-col"
        disabled={!enabled}
        onClick={() => editor?.chain().focus().addColumnAfter().run()}
      >
        <Columns3 size={16} /> Column
      </Tool>
      <Tool
        title="Delete row"
        testId="table-del-row"
        disabled={!enabled}
        onClick={() => editor?.chain().focus().deleteRow().run()}
      >
        <Rows3 size={16} /> Delete row
      </Tool>
      <Tool
        title="Delete column"
        testId="table-del-col"
        disabled={!enabled}
        onClick={() => editor?.chain().focus().deleteColumn().run()}
      >
        <Columns3 size={16} /> Delete column
      </Tool>
      <Divider />
      <Tool title="Insert image in cell" testId="table-insert-image" disabled={!enabled} onClick={openImage}>
        <ImageIcon size={16} /> Image
      </Tool>
      <Tool
        title="Delete table"
        testId="table-delete"
        disabled={!enabled}
        onClick={() => editor?.chain().focus().deleteTable().run()}
      >
        <Trash2 size={16} /> Delete table
      </Tool>
    </>
  );
}
