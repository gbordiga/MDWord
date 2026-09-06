"use client";

import { useEffect, useState } from "react";

export const COMPACT_QUERY = "(max-width: 1023px)";

/** Returns whether `query` matches. `null` until mounted (SSR-safe). */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useIsCompact(): boolean {
  return useMediaQuery(COMPACT_QUERY) === true;
}
