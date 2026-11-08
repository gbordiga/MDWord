"use client";

import { cn } from "@mdword/ui";
import { DocumentProperties } from "./DocumentProperties";

/** The document's properties. Lives in the sidebar tabs and in the narrow-screen sheet. */
export function PropertiesPanel({ className }: { className?: string }) {
  return (
    <div className={cn("min-h-0 w-full min-w-0 overflow-auto bg-white text-[13px]", className)}>
      <DocumentProperties variant="panel" />
    </div>
  );
}
