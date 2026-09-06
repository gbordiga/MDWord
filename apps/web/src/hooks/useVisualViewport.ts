"use client";

import { useEffect, useState } from "react";

function applyViewportVars(): { height: number; keyboardOpen: boolean } {
  const vv = window.visualViewport;
  const vvHeight = vv?.height ?? window.innerHeight;
  const keyboardOpen = window.innerHeight - vvHeight > 120;
  if (keyboardOpen && vv) {
    document.documentElement.style.setProperty("--app-height", `${vv.height}px`);
    document.documentElement.style.setProperty("--app-offset-top", `${vv.offsetTop}px`);
  } else {
    document.documentElement.style.setProperty("--app-height", "100dvh");
    document.documentElement.style.setProperty("--app-offset-top", "0px");
  }
  document.documentElement.classList.toggle("keyboard-open", keyboardOpen);
  return { height: keyboardOpen ? vvHeight : window.innerHeight, keyboardOpen };
}

/** Shrinks the shell only when the software keyboard is open. */
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
