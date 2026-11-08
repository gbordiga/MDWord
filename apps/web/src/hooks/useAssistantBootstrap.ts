"use client";

import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { VERIFIER_KEY, assistantSupported, useAssistant } from "@/lib/assistant/store";
import { setSelectionProvider } from "@/lib/assistant/selection";
import { selectionText } from "@/lib/editorCommands";
import { useApp } from "@/lib/store";

/** Wires the assistant into the app: settings, OAuth return, per-workspace history, selection. */
export function useAssistantBootstrap(editorRef: { current: Editor | null }) {
  const root = useApp((s) => s.workspace?.root ?? null);

  useEffect(() => {
    if (!assistantSupported()) return;
    void useAssistant.getState().init();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    // `?code=` may belong to something else: only consume it when we started a sign-in.
    if (code && sessionStorage.getItem(VERIFIER_KEY)) {
      params.delete("code");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
      useApp.setState({ rightOpen: true, rightPanel: "assistant" });
      void useAssistant.getState().completeWebSignIn(code);
    }
  }, []);

  useEffect(() => {
    if (!assistantSupported()) return;
    void useAssistant.getState().loadWorkspaceHistory(root ?? "no-folder");
  }, [root]);

  useEffect(() => {
    setSelectionProvider(() => (editorRef.current ? selectionText(editorRef.current) : ""));
    return () => setSelectionProvider(null);
  }, [editorRef]);
}
