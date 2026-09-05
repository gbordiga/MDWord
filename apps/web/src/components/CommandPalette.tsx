"use client";

import { Command } from "cmdk";
import { useApp } from "@/lib/store";

export function CommandPalette({
  onInsert
}: {
  onInsert: (kind: string) => void;
}) {
  const open = useApp((s) => s.paletteOpen);
  const setPalette = useApp((s) => s.setPalette);
  const actions = useApp();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setPalette(false)}>
      <Command
        className="mx-auto mt-[18vh] w-[min(560px,92vw)] overflow-hidden rounded-xl bg-white shadow-page"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          autoFocus
          placeholder="Type a command…"
          className="w-full border-b border-[#e4e7ec] px-4 py-3 text-[15px] outline-none"
        />
        <Command.List className="max-h-80 overflow-auto p-2">
          <Command.Item onSelect={() => { actions.newDocument(); setPalette(false); }} className="rounded px-2 py-2 text-[13px] data-[selected=true]:bg-[#e8eefc]">New</Command.Item>
          <Command.Item onSelect={() => { void actions.openFile(); setPalette(false); }} className="rounded px-2 py-2 text-[13px] data-[selected=true]:bg-[#e8eefc]">Open</Command.Item>
          <Command.Item onSelect={() => { void actions.saveFile(); setPalette(false); }} className="rounded px-2 py-2 text-[13px] data-[selected=true]:bg-[#e8eefc]">Save</Command.Item>
          <Command.Item onSelect={() => { actions.setView("source"); setPalette(false); }} className="rounded px-2 py-2 text-[13px] data-[selected=true]:bg-[#e8eefc]">Toggle source</Command.Item>
          <Command.Item onSelect={() => { onInsert("table"); setPalette(false); }} className="rounded px-2 py-2 text-[13px] data-[selected=true]:bg-[#e8eefc]">Insert table</Command.Item>
          <Command.Item onSelect={() => { onInsert("figure"); setPalette(false); }} className="rounded px-2 py-2 text-[13px] data-[selected=true]:bg-[#e8eefc]">Insert figure</Command.Item>
          <Command.Item onSelect={() => { onInsert("wikilink"); setPalette(false); }} className="rounded px-2 py-2 text-[13px] data-[selected=true]:bg-[#e8eefc]">Add wikilink</Command.Item>
          <Command.Item onSelect={() => { void actions.exportPdf(); setPalette(false); }} className="rounded px-2 py-2 text-[13px] data-[selected=true]:bg-[#e8eefc]">Export PDF</Command.Item>
        </Command.List>
      </Command>
    </div>
  );
}
