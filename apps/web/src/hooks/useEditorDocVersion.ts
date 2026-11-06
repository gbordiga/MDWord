"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

/**
 * Re-render when the editor document changes. Unlike `useEditorTick` this
 * ignores selection-only transactions, so list-like panels can stay in sync
 * with the content without re-rendering on every cursor move.
 */
export function useEditorDocVersion(editor: Editor | null): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) setVersion((n) => n + 1);
    };
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor]);
  return version;
}
