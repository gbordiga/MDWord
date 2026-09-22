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
  /** When set, Save uses this instead of saving only the active document. */
  save?: () => Promise<boolean>;
  onCancel?: () => void;
} | null;

export type EditorContextMenuState = { x: number; y: number } | null;

interface EditorUiValue {
  editor: Editor | null;
  dialog: EditorDialog;
  confirm: ConfirmState;
  contextMenu: EditorContextMenuState;
  openLink: () => void;
  openImage: () => void;
  openWikilink: () => void;
  openContextMenu: (x: number, y: number) => void;
  closeContextMenu: () => void;
  closeDialog: () => void;
  confirmIfDirty: (action: () => void, options?: { when?: boolean; save?: () => Promise<boolean> }) => void;
  openConfirm: (state: NonNullable<ConfirmState>) => void;
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
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState>(null);

  const openConfirm = useCallback((state: NonNullable<ConfirmState>) => {
    setConfirm(state);
  }, []);

  const confirmIfDirty = useCallback((action: () => void, options?: { when?: boolean; save?: () => Promise<boolean> }) => {
    const dirty = options?.when ?? useApp.getState().dirty;
    if (!dirty) {
      action();
      return;
    }
    setConfirm({
      title: "Unsaved changes",
      message: "This document has unsaved changes. Save them before continuing, or discard them.",
      action,
      save: options?.save
    });
  }, []);

  const value = useMemo<EditorUiValue>(
    () => ({
      editor,
      dialog,
      confirm,
      contextMenu,
      openLink: () => {
        setContextMenu(null);
        setDialog("link");
      },
      openImage: () => {
        setContextMenu(null);
        setDialog("image");
      },
      openWikilink: () => {
        setContextMenu(null);
        setDialog("wikilink");
      },
      openContextMenu: (x, y) => setContextMenu({ x, y }),
      closeContextMenu: () => setContextMenu(null),
      closeDialog: () => setDialog(null),
      confirmIfDirty,
      openConfirm,
      closeConfirm: () => setConfirm(null)
    }),
    [editor, dialog, confirm, contextMenu, confirmIfDirty, openConfirm]
  );

  return <EditorUiContext.Provider value={value}>{children}</EditorUiContext.Provider>;
}

export function useEditorUi(): EditorUiValue {
  const value = useContext(EditorUiContext);
  if (!value) throw new Error("useEditorUi must be used within EditorUiProvider");
  return value;
}
