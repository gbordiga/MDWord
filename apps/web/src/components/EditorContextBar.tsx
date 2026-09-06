"use client";

import { Columns3, Rows3, TableProperties, Trash2 } from "lucide-react";
import { setCalloutKind } from "@/lib/editorCommands";
import { useEditorTick } from "@/hooks/useEditorTick";
import { useEditorUi } from "@/lib/editorUi";

const CALLOUT_KINDS = [
  { id: "note", label: "Note" },
  { id: "tip", label: "Tip" },
  { id: "warning", label: "Warning" },
  { id: "important", label: "Important" }
];

function Tool({
  title,
  onClick,
  testId,
  children
}: {
  title: string;
  onClick: () => void;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      data-testid={testId}
      onClick={onClick}
      className="inline-flex h-11 min-w-11 items-center gap-1 rounded-lg px-2 text-[13px] text-[#1c1f24] hover:bg-[#eef2f6] lg:h-8"
    >
      {children}
    </button>
  );
}

export function EditorContextBar() {
  const { editor } = useEditorUi();
  useEditorTick(editor);
  if (!editor) return null;

  const inTable = editor.isActive("table");
  const inCallout = editor.isActive("callout");
  if (!inTable && !inCallout) return null;

  const kind = String(editor.getAttributes("callout").kind ?? "note");

  return (
    <div
      data-testid="editor-context-bar"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[#e4e7ec] bg-[#eef2f6] px-2 py-1"
    >
      {inTable ? (
        <>
          <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Table</span>
          <Tool title="Add row" testId="table-add-row" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <Rows3 size={16} /> Row
          </Tool>
          <Tool title="Add column" testId="table-add-col" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <Columns3 size={16} /> Column
          </Tool>
          <Tool title="Delete row" testId="table-del-row" onClick={() => editor.chain().focus().deleteRow().run()}>
            <Rows3 size={16} /> Delete row
          </Tool>
          <Tool title="Delete column" testId="table-del-col" onClick={() => editor.chain().focus().deleteColumn().run()}>
            <Columns3 size={16} /> Delete column
          </Tool>
          <Tool title="Delete table" testId="table-delete" onClick={() => editor.chain().focus().deleteTable().run()}>
            <Trash2 size={16} /> Delete table
          </Tool>
        </>
      ) : null}
      {inCallout ? (
        <>
          <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Callout</span>
          <TableProperties size={14} className="text-[#667085]" />
          <select
            aria-label="Callout kind"
            data-testid="callout-kind"
            className="h-11 rounded-md border border-[#e4e7ec] bg-white px-2 text-[16px] lg:h-8 lg:text-[13px]"
            value={kind}
            onChange={(e) => setCalloutKind(editor, e.target.value)}
          >
            {CALLOUT_KINDS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </>
      ) : null}
    </div>
  );
}
