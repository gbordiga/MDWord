"use client";

import { Command } from "cmdk";
import { useApp } from "@/lib/store";
import { useEditorUi } from "@/lib/editorUi";

export function CommandPalette({
  onInsert
}: {
  onInsert: (kind: string) => void;
}) {
  const open = useApp((s) => s.paletteOpen);
  const setPalette = useApp((s) => s.setPalette);
  const actions = useApp();
  const { confirmIfDirty } = useEditorUi();
  if (!open) return null;

  const close = () => setPalette(false);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/20 pt-[env(safe-area-inset-top)]"
      onClick={() => setPalette(false)}
    >
      <Command
        className="mx-auto mt-0 w-full overflow-hidden bg-white shadow-page max-lg:h-[var(--app-height,100dvh)] max-lg:rounded-none lg:mt-[18vh] lg:w-[min(560px,92vw)] lg:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          autoFocus
          placeholder="Type a command…"
          className="w-full border-b border-[#e4e7ec] px-4 py-3 text-[16px] outline-none lg:text-[15px]"
        />
        <Command.List className="max-h-[min(24rem,calc(var(--app-height,100dvh)-5rem))] overflow-auto p-2">
          <Command.Item
            onSelect={() => {
              close();
              confirmIfDirty(actions.newDocument);
            }}
            className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]"
          >
            New
          </Command.Item>
          <Command.Item
            onSelect={() => {
              close();
              confirmIfDirty(() => void actions.openFile());
            }}
            className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]"
          >
            Open
          </Command.Item>
          <Command.Item onSelect={() => { void actions.saveFile(); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Save</Command.Item>
          <Command.Item onSelect={() => { actions.setView("source"); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Toggle source</Command.Item>
          <Command.Item onSelect={() => { actions.setFind(true); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Find in document</Command.Item>
          <Command.Item onSelect={() => { onInsert("link"); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Insert link</Command.Item>
          <Command.Item onSelect={() => { onInsert("table"); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Insert table</Command.Item>
          <Command.Item onSelect={() => { onInsert("figure"); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Insert figure</Command.Item>
          <Command.Item onSelect={() => { onInsert("wikilink"); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Add wikilink</Command.Item>
          <Command.Item onSelect={() => { void actions.exportPdf(); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Export PDF</Command.Item>
        </Command.List>
      </Command>
    </div>
  );
}
