"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { nextZoomFromWheel } from "@/lib/zoom";

/** Ctrl/Cmd + mouse wheel zooms the document and blocks browser zoom. */
export function useCtrlWheelZoom(): void {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const { zoom, setZoom } = useApp.getState();
      setZoom(nextZoomFromWheel(zoom, event.deltaY, event.deltaMode));
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, []);
}
