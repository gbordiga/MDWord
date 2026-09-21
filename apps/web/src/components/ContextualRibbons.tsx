"use client";

import type { Editor } from "@tiptap/react";
import type { ReactNode } from "react";
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Columns2,
  Columns3,
  Image as ImageIcon,
  PanelLeft,
  PanelRight,
  Rows3,
  Sparkles,
  Subtitles,
  Trash2,
  type LucideIcon
} from "lucide-react";
import {
  IMAGE_LAYOUTS,
  figureCaptionText,
  figureNodeFromState,
  widthForLayoutChange,
  type ImageLayout
} from "@mdword/editor";
import { useEditorUi } from "@/lib/editorUi";
import {
  setCalloutKind,
  setTableAlign,
  setTableCaption,
  setTableCellAlign,
  setTableWidthsAuto,
  setTableWidthsEqual
} from "@/lib/editorCommands";
import { FigureTextInput, FigureWidthInput } from "./FigureAttrInputs";

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

function RibbonCaptionField({
  icon: Icon,
  label,
  enabled,
  value,
  testId,
  onCommit
}: {
  icon: LucideIcon;
  label: string;
  enabled: boolean;
  value: string;
  testId: string;
  onCommit: (value: string) => void;
}) {
  return (
    <label
      title={label}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e4e7ec] bg-white px-2 ${
        enabled ? "focus-within:border-[#c7d7fe] focus-within:ring-2 focus-within:ring-[#e8eefc]" : "opacity-40"
      }`}
    >
      <Icon size={16} className="shrink-0 text-[#667085]" aria-hidden />
      <FigureTextInput
        enabled={enabled}
        value={value}
        testId={testId}
        ariaLabel={label}
        placeholder={label}
        className="h-7 w-40 border-0 bg-transparent px-0 text-[13px] text-[#1c1f24] outline-none placeholder:text-[#98a2b3]"
        onCommit={onCommit}
      />
    </label>
  );
}

const LAYOUT_BUTTONS: { id: ImageLayout; title: string; testId: string; icon: ReactNode }[] = [
  { id: "block-left", title: "Position left", testId: "image-align-left", icon: <AlignHorizontalJustifyStart size={16} /> },
  { id: "block-center", title: "Position center", testId: "image-align-center", icon: <AlignHorizontalJustifyCenter size={16} /> },
  { id: "block-right", title: "Position right", testId: "image-align-right", icon: <AlignHorizontalJustifyEnd size={16} /> },
  { id: "float-left", title: "Float left, wrap text", testId: "image-float-left", icon: <PanelLeft size={16} /> },
  { id: "float-right", title: "Float right, wrap text", testId: "image-float-right", icon: <PanelRight size={16} /> }
];

function captionText(editor: Editor): string {
  return figureCaptionText(editor.state);
}

export function ImageRibbonTools({ editor, enabled }: { editor: Editor | null; enabled: boolean }) {
  const { openImage } = useEditorUi();
  const attrs = (editor ? figureNodeFromState(editor.state)?.attrs : null) ?? {};
  const layout = IMAGE_LAYOUTS.includes(attrs.layout as ImageLayout)
    ? (attrs.layout as ImageLayout)
    : "block-center";
  const width = Number(attrs.width ?? 100);
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
        <FigureWidthInput
          editor={editor}
          enabled={enabled}
          width={width}
          testId="image-width"
          className="h-8 w-16 rounded-md border border-[#e4e7ec] bg-white px-1 text-[13px] text-[#1c1f24] disabled:opacity-40"
        />
        %
      </label>
      <RibbonCaptionField
        icon={Subtitles}
        label="Caption"
        enabled={enabled}
        value={enabled ? caption : ""}
        testId="image-caption"
        onCommit={(value) => editor?.commands.setFigureCaption(value)}
      />
      <Divider />
      <Tool
        title="Move image up"
        testId="image-move-up"
        disabled={!enabled}
        onClick={() => editor?.commands.moveFigureUp()}
      >
        <ArrowUp size={16} />
      </Tool>
      <Tool
        title="Move image down"
        testId="image-move-down"
        disabled={!enabled}
        onClick={() => editor?.commands.moveFigureDown()}
      >
        <ArrowDown size={16} />
      </Tool>
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

export const CALLOUT_KINDS = [
  { id: "note", label: "Note" },
  { id: "tip", label: "Tip" },
  { id: "warning", label: "Warning" },
  { id: "important", label: "Important" }
] as const;

export function CalloutRibbonTools({ editor, enabled }: { editor: Editor | null; enabled: boolean }) {
  const kind = String(editor?.getAttributes("callout").kind ?? "note");
  return (
    <>
      <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Callout</span>
      <select
        aria-label="Callout type"
        data-testid="callout-kind"
        disabled={!enabled}
        className="h-11 rounded-md border border-[#e4e7ec] bg-white px-2 text-[16px] disabled:cursor-not-allowed disabled:opacity-40 lg:h-8 lg:text-[13px]"
        value={kind}
        onChange={(e) => editor && setCalloutKind(editor, e.target.value)}
      >
        {CALLOUT_KINDS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </>
  );
}

export function TableRibbonTools({ editor, enabled }: { editor: Editor | null; enabled: boolean }) {
  const tableAlign = String(editor?.getAttributes("table").align ?? "");
  const cellType = editor?.isActive("tableHeader") ? "tableHeader" : "tableCell";
  const cellAlign = String(editor?.getAttributes(cellType).align ?? "left") || "left";
  return (
    <>
      <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Table</span>
      <span className="px-1 text-[11px] text-[#667085]">Text</span>
      <Tool
        title="Align text left"
        testId="table-align-left"
        pressed={cellAlign === "left"}
        disabled={!enabled}
        onClick={() => editor && setTableCellAlign(editor, "left")}
      >
        <AlignLeft size={16} />
      </Tool>
      <Tool
        title="Align text center"
        testId="table-align-center"
        pressed={cellAlign === "center"}
        disabled={!enabled}
        onClick={() => editor && setTableCellAlign(editor, "center")}
      >
        <AlignCenter size={16} />
      </Tool>
      <Tool
        title="Align text right"
        testId="table-align-right"
        pressed={cellAlign === "right"}
        disabled={!enabled}
        onClick={() => editor && setTableCellAlign(editor, "right")}
      >
        <AlignRight size={16} />
      </Tool>
      <Divider />
      <span className="px-1 text-[11px] text-[#667085]">Position</span>
      <Tool
        title="Align table left"
        testId="table-page-align-left"
        pressed={tableAlign === "left"}
        disabled={!enabled}
        onClick={() => editor && setTableAlign(editor, "left")}
      >
        <AlignHorizontalJustifyStart size={16} />
      </Tool>
      <Tool
        title="Align table center"
        testId="table-page-align-center"
        pressed={tableAlign === "center"}
        disabled={!enabled}
        onClick={() => editor && setTableAlign(editor, "center")}
      >
        <AlignHorizontalJustifyCenter size={16} />
      </Tool>
      <Tool
        title="Align table right"
        testId="table-page-align-right"
        pressed={tableAlign === "right"}
        disabled={!enabled}
        onClick={() => editor && setTableAlign(editor, "right")}
      >
        <AlignHorizontalJustifyEnd size={16} />
      </Tool>
      <Divider />
      <Tool title="Auto column widths" testId="table-widths-auto" disabled={!enabled} onClick={() => editor && setTableWidthsAuto(editor)}>
        <Sparkles size={16} /> Auto
      </Tool>
      <Tool title="Equal column widths" testId="table-widths-equal" disabled={!enabled} onClick={() => editor && setTableWidthsEqual(editor)}>
        <Columns2 size={16} /> Equal
      </Tool>
      <RibbonCaptionField
        icon={Subtitles}
        label="Caption"
        enabled={enabled}
        value={enabled ? String(editor?.getAttributes("table").caption ?? "") : ""}
        testId="table-caption"
        onCommit={(value) => editor && setTableCaption(editor, value)}
      />
      <Divider />
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
