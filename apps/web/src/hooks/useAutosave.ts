"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";

const DELAY_MS = 1600;

export function useAutosave(): void {
  const editGeneration = useApp((s) => s.editGeneration);
  useEffect(() => {
    if (!useApp.getState().dirty) return;
    const timer = window.setTimeout(() => {
      void useApp.getState().autosave();
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [editGeneration]);
}
