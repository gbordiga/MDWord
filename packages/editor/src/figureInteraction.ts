let active = 0;
const idleListeners = new Set<() => void>();

export function beginFigureInteraction(): void {
  active += 1;
}

export function endFigureInteraction(): void {
  active = Math.max(0, active - 1);
  if (active > 0) return;
  queueMicrotask(() => {
    if (active === 0) idleListeners.forEach((fn) => fn());
  });
}

export function isFigureInteracting(): boolean {
  return active > 0;
}

export function onFigureIdle(fn: () => void): () => void {
  idleListeners.add(fn);
  return () => {
    idleListeners.delete(fn);
  };
}
