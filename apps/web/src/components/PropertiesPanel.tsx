"use client";

import { cn } from "@mdword/ui";
import { useApp } from "@/lib/store";
import { DocumentProperties } from "./DocumentProperties";

export function PropertiesPanel({ className }: { className?: string }) {
  const diagnostics = useApp((s) => s.model.diagnostics);

  return (
    <aside
      className={cn("flex h-full w-full min-w-0 flex-col border-l border-[#e4e7ec] bg-white text-[13px]", className)}
    >
      <div className="shrink-0 border-b border-[#e4e7ec] px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Properties</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <DocumentProperties variant="panel" />
        {diagnostics.length > 0 ? (
          <div className="m-3 rounded-md bg-[#fffbeb] p-2 text-[12px] text-[#92400e]" data-testid="diagnostics">
            {diagnostics.slice(0, 6).map((d, i) => (
              <div key={i}>{d.message}</div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
