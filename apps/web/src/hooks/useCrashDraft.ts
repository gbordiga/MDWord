"use client";

import { useEffect } from "react";
import { saveDocument } from "@mdword/document-model";
import { useApp } from "@/lib/store";

const DELAY_MS = 1600;

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
  if (!useApp.getState().dirty) return;
  void useApp.getState().saveDraft();
}

export function useUnsavedCloseGuard(): void {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!useApp.getState().dirty) return;
      event.preventDefault();
      event.returnValue = "";
      flushDraftIfDirty();
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
  return content !== saveDocument(useApp.getState().model);
}
