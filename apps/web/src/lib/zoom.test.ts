import { describe, expect, it } from "vitest";
import { nextZoomFromWheel } from "./zoom";

describe("nextZoomFromWheel", () => {
  it("zooms in on wheel up and out on wheel down", () => {
    expect(nextZoomFromWheel(1, -100)).toBeGreaterThan(1);
    expect(nextZoomFromWheel(1, 100)).toBeLessThan(1);
  });

  it("stays within 50%–200%", () => {
    expect(nextZoomFromWheel(0.5, 800)).toBe(0.5);
    expect(nextZoomFromWheel(2, -800)).toBe(2);
  });
});
