"use client";

import { useEffect } from "react";
import { dirtyDocumentTitles, sessionIsDirty, unsavedCloseMessage } from "@/lib/closeGuard";
import type { ConfirmState } from "@/lib/editorUi";
import { getHost, isElectron } from "@/lib/host";
import { clearCrashDraft } from "@/lib/recovery";
import { useApp } from "@/lib/store";

const DELAY_MS = 1600;
let crashDraftEnabled = true;

/** Discarded closes must not write the draft back during unload. */
export function suppressCrashDraft(): void {
  crashDraftEnabled = false;
}

export function useCrashDraft(): void {
  const editGeneration = useApp((s) => s.editGeneration);
  useEffect(() => {
    if (!useApp.getState().dirty) return;
    const timer = window.setTimeout(() => {
      void useApp.getState().saveDraft();
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [editGeneration]);
}

function flushDraftIfDirty(): void {
  if (!crashDraftEnabled || !useApp.getState().dirty) return;
  void useApp.getState().saveDraft();
}

export function useUnsavedCloseGuard(): void {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      useApp.getState().flushPendingEdits();
      flushDraftIfDirty();
      if (isElectron() || !sessionIsDirty(useApp.getState())) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushDraftIfDirty();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", flushDraftIfDirty);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", flushDraftIfDirty);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}

export function useDesktopCloseGuard(openConfirm: (state: NonNullable<ConfirmState>) => void): void {
  useEffect(() => {
    if (!isElectron()) return;
    const host = getHost();
    let promptOpen = false;
    const onRequestClose = () => {
      if (promptOpen) return;
      useApp.getState().flushPendingEdits();
      const state = useApp.getState();
      const titles = dirtyDocumentTitles(state.tabs, state.activeTabId, state.dirty);
      if (!titles.length) {
        void host.app.allowClose?.();
        return;
      }
      promptOpen = true;
      const release = () => {
        promptOpen = false;
      };
      openConfirm({
        title: "Unsaved changes",
        message: unsavedCloseMessage(titles),
        save: () => useApp.getState().saveAllDirty(),
        onCancel: () => {
          release();
          void host.app.cancelClose?.();
        },
        action: () => {
          release();
          suppressCrashDraft();
          void clearCrashDraft();
          void host.app.allowClose?.();
        }
      });
    };
    const stop = host.app.onRequestClose?.(onRequestClose) ?? (() => undefined);
    host.app.notifyCloseGuardReady?.();
    return () => {
      stop();
    };
  }, [openConfirm]);
}

export function usePeriodicCrashDraft(): void {
  useEffect(() => {
    const id = window.setInterval(() => {
      const state = useApp.getState();
      if (!state.dirty) return;
      void useApp.getState().saveDraft();
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);
}

export function recoveredDraftDiffers(content: string): boolean {
  return content !== useApp.getState().model.source;
}
