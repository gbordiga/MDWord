"use client";

import { useEffect, useState } from "react";

function applyViewportVars(): { height: number; keyboardOpen: boolean } {
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
  document.documentElement.style.setProperty("--app-offset-top", `${offsetTop}px`);
  const keyboardOpen = window.innerHeight - height > 80;
  document.documentElement.classList.toggle("keyboard-open", keyboardOpen);
  return { height, keyboardOpen };
}

/** Keeps the shell inside the visual viewport (iOS URL bar + keyboard). */
export function useVisualViewport(): { height: number; keyboardOpen: boolean } {
  const [state, setState] = useState({
    height: typeof window === "undefined" ? 800 : window.innerHeight,
    keyboardOpen: false
  });

  useEffect(() => {
    const sync = () => setState(applyViewportVars());
    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  return state;
}
