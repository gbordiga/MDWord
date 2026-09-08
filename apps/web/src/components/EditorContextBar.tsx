"use client";

import { TableProperties } from "lucide-react";
import { setCalloutKind } from "@/lib/editorCommands";
import { useEditorTick } from "@/hooks/useEditorTick";
import { useEditorUi } from "@/lib/editorUi";

const CALLOUT_KINDS = [
  { id: "note", label: "Note" },
  { id: "tip", label: "Tip" },
  { id: "warning", label: "Warning" },
  { id: "important", label: "Important" }
];

export function EditorContextBar() {
  const { editor } = useEditorUi();
  useEditorTick(editor);
  if (!editor?.isActive("callout")) return null;

  const kind = String(editor.getAttributes("callout").kind ?? "note");

  return (
    <div
      data-testid="editor-context-bar"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[#e4e7ec] bg-[#eef2f6] px-2 py-1"
    >
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
    </div>
  );
}
