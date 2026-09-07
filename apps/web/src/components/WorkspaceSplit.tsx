"use client";

import type { ReactNode } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useIsCompact } from "@/hooks/useMediaQuery";
import { LeftSidebar } from "./LeftSidebar";
import { PropertiesPanel } from "./PropertiesPanel";

function ResizeHandle({ label }: { label: string }) {
  return (
    <PanelResizeHandle
      aria-label={label}
      className="group relative flex w-1.5 shrink-0 cursor-col-resize bg-transparent"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#e4e7ec] group-hover:bg-[#98a2b3] group-active:bg-accent group-data-[resize-handle-active]:bg-accent"
      />
    </PanelResizeHandle>
  );
}

export function WorkspaceSplit({
  leftOpen,
  rightOpen,
  children
}: {
  leftOpen: boolean;
  rightOpen: boolean;
  children: ReactNode;
}) {
  const compact = useIsCompact();
  const showLeft = leftOpen && !compact;
  const showRight = rightOpen && !compact;

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1">
    <PanelGroup
      direction="horizontal"
      autoSaveId="mdword-sidebars"
      className="flex h-full min-h-0 min-w-0 flex-1"
    >
      {showLeft ? (
        <>
          <Panel id="mdword-left" order={1} defaultSize={20} minSize={12} maxSize={40} className="min-h-0 min-w-0">
            <LeftSidebar className="h-full w-full" />
          </Panel>
          <ResizeHandle label="Resize left sidebar" />
        </>
      ) : null}
      <Panel
        id="mdword-editor"
        order={2}
        defaultSize={showLeft || showRight ? 60 : 100}
        minSize={30}
        className="min-h-0 min-w-0"
      >
        {children}
      </Panel>
      {showRight ? (
        <>
          <ResizeHandle label="Resize properties sidebar" />
          <Panel id="mdword-right" order={3} defaultSize={22} minSize={14} maxSize={42} className="min-h-0 min-w-0">
            <PropertiesPanel className="h-full w-full" />
          </Panel>
        </>
      ) : null}
    </PanelGroup>
    </div>
  );
}
