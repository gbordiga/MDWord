"use client";

import type { ReactNode } from "react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { useIsCompact } from "@/hooks/useMediaQuery";
import { LeftSidebar } from "./LeftSidebar";
import { PropertiesPanel } from "./PropertiesPanel";

function ResizeHandle({ label }: { label: string }) {
  return (
    <Separator
      aria-label={label}
      className="relative w-1.5 shrink-0 cursor-col-resize bg-transparent after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-[#e4e7ec] hover:after:bg-[#98a2b3] active:after:bg-accent data-[active]:after:bg-accent"
    />
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
  const panelIds = [
    ...(showLeft ? ["mdword-left"] : []),
    "mdword-editor",
    ...(showRight ? ["mdword-right"] : [])
  ];
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "mdword-sidebars",
    panelIds
  });

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1">
      <Group
        id="mdword-sidebars"
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="flex h-full min-h-0 min-w-0 flex-1"
      >
        {showLeft ? (
          <>
            <Panel id="mdword-left" defaultSize="20%" minSize="12%" maxSize="40%" className="min-h-0 min-w-0">
              <LeftSidebar className="h-full w-full" />
            </Panel>
            <ResizeHandle label="Resize left sidebar" />
          </>
        ) : null}
        <Panel
          id="mdword-editor"
          defaultSize={showLeft || showRight ? "60%" : "100%"}
          minSize="30%"
          className="min-h-0 min-w-0"
        >
          {children}
        </Panel>
        {showRight ? (
          <>
            <ResizeHandle label="Resize properties sidebar" />
            <Panel id="mdword-right" defaultSize="22%" minSize="14%" maxSize="42%" className="min-h-0 min-w-0">
              <PropertiesPanel className="h-full w-full" />
            </Panel>
          </>
        ) : null}
      </Group>
    </div>
  );
}
