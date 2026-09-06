"use client";

import { useEffect, useRef, useState } from "react";
import { createSourceEditor, setSource } from "@mdword/source-editor";
import { saveDocument } from "@mdword/document-model";
import { useApp } from "@/lib/store";
import { Spinner } from "./Spinner";

export function SourcePane() {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<ReturnType<typeof createSourceEditor> | null>(null);
  const model = useApp((s) => s.model);
  const applySource = useApp((s) => s.applySource);
  const syncGeneration = useApp((s) => s.syncGeneration);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!parentRef.current || viewRef.current) return;
    viewRef.current = createSourceEditor({
      parent: parentRef.current,
      doc: saveDocument(model),
      onChange: (value) => applySource(value)
    });
    setReady(true);
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

  useEffect(() => {
    useApp.getState().finishBusy(["open", "workspace"]);
  }, [syncGeneration]);

  return (
    <div className="relative h-full min-h-0 min-w-0 bg-white">
      {!ready ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          data-testid="source-loading"
          role="status"
        >
          <Spinner size={24} />
        </div>
      ) : null}
      <div ref={parentRef} className="h-full min-h-0 min-w-0" data-testid="source-editor" />
    </div>
  );
}
