"use client";

import { useEffect, useRef } from "react";
import { createSourceEditor, setSource } from "@mdword/source-editor";
import { saveDocument } from "@mdword/document-model";
import { useApp } from "@/lib/store";

export function SourcePane() {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<ReturnType<typeof createSourceEditor> | null>(null);
  const model = useApp((s) => s.model);
  const applySource = useApp((s) => s.applySource);
  const syncGeneration = useApp((s) => s.syncGeneration);

  useEffect(() => {
    if (!parentRef.current || viewRef.current) return;
    viewRef.current = createSourceEditor({
      parent: parentRef.current,
      doc: saveDocument(model),
      onChange: (value) => applySource(value)
    });
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!viewRef.current) return;
    setSource(viewRef.current, saveDocument(model));
  }, [syncGeneration, model]);

  return <div ref={parentRef} className="h-full min-h-0 bg-white" data-testid="source-editor" />;
}
