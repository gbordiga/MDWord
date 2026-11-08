"use client";

import { Command } from "cmdk";
import { useApp } from "@/lib/store";
import { assistantSupported } from "@/lib/assistant/store";
import { useMarkdownAssociation } from "./MarkdownAssociationControl";
import { useEditorUi } from "@/lib/editorUi";
import { copyDiagnostics } from "@/lib/diagnostics";
export function CommandPalette({
  onInsert
}: {
  onInsert: (kind: string) => void;
}) {
  const open = useApp((s) => s.paletteOpen);
  const setPalette = useApp((s) => s.setPalette);
  const actions = useApp();
  const { confirmIfDirty } = useEditorUi();
  const markdownAssociation = useMarkdownAssociation();
  if (!open) return null;

  const close = () => setPalette(false);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/20 pt-[env(safe-area-inset-top)]"
      onClick={() => setPalette(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      data-testid="command-palette"
    >
      <Command
        className="mx-auto mt-0 flex w-full flex-col overflow-hidden bg-white shadow-page max-lg:h-[var(--app-height,100dvh)] max-lg:rounded-none lg:mt-[18vh] lg:w-[min(560px,92vw)] lg:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          autoFocus
          placeholder="Type a command…"
          className="w-full border-b border-[#e4e7ec] px-4 py-3 text-[16px] outline-hidden lg:text-[15px]"
        />
        <Command.List className="min-h-0 flex-1 overflow-auto p-2 lg:max-h-[min(24rem,calc(var(--app-height,100dvh)-5rem))] lg:flex-none">
          <Command.Item
            onSelect={() => {
              close();
              confirmIfDirty(() => actions.newDocument());
            }}
            className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]"
          >
            New
          </Command.Item>
          <Command.Item
            onSelect={() => {
              close();
              void actions.openFile();
            }}
            className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]"
          >
            Open
          </Command.Item>
          <Command.Item onSelect={() => { void actions.saveFile(); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Save</Command.Item>
          <Command.Item onSelect={() => { actions.setView("source"); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Toggle source</Command.Item>
          {assistantSupported() ? (
            <Command.Item onSelect={() => { actions.showRightPanel("assistant"); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Toggle assistant</Command.Item>
          ) : null}
          <Command.Item onSelect={() => { actions.setFind(true); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Find in document</Command.Item>
          <Command.Item onSelect={() => { onInsert("link"); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Insert link</Command.Item>
          <Command.Item onSelect={() => { onInsert("table"); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Insert table</Command.Item>
          <Command.Item onSelect={() => { onInsert("figure"); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Insert figure</Command.Item>
          <Command.Item onSelect={() => { onInsert("wikilink"); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Add wikilink</Command.Item>
          <Command.Item onSelect={() => { void actions.printDocument(); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Print</Command.Item>
          <Command.Item onSelect={() => { void actions.exportPdf(); close(); }} className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]">Export PDF</Command.Item>
          <Command.Item
            onSelect={() => {
              close();
              void copyDiagnostics().then((copied) => {
                const state = useApp.getState();
                if (copied) state.showNotice("Diagnostics copied to the clipboard.");
                else state.setErrorMessage("Could not copy diagnostics.");
              });
            }}
            className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]"
          >
            Copy diagnostics
          </Command.Item>
          {markdownAssociation.status?.supported ? (
            <Command.Item
              onSelect={() => {
                void markdownAssociation.setAsDefault();
                close();
              }}
              className="rounded-lg px-3 py-3 text-[15px] data-[selected=true]:bg-[#e8eefc] lg:py-2 lg:text-[13px]"
            >
              {markdownAssociation.status.isDefault
                ? "MDWord is the default app for Markdown files"
                : "Set MDWord as the default app for .md files"}
            </Command.Item>
          ) : null}
        </Command.List>
        <div className="hidden items-center justify-between gap-2 border-t border-[#e4e7ec] px-3 py-2 text-[11px] text-[#667085] sm:flex">
          <span>Type to filter</span>
          <span className="inline-flex items-center gap-2">
            <kbd className="rounded border border-[#e4e7ec] bg-[#f8fafc] px-1">↑</kbd>
            <kbd className="rounded border border-[#e4e7ec] bg-[#f8fafc] px-1">↓</kbd>
            move
            <kbd className="rounded border border-[#e4e7ec] bg-[#f8fafc] px-1">↵</kbd>
            run
            <kbd className="rounded border border-[#e4e7ec] bg-[#f8fafc] px-1">esc</kbd>
            close
          </span>
        </div>
      </Command>
    </div>
  );
}
