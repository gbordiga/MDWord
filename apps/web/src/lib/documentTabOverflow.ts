const EDGE = 1;

export function tabOverflowFlags(scrollLeft: number, scrollWidth: number, clientWidth: number) {
  const max = Math.max(0, scrollWidth - clientWidth);
  return {
    canScrollLeft: scrollLeft > EDGE,
    canScrollRight: scrollLeft < max - EDGE
  };
}

export function nextTabStripScrollLeft(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  direction: -1 | 1
): number {
  const page = Math.max(72, Math.round(clientWidth * 0.85));
  const max = Math.max(0, scrollWidth - clientWidth);
  return Math.min(max, Math.max(0, scrollLeft + page * direction));
}

export function scrollLeftToRevealTab(
  tabOffset: number,
  tabWidth: number,
  scrollLeft: number,
  clientWidth: number,
  pad = 8
): number | null {
  const viewStart = scrollLeft;
  const viewEnd = scrollLeft + clientWidth;
  if (tabOffset < viewStart + pad) return Math.max(0, tabOffset - pad);
  if (tabOffset + tabWidth > viewEnd - pad) {
    return Math.max(0, tabOffset + tabWidth - clientWidth + pad);
  }
  return null;
}
