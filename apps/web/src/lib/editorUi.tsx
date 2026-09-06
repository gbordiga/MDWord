"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { Editor } from "@tiptap/react";
import { useApp } from "./store";

export type EditorDialog = "link" | "image" | "wikilink" | null;

export type ConfirmState = {
  title: string;
  message: string;
  action: () => void;
} | null;

interface EditorUiValue {
  editor: Editor | null;
  dialog: EditorDialog;
  confirm: ConfirmState;
  openLink: () => void;
  openImage: () => void;
  openWikilink: () => void;
  closeDialog: () => void;
  confirmIfDirty: (action: () => void) => void;
  closeConfirm: () => void;
}

const EditorUiContext = createContext<EditorUiValue | null>(null);

export function EditorUiProvider({
  editor,
  children
}: {
  editor: Editor | null;
  children: ReactNode;
}) {
  const [dialog, setDialog] = useState<EditorDialog>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const confirmIfDirty = useCallback((action: () => void) => {
    if (!useApp.getState().dirty) {
      action();
      return;
    }
    setConfirm({
      title: "Unsaved changes",
      message: "This document has unsaved changes. Save them before continuing, or discard them.",
      action
    });
  }, []);

  const value = useMemo<EditorUiValue>(
    () => ({
      editor,
      dialog,
      confirm,
      openLink: () => setDialog("link"),
      openImage: () => setDialog("image"),
      openWikilink: () => setDialog("wikilink"),
      closeDialog: () => setDialog(null),
      confirmIfDirty,
      closeConfirm: () => setConfirm(null)
    }),
    [editor, dialog, confirm, confirmIfDirty]
  );

  return <EditorUiContext.Provider value={value}>{children}</EditorUiContext.Provider>;
}

export function useEditorUi(): EditorUiValue {
  const value = useContext(EditorUiContext);
  if (!value) throw new Error("useEditorUi must be used within EditorUiProvider");
  return value;
}
