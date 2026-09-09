"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

export function useEditorTick(editor: Editor | null): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const bump = () => setTick((n) => n + 1);
    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) bump();
    };
    editor.on("selectionUpdate", bump);
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("selectionUpdate", bump);
      editor.off("transaction", onTransaction);
    };
  }, [editor]);
  return tick;
}
