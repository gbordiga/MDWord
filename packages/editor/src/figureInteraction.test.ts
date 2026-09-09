import { describe, expect, it } from "vitest";
import {
  beginFigureInteraction,
  endFigureInteraction,
  isFigureInteracting,
  onFigureIdle
} from "./figureInteraction";

describe("figure interaction", () => {
  it("tracks nested begin/end and notifies idle once", async () => {
    let idle = 0;
    const stop = onFigureIdle(() => {
      idle += 1;
    });
    beginFigureInteraction();
    beginFigureInteraction();
    expect(isFigureInteracting()).toBe(true);
    endFigureInteraction();
    expect(isFigureInteracting()).toBe(true);
    endFigureInteraction();
    expect(isFigureInteracting()).toBe(false);
    await Promise.resolve();
    expect(idle).toBe(1);
    stop();
  });
});
