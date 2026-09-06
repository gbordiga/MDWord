const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Ctrl/Cmd + wheel: negative deltaY zooms in. */
export function nextZoomFromWheel(zoom: number, deltaY: number, deltaMode = 0): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 800 : deltaY;
  const next = zoom * Math.exp(-pixels * 0.001);
  return clampZoom(next);
}
