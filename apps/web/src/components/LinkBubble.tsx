"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Link2Off, Pencil } from "lucide-react";
import { getHost } from "@/lib/host";
import { removeLink } from "@/lib/editorCommands";
import { useEditorTick } from "@/hooks/useEditorTick";
import { useEditorUi } from "@/lib/editorUi";

export function LinkBubble() {
  const { editor, openLink } = useEditorUi();
  useEditorTick(editor);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const href = editor?.isActive("link") ? String(editor.getAttributes("link").href ?? "") : "";

  useEffect(() => {
    if (!editor || !href) {
      setCoords(null);
      return;
    }
    const { from } = editor.state.selection;
    const $pos = editor.view.domAtPos(from);
    const node = $pos.node instanceof Element ? $pos.node : $pos.node.parentElement;
    const a = node?.closest?.("a");
    if (!a) {
      setCoords(null);
      return;
    }
    const rect = a.getBoundingClientRect();
    const width = 220;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const below = rect.bottom + 8;
    const top = below + 40 > window.innerHeight ? rect.top - 48 : below;
    setCoords({ top, left });
  }, [editor, href, editor?.state.selection.from, editor?.state.selection.to]);

  if (!editor || !href || !coords) return null;

  return (
    <div
      data-testid="link-bubble"
      className="fixed z-[70] flex items-center gap-1 rounded-lg border border-[#e4e7ec] bg-white px-1 py-1 shadow-[0_8px_24px_rgb(16_24_40_/_16%)]"
      style={{ top: coords.top, left: coords.left }}
    >
      <span className="max-w-[9rem] truncate px-2 text-[12px] text-[#667085]" title={href}>
        {href}
      </span>
      <button
        type="button"
        data-testid="link-open"
        title="Open link"
        aria-label="Open link"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[#f2f4f7]"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void getHost().shell.openExternal(href)}
      >
        <ExternalLink size={14} />
      </button>
      <button
        type="button"
        data-testid="link-edit"
        title="Edit link"
        aria-label="Edit link"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[#f2f4f7]"
        onMouseDown={(e) => e.preventDefault()}
        onClick={openLink}
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        data-testid="link-unlink"
        title="Remove link"
        aria-label="Remove link"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[#fef3f2] hover:text-[#b42318]"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => removeLink(editor)}
      >
        <Link2Off size={14} />
      </button>
    </div>
  );
}
