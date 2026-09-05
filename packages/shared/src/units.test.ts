import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { formatLength, parseLength, toMm, isLength } from "./units";
import { headingSlug, normalizeDocPath, ensureMdExtension } from "./paths";

describe("units", () => {
  it("parses metric and imperial lengths", () => {
    expect(parseLength("20mm")).toEqual({ value: 20, unit: "mm" });
    expect(parseLength("2.54cm").unit).toBe("cm");
    expect(toMm("1in")).toBeCloseTo(25.4);
    expect(toMm("72pt")).toBeCloseTo(25.4);
  });

  it("rejects invalid lengths", () => {
    expect(isLength("20")).toBe(false);
    expect(isLength("20px")).toBe(false);
    expect(() => parseLength("20px")).toThrow();
  });

  it("round-trips generated lengths", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(1000), noNaN: true }),
        fc.constantFrom("mm", "cm", "in", "pt") as fc.Arbitrary<
          "mm" | "cm" | "in" | "pt"
        >,
        (value, unit) => {
          const formatted = formatLength(value, unit);
          const parsed = parseLength(formatted);
          expect(parsed.unit).toBe(unit);
          expect(parsed.value).toBeCloseTo(Number(value.toFixed(4)), 4);
        }
      )
    );
  });
});

describe("paths", () => {
  it("normalizes and blocks escape", () => {
    expect(normalizeDocPath("./a/../b/c.md")).toBe("b/c.md");
    expect(() => normalizeDocPath("../secret")).toThrow();
  });

  it("ensures md extension", () => {
    expect(ensureMdExtension("Doc")).toBe("Doc.md");
    expect(ensureMdExtension("Doc.md")).toBe("Doc.md");
  });

  it("slugs headings stably", () => {
    expect(headingSlug("Risultati Audit")).toBe("risultati-audit");
    expect(headingSlug("  Hello, World! ")).toBe("hello-world");
  });
});
