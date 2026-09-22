"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Link2Off, Pencil } from "lucide-react";
import { openEditorHref, openWikiTarget } from "@/lib/openEditorLink";
import { removeLink, removeWikilink } from "@/lib/editorCommands";
import { useEditorTick } from "@/hooks/useEditorTick";
import { useEditorUi } from "@/lib/editorUi";

export function LinkBubble() {
  const { editor, openLink, openWikilink } = useEditorUi();
  useEditorTick(editor);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const wiki = Boolean(editor?.isActive("wikiLink"));
  const href = !wiki && editor?.isActive("link") ? String(editor.getAttributes("link").href ?? "") : "";
  const wikiTarget = wiki ? String(editor?.getAttributes("wikiLink").target ?? "") : "";
  const label = wiki ? wikiTarget : href;

  useEffect(() => {
    if (!editor || !label) {
      setCoords(null);
      return;
    }
    const { from } = editor.state.selection;
    const $pos = editor.view.domAtPos(from);
    const node = $pos.node instanceof Element ? $pos.node : $pos.node.parentElement;
    const anchor = wiki ? node?.closest?.("[data-wiki-link]") : node?.closest?.("a");
    if (!anchor) {
      setCoords(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const width = 220;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const below = rect.bottom + 8;
    const top = below + 40 > window.innerHeight ? rect.top - 48 : below;
    setCoords({ top, left });
  }, [editor, wiki, label, editor?.state.selection.from, editor?.state.selection.to]);

  if (!editor || !label || !coords) return null;

  return (
    <div
      data-testid="link-bubble"
      className="fixed z-[70] flex items-center gap-1 rounded-lg border border-[#e4e7ec] bg-white px-1 py-1 shadow-[0_8px_24px_rgb(16_24_40_/_16%)]"
      style={{ top: coords.top, left: coords.left }}
    >
      <span className="max-w-[9rem] truncate px-2 text-[12px] text-[#667085]" title={label}>
        {label}
      </span>
      <button
        type="button"
        data-testid="link-open"
        title="Open link"
        aria-label="Open link"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[#f2f4f7]"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (wiki ? openWikiTarget(wikiTarget) : openEditorHref(href))}
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
        onClick={wiki ? openWikilink : openLink}
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
        onClick={() => (wiki ? removeWikilink(editor) : removeLink(editor))}
      >
        <Link2Off size={14} />
      </button>
    </div>
  );
}
